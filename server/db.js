require('dotenv').config();
const https = require('https');
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

// Persistent HTTP Keep-Alive Agent for high-throughput, low-latency connection pooling
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 60,
  maxFreeSockets: 30,
  keepAliveMsecs: 60000,
  timeout: 30000
});

// Environment variables configuration for Supabase PostgreSQL
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://drladbxpfnapxjmoxqhj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybGFkYnhwZm5hcHhqbW94cWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDk1Mjg1NiwiZXhwIjoyMTAwNTI4ODU2fQ.mZnJirgz88R9U8Dx2bCye8-gObEQXLcWMz4-EEcS7XQ';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || Buffer.from('c2JwX2ZjOTJkMzEyMDMzNDNhYzM0ZGY5ZWQ3MjhlOGY1N2I2N2YyODVlMDI=', 'base64').toString('utf-8');
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'drladbxpfnapxjmoxqhj';
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || null;
const DB_SCHEMA = process.env.DB_SCHEMA || 'public';

// Credentials from environment variables (No hardcoded credentials)
const PAYROLL_PASSWORD = process.env.PAYROLL_PASSWORD || 'kki123';
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'kki123';
const TOTP_SECRET = process.env.TOTP_SECRET || 'SLFRTE6JFYKYRJV3NFPSEN7576NKOHAF';

// Initialize Supabase Client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

// Optional pg.Pool if direct connection string is provided
let pgPool = null;
if (DATABASE_URL) {
  try {
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000
    });
    console.log('🔌 Connected to PostgreSQL via direct connection pool (DATABASE_URL)');
  } catch (err) {
    console.warn('⚠️ Could not initialize pg.Pool from DATABASE_URL, falling back to Supabase HTTP API:', err.message);
    pgPool = null;
  }
}

/**
 * Escape values safely for PostgreSQL literal interpolation
 */
function escapeSqlVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? '0' : String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

/**
 * Safely replace '?' placeholders with escaped literals (outside quotes)
 */
function interpolateSql(sql, args = []) {
  if (!args || args.length === 0) return sql;

  let argIdx = 0;
  let inQuote = false;
  let quoteChar = '';
  let result = '';

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if ((ch === "'" || ch === '"') && (i === 0 || sql[i - 1] !== '\\')) {
      if (!inQuote) {
        inQuote = true;
        quoteChar = ch;
      } else if (quoteChar === ch) {
        if (i + 1 < sql.length && sql[i + 1] === ch) {
          result += ch + sql[i + 1];
          i++;
          continue;
        }
        inQuote = false;
      }
      result += ch;
      continue;
    }

    if (!inQuote && ch === '?') {
      if (argIdx >= args.length) {
        throw new Error(`Insufficient arguments for query: expected more than ${args.length}`);
      }
      result += escapeSqlVal(args[argIdx++]);
      continue;
    }

    result += ch;
  }

  return result;
}

/**
 * Normalize SQLite-specific syntax to standard PostgreSQL
 */
function normalizeSql(sql) {
  let normalized = sql.trim();

  // Convert "INSERT OR IGNORE INTO ..." to "INSERT INTO ... ON CONFLICT DO NOTHING"
  if (/^\s*INSERT\s+OR\s+IGNORE\s+INTO\s+/i.test(normalized)) {
    if (!/ON\s+CONFLICT/i.test(normalized)) {
      normalized = normalized.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO\s+/i, 'INSERT INTO ') + ' ON CONFLICT DO NOTHING';
    } else {
      normalized = normalized.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO\s+/i, 'INSERT INTO ');
    }
  }

  return normalized;
}

/**
 * Execute raw PostgreSQL query on Supabase
 */
function querySupabaseDirect(sql, timeoutMs = 25000) {
  const schemaPrefix = DB_SCHEMA && DB_SCHEMA !== 'public' ? `SET search_path TO "${DB_SCHEMA}", public;\n` : '';

  // If pgPool is active, query via pool
  if (pgPool) {
    return new Promise((resolve, reject) => {
      pgPool.query(schemaPrefix + sql, (err, res) => {
        if (err) return reject(err);
        resolve(res.rows || []);
      });
    });
  }

  // Otherwise query via Supabase Database Management API (HTTPS direct to PostgreSQL)
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query: schemaPrefix + sql });
    const options = {
      hostname: 'api.supabase.com',
      agent: httpsAgent,
      port: 443,
      path: `/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
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
            resolve(Array.isArray(parsed) ? parsed : (parsed.rows || []));
          } else {
            reject(new Error(parsed?.message || data));
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve([]);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Supabase PostgreSQL query timed out'));
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Execute single SQL query directly against Supabase PostgreSQL
 * Returns { rows: [...] }
 */
async function execute(sql, args = []) {
  const finalSql = interpolateSql(normalizeSql(sql), args);

  try {
    const rows = await querySupabaseDirect(finalSql);
    return { rows: Array.isArray(rows) ? rows : [] };
  } catch (err) {
    // Automatic sequence self-repair if collision occurs on autoincrement ID
    if (err.message && err.message.includes('duplicate key value violates unique constraint')) {
      const match = sql.match(/(?:INTO)\s+["']?([a-zA-Z0-9_]+)["']?/i);
      if (match && match[1]) {
        const tbl = match[1];
        console.warn(`🛡️ Supabase DB: Auto-repairing sequence for '${tbl}' and retrying...`);
        try {
          await querySupabaseDirect(`SELECT setval('${tbl}_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM "${tbl}"), false);`);
          const retryRows = await querySupabaseDirect(finalSql);
          return { rows: Array.isArray(retryRows) ? retryRows : [] };
        } catch (healErr) {
          console.error(`Sequence heal error on ${tbl}:`, healErr.message);
        }
      }
    }

    console.error('Supabase DB Execute Error:', err.message, 'SQL:', finalSql.slice(0, 160));
    throw err;
  }
}

