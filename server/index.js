const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { execute, initDatabase } = require('./db');
const XLSX = require('xlsx');
const { parseExcelFile, parseWordFile, parseSwipeRecord } = require('./parser');
const { computeDailyAttendance, applyWeeklyOffForfeiture, formatHours, detectDailyFactoryShift, buildDailyShiftMap } = require('./rulesEngine');
const { calculateWorkerPayroll } = require('./payrollEngine');
const { parseNaturalLanguageRule } = require('./aiRuleEngine');
const { processUniversalAssistantPrompt } = require('./aiAssistantEngine');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Setup Multer for upload handling
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Helper: Fetch all settings as key-value map
async function getSettingsMap() {
  const rows = await execute(`SELECT key, value FROM settings`);
  const settings = {};
  rows.rows.forEach(r => {
    settings[r.key] = r.value;
  });
  return settings;
}

// Helper: Fetch active custom rules (timing-based)
async function getCustomRules() {
  const res = await execute(`SELECT * FROM custom_rules WHERE is_active = 1`);
  return res.rows || [];
}

// Helper: Fetch active custom salary rules (bonus/deduction)
async function getSalaryRules() {
  const res = await execute(`SELECT * FROM custom_salary_rules WHERE is_active = 1`);
  return res.rows || [];
}

// -------------------------------------------------------------
// REST API ROUTES
// -------------------------------------------------------------

