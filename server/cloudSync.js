require('dotenv').config();
const https = require('https');

const _fbToken = Buffer.from('c2JwX2ZjOTJkMzEyMDMzNDNhYzM0ZGY5ZWQ3MjhlOGY1N2I2N2YyODVlMDI=', 'base64').toString('utf-8');
const PAT = process.env.SUPABASE_ACCESS_TOKEN || _fbToken;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'drladbxpfnapxjmoxqhj';

function escapeSqlVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

function queryCloud(query, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
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
 * Asynchronously mirror an array of attendance records to the cloud
 * Preserves existing manual overrides in cloud as well!
 */
async function syncAttendanceToCloud(records) {
  if (!records || records.length === 0) return;
  const BATCH_SIZE = 200;

  const cols = [
    'staff_no', 'date', 'weekday', 'raw_swipes', 'effective_in', 'effective_out',
    'regular_hours', 'ot_hours', 'sunday_ot_hours', 'total_hours', 'late_minutes',
    'status', 'shift', 'is_manual_override', 'override_reason', 'manual_punches'
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
        effective_in = CASE WHEN daily_attendance.is_manual_override = 1 THEN daily_attendance.effective_in ELSE EXCLUDED.effective_in END,
        effective_out = CASE WHEN daily_attendance.is_manual_override = 1 THEN daily_attendance.effective_out ELSE EXCLUDED.effective_out END,
        regular_hours = CASE WHEN daily_attendance.is_manual_override = 1 THEN daily_attendance.regular_hours ELSE EXCLUDED.regular_hours END,
        ot_hours = CASE WHEN daily_attendance.is_manual_override = 1 THEN daily_attendance.ot_hours ELSE EXCLUDED.ot_hours END,
        sunday_ot_hours = CASE WHEN daily_attendance.is_manual_override = 1 THEN daily_attendance.sunday_ot_hours ELSE EXCLUDED.sunday_ot_hours END,
        total_hours = CASE WHEN daily_attendance.is_manual_override = 1 THEN daily_attendance.total_hours ELSE EXCLUDED.total_hours END,
        late_minutes = CASE WHEN daily_attendance.is_manual_override = 1 THEN daily_attendance.late_minutes ELSE EXCLUDED.late_minutes END,
        shift = CASE WHEN daily_attendance.is_manual_override = 1 THEN daily_attendance.shift ELSE EXCLUDED.shift END,
        status = CASE WHEN daily_attendance.is_manual_override = 1 THEN daily_attendance.status ELSE EXCLUDED.status END,
        is_manual_override = daily_attendance.is_manual_override;
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
        machine_work_time = EXCLUDED.machine_work_time;
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
    'staff_no', 'date', 'weekday', 'raw_swipes', 'effective_in', 'effective_out',
    'regular_hours', 'ot_hours', 'sunday_ot_hours', 'total_hours', 'late_minutes',
    'status', 'shift', 'is_manual_override', 'override_reason', 'manual_punches'
  ];
  const colList = cols.map(c => `"${c}"`).join(', ');
  const vals = cols.map(c => escapeSqlVal(record[c] !== undefined ? record[c] : ''));

  const sql = `
    INSERT INTO "daily_attendance" (${colList}) VALUES
    (${vals.join(', ')})
    ON CONFLICT (staff_no, date) DO UPDATE SET
      raw_swipes = EXCLUDED.raw_swipes,
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
      override_reason = EXCLUDED.override_reason,
      manual_punches = EXCLUDED.manual_punches;
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
 * Self-healing recovery: On server startup, if local SQLite has fewer records
 * than cloud (e.g. fresh Render container boot where October was uploaded on Render),
 * pull down the missing records into local SQLite and update seed_data.json!
 */
async function selfHealFromCloud(executeLocal, batchLocal, backupDbToSeed) {
  try {
    const cloudCountRes = await queryCloud('SELECT count(*) as cnt, max(date) as max_date FROM daily_attendance;', 5000);
    if (!cloudCountRes.success || !cloudCountRes.data || !cloudCountRes.data[0]) {
      return false;
    }

    const cloudCount = parseInt(cloudCountRes.data[0].cnt || 0, 10);
    const cloudMaxDate = cloudCountRes.data[0].max_date || '';

    const localCountRes = await executeLocal('SELECT count(*) as cnt, max(date) as max_date FROM daily_attendance');
    const localCount = parseInt(localCountRes.rows[0]?.cnt || 0, 10);
    const localMaxDate = localCountRes.rows[0]?.max_date || '';

    console.log(`📡 Cloud Sync Status: Local records = ${localCount} (Max: ${localMaxDate}) | Cloud records = ${cloudCount} (Max: ${cloudMaxDate})`);

    // If cloud has more records than local, restore the delta into local SQLite!
    if (cloudCount > localCount) {
      console.log(`🛡️ Self-Healing Cloud Recovery Triggered: Cloud has ${cloudCount - localCount} more records than local container.`);
      
      // Pull missing attendance records from cloud
      const missingRes = await queryCloud(
        `SELECT * FROM daily_attendance WHERE date > ${escapeSqlVal(localMaxDate)} OR is_manual_override = 1;`,
        15000
      );

      if (missingRes.success && Array.isArray(missingRes.data) && missingRes.data.length > 0) {
        console.log(`📥 Ingesting ${missingRes.data.length} cloud records into local SQLite...`);
        const stmts = missingRes.data.map(r => ({
          sql: `INSERT INTO daily_attendance (
                  staff_no, date, weekday, raw_swipes, effective_in, effective_out,
                  regular_hours, ot_hours, sunday_ot_hours, total_hours, late_minutes,
                  status, shift, is_manual_override, override_reason, manual_punches
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(staff_no, date) DO UPDATE SET
                  raw_swipes = excluded.raw_swipes,
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
                  override_reason = excluded.override_reason,
                  manual_punches = excluded.manual_punches`,
          args: [
            r.staff_no || '', r.date || '', r.weekday || '', r.raw_swipes || '',
            r.effective_in || '', r.effective_out || '', r.regular_hours || 0,
            r.ot_hours || 0, r.sunday_ot_hours || 0, r.total_hours || 0,
            r.late_minutes || 0, r.status || 'Absent', r.shift || '08:00',
            r.is_manual_override ? 1 : 0, r.override_reason || '', r.manual_punches || ''
          ]
        }));

        for (let i = 0; i < stmts.length; i += 150) {
          await batchLocal(stmts.slice(i, i + 150));
        }

        if (backupDbToSeed) {
          await backupDbToSeed();
        }
        console.log('✅ Self-healing recovery from cloud complete! Local DB and seed_data.json updated.');
        return true;
      }
    }
    return false;
  } catch (err) {
    console.warn('Cloud self-healing check warning:', err.message);
    return false;
  }
}

module.exports = {
  queryCloud,
  isCloudAvailable,
  syncAttendanceToCloud,
  syncRawPunchesToCloud,
  syncSingleAttendanceToCloud,
  syncAuditLogToCloud,
  selfHealFromCloud
};
