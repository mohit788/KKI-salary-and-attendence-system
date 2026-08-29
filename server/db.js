const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbUrl = process.env.TURSO_DATABASE_URL || `file:${path.join(dataDir, 'attendance.db')}`;
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

const db = createClient({
  url: dbUrl,
  authToken,
});

async function execute(sql, args = []) {
  try {
    return await db.execute({ sql, args });
  } catch (err) {
    console.error('DB Execute Error:', err.message, 'SQL:', sql);
    throw err;
  }
}

async function batch(statements) {
  try {
    return await db.batch(statements, 'write');
  } catch (err) {
    console.error('DB Batch Error:', err.message);
    throw err;
  }
}

// Initialize SQLite/Turso tables
async function initDatabase() {
  const schemaQueries = [
    // Admin settings table
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT
    );`,

    // Workers table
    `CREATE TABLE IF NOT EXISTS workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_no TEXT UNIQUE NOT NULL,
      staff_name TEXT NOT NULL,
      department TEXT DEFAULT 'WORKER',
      monthly_salary REAL DEFAULT 15000,
      housing_allowance REAL DEFAULT 0,
      food_allowance REAL DEFAULT 0,
      other_allowance REAL DEFAULT 0,
      salary_type TEXT DEFAULT 'monthly',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,

    // Raw punches table
    `CREATE TABLE IF NOT EXISTS raw_punches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_no TEXT NOT NULL,
      date TEXT NOT NULL, -- YYYY-MM-DD
      weekday TEXT,
      swipe_record TEXT, -- e.g. "07:54 12:33 14:24 18:36"
      machine_work_time TEXT,
      batch_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(staff_no, date)
    );`,

    // Recomputed daily attendance table
    `CREATE TABLE IF NOT EXISTS daily_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_no TEXT NOT NULL,
      date TEXT NOT NULL, -- YYYY-MM-DD
      weekday TEXT,
      raw_swipes TEXT,
      effective_in TEXT,
      effective_out TEXT,
      regular_hours REAL DEFAULT 0,
      ot_hours REAL DEFAULT 0,
      total_hours REAL DEFAULT 0,
      late_minutes INTEGER DEFAULT 0,
      status TEXT NOT NULL, -- 'Present (Full)', 'Present (Short)', 'Absent', 'Weekly Off (Paid)', 'Weekly Off (Forfeited)', 'Incomplete'
      is_manual_override INTEGER DEFAULT 0,
      override_reason TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(staff_no, date)
    );`,

    // Advances ledger table
    `CREATE TABLE IF NOT EXISTS advances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_no TEXT NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,

    // Audit logs table
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_no TEXT NOT NULL,
      date TEXT NOT NULL,
      field_changed TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      edited_by TEXT DEFAULT 'Admin',
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,

    // Rule Profiles table
    `CREATE TABLE IF NOT EXISTS rule_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_name TEXT UNIQUE NOT NULL,
      is_default INTEGER DEFAULT 0,
      shift_start TEXT DEFAULT '08:30',
      shift_end TEXT DEFAULT '16:30',
      grace_slab_minutes INTEGER DEFAULT 30,
      ot_multiplier REAL DEFAULT 1.5,
      ot_rounding TEXT DEFAULT 'minutes',
      short_hours_threshold REAL DEFAULT 4.0,
      weekly_off_day TEXT DEFAULT 'Sun',
      forfeiture_absent_threshold INTEGER DEFAULT 2,
      standard_month_days TEXT DEFAULT '26',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,

    // Custom Rules table (timing-based restrictions)
    `CREATE TABLE IF NOT EXISTS custom_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_name TEXT NOT NULL,
      rule_type TEXT NOT NULL, -- 'midday_exit', 'late_penalty', 'ot_rule', 'salary_rule'
      start_time TEXT DEFAULT '',
      end_time TEXT DEFAULT '',
      threshold_mins INTEGER DEFAULT 0,
      deduction_mins INTEGER DEFAULT 0,
      deduction_amount REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,

    // Custom Salary Rules table (bonus/deduction/OT modifier rules — manual & AI-generated)
    `CREATE TABLE IF NOT EXISTS custom_salary_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_name TEXT NOT NULL,
      rule_type TEXT NOT NULL DEFAULT 'bonus',
      condition_type TEXT DEFAULT 'always',
      condition_value TEXT DEFAULT '0',
      action_type TEXT DEFAULT 'add_fixed',
      action_value REAL DEFAULT 0,
      applies_to_day TEXT DEFAULT 'all',
      description TEXT,
      source TEXT DEFAULT 'manual',
      ai_original_prompt TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,

    // Paid Holidays table (National holidays and factory declared paid offs)
    `CREATE TABLE IF NOT EXISTS paid_holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      holiday_date TEXT NOT NULL UNIQUE,
      holiday_name TEXT NOT NULL,
      is_recurring INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`
  ];

  for (const sql of schemaQueries) {
    await execute(sql);
  }

  // Seed default national holidays if empty
  const defaultHolidays = [
    ['2026-01-26', 'Republic Day 🇮🇳', 1],
    ['2026-05-01', 'Labour Day / May Day 👷', 1],
    ['2026-08-15', 'Independence Day 🇮🇳', 1],
    ['2026-10-02', 'Gandhi Jayanti 🕊️', 1],
  ];
  for (const [hDate, hName, hRec] of defaultHolidays) {
    try {
      await execute(
        `INSERT INTO paid_holidays (holiday_date, holiday_name, is_recurring) VALUES (?, ?, ?) ON CONFLICT(holiday_date) DO NOTHING;`,
        [hDate, hName, hRec]
      );
    } catch (e) {}
  }

  // Migrations for existing database instances
  try { await execute(`ALTER TABLE workers ADD COLUMN housing_allowance REAL DEFAULT 0`); } catch (e) {}
  try { await execute(`ALTER TABLE workers ADD COLUMN food_allowance REAL DEFAULT 0`); } catch (e) {}
  try { await execute(`ALTER TABLE workers ADD COLUMN other_allowance REAL DEFAULT 0`); } catch (e) {}
  try { await execute(`ALTER TABLE workers ADD COLUMN assigned_shift TEXT DEFAULT 'auto'`); } catch (e) {}
  try { await execute(`ALTER TABLE daily_attendance ADD COLUMN sunday_ot_hours REAL DEFAULT 0`); } catch (e) {}
  try { await execute(`ALTER TABLE daily_attendance ADD COLUMN shift TEXT DEFAULT '08:00'`); } catch (e) {}
  try { await execute(`ALTER TABLE daily_attendance ADD COLUMN manual_punches TEXT DEFAULT ''`); } catch (e) {}
  try { await execute(`ALTER TABLE custom_rules ADD COLUMN target_staff_no TEXT DEFAULT 'all'`); } catch (e) {}
  try { await execute(`ALTER TABLE custom_rules ADD COLUMN exemption_type TEXT DEFAULT ''`); } catch (e) {}
  try { await execute(`ALTER TABLE custom_salary_rules ADD COLUMN target_staff_no TEXT DEFAULT 'all'`); } catch (e) {}

  // Backfill manual_punches for existing manual records from audit_logs
  try {
    const logs = await execute(`SELECT staff_no, date, old_value, new_value FROM audit_logs ORDER BY id ASC`);
    for (const log of logs.rows) {
      const oldMatch = (log.old_value || '').match(/Swipes:\s*([^,]*)/);
      const newMatch = (log.new_value || '').match(/Swipes:\s*([^,]*)/);
      if (oldMatch && newMatch) {
        const oldTokens = new Set((oldMatch[1] || '').trim().split(/\s+/).filter(Boolean));
        const newTokens = (newMatch[1] || '').trim().split(/\s+/).filter(Boolean);
        const added = newTokens.filter(t => !oldTokens.has(t));
        if (added.length > 0) {
          await execute(
            `UPDATE daily_attendance SET manual_punches = ? WHERE staff_no = ? AND date = ? AND is_manual_override = 1 AND (manual_punches IS NULL OR manual_punches = '')`,
            [added.join(' '), log.staff_no, log.date]
          );
        }
      }
    }
  } catch (e) {}

  // Insert default settings if empty or update legacy defaults
  const defaultSettings = [
    ['shift_start', '08:00', 'Standard shift start time (HH:MM)'],
    ['shift_end', '16:30', 'Standard shift end time (HH:MM)'],
    ['grace_slab_minutes', '30', 'Late arrival grace slab size in minutes'],
    ['leisure_mins_allowed', '5', 'Leisure grace minutes allowed (Default: 5 min)'],
    ['leisure_days_allowed', '2', 'Maximum days per month eligible for leisure time forgiveness (Default: 2)'],
    ['ot_multiplier', '1.5', 'Overtime pay multiplier'],
    ['ot_rounding', '30min_block', 'OT rounding mode: "30min_block" or "minutes"'],
    ['short_hours_threshold', '4.0', 'Threshold hours below which day is short hours'],
    ['weekly_off_day', 'Sun', 'Default paid weekly off day (Sun/Sat/etc)'],
    ['forfeiture_absent_threshold', '4', 'Number of absent days in Mon-Sat stretch to forfeit Sunday (Default: 4)'],
    ['weekly_off_forfeiture_threshold', '4', 'Number of weekly offs in same week to forfeit Sunday'],
    ['monthly_absent_forfeiture_threshold', '4', 'Total monthly absents to forfeit 1 Sunday weekly off (Default: 4)'],
    ['standard_month_days', 'calendar', 'Standard days in month for per-day rate calculation (calendar/26/30)'],
    ['max_ot_hours', '0', 'Maximum OT hours cap per day (0 = Unlimited)'],
    ['lunch_deduction_mins', '30', 'Automatic lunch/break deduction in minutes'],
    ['late_penalty_threshold_mins', '120', 'Late arrival cutoff in minutes for half-day penalty'],
    ['sunday_ot_multiplier', '2.0', 'Overtime multiplier for Sunday work'],
    ['payroll_password', 'kki123', 'Password to unlock salary and payroll figures']
  ];

  for (const [key, value, desc] of defaultSettings) {
    await execute(
      `INSERT INTO settings (key, value, description) VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING;`,
      [key, value, desc]
    );
  }

  // Update legacy settings if they are still at 08:30, lunch_deduction_mins 0, or leisure_mins_allowed 2
  try {
    await execute(`UPDATE settings SET value = '08:00' WHERE key = 'shift_start' AND value = '08:30'`);
    await execute(`UPDATE settings SET value = '30' WHERE key = 'lunch_deduction_mins' AND value = '0'`);
    await execute(`UPDATE settings SET value = '3' WHERE key = 'forfeiture_absent_threshold' AND (value = '2' OR value IS NULL)`);
    await execute(`UPDATE settings SET value = '4' WHERE key = 'monthly_absent_forfeiture_threshold' AND (value = '5' OR value IS NULL)`);
    await execute(`UPDATE settings SET value = '5' WHERE key = 'leisure_mins_allowed' AND (value = '2' OR value IS NULL)`);
  } catch (e) {}

  // Insert default Rule Profile if rule_profiles table is empty
  const profilesCountRes = await execute(`SELECT COUNT(*) as cnt FROM rule_profiles`);
  if (profilesCountRes.rows[0].cnt === 0) {
    await execute(
      `INSERT INTO rule_profiles (profile_name, is_default, shift_start, shift_end, grace_slab_minutes, ot_multiplier, ot_rounding, short_hours_threshold, weekly_off_day, forfeiture_absent_threshold, standard_month_days)
       VALUES (?, 1, '08:00', '16:30', 30, 1.5, 'minutes', 4.0, 'Sun', 3, '26')`,
      ['Standard Factory Rules (08:00 - 16:30 | 8h Duty + 30m Lunch)']
    );
  }

  console.log('✅ Attendance & Payroll Database Initialized.');
}

module.exports = {
  db,
  execute,
  batch,
  initDatabase,
};
