/**
 * Migration Script: Migrate local SQLite database to Turso Cloud DB
 * 
 * Usage:
 *   node server/migrateToTurso.js
 */

require('dotenv').config();
const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

async function migrate() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl || !tursoUrl.startsWith('libsql://')) {
    console.error('❌ Error: TURSO_DATABASE_URL must be set and start with libsql://');
    console.error('Example: TURSO_DATABASE_URL="libsql://your-db-name-org.turso.io"');
    console.error('Example: TURSO_AUTH_TOKEN="your-turso-jwt-token"');
    process.exit(1);
  }

  const localDbPath = path.join(__dirname, '../data/attendance.db');
  if (!fs.existsSync(localDbPath)) {
    console.error(`❌ Local database file not found at: ${localDbPath}`);
    process.exit(1);
  }

  console.log('🔌 Connecting to local SQLite DB...');
  const localClient = createClient({
    url: `file:${localDbPath}`
  });

  console.log(`☁️ Connecting to Turso Cloud DB: ${tursoUrl}...`);
  const remoteClient = createClient({
    url: tursoUrl,
    authToken: tursoToken
  });

  // 1. Ensure all schemas exist
  const tablesRes = await localClient.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
  for (const row of tablesRes.rows) {
    try {
      await remoteClient.execute(row.sql);
    } catch (e) {
      // Table may already exist
    }
  }

  const tables = [
    'settings',
    'workers',
    'raw_punches',
    'daily_attendance',
    'advances',
    'audit_logs',
    'rule_profiles',
    'custom_rules',
    'custom_salary_rules',
    'paid_holidays',
    'factory_calendar',
    'user_sessions'
  ];

  for (const table of tables) {
    try {
      console.log(`\n📦 Migrating table: ${table}...`);
      const localData = await localClient.execute(`SELECT * FROM ${table}`);
      if (localData.rows.length === 0) {
        console.log(`   ℹ️ Table ${table} is empty. Skipping.`);
        continue;
      }

      const columns = localData.columns;
      const placeholders = columns.map(() => '?').join(', ');
      const sql = `INSERT OR REPLACE INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`;

      const BATCH_SIZE = 100;
      let migratedCount = 0;
      for (let i = 0; i < localData.rows.length; i += BATCH_SIZE) {
        const chunk = localData.rows.slice(i, i + BATCH_SIZE);
        const stmts = chunk.map(row => ({
          sql,
          args: columns.map(col => row[col])
        }));
        await remoteClient.batch(stmts, 'write');
        migratedCount += chunk.length;
      }
      console.log(`   ✅ Migrated ${migratedCount} rows to ${table}`);
    } catch (err) {
      console.error(`   ❌ Failed migrating table ${table}:`, err.message);
    }
  }

  console.log('\n🎉 Migration to Turso Cloud DB completed successfully!');
}

migrate().catch(console.error);