// GET Custom Rules
app.get('/api/custom-rules', async (req, res) => {
  try {
    const result = await execute(`SELECT * FROM custom_rules ORDER BY id DESC`);
    res.json({ success: true, rules: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Create Custom Rule
app.post('/api/custom-rules', async (req, res) => {
  try {
    const {
      rule_name,
      rule_type,
      start_time = '',
      end_time = '',
      threshold_mins = 0,
      deduction_mins = 0,
      deduction_amount = 0,
    } = req.body;

    if (!rule_name || !rule_type) {
      return res.status(400).json({ success: false, error: 'rule_name and rule_type are required' });
    }

    await execute(
      `INSERT INTO custom_rules (rule_name, rule_type, start_time, end_time, threshold_mins, deduction_mins, deduction_amount, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        rule_name,
        rule_type,
        start_time,
        end_time,
        parseInt(threshold_mins, 10) || 0,
        parseInt(deduction_mins, 10) || 0,
        parseFloat(deduction_amount) || 0,
      ]
    );

    await recomputeAllAttendance();

    res.json({ success: true, message: 'Custom rule created and payroll recomputed.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Toggle Custom Rule Status
app.post('/api/custom-rules/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    await execute(`UPDATE custom_rules SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?`, [id]);
    await recomputeAllAttendance();
    res.json({ success: true, message: 'Rule status toggled & payroll recomputed.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE Custom Rule
app.delete('/api/custom-rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await execute(`DELETE FROM custom_rules WHERE id = ?`, [id]);
    await recomputeAllAttendance();
    res.json({ success: true, message: 'Custom rule deleted & payroll recomputed.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1. GET Settings
app.get('/api/settings', async (req, res) => {
  try {
    const result = await execute(`SELECT * FROM settings`);
    res.json({ success: true, settings: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. POST Settings (Update & Recompute)
app.post('/api/settings', async (req, res) => {
  try {
    const newSettings = req.body; // { shift_start: '08:30', ... }
    for (const [key, value] of Object.entries(newSettings)) {
      await execute(
        `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, String(value)]
      );
    }

    // Recompute all records with new settings
    await recomputeAllAttendance();

    res.json({ success: true, message: 'Settings updated & payroll recomputed.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Rule Profiles
app.get('/api/rule-profiles', async (req, res) => {
  try {
    const result = await execute(`SELECT * FROM rule_profiles ORDER BY id DESC`);
    res.json({ success: true, profiles: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Create Rule Profile
app.post('/api/rule-profiles', async (req, res) => {
  try {
    const {
      profile_name,
      shift_start = '08:00',
      shift_end = '16:30',
      grace_slab_minutes = 30,
      ot_multiplier = 1.5,
      ot_rounding = 'minutes',
      short_hours_threshold = 4.0,
      weekly_off_day = 'Sun',
      forfeiture_absent_threshold = 2,
      standard_month_days = '26',
    } = req.body;

    if (!profile_name) {
      return res.status(400).json({ success: false, error: 'profile_name is required' });
    }

    await execute(
      `INSERT INTO rule_profiles (profile_name, is_default, shift_start, shift_end, grace_slab_minutes, ot_multiplier, ot_rounding, short_hours_threshold, weekly_off_day, forfeiture_absent_threshold, standard_month_days)
       VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        profile_name,
        shift_start,
        shift_end,
        parseInt(grace_slab_minutes, 10) || 30,
        parseFloat(ot_multiplier) || 1.5,
        ot_rounding,
        parseFloat(short_hours_threshold) || 4.0,
        weekly_off_day,
        parseInt(forfeiture_absent_threshold, 10) || 2,
        String(standard_month_days),
      ]
    );

    res.json({ success: true, message: 'Custom rule profile created successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Activate Rule Profile
app.post('/api/rule-profiles/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;
    const profRes = await execute(`SELECT * FROM rule_profiles WHERE id = ?`, [id]);
    if (profRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Rule profile not found' });
    }

    const prof = profRes.rows[0];

    await execute(`UPDATE rule_profiles SET is_default = 0`);
    await execute(`UPDATE rule_profiles SET is_default = 1 WHERE id = ?`, [id]);

    const keysToCopy = {
      shift_start: prof.shift_start,
      shift_end: prof.shift_end,
      grace_slab_minutes: String(prof.grace_slab_minutes),
      ot_multiplier: String(prof.ot_multiplier),
      ot_rounding: prof.ot_rounding,
      short_hours_threshold: String(prof.short_hours_threshold),
      weekly_off_day: prof.weekly_off_day,
      forfeiture_absent_threshold: String(prof.forfeiture_absent_threshold),
      standard_month_days: String(prof.standard_month_days),
    };

    for (const [key, val] of Object.entries(keysToCopy)) {
      await execute(
        `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, val]
      );
    }

    await recomputeAllAttendance();

    res.json({ success: true, message: `Activated profile "${prof.profile_name}" & recomputed all attendance!` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE Rule Profile
app.delete('/api/rule-profiles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await execute(`DELETE FROM rule_profiles WHERE id = ? AND is_default = 0`, [id]);
    res.json({ success: true, message: 'Rule profile deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. POST Upload File (Auto-process and commit to DB)
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded.' });
  }

  const filePath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();

  try {
    let parsedWorkers = [];
    if (ext === '.xlsx' || ext === '.xls') {
      parsedWorkers = parseExcelFile(filePath);
    } else if (ext === '.docx' || ext === '.doc') {
      parsedWorkers = await parseWordFile(filePath);
    } else {
      return res.status(400).json({ success: false, error: 'Unsupported file format. Please upload .xlsx, .xls, .docx, or .doc' });
    }

    if (parsedWorkers.length === 0) {
      return res.status(400).json({ success: false, error: 'No worker punch records found in the uploaded file.' });
    }

    // Auto-commit data into DB directly on upload
    const batchId = `BATCH_${Date.now()}`;
    const settings = await getSettingsMap();
    const customRules = await getCustomRules();

    // Pre-calculate daily factory shift map across all uploaded records
    const allUploadedRecords = [];
    parsedWorkers.forEach(w => {
      (w.records || []).forEach(r => allUploadedRecords.push(r));
    });
    const dailyShiftMap = buildDailyShiftMap(allUploadedRecords, settings.shift_start || '08:00');

    let totalRecords = 0;
    let flaggedCount = 0;
    let datesSet = new Set();

    for (const worker of parsedWorkers) {
      // Upsert worker profile
      await execute(
        `INSERT INTO workers (staff_no, staff_name, department) VALUES (?, ?, ?)
         ON CONFLICT(staff_no) DO UPDATE SET staff_name = excluded.staff_name, department = excluded.department`,
        [worker.staff_no, worker.staff_name, worker.department || 'WORKER']
      );

      const sortedRecords = (worker.records || []).sort((a, b) => a.date.localeCompare(b.date));

      let dailyComputed = sortedRecords.map(r => {
        totalRecords++;
        if (r.date) datesSet.add(r.date);
        const { timestamps, isOdd } = parseSwipeRecord(r.swipe_record);
        if (isOdd) flaggedCount++;
        const dateShift = dailyShiftMap.get(r.date) || settings.shift_start || '08:00';
        const attendance = computeDailyAttendance(timestamps, settings, r.weekday, customRules, dateShift);
        return {
          staff_no: worker.staff_no,
          date: r.date,
          weekday: r.weekday,
          raw_swipes: r.swipe_record,
          machine_work_time: r.machine_work_time,
          ...attendance,
        };
      });

      dailyComputed = applyWeeklyOffForfeiture(dailyComputed, settings);

      for (const d of dailyComputed) {
        await execute(
          `INSERT INTO raw_punches (staff_no, date, weekday, swipe_record, machine_work_time, batch_id)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(staff_no, date) DO UPDATE SET swipe_record = excluded.swipe_record, machine_work_time = excluded.machine_work_time`,
          [
            d.staff_no || '',
            d.date || '',
            d.weekday || '',
            d.raw_swipes || '',
            d.machine_work_time || '',
            batchId
          ]
        );

        await execute(
          `INSERT INTO daily_attendance (staff_no, date, weekday, raw_swipes, effective_in, effective_out, regular_hours, ot_hours, sunday_ot_hours, total_hours, late_minutes, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(staff_no, date) DO UPDATE SET
             raw_swipes = excluded.raw_swipes,
             effective_in = excluded.effective_in,
             effective_out = excluded.effective_out,
             regular_hours = excluded.regular_hours,
             ot_hours = excluded.ot_hours,
             sunday_ot_hours = excluded.sunday_ot_hours,
             total_hours = excluded.total_hours,
             late_minutes = excluded.late_minutes,
             status = CASE WHEN is_manual_override = 1 THEN status ELSE excluded.status END`,
          [
            d.staff_no || '',
            d.date || '',
            d.weekday || '',
            d.raw_swipes || '',
            d.effectiveIn || '',
            d.effectiveOut || '',
            d.regularHours || 0,
            d.otHours || 0,
            d.sundayOtHours || 0,
            d.totalHours || 0,
            d.lateMinutes || 0,
            d.status || 'Absent'
          ]
        );
      }
    }

    const sortedDates = Array.from(datesSet).sort();
    const startDate = sortedDates[0] || '';
    const endDate = sortedDates[sortedDates.length - 1] || '';

    res.json({
      success: true,
      filename: req.file.originalname,
      workerCount: parsedWorkers.length,
      totalRecords,
      flaggedCount,
      startDate,
      endDate,
      parsedData: parsedWorkers,
      message: `Successfully processed and saved ${parsedWorkers.length} workers (${totalRecords} attendance records) to database!`,
    });
  } catch (err) {
    console.error('File Upload Parsing & Commit Error:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
  }
});

// 4. POST Commit Upload Data to DB (Fallback support)
app.post('/api/upload/commit', async (req, res) => {
  try {
    const { parsedData } = req.body;
    if (!parsedData || !Array.isArray(parsedData) || parsedData.length === 0) {
      return res.json({ success: true, message: 'Data already committed during upload.' });
    }

    const batchId = `BATCH_${Date.now()}`;
    const settings = await getSettingsMap();
    const customRules = await getCustomRules();

    // Pre-calculate daily factory shift map across all parsed records
    const allRecordsFlat = [];
    parsedData.forEach(w => {
      (w.records || []).forEach(r => allRecordsFlat.push(r));
    });
    const dailyShiftMap = buildDailyShiftMap(allRecordsFlat, settings.shift_start || '08:00');

    for (const worker of parsedData) {
      // Upsert worker profile
      await execute(
        `INSERT INTO workers (staff_no, staff_name, department) VALUES (?, ?, ?)
         ON CONFLICT(staff_no) DO UPDATE SET staff_name = excluded.staff_name, department = excluded.department`,
        [worker.staff_no, worker.staff_name, worker.department || 'WORKER']
      );

      // Sort worker daily records by date
      const sortedRecords = (worker.records || []).sort((a, b) => a.date.localeCompare(b.date));

      // Calculate initial attendance for each day
      let dailyComputed = sortedRecords.map(r => {
        const { timestamps } = parseSwipeRecord(r.swipe_record);
        const dateShift = dailyShiftMap.get(r.date) || settings.shift_start || '08:00';
        const attendance = computeDailyAttendance(timestamps, settings, r.weekday, customRules, dateShift);
        return {
          staff_no: worker.staff_no,
          date: r.date,
          weekday: r.weekday,
          raw_swipes: r.swipe_record,
          machine_work_time: r.machine_work_time,
          ...attendance,
        };
      });

      // Apply Sunday / Weekly Off Forfeiture logic
      dailyComputed = applyWeeklyOffForfeiture(dailyComputed, settings);

      // Save to raw_punches & daily_attendance DB
      for (const d of dailyComputed) {
        await execute(
          `INSERT INTO raw_punches (staff_no, date, weekday, swipe_record, machine_work_time, batch_id)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(staff_no, date) DO UPDATE SET swipe_record = excluded.swipe_record, machine_work_time = excluded.machine_work_time`,
          [
            d.staff_no || '',
            d.date || '',
            d.weekday || '',
            d.raw_swipes || '',
            d.machine_work_time || '',
            batchId
          ]
        );

        await execute(
          `INSERT INTO daily_attendance (staff_no, date, weekday, raw_swipes, effective_in, effective_out, regular_hours, ot_hours, sunday_ot_hours, total_hours, late_minutes, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(staff_no, date) DO UPDATE SET
             raw_swipes = excluded.raw_swipes,
             effective_in = excluded.effective_in,
             effective_out = excluded.effective_out,
             regular_hours = excluded.regular_hours,
             ot_hours = excluded.ot_hours,
             sunday_ot_hours = excluded.sunday_ot_hours,
             total_hours = excluded.total_hours,
             late_minutes = excluded.late_minutes,
             status = CASE WHEN is_manual_override = 1 THEN status ELSE excluded.status END`,
          [
            d.staff_no || '',
            d.date || '',
            d.weekday || '',
            d.raw_swipes || '',
            d.effectiveIn || '',
            d.effectiveOut || '',
            d.regularHours || 0,
            d.otHours || 0,
            d.sundayOtHours || 0,
            d.totalHours || 0,
            d.lateMinutes || 0,
            d.status || 'Absent'
          ]
        );
      }
    }

    res.json({ success: true, message: `Successfully committed ${parsedData.length} workers to database.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4.1 POST Clear Attendance Logs by Date Range or Month
app.post('/api/attendance/clear-range', async (req, res) => {
  try {
    const { startDate, endDate, month, clearAll } = req.body;

    let deleteWhere = '';
    let params = [];

    if (clearAll) {
      deleteWhere = '1=1';
    } else if (startDate && endDate) {
      deleteWhere = 'date >= ? AND date <= ?';
      params = [startDate, endDate];
    } else if (month) {
      // month formatted as 'YYYY-MM' (e.g. '2026-07')
      deleteWhere = 'date LIKE ?';
      params = [`${month}%`];
    } else {
      return res.status(400).json({ success: false, error: 'Please provide startDate & endDate or month string (YYYY-MM).' });
    }

    const countRes = await execute(`SELECT COUNT(*) as cnt FROM daily_attendance WHERE ${deleteWhere}`, params);
    const deletedCount = countRes.rows[0]?.cnt || 0;

    await execute(`DELETE FROM daily_attendance WHERE ${deleteWhere}`, params);
    await execute(`DELETE FROM raw_punches WHERE ${deleteWhere}`, params);

    res.json({
      success: true,
      message: `Cleared ${deletedCount} attendance records for the selected period.`,
      deletedCount
    });
  } catch (err) {
    console.error('Clear Attendance Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// Helper: Recompute all daily attendance with current settings
async function recomputeAllAttendance() {
  const settings = await getSettingsMap();
  const customRules = await getCustomRules();

  // Pre-calculate daily factory shift map across all raw punches
  const allPunchesRes = await execute(`SELECT date, swipe_record, raw_swipes FROM raw_punches`);
  let recordsForShiftMap = allPunchesRes.rows;
  if (!recordsForShiftMap || recordsForShiftMap.length === 0) {
    const dailyPunchesRes = await execute(`SELECT date, raw_swipes as swipe_record FROM daily_attendance`);
    recordsForShiftMap = dailyPunchesRes.rows;
  }
  const dailyShiftMap = buildDailyShiftMap(recordsForShiftMap, settings.shift_start || '08:00');

  const workersRes = await execute(`SELECT staff_no FROM workers`);

  for (const w of workersRes.rows) {
    const punchesRes = await execute(
      `SELECT * FROM raw_punches WHERE staff_no = ? ORDER BY date ASC`,
      [w.staff_no]
    );

    let recordsToCompute = punchesRes.rows;
    if (!recordsToCompute || recordsToCompute.length === 0) {
      const dailyRes = await execute(
        `SELECT staff_no, date, weekday, raw_swipes as swipe_record FROM daily_attendance WHERE staff_no = ? ORDER BY date ASC`,
        [w.staff_no]
      );
      recordsToCompute = dailyRes.rows;
    }

    let dailyComputed = recordsToCompute.map(r => {
      const { timestamps } = parseSwipeRecord(r.swipe_record || r.raw_swipes);
      const dateShift = dailyShiftMap.get(r.date) || settings.shift_start || '08:00';
      const attendance = computeDailyAttendance(timestamps, settings, r.weekday, customRules, dateShift);
      return {
        staff_no: w.staff_no,
        date: r.date,
        weekday: r.weekday,
        raw_swipes: r.swipe_record || r.raw_swipes,
        ...attendance,
      };
    });

    dailyComputed = applyWeeklyOffForfeiture(dailyComputed, settings);

    for (const d of dailyComputed) {
      await execute(
        `UPDATE daily_attendance SET
           effective_in = ?, effective_out = ?, regular_hours = ?, ot_hours = ?, sunday_ot_hours = ?, total_hours = ?, late_minutes = ?,
           status = CASE WHEN is_manual_override = 1 THEN status ELSE ? END
         WHERE staff_no = ? AND date = ?`,
        [
          d.effectiveIn || '',
          d.effectiveOut || '',
          d.regularHours || 0,
          d.otHours || 0,
          d.sundayOtHours || 0,
          d.totalHours || 0,
          d.lateMinutes || 0,
          d.status || 'Absent',
          d.staff_no,
          d.date
        ]
      );
    }
  }
}

// 4a. POST Recalculate All Attendance (Explicit trigger)
app.post('/api/attendance/recalculate', async (req, res) => {
  try {
    await recomputeAllAttendance();
    res.json({ success: true, message: 'All attendance records and overtime recomputed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4b. GET All Daily Attendance Records (for Dashboard Master Sheet)
app.get('/api/attendance/all', async (req, res) => {
  try {
    const result = await execute(`
      SELECT 
        d.*, 
        w.staff_name, 
        w.department 
      FROM daily_attendance d
      LEFT JOIN workers w ON d.staff_no = w.staff_no
      ORDER BY d.date DESC, CAST(d.staff_no AS INTEGER) ASC
    `);
    res.json({ success: true, records: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. GET All Workers & Payroll Summary (OPTIMIZED - Single Query Batch)
app.get('/api/workers', async (req, res) => {
  try {
    const settings = await getSettingsMap();
    const salaryRules = await getSalaryRules();

    // Batch fetch all data in parallel
    const [workersRes, allAttendanceRes, allAdvancesRes] = await Promise.all([
      execute(`SELECT * FROM workers ORDER BY CAST(staff_no AS INTEGER) ASC`),
      execute(`SELECT * FROM daily_attendance ORDER BY staff_no, date ASC`),
      execute(`SELECT * FROM advances ORDER BY staff_no, date DESC`)
    ]);

    // Index attendance and advances by staff_no for O(1) lookup
    const attendanceMap = new Map();
    const advancesMap = new Map();

    allAttendanceRes.rows.forEach(r => {
      if (!attendanceMap.has(r.staff_no)) attendanceMap.set(r.staff_no, []);
      attendanceMap.get(r.staff_no).push(r);
    });

    allAdvancesRes.rows.forEach(r => {
      if (!advancesMap.has(r.staff_no)) advancesMap.set(r.staff_no, []);
      advancesMap.get(r.staff_no).push(r);
    });

    // Compute payroll for all workers
    const resultList = workersRes.rows.map(w => {
      const dailyRecords = attendanceMap.get(w.staff_no) || [];
      const advances = advancesMap.get(w.staff_no) || [];

      const payroll = calculateWorkerPayroll({
        monthlySalary: w.monthly_salary,
        housingAllowance: w.housing_allowance,
        foodAllowance: w.food_allowance,
        otherAllowance: w.other_allowance,
        dailyRecords,
        advances,
        settings,
        salaryRules,
      });

      return {
        ...w,
        payroll,
        recordCount: dailyRecords.length,
      };
    });

    res.json({ success: true, workers: resultList });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. GET Single Worker Detail
app.get('/api/workers/:staff_no', async (req, res) => {
  try {
    const { staff_no } = req.params;
    const settings = await getSettingsMap();

    const workerRes = await execute(`SELECT * FROM workers WHERE staff_no = ?`, [staff_no]);
    if (workerRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Worker not found' });
    }
    const worker = workerRes.rows[0];

    const attRes = await execute(
      `SELECT * FROM daily_attendance WHERE staff_no = ? ORDER BY date ASC`,
      [staff_no]
    );

    const advRes = await execute(
      `SELECT * FROM advances WHERE staff_no = ? ORDER BY date DESC`,
      [staff_no]
    );

    const auditRes = await execute(
      `SELECT * FROM audit_logs WHERE staff_no = ? ORDER BY created_at DESC`,
      [staff_no]
    );

    const salaryRules = await getSalaryRules();
    const payroll = calculateWorkerPayroll({
      monthlySalary: worker.monthly_salary,
      housingAllowance: worker.housing_allowance,
      foodAllowance: worker.food_allowance,
      otherAllowance: worker.other_allowance,
      dailyRecords: attRes.rows,
      advances: advRes.rows,
      settings,
      salaryRules,
    });

    res.json({
      success: true,
      worker,
      dailyRecords: attRes.rows,
      advances: advRes.rows,
      auditLogs: auditRes.rows,
      payroll,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Worker Salary & Allowances (Compensation)
app.post('/api/workers/:staff_no/compensation', async (req, res) => {
  try {
    const { staff_no } = req.params;
    const { monthly_salary, housing_allowance, food_allowance, other_allowance } = req.body;

    await execute(
      `UPDATE workers SET 
         monthly_salary = ?, 
         housing_allowance = ?, 
         food_allowance = ?, 
         other_allowance = ? 
       WHERE staff_no = ?`,
      [
        parseFloat(monthly_salary) || 15000,
        parseFloat(housing_allowance) || 0,
        parseFloat(food_allowance) || 0,
        parseFloat(other_allowance) || 0,
        staff_no
      ]
    );

    res.json({ success: true, message: 'Worker base salary & allowances updated.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. POST Attendance Manual Edit & Audit Log
app.post('/api/attendance/edit', async (req, res) => {
  try {
    const { staff_no, date, raw_swipes, status, reason, edited_by } = req.body;
    if (!staff_no || !date) {
      return res.status(400).json({ success: false, error: 'staff_no and date are required.' });
    }

    const oldRes = await execute(
      `SELECT * FROM daily_attendance WHERE staff_no = ? AND date = ?`,
      [staff_no, date]
    );
    const oldRec = oldRes.rows[0] || {};

    const settings = await getSettingsMap();
    const customRules = await getCustomRules();
    const { timestamps } = parseSwipeRecord(raw_swipes || oldRec.raw_swipes);

    const datePunchesRes = await execute(`SELECT raw_swipes as swipe_record FROM daily_attendance WHERE date = ?`, [date]);
    const dateShift = detectDailyFactoryShift(
      (datePunchesRes.rows || []).map(r => parseSwipeRecord(r.swipe_record).timestamps[0]).filter(Boolean),
      settings.shift_start || '08:00'
    );

    const computed = computeDailyAttendance(timestamps, settings, oldRec.weekday, customRules, dateShift);
    const finalStatus = status || computed.status;

    // Log to Audit Table
    await execute(
      `INSERT INTO audit_logs (staff_no, date, field_changed, old_value, new_value, edited_by, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        staff_no,
        date,
        'Attendance Record',
        `Swipes: ${oldRec.raw_swipes || ''}, Status: ${oldRec.status || ''}`,
        `Swipes: ${raw_swipes || ''}, Status: ${finalStatus}`,
        edited_by || 'Admin',
        reason || 'Manual correction',
      ]
    );

    // Also update raw_punches
    await execute(
      `INSERT INTO raw_punches (staff_no, date, weekday, swipe_record)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(staff_no, date) DO UPDATE SET swipe_record = excluded.swipe_record`,
      [staff_no, date, oldRec.weekday || '', raw_swipes]
    );

    // Update Daily Attendance
    await execute(
      `UPDATE daily_attendance SET
         raw_swipes = ?, effective_in = ?, effective_out = ?, regular_hours = ?, ot_hours = ?, sunday_ot_hours = ?, total_hours = ?,
         late_minutes = ?, status = ?, is_manual_override = 1, override_reason = ?
       WHERE staff_no = ? AND date = ?`,
      [
        raw_swipes,
        computed.effectiveIn,
        computed.effectiveOut,
        computed.regularHours,
        computed.otHours,
        computed.sundayOtHours,
        computed.totalHours,
        computed.lateMinutes,
        finalStatus,
        reason || 'Manual correction',
        staff_no,
        date,
      ]
    );

    res.json({ success: true, message: 'Record updated and audit log saved.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. POST Advance Entry
app.post('/api/advances', async (req, res) => {
  try {
    const { staff_no, date, amount, note } = req.body;
    if (!staff_no || !amount) {
      return res.status(400).json({ success: false, error: 'staff_no and amount are required.' });
    }

    await execute(
      `INSERT INTO advances (staff_no, date, amount, note) VALUES (?, ?, ?, ?)`,
      [staff_no, date || new Date().toISOString().slice(0, 10), parseFloat(amount), note || '']
    );

    res.json({ success: true, message: 'Advance recorded.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Advance
app.delete('/api/advances/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await execute(`DELETE FROM advances WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Advance deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. GET Audit Logs
app.get('/api/audit-logs', async (req, res) => {
  try {
    const logsRes = await execute(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100`);
    res.json({ success: true, auditLogs: logsRes.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. GET Dashboard Metrics (OPTIMIZED - Parallel Batch Fetch)
app.get('/api/dashboard', async (req, res) => {
  try {
    const settings = await getSettingsMap();
    const salaryRules = await getSalaryRules();

    // Execute all count queries in parallel
    const [workersCountRes, recordsCountRes, incompleteRes, statusCountsRes, workersRes, allAttendanceRes, allAdvancesRes] = await Promise.all([
      execute(`SELECT COUNT(*) as cnt FROM workers`),
      execute(`SELECT COUNT(*) as cnt FROM daily_attendance`),
      execute(`SELECT COUNT(*) as cnt FROM daily_attendance WHERE status = 'Incomplete'`),
      execute(`SELECT status, COUNT(*) as cnt FROM daily_attendance GROUP BY status`),
      execute(`SELECT * FROM workers`),
      execute(`SELECT * FROM daily_attendance ORDER BY staff_no`),
      execute(`SELECT * FROM advances ORDER BY staff_no`)
    ]);

    const totalWorkers = workersCountRes.rows[0].cnt;
    const totalRecords = recordsCountRes.rows[0].cnt;
    const incompleteCount = incompleteRes.rows[0].cnt;

    const statusBreakdown = {};
    statusCountsRes.rows.forEach(r => { statusBreakdown[r.status] = r.cnt; });

    // Index attendance and advances by staff_no
    const attendanceMap = new Map();
    const advancesMap = new Map();

    allAttendanceRes.rows.forEach(r => {
      if (!attendanceMap.has(r.staff_no)) attendanceMap.set(r.staff_no, []);
      attendanceMap.get(r.staff_no).push(r);
    });

    allAdvancesRes.rows.forEach(r => {
      if (!advancesMap.has(r.staff_no)) advancesMap.set(r.staff_no, []);
      advancesMap.get(r.staff_no).push(r);
    });

    // Calculate total payroll in single pass
    let grandGross = 0;
    let grandAdvances = 0;
    let grandNet = 0;

    workersRes.rows.forEach(w => {
      const dailyRecords = attendanceMap.get(w.staff_no) || [];
      const advances = advancesMap.get(w.staff_no) || [];

      const p = calculateWorkerPayroll({
        monthlySalary: w.monthly_salary,
        housingAllowance: w.housing_allowance,
        foodAllowance: w.food_allowance,
        otherAllowance: w.other_allowance,
        dailyRecords,
        advances,
        settings,
        salaryRules,
      });

      grandGross += p.grossSalary;
      grandAdvances += p.totalAdvances;
      grandNet += p.netPayable;
    });

    res.json({
      success: true,
      metrics: {
        totalWorkers,
        totalRecords,
        incompleteCount,
        grandGross: +grandGross.toFixed(2),
        grandAdvances: +grandAdvances.toFixed(2),
        grandNet: +grandNet.toFixed(2),
        statusBreakdown,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. POST Google Sheets Live Sync (OPTIMIZED)
app.post('/api/google-sheets/sync', async (req, res) => {
  try {
    const { webhook_url } = req.body;
    if (!webhook_url) {
      return res.status(400).json({ success: false, error: 'Google Sheets Webhook URL is required.' });
    }

    const settings = await getSettingsMap();
    const salaryRules = await getSalaryRules();

    const [workersRes, allAttendanceRes, allAdvancesRes] = await Promise.all([
      execute(`SELECT * FROM workers ORDER BY CAST(staff_no AS INTEGER) ASC`),
      execute(`SELECT * FROM daily_attendance ORDER BY staff_no`),
      execute(`SELECT * FROM advances ORDER BY staff_no`)
    ]);

    const attendanceMap = new Map();
    const advancesMap = new Map();

    allAttendanceRes.rows.forEach(r => {
      if (!attendanceMap.has(r.staff_no)) attendanceMap.set(r.staff_no, []);
      attendanceMap.get(r.staff_no).push(r);
    });

    allAdvancesRes.rows.forEach(r => {
      if (!advancesMap.has(r.staff_no)) advancesMap.set(r.staff_no, []);
      advancesMap.get(r.staff_no).push(r);
    });

    const workerList = workersRes.rows.map(w => {
      const dailyRecords = attendanceMap.get(w.staff_no) || [];
      const advances = advancesMap.get(w.staff_no) || [];

      const payroll = calculateWorkerPayroll({
        monthlySalary: w.monthly_salary,
        housingAllowance: w.housing_allowance,
        foodAllowance: w.food_allowance,
        otherAllowance: w.other_allowance,
        dailyRecords,
        advances,
        settings,
        salaryRules,
      });

      return {
        staff_no: w.staff_no,
        staff_name: w.staff_name,
        department: w.department || 'WORKER',
        payroll,
      };
    });

    await fetch(webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workers: workerList }),
    });

    res.json({ success: true, message: `Successfully synced ${workerList.length} workers to Google Sheets!` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: Auto-fit Excel sheet columns
function formatAndAutoFitWorksheet(worksheet, dataAoA) {
  if (!worksheet || !Array.isArray(dataAoA) || dataAoA.length === 0) return;
  const colWidths = [];
  dataAoA.forEach(row => {
    if (!Array.isArray(row)) return;
    row.forEach((val, colIdx) => {
      const strVal = String(val !== null && val !== undefined ? val : '');
      const strLen = strVal.length;
      colWidths[colIdx] = Math.max(colWidths[colIdx] || 10, strLen + 4);
    });
  });
  worksheet['!cols'] = colWidths.map(w => ({ wch: Math.min(Math.max(w, 13), 45) }));
}

// 12. GET Export Full Factory Attendance & OT Excel Sheet (Clean & Formatted)
app.get('/api/export/excel', async (req, res) => {
  try {
    const settings = await getSettingsMap();
    const customRules = await getCustomRules();
    const workersRes = await execute(`SELECT * FROM workers ORDER BY CAST(staff_no AS INTEGER) ASC`);

    const summaryRows = [
      ['Staff No', 'Employee Name', 'Department', 'Full Present Days', 'Paid Sundays (Offs)', 'Absent Days', 'Payable Days', 'Regular Duty Hours (8h)', 'Weekday OT Hours', 'Sunday OT Hours ☀️', 'Total Overtime Hours 🔥', 'Total Worked Hours']
    ];

    const dailyRows = [
      ['Staff No', 'Employee Name', 'Date', 'Day', 'Raw Punches', 'Punch Pairs (IN ➔ OUT)', 'Effective IN', 'Effective OUT', 'Regular Duty (8h)', 'Weekday OT (Hrs)', 'Sunday OT (Hrs) ☀️', 'Total OT (Hrs) 🔥', 'Total Worked Hours', 'Late Mins', 'Attendance Status']
    ];

    for (const w of workersRes.rows) {
      const attRes = await execute(
        `SELECT * FROM daily_attendance WHERE staff_no = ? ORDER BY date ASC`,
        [w.staff_no]
      );
      const advRes = await execute(
        `SELECT * FROM advances WHERE staff_no = ? ORDER BY date DESC`,
        [w.staff_no]
      );

      const p = calculateWorkerPayroll({
        monthlySalary: w.monthly_salary,
        dailyRecords: attRes.rows,
        advances: advRes.rows,
        settings,
      });

      const regHours = +(p.totalWorkedHours - p.totalOtHours - p.totalSundayOtHours).toFixed(2);

      summaryRows.push([
        w.staff_no,
        w.staff_name,
        w.department || 'WORKER',
        p.fullPresentDays || 0,
        p.paidWeeklyOffs || 0,
        p.absentDays || 0,
        p.payableDays || 0,
        regHours,
        p.totalOtHours || 0,
        p.totalSundayOtHours || 0,
        +((p.totalOtHours || 0) + (p.totalSundayOtHours || 0)).toFixed(2),
        p.totalWorkedHours || 0,
      ]);

      attRes.rows.forEach(r => {
        const { timestamps } = parseSwipeRecord(r.raw_swipes);
        const computed = computeDailyAttendance(timestamps, settings, r.weekday, customRules);
        const totalOt = +((r.ot_hours || 0) + (r.sunday_ot_hours || 0)).toFixed(2);

        dailyRows.push([
          w.staff_no,
          w.staff_name,
          r.date,
          r.weekday || '',
          r.raw_swipes || '',
          computed.punchPairsFormatted || r.raw_swipes || '',
          r.effective_in || '—',
          r.effective_out || '—',
          r.regular_hours || 0,
          r.ot_hours || 0,
          r.sunday_ot_hours || 0,
          totalOt,
          r.total_hours || 0,
          r.late_minutes || 0,
          r.status || 'Absent',
        ]);
      });
    }

    const wb = XLSX.utils.book_new();

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    formatAndAutoFitWorksheet(wsSummary, summaryRows);

    const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows);
    formatAndAutoFitWorksheet(wsDaily, dailyRows);

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Monthly Attendance & OT');
    XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Punch Breakdown');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Factory_Attendance_and_Overtime_Report.xlsx"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12b. GET Export Dedicated All Employees Daily Biometric Timings Excel Sheet
app.get('/api/export/excel/timings', async (req, res) => {
  try {
    const settings = await getSettingsMap();
    const customRules = await getCustomRules();

    const result = await execute(`
      SELECT 
        d.*, 
        w.staff_name, 
        w.department 
      FROM daily_attendance d
      LEFT JOIN workers w ON d.staff_no = w.staff_no
      ORDER BY d.date DESC, CAST(d.staff_no AS INTEGER) ASC
    `);

    const dailyRows = [
      ['Staff No', 'Employee Name', 'Department', 'Date', 'Day', 'Raw Punches', 'Punch Pairs (IN ➔ OUT)', 'Effective IN', 'Effective OUT', 'Regular Duty (8h)', 'Weekday OT (Hrs)', 'Sunday OT (Hrs) ☀️', 'Total OT (Hrs) 🔥', 'Total Worked Hours', 'Late Minutes', 'Attendance Status']
    ];

    result.rows.forEach(r => {
      const { timestamps } = parseSwipeRecord(r.raw_swipes);
      const computed = computeDailyAttendance(timestamps, settings, r.weekday, customRules);
      const totalOt = +((r.ot_hours || 0) + (r.sunday_ot_hours || 0)).toFixed(2);

      dailyRows.push([
        r.staff_no,
        r.staff_name || 'WORKER',
        r.department || 'WORKER',
        r.date,
        r.weekday || '',
        r.raw_swipes || '',
        computed.punchPairsFormatted || r.raw_swipes || '',
        r.effective_in || '—',
        r.effective_out || '—',
        r.regular_hours || 0,
        r.ot_hours || 0,
        r.sunday_ot_hours || 0,
        totalOt,
        r.total_hours || 0,
        r.late_minutes || 0,
        r.status || 'Absent',
      ]);
    });

    const wb = XLSX.utils.book_new();
    const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows);
    formatAndAutoFitWorksheet(wsDaily, dailyRows);
    XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Biometric Timings');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="All_Employees_Daily_Biometric_Timings.xlsx"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. GET Export Single Worker Excel Sheet
app.get('/api/export/excel/worker/:staff_no', async (req, res) => {
  try {
    const { staff_no } = req.params;
    const settings = await getSettingsMap();

    const workerRes = await execute(`SELECT * FROM workers WHERE staff_no = ?`, [staff_no]);
    if (workerRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Worker not found' });
    }
    const w = workerRes.rows[0];

    const attRes = await execute(
      `SELECT * FROM daily_attendance WHERE staff_no = ? ORDER BY date ASC`,
      [staff_no]
    );
    const advRes = await execute(
      `SELECT * FROM advances WHERE staff_no = ? ORDER BY date DESC`,
      [staff_no]
    );

    const p = calculateWorkerPayroll({
      monthlySalary: w.monthly_salary,
      dailyRecords: attRes.rows,
      advances: advRes.rows,
      settings,
    });

    const summaryRows = [
      ['Staff No', 'Employee Name', 'Department', 'Full Present Days', 'Paid Sundays (Offs)', 'Absent Days', 'Payable Days', 'Regular Duty Hours (8h)', 'Weekday OT Hours', 'Sunday OT Hours ☀️', 'Total Overtime Hours 🔥', 'Total Worked Hours'],
      [w.staff_no, w.staff_name, w.department || 'WORKER', p.fullPresentDays || 0, p.paidWeeklyOffs || 0, p.absentDays || 0, p.payableDays || 0, +(p.totalWorkedHours - p.totalOtHours - p.totalSundayOtHours).toFixed(2), p.totalOtHours || 0, p.totalSundayOtHours || 0, +((p.totalOtHours || 0) + (p.totalSundayOtHours || 0)).toFixed(2), p.totalWorkedHours || 0]
    ];

    const dailyRows = [
      ['Date', 'Day', 'Raw Punches', 'Effective IN', 'Effective OUT', 'Regular Duty (8h)', 'Weekday OT (Hrs)', 'Sunday OT (Hrs) ☀️', 'Total OT (Hrs) 🔥', 'Total Worked Hours', 'Late Mins', 'Attendance Status']
    ];

    attRes.rows.forEach(r => {
      const totalOt = +((r.ot_hours || 0) + (r.sunday_ot_hours || 0)).toFixed(2);
      dailyRows.push([
        r.date,
        r.weekday || '',
        r.raw_swipes || '',
        r.effective_in || '—',
        r.effective_out || '—',
        r.regular_hours || 0,
        r.ot_hours || 0,
        r.sunday_ot_hours || 0,
        totalOt,
        r.total_hours || 0,
        r.late_minutes || 0,
        r.status || 'Absent',
      ]);
    });

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    formatAndAutoFitWorksheet(wsSummary, summaryRows);

    const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows);
    formatAndAutoFitWorksheet(wsDaily, dailyRows);

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Worker Summary');
    XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Biometric Swipes');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Worker_${staff_no}_${w.staff_name.replace(/\s+/g, '_')}_Attendance.xlsx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// CUSTOM SALARY RULES API
// -------------------------------------------------------------

// GET all salary rules
app.get('/api/salary-rules', async (req, res) => {
  try {
    const result = await execute(`SELECT * FROM custom_salary_rules ORDER BY id DESC`);
    res.json({ success: true, rules: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create salary rule (manual)
app.post('/api/salary-rules', async (req, res) => {
  try {
    const {
      rule_name,
      rule_type = 'bonus',
      condition_type = 'always',
      condition_value = '0',
      action_type = 'add_fixed',
      action_value = 0,
      applies_to_day = 'all',
      description = '',
      source = 'manual',
      ai_original_prompt = '',
    } = req.body;

    if (!rule_name) {
      return res.status(400).json({ success: false, error: 'rule_name is required' });
    }

    await execute(
      `INSERT INTO custom_salary_rules (rule_name, rule_type, condition_type, condition_value, action_type, action_value, applies_to_day, description, source, ai_original_prompt, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        rule_name,
        rule_type,
        condition_type,
        String(condition_value),
        action_type,
        parseFloat(action_value) || 0,
        applies_to_day,
        description,
        source,
        ai_original_prompt,
      ]
    );

    res.json({ success: true, message: `Salary rule "${rule_name}" created successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST toggle salary rule active/inactive
app.post('/api/salary-rules/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    await execute(`UPDATE custom_salary_rules SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Salary rule toggled.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE salary rule
app.delete('/api/salary-rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await execute(`DELETE FROM custom_salary_rules WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Salary rule deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// AI-POWERED RULES API (Gemini)
// -------------------------------------------------------------

// POST parse natural language rule using Gemini
app.post('/api/ai-rules/parse', async (req, res) => {
  try {
    const { prompt } = req.body;
    const settings = await getSettingsMap();
    const apiKey = settings.gemini_api_key;

    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'Gemini API key not configured. Go to Settings and add your API key.' });
    }

    const parsedRule = await parseNaturalLanguageRule(prompt, apiKey);
    res.json({ success: true, parsedRule });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST save AI-parsed rule
app.post('/api/ai-rules/save', async (req, res) => {
  try {
    const { parsedRule, originalPrompt } = req.body;
    if (!parsedRule || !parsedRule.rule_name) {
      return res.status(400).json({ success: false, error: 'Invalid parsed rule data.' });
    }

    await execute(
      `INSERT INTO custom_salary_rules (rule_name, rule_type, condition_type, condition_value, action_type, action_value, applies_to_day, description, source, ai_original_prompt, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ai_generated', ?, 1)`,
      [
        parsedRule.rule_name,
        parsedRule.rule_type || 'bonus',
        parsedRule.condition_type || 'always',
        String(parsedRule.condition_value || '0'),
        parsedRule.action_type || 'add_fixed',
        parseFloat(parsedRule.action_value) || 0,
        parsedRule.applies_to_day || 'all',
        parsedRule.description || '',
        originalPrompt || '',
      ]
    );

    res.json({ success: true, message: `AI-generated rule "${parsedRule.rule_name}" saved and activated!` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// UNIVERSAL AI ASSISTANT API
// -------------------------------------------------------------

app.post('/api/ai-assistant/execute', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, error: 'Please enter a prompt.' });
    }

    const settings = await getSettingsMap();
    const apiKey = settings.gemini_api_key || '';

    // OPTIMIZED: Batch fetch all data in parallel
    const [salaryRulesRes, workersRes, allAttendanceRes, allAdvancesRes] = await Promise.all([
      execute(`SELECT * FROM custom_salary_rules WHERE is_active = 1`),
      execute(`SELECT * FROM workers ORDER BY CAST(staff_no AS INTEGER) ASC`),
      execute(`SELECT * FROM daily_attendance ORDER BY staff_no, date ASC`),
      execute(`SELECT * FROM advances ORDER BY staff_no`)
    ]);

    const salaryRules = salaryRulesRes.rows;

    // Index attendance and advances by staff_no
    const attendanceMap = new Map();
    const advancesMap = new Map();

    allAttendanceRes.rows.forEach(r => {
      if (!attendanceMap.has(r.staff_no)) attendanceMap.set(r.staff_no, []);
      attendanceMap.get(r.staff_no).push(r);
    });

    allAdvancesRes.rows.forEach(r => {
      if (!advancesMap.has(r.staff_no)) advancesMap.set(r.staff_no, []);
      advancesMap.get(r.staff_no).push(r);
    });

    // Compute payroll for all workers
    const workerList = workersRes.rows.map(w => {
      const dailyRecords = attendanceMap.get(w.staff_no) || [];
      const advances = advancesMap.get(w.staff_no) || [];

      const payroll = calculateWorkerPayroll({
        monthlySalary: w.monthly_salary,
        housingAllowance: w.housing_allowance,
        foodAllowance: w.food_allowance,
        otherAllowance: w.other_allowance,
        dailyRecords,
        advances,
        settings,
        salaryRules,
      });

      return {
        ...w,
        payroll,
        dailyRecords,
      };
    });

    // Process prompt via Gemini
    const result = await processUniversalAssistantPrompt(prompt, apiKey, {
      workers: workerList,
      settings,
    });

    const { action, payload, reply } = result;
    let executionSummary = '';

    // Execute requested DB action if applicable
    if (action === 'UPDATE_SALARY' && payload && payload.staff_no) {
      const newSalary = parseFloat(payload.monthly_salary) || 15000;
      await execute(`UPDATE workers SET monthly_salary = ? WHERE staff_no = ?`, [newSalary, String(payload.staff_no)]);
      executionSummary = `Updated staff #${payload.staff_no} salary to ₹${newSalary}`;
    } 
    else if (action === 'ADD_ADVANCE' && payload && payload.staff_no && payload.amount) {
      await execute(
        `INSERT INTO advances (staff_no, date, amount, note) VALUES (?, ?, ?, ?)`,
        [
          String(payload.staff_no),
          payload.date || new Date().toISOString().slice(0, 10),
          parseFloat(payload.amount),
          payload.note || 'Recorded by Universal AI Assistant'
        ]
      );
      executionSummary = `Added advance ₹${payload.amount} for staff #${payload.staff_no}`;
    }
    else if (action === 'EDIT_ATTENDANCE' && payload && payload.staff_no && payload.date) {
      await execute(
        `UPDATE daily_attendance SET status = ?, is_manual_override = 1, override_reason = ? WHERE staff_no = ? AND date = ?`,
        [payload.status || 'Present (Full)', payload.reason || 'AI Correction', String(payload.staff_no), payload.date]
      );
      executionSummary = `Updated attendance for staff #${payload.staff_no} on ${payload.date} to ${payload.status}`;
    }
    else if (action === 'CREATE_SALARY_RULE' && payload && payload.rule_name) {
      await execute(
        `INSERT INTO custom_salary_rules (rule_name, rule_type, condition_type, condition_value, action_type, action_value, description, source, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ai_assistant', 1)`,
        [
          payload.rule_name,
          payload.rule_type || 'bonus',
          payload.condition_type || 'always',
          String(payload.condition_value || '0'),
          payload.action_type || 'add_fixed',
          parseFloat(payload.action_value) || 0,
          payload.description || '',
        ]
      );
      executionSummary = `Created salary rule "${payload.rule_name}"`;
    }
    else if (action === 'UPDATE_SETTINGS' && payload) {
      for (const [key, value] of Object.entries(payload)) {
        await execute(
          `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          [key, String(value)]
        );
      }
      await recomputeAllAttendance();
      executionSummary = `Updated factory settings`;
    }

    res.json({
      success: true,
      action,
      payload,
      reply: reply || `Executed: ${executionSummary}`,
      executionSummary,
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12b. POST AI Assistant - Generate Excel Report
app.post('/api/ai-assistant/generate-report', async (req, res) => {
  try {
    const { filterCriteria, reportTitle } = req.body;

    const settings = await getSettingsMap();
    const salaryRules = await getSalaryRules();

    const [workersRes, allAttendanceRes, allAdvancesRes] = await Promise.all([
      execute(`SELECT * FROM workers ORDER BY CAST(staff_no AS INTEGER) ASC`),
      execute(`SELECT * FROM daily_attendance ORDER BY staff_no, date ASC`),
      execute(`SELECT * FROM advances ORDER BY staff_no`)
    ]);

    const attendanceMap = new Map();
    const advancesMap = new Map();

    allAttendanceRes.rows.forEach(r => {
      if (!attendanceMap.has(r.staff_no)) attendanceMap.set(r.staff_no, []);
      attendanceMap.get(r.staff_no).push(r);
    });

    allAdvancesRes.rows.forEach(r => {
      if (!advancesMap.has(r.staff_no)) advancesMap.set(r.staff_no, []);
      advancesMap.get(r.staff_no).push(r);
    });

    // Compute payroll and apply filters
    const allWorkers = workersRes.rows.map(w => {
      const dailyRecords = attendanceMap.get(w.staff_no) || [];
      const advances = advancesMap.get(w.staff_no) || [];

      const payroll = calculateWorkerPayroll({
        monthlySalary: w.monthly_salary,
        housingAllowance: w.housing_allowance,
        foodAllowance: w.food_allowance,
        otherAllowance: w.other_allowance,
        dailyRecords,
        advances,
        settings,
        salaryRules,
      });

      return { ...w, payroll, dailyRecords };
    });

    // Apply filter criteria
    const filteredWorkers = allWorkers.filter(w => {
      const p = w.payroll;

      if (filterCriteria.absent_days_gt && p.absentDays <= filterCriteria.absent_days_gt) return false;
      if (filterCriteria.absent_days_gte && p.absentDays < filterCriteria.absent_days_gte) return false;
      if (filterCriteria.late_days_gt && p.shortDays <= filterCriteria.late_days_gt) return false;
      if (filterCriteria.ot_hours_gt && p.totalCombinedOtHours <= filterCriteria.ot_hours_gt) return false;
      if (filterCriteria.ot_hours_lt && p.totalCombinedOtHours >= filterCriteria.ot_hours_lt) return false;
      if (filterCriteria.sunday_worked_days_gt && p.sundayWorkedDays <= filterCriteria.sunday_worked_days_gt) return false;
      if (filterCriteria.net_pay_gt && p.netPayable <= filterCriteria.net_pay_gt) return false;
      if (filterCriteria.net_pay_lt && p.netPayable >= filterCriteria.net_pay_lt) return false;

      return true;
    });

    // Generate Excel Report
    const reportRows = [
      [reportTitle || 'AI Generated Worker Report'],
      [],
      ['Staff No', 'Name', 'Dept', 'Absent Days', 'Short/Late Days', 'Total OT Hours', 'Sunday OT', 'Sunday Worked Days', 'Gross Salary (₹)', 'Net Payable (₹)']
    ];

    filteredWorkers.forEach(w => {
      const p = w.payroll;
      reportRows.push([
        w.staff_no,
        w.staff_name,
        w.department || 'WORKER',
        p.absentDays || 0,
        p.shortDays || 0,
        p.totalCombinedOtHours || 0,
        p.totalSundayOtHours || 0,
        p.sundayWorkedDays || 0,
        p.grossSalary || 0,
        p.netPayable || 0
      ]);
    });

    reportRows.push([]);
    reportRows.push(['Total Workers Matched:', filteredWorkers.length]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(reportRows);
    formatAndAutoFitWorksheet(ws, reportRows);
    XLSX.utils.book_append_sheet(wb, ws, 'AI Report');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="AI_Report_${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// 404 handler for unmatched API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: `API endpoint ${req.method} ${req.originalUrl} not found` });
});

const distDir = path.join(__dirname, '../dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Global API Error Handler Middleware (Guarantees JSON response for API endpoints)
app.use((err, req, res, next) => {
  console.error('API Server Error:', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start Unified Server
const PORT = process.env.PORT || 5000;
initDatabase().then(async () => {
  try {
    await recomputeAllAttendance();
    console.log('✅ Startup Attendance Integrity Check: All attendance and OT verified with factory rules.');
  } catch (err) {
    console.warn('⚠️ Startup recompute warning:', err.message);
  }
  app.listen(PORT, () => {
    console.log(`🚀 Unified Factory HR (Frontend + Backend) running on Port ${PORT}: http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
});
