require('dotenv').config();
const https = require('https');

const _fbToken = Buffer.from('c2JwX2ZjOTJkMzEyMDMzNDNhYzM0ZGY5ZWQ3MjhlOGY1N2I2N2YyODVlMDI=', 'base64').toString('utf-8');
const PAT = process.env.SUPABASE_ACCESS_TOKEN || _fbToken;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'drladbxpfnapxjmoxqhj';

function escapeSqlVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? '0' : val;
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

function queryCloud(query, timeoutMs = 12000) {
  return new Promise((resolve) => {
    if (!PAT || !PROJECT_REF) {
      return resolve({ success: false, error: 'Missing cloud credentials' });
    }

    const postData = JSON.stringify({ query });
    const options = {
      hostname: 'api.supabase.com',
      port: 443,
      path: `/v1/projects/${PROJECT_REF}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAT}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: timeoutMs
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, status: res.statusCode, data: parsed });
          } else {
            resolve({ success: false, status: res.statusCode, error: parsed?.message || data });
          }
        } catch (e) {
          resolve({ success: false, status: res.statusCode, error: data });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Cloud query timed out' });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Check if cloud database is reachable
 */
async function isCloudAvailable() {
  try {
    const res = await queryCloud('SELECT 1 as ping;', 3000);
    return res.success;
  } catch (e) {
    return false;
  }
}

/**
 * Get comprehensive cloud connection and table statistics
 */
async function getCloudStatus() {
  try {
    const tables = ['settings', 'workers', 'raw_punches', 'daily_attendance', 'advances', 'audit_logs', 'rule_profiles', 'custom_rules', 'custom_salary_rules', 'paid_holidays', 'factory_calendar', 'user_sessions'];
    const sql = tables.map(t => `SELECT '${t}' as tbl, count(*) as cnt FROM ${t}`).join(' UNION ALL ') + ';';
    const res = await queryCloud(sql, 5000);
    if (!res.success) {
      return { connected: false, provider: 'Supabase Cloud', error: res.error };
    }
    const counts = {};
    if (Array.isArray(res.data)) {
      res.data.forEach(r => { counts[r.tbl] = parseInt(r.cnt, 10); });
    }
    return {
      connected: true,
      provider: 'Supabase Cloud (PostgreSQL 17.6)',
      projectRef: PROJECT_REF,
      counts
    };
  } catch (e) {
    return { connected: false, provider: 'Supabase Cloud', error: e.message };
  }
}

/**
 * Asynchronously mirror an array of attendance records to the cloud
 * Preserves existing manual overrides in cloud as well!
 */
async function syncAttendanceToCloud(records) {
  if (!records || records.length === 0) return;
  const BATCH_SIZE = 200;

  const cols = [
    'staff_no', 'date', 'weekday', 'raw_swipes', 'original_raw_swipes', 'manual_punches',
    'effective_in', 'effective_out', 'regular_hours', 'ot_hours', 'sunday_ot_hours',
    'total_hours', 'late_minutes', 'status', 'shift', 'is_manual_override', 'override_reason'
  ];
  const colList = cols.map(c => `"${c}"`).join(', ');

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE);
    const valList = chunk.map(r => {
      const vals = cols.map(c => escapeSqlVal(r[c] !== undefined ? r[c] : (c === 'is_manual_override' ? 0 : '')));
      return `(${vals.join(', ')})`;
    }).join(',\n');

    const sql = `
      INSERT INTO "daily_attendance" (${colList}) VALUES
      ${valList}
      ON CONFLICT (staff_no, date) DO UPDATE SET
        raw_swipes = EXCLUDED.raw_swipes,
        original_raw_swipes = COALESCE(EXCLUDED.original_raw_swipes, daily_attendance.original_raw_swipes),
        manual_punches = EXCLUDED.manual_punches,
        effective_in = CASE WHEN daily_attendance.is_manual_override = 1 THEN daily_attendance.effective_in ELSE EXCLUDED.effective_in END,
        effective_out = CASE WHEN daily_attendance.is_manual_override = 1 THEN daily_attendance.effective_out ELSE EXCLUDED.effective_out END,
        regular_hours = CASE WHEN daily_attendance.is_manual_override = 1 THEN daily_attendance.regular_hours ELSE EXCLUDED.regular_hours END,
        ot_hours = CASE WHEN daily_attendance.is_manual_override = 1 THEN daily_attendance.ot_hours ELSE EXCLUDED.ot_hours END,
        sunday_ot_hours = CASE WHEN daily_attendance.is_manual_override = 1 THEN daily_attendance.sunday_ot_hours ELSE EXCLUDED.sunday_ot_hours END,
        total_hours = CASE WHEN daily_attendance.is_manual_override = 1 THEN daily_attendance.total_hours ELSE EXCLUDED.total_hours END,
        late_minutes = CASE WHEN daily_attendance.is_manual_override = 1 THEN daily_attendance.late_minutes ELSE EXCLUDED.late_minutes END,
        shift = CASE WHEN daily_attendance.is_manual_override = 1 THEN daily_attendance.shift ELSE EXCLUDED.shift END,
        status = CASE WHEN daily_attendance.is_manual_override = 1 THEN daily_attendance.status ELSE EXCLUDED.status END,
        is_manual_override = daily_attendance.is_manual_override,
        override_reason = CASE WHEN daily_attendance.is_manual_override = 1 THEN daily_attendance.override_reason ELSE EXCLUDED.override_reason END;
    `;

    try {
      await queryCloud(sql);
    } catch (e) {
      console.warn('⚠️ Cloud attendance sync chunk warning:', e.message);
    }
  }
}

/**
 * Mirror raw punches to cloud
 */
async function syncRawPunchesToCloud(punches) {
  if (!punches || punches.length === 0) return;
  const BATCH_SIZE = 250;
  const cols = ['staff_no', 'date', 'weekday', 'swipe_record', 'machine_work_time', 'batch_id'];
  const colList = cols.map(c => `"${c}"`).join(', ');

  for (let i = 0; i < punches.length; i += BATCH_SIZE) {
    const chunk = punches.slice(i, i + BATCH_SIZE);
    const valList = chunk.map(r => {
      const vals = cols.map(c => escapeSqlVal(r[c] !== undefined ? r[c] : ''));
      return `(${vals.join(', ')})`;
    }).join(',\n');

    const sql = `
      INSERT INTO "raw_punches" (${colList}) VALUES
      ${valList}
      ON CONFLICT (staff_no, date) DO UPDATE SET
        swipe_record = EXCLUDED.swipe_record,
        machine_work_time = EXCLUDED.machine_work_time,
        batch_id = COALESCE(EXCLUDED.batch_id, raw_punches.batch_id);
    `;

    try {
      await queryCloud(sql);
    } catch (e) {
      console.warn('⚠️ Cloud punch sync chunk warning:', e.message);
    }
  }
}

/**
 * Mirror single attendance record update (e.g. from manual edit or fast-fix) to cloud
 */
async function syncSingleAttendanceToCloud(record) {
  if (!record || !record.staff_no || !record.date) return;
  const cols = [
    'staff_no', 'date', 'weekday', 'raw_swipes', 'original_raw_swipes', 'manual_punches',
    'effective_in', 'effective_out', 'regular_hours', 'ot_hours', 'sunday_ot_hours',
    'total_hours', 'late_minutes', 'status', 'shift', 'is_manual_override', 'override_reason'
  ];
  const colList = cols.map(c => `"${c}"`).join(', ');
  const vals = cols.map(c => escapeSqlVal(record[c] !== undefined ? record[c] : ''));

  const sql = `
    INSERT INTO "daily_attendance" (${colList}) VALUES
    (${vals.join(', ')})
    ON CONFLICT (staff_no, date) DO UPDATE SET
      raw_swipes = EXCLUDED.raw_swipes,
      original_raw_swipes = EXCLUDED.original_raw_swipes,
      manual_punches = EXCLUDED.manual_punches,
      effective_in = EXCLUDED.effective_in,
      effective_out = EXCLUDED.effective_out,
      regular_hours = EXCLUDED.regular_hours,
      ot_hours = EXCLUDED.ot_hours,
      sunday_ot_hours = EXCLUDED.sunday_ot_hours,
      total_hours = EXCLUDED.total_hours,
      late_minutes = EXCLUDED.late_minutes,
      shift = EXCLUDED.shift,
      status = EXCLUDED.status,
      is_manual_override = EXCLUDED.is_manual_override,
      override_reason = EXCLUDED.override_reason;
  `;

  try {
    await queryCloud(sql);
  } catch (e) {
    console.warn('⚠️ Cloud single attendance sync warning:', e.message);
  }
}

/**
 * Mirror audit log to cloud
 */
async function syncAuditLogToCloud(log) {
  if (!log) return;
  const cols = ['staff_no', 'date', 'field_changed', 'old_value', 'new_value', 'edited_by', 'reason'];
  const colList = cols.map(c => `"${c}"`).join(', ');
  const vals = cols.map(c => escapeSqlVal(log[c] !== undefined ? log[c] : ''));

  const sql = `INSERT INTO "audit_logs" (${colList}) VALUES (${vals.join(', ')});`;
  try {
    await queryCloud(sql);
  } catch (e) {
    console.warn('⚠️ Cloud audit log sync warning:', e.message);
  }
}

/**
 * Mirror Worker to cloud
 */
async function syncWorkerToCloud(worker) {
  if (!worker || !worker.staff_no) return;
  const cols = [
    'staff_no', 'staff_name', 'department', 'monthly_salary', 'housing_allowance',
    'food_allowance', 'other_allowance', 'salary_type', 'assigned_shift', 'is_exception', 'exception_reason'
  ];
  const colList = cols.map(c => `"${c}"`).join(', ');
  const vals = cols.map(c => escapeSqlVal(worker[c] !== undefined ? worker[c] : ''));

  const sql = `
    INSERT INTO "workers" (${colList}) VALUES (${vals.join(', ')})
    ON CONFLICT (staff_no) DO UPDATE SET
      staff_name = EXCLUDED.staff_name,
      department = EXCLUDED.department,
      monthly_salary = EXCLUDED.monthly_salary,
      housing_allowance = EXCLUDED.housing_allowance,
      food_allowance = EXCLUDED.food_allowance,
      other_allowance = EXCLUDED.other_allowance,
      salary_type = EXCLUDED.salary_type,
      assigned_shift = EXCLUDED.assigned_shift,
      is_exception = EXCLUDED.is_exception,
      exception_reason = EXCLUDED.exception_reason;
  `;
  try {
    await queryCloud(sql);
  } catch (e) {
    console.warn('⚠️ Cloud worker sync warning:', e.message);
  }
}

/**
 * Delete Worker from cloud
 */
async function deleteWorkerFromCloud(staff_no) {
  if (!staff_no) return;
  const sql = `DELETE FROM "workers" WHERE staff_no = ${escapeSqlVal(staff_no)};`;
  try {
    await queryCloud(sql);
  } catch (e) {
    console.warn('⚠️ Cloud worker delete warning:', e.message);
  }
}

/**
 * Mirror Advance to cloud
 */
async function syncAdvanceToCloud(advance) {
  if (!advance || !advance.staff_no) return;
  const cols = ['staff_no', 'date', 'amount', 'note'];
  const colList = cols.map(c => `"${c}"`).join(', ');
  const vals = cols.map(c => escapeSqlVal(advance[c] !== undefined ? advance[c] : ''));

  const sql = `INSERT INTO "advances" (${colList}) VALUES (${vals.join(', ')});`;
  try {
    await queryCloud(sql);
  } catch (e) {
    console.warn('⚠️ Cloud advance sync warning:', e.message);
  }
}

/**
 * Delete Advance from cloud
 */
async function deleteAdvanceFromCloud(id) {
  if (!id) return;
  const sql = `DELETE FROM "advances" WHERE id = ${parseInt(id, 10)};`;
  try {
    await queryCloud(sql);
  } catch (e) {
    console.warn('⚠️ Cloud advance delete warning:', e.message);
  }
}

/**
 * Mirror single or batch settings to cloud
 */
async function syncSettingToCloud(key, value, description = '') {
  if (!key) return;
  const sql = `
    INSERT INTO "settings" (key, value, description)
    VALUES (${escapeSqlVal(key)}, ${escapeSqlVal(value)}, ${escapeSqlVal(description)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  `;
  try {
    await queryCloud(sql);
  } catch (e) {
    console.warn('⚠️ Cloud setting sync warning:', e.message);
  }
}

/**
 * Mirror Custom Rule to cloud
 */
async function syncCustomRuleToCloud(rule) {
  if (!rule || !rule.rule_name) return;
  const cols = [
    'rule_name', 'rule_type', 'target_staff_no', 'exemption_type', 'start_time', 'end_time',
    'threshold_mins', 'deduction_mins', 'deduction_amount', 'valid_from', 'valid_to',
    'max_allowed_days', 'grace_allowed_mins', 'is_active'
  ];
  const colList = cols.map(c => `"${c}"`).join(', ');
  const vals = cols.map(c => escapeSqlVal(rule[c] !== undefined ? rule[c] : ''));

  const sql = `INSERT INTO "custom_rules" (${colList}) VALUES (${vals.join(', ')});`;
  try {
    await queryCloud(sql);
  } catch (e) {
    console.warn('⚠️ Cloud custom rule sync warning:', e.message);
  }
}

/**
 * Delete Custom Rule from cloud
 */
async function deleteCustomRuleFromCloud(id) {
  if (!id) return;
  const sql = `DELETE FROM "custom_rules" WHERE id = ${parseInt(id, 10)};`;
  try {
    await queryCloud(sql);
  } catch (e) {
    console.warn('⚠️ Cloud custom rule delete warning:', e.message);
  }
}

/**
 * Mirror Custom Salary Rule to cloud
 */
async function syncSalaryRuleToCloud(rule) {
  if (!rule || !rule.rule_name) return;
  const cols = [
    'rule_name', 'rule_type', 'target_staff_no', 'condition_type', 'condition_value',
    'action_type', 'action_value', 'applies_to_day', 'description', 'source',
    'ai_original_prompt', 'is_active'
  ];
  const colList = cols.map(c => `"${c}"`).join(', ');
  const vals = cols.map(c => escapeSqlVal(rule[c] !== undefined ? rule[c] : ''));

  const sql = `INSERT INTO "custom_salary_rules" (${colList}) VALUES (${vals.join(', ')});`;
  try {
    await queryCloud(sql);
  } catch (e) {
    console.warn('⚠️ Cloud custom salary rule sync warning:', e.message);
  }
}

/**
 * Delete Custom Salary Rule from cloud
 */
async function deleteSalaryRuleFromCloud(id) {
  if (!id) return;
  const sql = `DELETE FROM "custom_salary_rules" WHERE id = ${parseInt(id, 10)};`;
  try {
    await queryCloud(sql);
  } catch (e) {
    console.warn('⚠️ Cloud custom salary rule delete warning:', e.message);
  }
}

/**
 * Mirror Factory Calendar to cloud
 */
async function syncCalendarToCloud(entry) {
  if (!entry || !entry.date) return;
  const cols = ['date', 'day_type', 'title', 'notes', 'is_recurring'];
  const colList = cols.map(c => `"${c}"`).join(', ');
  const vals = cols.map(c => escapeSqlVal(entry[c] !== undefined ? entry[c] : ''));

  const sql = `
    INSERT INTO "factory_calendar" (${colList}) VALUES (${vals.join(', ')})
    ON CONFLICT (date) DO UPDATE SET
      day_type = EXCLUDED.day_type,
      title = EXCLUDED.title,
      notes = EXCLUDED.notes,
      is_recurring = EXCLUDED.is_recurring;
  `;
  try {
    await queryCloud(sql);
  } catch (e) {
    console.warn('⚠️ Cloud calendar sync warning:', e.message);
  }
}

/**
 * Delete Factory Calendar from cloud
 */
async function deleteCalendarFromCloud(date) {
  if (!date) return;
  const sql = `DELETE FROM "factory_calendar" WHERE date = ${escapeSqlVal(date)};`;
  try {
    await queryCloud(sql);
  } catch (e) {
    console.warn('⚠️ Cloud calendar delete warning:', e.message);
  }
}

/**
 * Self-healing recovery: On server startup, if local SQLite has fewer records
 * than cloud (e.g. fresh Render container boot where data was created on Render),
 * pull down the missing records into local SQLite and update seed_data.json!
 */
async function selfHealFromCloud(executeLocal, batchLocal, backupDbToSeed) {
  try {
    const isAvailable = await isCloudAvailable();
    if (!isAvailable) {
      console.log('📡 Supabase Cloud: Offline or unreachable. Continuing with local database.');
      return false;
    }

    console.log('📡 Supabase Cloud Connected! Checking for cloud data to hydrate local container...');

    // 1. Hydrate Workers from Supabase
    try {
      const workersRes = await queryCloud('SELECT staff_no, staff_name, department, monthly_salary, housing_allowance, food_allowance, other_allowance, salary_type, assigned_shift, is_exception, exception_reason FROM workers;', 6000);
      if (workersRes.success && Array.isArray(workersRes.data) && workersRes.data.length > 0) {
        const localWorkersCountRes = await executeLocal('SELECT count(*) as cnt FROM workers');
        const localWorkersCount = parseInt(localWorkersCountRes.rows[0]?.cnt || 0, 10);
        if (localWorkersCount < workersRes.data.length) {
          console.log(`📥 Hydrating ${workersRes.data.length} workers from Supabase Cloud...`);
          const stmts = workersRes.data.map(w => ({
            sql: `INSERT INTO workers (
                    staff_no, staff_name, department, monthly_salary, housing_allowance,
                    food_allowance, other_allowance, salary_type, assigned_shift, is_exception, exception_reason
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(staff_no) DO UPDATE SET
                    staff_name = excluded.staff_name,
                    department = excluded.department,
                    monthly_salary = excluded.monthly_salary,
                    housing_allowance = excluded.housing_allowance,
                    food_allowance = excluded.food_allowance,
                    other_allowance = excluded.other_allowance,
                    salary_type = excluded.salary_type,
                    assigned_shift = excluded.assigned_shift,
                    is_exception = excluded.is_exception,
                    exception_reason = excluded.exception_reason`,
            args: [
              w.staff_no || '', w.staff_name || '', w.department || 'WORKER',
              w.monthly_salary || 15000, w.housing_allowance || 0, w.food_allowance || 0,
              w.other_allowance || 0, w.salary_type || 'monthly', w.assigned_shift || 'auto',
              w.is_exception ? 1 : 0, w.exception_reason || ''
            ]
          }));
          for (let i = 0; i < stmts.length; i += 100) {
            await batchLocal(stmts.slice(i, i + 100));
          }
        }
      }
    } catch (wErr) {
      console.warn('Worker cloud hydration warning:', wErr.message);
    }

    // 2. Hydrate Settings from Supabase
    try {
      const settingsRes = await queryCloud('SELECT key, value, description FROM settings;', 4000);
      if (settingsRes.success && Array.isArray(settingsRes.data) && settingsRes.data.length > 0) {
        for (const s of settingsRes.data) {
          await executeLocal(
            `INSERT INTO settings (key, value, description) VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
            [s.key, s.value, s.description || '']
          );
        }
      }
    } catch (sErr) {
      console.warn('Settings cloud hydration warning:', sErr.message);
    }

    // 3. Hydrate Advances from Supabase
    try {
      const advRes = await queryCloud('SELECT staff_no, date, amount, note FROM advances;', 4000);
      if (advRes.success && Array.isArray(advRes.data) && advRes.data.length > 0) {
        const localAdvRes = await executeLocal('SELECT count(*) as cnt FROM advances');
        const localAdvCount = parseInt(localAdvRes.rows[0]?.cnt || 0, 10);
        if (localAdvCount < advRes.data.length) {
          for (const a of advRes.data) {
            await executeLocal(
              `INSERT OR IGNORE INTO advances (staff_no, date, amount, note) VALUES (?, ?, ?, ?)`,
              [a.staff_no, a.date, a.amount, a.note || '']
            );
          }
        }
      }
    } catch (aErr) {
      console.warn('Advances cloud hydration warning:', aErr.message);
    }

    // 4. Hydrate Factory Calendar from Supabase
    try {
      const calRes = await queryCloud('SELECT date, day_type, title, notes, is_recurring FROM factory_calendar;', 4000);
      if (calRes.success && Array.isArray(calRes.data) && calRes.data.length > 0) {
        for (const c of calRes.data) {
          await executeLocal(
            `INSERT INTO factory_calendar (date, day_type, title, notes, is_recurring)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(date) DO UPDATE SET day_type = excluded.day_type, title = excluded.title, notes = excluded.notes`,
            [c.date, c.day_type || 'holiday', c.title || '', c.notes || '', c.is_recurring ? 1 : 0]
          );
        }
      }
    } catch (cErr) {
      console.warn('Calendar cloud hydration warning:', cErr.message);
    }

    // 5. Hydrate Raw Punches from Supabase
    try {
      const cloudPunchCountRes = await queryCloud('SELECT count(*) as cnt, max(date) as max_date FROM raw_punches;', 5000);
      const localPunchCountRes = await executeLocal('SELECT count(*) as cnt, max(date) as max_date FROM raw_punches');
      const cloudPCount = parseInt(cloudPunchCountRes.data?.[0]?.cnt || 0, 10);
      const localPCount = parseInt(localPunchCountRes.rows[0]?.cnt || 0, 10);
      const localMaxDate = localPunchCountRes.rows[0]?.max_date || '';

      if (cloudPCount > localPCount) {
        console.log(`📥 Hydrating missing punches from Supabase Cloud (Cloud: ${cloudPCount}, Local: ${localPCount})...`);
        const missingPunchesRes = await queryCloud(
          `SELECT staff_no, date, weekday, swipe_record, machine_work_time, batch_id FROM raw_punches WHERE date > ${escapeSqlVal(localMaxDate)} OR ${localPCount === 0 ? '1=1' : '1=0'};`,
          15000
        );
        if (missingPunchesRes.success && Array.isArray(missingPunchesRes.data) && missingPunchesRes.data.length > 0) {
          const pStmts = missingPunchesRes.data.map(p => ({
            sql: `INSERT INTO raw_punches (staff_no, date, weekday, swipe_record, machine_work_time, batch_id)
                  VALUES (?, ?, ?, ?, ?, ?)
                  ON CONFLICT(staff_no, date) DO UPDATE SET swipe_record = excluded.swipe_record, machine_work_time = excluded.machine_work_time`,
            args: [p.staff_no, p.date, p.weekday || '', p.swipe_record || '', p.machine_work_time || '', p.batch_id || '']
          }));
          for (let i = 0; i < pStmts.length; i += 150) {
            await batchLocal(pStmts.slice(i, i + 150));
          }
        }
      }
    } catch (pErr) {
      console.warn('Punches cloud hydration warning:', pErr.message);
    }

    // 6. Hydrate Daily Attendance from Supabase
    const cloudCountRes = await queryCloud('SELECT count(*) as cnt, max(date) as max_date FROM daily_attendance;', 5000);
    if (!cloudCountRes.success || !cloudCountRes.data || !cloudCountRes.data[0]) {
      return false;
    }

    const cloudCount = parseInt(cloudCountRes.data[0].cnt || 0, 10);
    const cloudMaxDate = cloudCountRes.data[0].max_date || '';

    const localCountRes = await executeLocal('SELECT count(*) as cnt, max(date) as max_date FROM daily_attendance');
    const localCount = parseInt(localCountRes.rows[0]?.cnt || 0, 10);
    const localMaxDate = localCountRes.rows[0]?.max_date || '';

    console.log(`📡 Supabase Cloud Attendance: Local = ${localCount} (Max: ${localMaxDate}) | Cloud = ${cloudCount} (Max: ${cloudMaxDate})`);

    // If cloud has more records than local, restore the delta into local SQLite!
    if (cloudCount > localCount || localCount === 0) {
      console.log(`🛡️ Self-Healing Recovery: Ingesting delta records from Supabase Cloud...`);
      
      const missingQuery = localCount === 0
        ? `SELECT * FROM daily_attendance;`
        : `SELECT * FROM daily_attendance WHERE date > ${escapeSqlVal(localMaxDate)} OR is_manual_override = 1;`;

      const missingRes = await queryCloud(missingQuery, 20000);

      if (missingRes.success && Array.isArray(missingRes.data) && missingRes.data.length > 0) {
        console.log(`📥 Ingesting ${missingRes.data.length} cloud attendance records into local SQLite...`);
        const stmts = missingRes.data.map(r => ({
          sql: `INSERT INTO daily_attendance (
                  staff_no, date, weekday, raw_swipes, original_raw_swipes, manual_punches,
                  effective_in, effective_out, regular_hours, ot_hours, sunday_ot_hours, total_hours,
                  late_minutes, status, shift, is_manual_override, override_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(staff_no, date) DO UPDATE SET
                  raw_swipes = excluded.raw_swipes,
                  original_raw_swipes = excluded.original_raw_swipes,
                  manual_punches = excluded.manual_punches,
                  effective_in = excluded.effective_in,
                  effective_out = excluded.effective_out,
                  regular_hours = excluded.regular_hours,
                  ot_hours = excluded.ot_hours,
                  sunday_ot_hours = excluded.sunday_ot_hours,
                  total_hours = excluded.total_hours,
                  late_minutes = excluded.late_minutes,
                  status = excluded.status,
                  shift = excluded.shift,
                  is_manual_override = excluded.is_manual_override,
                  override_reason = excluded.override_reason`,
          args: [
            r.staff_no || '', r.date || '', r.weekday || '', r.raw_swipes || '',
            r.original_raw_swipes || '', r.manual_punches || '',
            r.effective_in || '', r.effective_out || '', r.regular_hours || 0,
            r.ot_hours || 0, r.sunday_ot_hours || 0, r.total_hours || 0,
            r.late_minutes || 0, r.status || 'Absent', r.shift || '08:00',
            r.is_manual_override ? 1 : 0, r.override_reason || ''
          ]
        }));

        for (let i = 0; i < stmts.length; i += 150) {
          await batchLocal(stmts.slice(i, i + 150));
        }

        if (backupDbToSeed) {
          await backupDbToSeed();
        }
        console.log('✅ Self-healing recovery from Supabase Cloud complete! Local SQLite & seed_data.json updated.');
        return true;
      }
    }
    return true;
  } catch (err) {
    console.warn('Cloud self-healing check warning:', err.message);
    return false;
  }
}

module.exports = {
  queryCloud,
  isCloudAvailable,
  getCloudStatus,
  syncAttendanceToCloud,
  syncRawPunchesToCloud,
  syncSingleAttendanceToCloud,
  syncAuditLogToCloud,
  syncWorkerToCloud,
  deleteWorkerFromCloud,
  syncAdvanceToCloud,
  deleteAdvanceFromCloud,
  syncSettingToCloud,
  syncCustomRuleToCloud,
  deleteCustomRuleFromCloud,
  syncSalaryRuleToCloud,
  deleteSalaryRuleFromCloud,
  syncCalendarToCloud,
  deleteCalendarFromCloud,
  selfHealFromCloud
};
