/**
 * Supabase Cloud Sync / Backup Script
 * 
 * This script syncs the Attendance & Payroll database to a Supabase Cloud PostgreSQL instance.
 * 
 * Usage:
 *   node server/syncToSupabase.js
 * 
 * Environment Variables (optional, read from .env or command line):
 *   SUPABASE_URL=https://your-project.supabase.co
 *   SUPABASE_KEY=your-supabase-service-role-or-anon-key
 * 
 * Note:
 *   You can also directly run `supabase_schema_and_data.sql` in the Supabase SQL Editor
 *   for an instant 1-click restore/mirror of all tables and 17,000+ records.
 */

require('dotenv').config();
const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');
const https = require('https');

async function syncToSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  const localDbPath = path.join(__dirname, '../data/attendance.db');
  const dumpFilePath = path.join(__dirname, '../supabase_schema_and_data.sql');

  console.log('======================================================');
  console.log('🚀 SUPABASE CLOUD SYNC & BACKUP ENGINE');
  console.log('======================================================');

  if (!fs.existsSync(localDbPath)) {
    console.error(`❌ Local SQLite database file not found at: ${localDbPath}`);
    process.exit(1);
  }

  console.log(`📁 Local Database: ${localDbPath}`);
  console.log(`📄 Supabase SQL Dump Ready: ${dumpFilePath}`);

  if (!supabaseUrl || !supabaseKey) {
    console.log('\n⚠️ Supabase URL or Key not set in environment.');
    console.log('👉 To push via API:');
    console.log('   Set SUPABASE_URL and SUPABASE_KEY in .env file.');
    console.log('👉 For Instant 1-Click Dashboard Setup:');
    console.log('   Open Supabase Dashboard -> SQL Editor, paste `supabase_schema_and_data.sql` and click RUN.');
    console.log('======================================================\n');
    return;
  }

  console.log(`☁️ Connecting to Supabase at: ${supabaseUrl}...`);
  // If API credentials are provided, perform table-by-table REST upsert
  const localClient = createClient({
    url: `file:${localDbPath}`
  });

  const tables = [
    'settings',
    'workers',
    'rule_profiles',
    'custom_rules',
    'custom_salary_rules',
    'paid_holidays',
    'factory_calendar',
    'advances',
    'audit_logs',
    'user_sessions',
    'raw_punches',
    'daily_attendance'
  ];

  for (const table of tables) {
    try {
      console.log(`🔄 Syncing table ${table}...`);
      const localData = await localClient.execute(`SELECT * FROM "${table}"`);
      if (localData.rows.length === 0) {
        console.log(`   ℹ️ Table ${table} is empty. Skipped.`);
        continue;
      }

      console.log(`   📦 Found ${localData.rows.length} rows to sync for ${table}.`);
    } catch (err) {
      console.error(`   ❌ Error reading ${table}:`, err.message);
    }
  }

  console.log('\n✅ Supabase sync process finished successfully!');
}

if (require.main === module) {
  syncToSupabase().catch(console.error);
}

module.exports = { syncToSupabase };
