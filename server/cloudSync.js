require('dotenv').config();
const { execute } = require('./db');

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'drladbxpfnapxjmoxqhj';
const DB_SCHEMA = process.env.DB_SCHEMA || 'public';

/**
 * Direct cloud query wrapper delegating to primary Supabase database execution
 */
async function queryCloud(query) {
  try {
    const res = await execute(query);
    return { success: true, data: res.rows };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Execute Cloud Query with retry
 */
async function executeCloudWithRetry(sql) {
  try {
    const res = await execute(sql);
    return { success: true, data: res.rows };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Calibrate cloud sequences
 */
async function calibrateCloudSequences() {
  const seqTables = [
    { seq: 'daily_attendance_id_seq', tbl: 'daily_attendance' },
    { seq: 'raw_punches_id_seq', tbl: 'raw_punches' },
    { seq: 'audit_logs_id_seq', tbl: 'audit_logs' },
    { seq: 'workers_id_seq', tbl: 'workers' },
    { seq: 'advances_id_seq', tbl: 'advances' },
    { seq: 'rule_profiles_id_seq', tbl: 'rule_profiles' },
    { seq: 'custom_rules_id_seq', tbl: 'custom_rules' },
    { seq: 'custom_salary_rules_id_seq', tbl: 'custom_salary_rules' },
    { seq: 'paid_holidays_id_seq', tbl: 'paid_holidays' },
    { seq: 'factory_calendar_id_seq', tbl: 'factory_calendar' }
  ];
  for (const t of seqTables) {
    try {
      await execute(`SELECT setval('${t.seq}', (SELECT COALESCE(MAX(id), 0) + 1 FROM "${t.tbl}"), false);`);
    } catch (e) {}
  }
}

/**
 * Check if cloud database is reachable
 */
async function isCloudAvailable() {
  try {
    const res = await execute('SELECT 1 as ping;');
    return Array.isArray(res.rows) && res.rows.length > 0;
  } catch (e) {
    return false;
  }
}

/**
 * Get comprehensive cloud connection and table statistics
 */
async function getCloudStatus() {
  try {
    const tables = [
      'settings', 'workers', 'raw_punches', 'daily_attendance',
      'advances', 'audit_logs', 'rule_profiles', 'custom_rules',
      'custom_salary_rules', 'paid_holidays', 'factory_calendar', 'user_sessions'
    ];
    const sql = tables.map(t => `SELECT '${t}' as tbl, count(*) as cnt FROM "${t}"`).join(' UNION ALL ') + ';';
    const res = await execute(sql);
    const counts = {};
    if (Array.isArray(res.rows)) {
      res.rows.forEach(r => { counts[r.tbl] = parseInt(r.cnt, 10); });
    }
    return {
      connected: true,
      provider: `Supabase Cloud (PostgreSQL 17.6 - Schema: ${DB_SCHEMA})`,
      schema: DB_SCHEMA,
      projectRef: PROJECT_REF,
      counts
    };
  } catch (e) {
    return { connected: false, provider: 'Supabase Cloud', error: e.message };
  }
}

/**
 * Sync methods: Since Supabase IS now the primary database, all records written via
 * db.execute / db.batch are already committed directly to Supabase PostgreSQL!
 * These wrappers provide 100% backward compatibility for any callers in index.js.
 */
async function syncAttendanceToCloud(records) {
  return { success: true, count: Array.isArray(records) ? records.length : 0 };
}

async function syncRawPunchesToCloud(punches) {
  return { success: true, count: Array.isArray(punches) ? punches.length : 0 };
}

async function syncSingleAttendanceToCloud() {
  return { success: true };
}

async function syncAuditLogToCloud() {
  return { success: true };
}

async function syncWorkerToCloud() {
  return { success: true };
}

async function deleteWorkerFromCloud() {
  return { success: true };
}

async function syncAdvanceToCloud() {
  return { success: true };
}

async function deleteAdvanceFromCloud() {
  return { success: true };
}

async function syncSettingToCloud() {
  return { success: true };
}

async function syncCustomRuleToCloud() {
  return { success: true };
}

async function deleteCustomRuleFromCloud() {
  return { success: true };
}

async function syncSalaryRuleToCloud() {
  return { success: true };
}

async function deleteSalaryRuleFromCloud() {
  return { success: true };
}

async function syncCalendarToCloud() {
  return { success: true };
}

async function deleteCalendarFromCloud() {
  return { success: true };
}

async function selfHealFromCloud() {
  console.log('🛡️ Supabase Cloud is active as the primary and authoritative database.');
  return true;
}

module.exports = {
  queryCloud,
  executeCloudWithRetry,
  calibrateCloudSequences,
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