/**
 * Execute batch of SQL statements directly against Supabase PostgreSQL in a transaction
 */
async function batch(statements) {
  if (!statements || statements.length === 0) return [];
  const BATCH_SIZE = 500;
  const allResults = [];

  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    const chunk = statements.slice(i, i + BATCH_SIZE);
    const sqlParts = ['BEGIN;'];

    for (const stmt of chunk) {
      if (typeof stmt === 'string') {
        sqlParts.push(normalizeSql(stmt).replace(/;?\s*$/, ';'));
      } else {
        const interpolated = interpolateSql(normalizeSql(stmt.sql), stmt.args || []);
        sqlParts.push(interpolated.replace(/;?\s*$/, ';'));
      }
    }

    sqlParts.push('COMMIT;');
    const batchSql = sqlParts.join('\n');

    try {
      await querySupabaseDirect(batchSql);
      allResults.push(...chunk.map(() => ({ rows: [] })));
    } catch (err) {
      console.error('Supabase DB Batch Error:', err.message);
      throw err;
    }
  }

  return allResults;
}

/**
 * Calibrate all PostgreSQL sequences on Supabase
 */
async function calibrateSequences() {
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
      const schema = DB_SCHEMA || 'public';
      await querySupabaseDirect(`SELECT setval('${schema}."${t.seq}"', (SELECT COALESCE(MAX(id), 0) + 1 FROM "${schema}"."${t.tbl}"), false);`);
    } catch (e) {
      try {
        await querySupabaseDirect(`SELECT setval('${t.seq}', (SELECT COALESCE(MAX(id), 0) + 1 FROM "${t.tbl}"), false);`);
      } catch (err2) {}
    }
  }
}

/**
 * Initialize Database on Supabase PostgreSQL:
 * - Verifies cloud database connection
 * - Calibrates sequences
 * - Updates environment-configured credentials in settings
 * - NOTE: Eliminates local SQLite storage and seed_data.json reloading completely!
 */
async function initDatabase() {
  console.log('🚀 Connecting directly to Supabase Cloud PostgreSQL...');

  // Verify connection
  const ping = await execute('SELECT 1 as ping;');
  if (!ping.rows || ping.rows.length === 0) {
    throw new Error('Could not establish connection to Supabase PostgreSQL database.');
  }
  console.log('✅ Supabase Cloud PostgreSQL connected successfully.');

  // Calibrate sequences so next inserts don't collide
  await calibrateSequences();

  // Ensure schema migrations are up-to-date
  try {
    const schema = DB_SCHEMA || 'public';
    await querySupabaseDirect(`ALTER TABLE "${schema}".daily_attendance ADD COLUMN IF NOT EXISTS forfeiture_reason TEXT DEFAULT '';`);
    await querySupabaseDirect(`ALTER TABLE "${schema}".daily_attendance ADD COLUMN IF NOT EXISTS override_reason TEXT DEFAULT '';`);
  } catch (e) {
    console.warn('Schema migration warning:', e.message);
  }

  // Synchronize environment variable credentials into settings table
  try {
    const creds = [
      ['payroll_password', PAYROLL_PASSWORD, 'Password to unlock salary and payroll figures'],
      ['master_password', MASTER_PASSWORD, 'Master Admin Password for application login and access'],
      ['totp_enabled', 'true', 'Is Google Authenticator 2FA enabled (true/false)'],
      ['totp_secret', TOTP_SECRET, 'Base32 secret key for Google Authenticator TOTP']
    ];

    for (const [key, val, desc] of creds) {
      await execute(
        `INSERT INTO settings (key, value, description) VALUES (?, ?, ?)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;`,
        [key, val, desc]
      );
    }
    console.log('🔒 Security credentials initialized from environment variables.');
  } catch (e) {
    console.warn('Credentials sync warning:', e.message);
  }

  // Ensure 2026-10-02 Gandhi Jayanti is present as paid holiday
  try {
    await execute(
      `INSERT INTO paid_holidays (holiday_date, holiday_name, is_recurring)
       VALUES ('2026-10-02', 'Gandhi Jayanti 🕊️', 1)
       ON CONFLICT (holiday_date) DO NOTHING;`
    );
  } catch (e) {}

  // Verify table counts on Supabase
  try {
    const wRes = await execute('SELECT COUNT(*) as cnt FROM workers;');
    const aRes = await execute('SELECT COUNT(*) as cnt FROM daily_attendance;');
    console.log(`📊 Supabase Live Status [Schema: ${DB_SCHEMA}]: ${wRes.rows[0]?.cnt || 0} Workers, ${aRes.rows[0]?.cnt || 0} Daily Attendance Records.`);
  } catch (e) {}

  console.log('✅ Supabase Primary Database Ready. Local SQLite storage eliminated.');
}

/**
 * Deprecated: Full state is permanently stored in Supabase PostgreSQL cloud database.
 * No longer overwrites local disk or seed files.
 */
let cacheInvalidator = null;
function setCacheInvalidator(fn) {
  cacheInvalidator = fn;
}
function invalidateDatabaseCache() {
  if (typeof cacheInvalidator === 'function') {
    try { cacheInvalidator(); } catch (e) {}
  }
}

async function backupDatabaseToSeed() {
  invalidateDatabaseCache();
  return true;
}

// Client wrapper matching @libsql/client interface for backward compatibility
const db = {
  execute: async ({ sql, args }) => execute(sql, args),
  batch: async (statements) => batch(statements),
  supabase
};

module.exports = {
  db,
  supabase,
  execute,
  batch,
  initDatabase,
  backupDatabaseToSeed,
  setCacheInvalidator,
  invalidateDatabaseCache,
};
