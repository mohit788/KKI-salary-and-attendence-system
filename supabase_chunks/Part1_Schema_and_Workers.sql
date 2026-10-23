-- =============================================================
-- PART 1: ALL TABLES + WORKERS + SETTINGS (RUN THIS FIRST)
-- =============================================================

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS workers (
  id SERIAL PRIMARY KEY,
  staff_no TEXT UNIQUE NOT NULL,
  staff_name TEXT NOT NULL,
  department TEXT DEFAULT 'WORKER',
  monthly_salary NUMERIC DEFAULT 15000,
  housing_allowance NUMERIC DEFAULT 0,
  food_allowance NUMERIC DEFAULT 0,
  other_allowance NUMERIC DEFAULT 0,
  salary_type TEXT DEFAULT 'monthly',
  assigned_shift TEXT DEFAULT 'auto',
  is_exception INTEGER DEFAULT 0,
  exception_reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS raw_punches (
  id SERIAL PRIMARY KEY,
  staff_no TEXT NOT NULL,
  date TEXT NOT NULL,
  weekday TEXT,
  swipe_record TEXT,
  machine_work_time TEXT,
  batch_id TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(staff_no, date)
);

CREATE TABLE IF NOT EXISTS daily_attendance (
  id SERIAL PRIMARY KEY,
  staff_no TEXT NOT NULL,
  date TEXT NOT NULL,
  weekday TEXT,
  raw_swipes TEXT,
  original_raw_swipes TEXT DEFAULT '',
  manual_punches TEXT DEFAULT '',
  effective_in TEXT,
  effective_out TEXT,
  regular_hours NUMERIC DEFAULT 0,
  ot_hours NUMERIC DEFAULT 0,
  sunday_ot_hours NUMERIC DEFAULT 0,
  total_hours NUMERIC DEFAULT 0,
  late_minutes INTEGER DEFAULT 0,
  status TEXT NOT NULL,
  shift TEXT DEFAULT '08:00',
  is_manual_override INTEGER DEFAULT 0,
  override_reason TEXT,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(staff_no, date)
);

CREATE TABLE IF NOT EXISTS advances (
  id SERIAL PRIMARY KEY,
  staff_no TEXT NOT NULL,
  date TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  staff_no TEXT NOT NULL,
  date TEXT NOT NULL,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  edited_by TEXT DEFAULT 'Admin',
  reason TEXT,
  action TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rule_profiles (
  id SERIAL PRIMARY KEY,
  profile_name TEXT UNIQUE NOT NULL,
  is_default INTEGER DEFAULT 0,
  shift_start TEXT DEFAULT '08:30',
  shift_end TEXT DEFAULT '16:30',
  grace_slab_minutes INTEGER DEFAULT 30,
  ot_multiplier NUMERIC DEFAULT 1.5,
  ot_rounding TEXT DEFAULT 'minutes',
  short_hours_threshold NUMERIC DEFAULT 4.0,
  weekly_off_day TEXT DEFAULT 'Sun',
  forfeiture_absent_threshold INTEGER DEFAULT 2,
  standard_month_days TEXT DEFAULT 'calendar',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_rules (
  id SERIAL PRIMARY KEY,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  target_staff_no TEXT DEFAULT 'all',
  exemption_type TEXT DEFAULT '',
  start_time TEXT DEFAULT '',
  end_time TEXT DEFAULT '',
  threshold_mins INTEGER DEFAULT 0,
  deduction_mins INTEGER DEFAULT 0,
  deduction_amount NUMERIC DEFAULT 0,
  valid_from TEXT DEFAULT '',
  valid_to TEXT DEFAULT '',
  max_allowed_days INTEGER DEFAULT 0,
  grace_allowed_mins INTEGER DEFAULT 30,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_salary_rules (
  id SERIAL PRIMARY KEY,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL DEFAULT 'bonus',
  condition_type TEXT DEFAULT 'always',
  condition_value TEXT DEFAULT '0',
  action_type TEXT DEFAULT 'add_fixed',
  action_value NUMERIC DEFAULT 0,
  applies_to_day TEXT DEFAULT 'all',
  description TEXT,
  source TEXT DEFAULT 'manual',
  ai_original_prompt TEXT,
  is_active INTEGER DEFAULT 1,
  target_staff_no TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS paid_holidays (
  id SERIAL PRIMARY KEY,
  holiday_date TEXT NOT NULL UNIQUE,
  holiday_name TEXT NOT NULL,
  is_recurring INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS factory_calendar (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  day_type TEXT NOT NULL DEFAULT 'holiday',
  title TEXT NOT NULL,
  notes TEXT DEFAULT '',
  is_recurring INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_sessions (
  token TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Ensure schema columns match even if tables already existed:
ALTER TABLE IF EXISTS audit_logs ADD COLUMN IF NOT EXISTS "action" TEXT DEFAULT '';
ALTER TABLE IF EXISTS custom_salary_rules ADD COLUMN IF NOT EXISTS "target_staff_no" TEXT DEFAULT '';

INSERT INTO "settings" ("key", "value", "description") VALUES
('test_batch_1', 'val1', 'desc1'),
('test_batch_2', 'val2', 'desc2'),
('payroll_password', 'kki123', 'Password to unlock salary and payroll figures'),
('shift_start', '08:00', 'Standard shift start time (HH:MM)'),
('shift_end', '16:30', 'Standard shift end time (HH:MM)'),
('grace_slab_minutes', '30', 'Late arrival grace slab size in minutes'),
('ot_multiplier', '1.5', 'Overtime pay multiplier'),
('ot_rounding', '30min_block', 'OT rounding mode: "minutes" or "30min_block"'),
('short_hours_threshold', '4.0', 'Threshold hours below which day is short hours'),
('weekly_off_day', 'Sun', 'Default paid weekly off day (Sun/Sat/etc)'),
('forfeiture_absent_threshold', '3', 'Number of absent days in Mon-Sat stretch to forfeit Sunday'),
('standard_month_days', 'calendar', 'Standard days in month for per-day rate calculation (26/30/calendar)'),
('max_ot_hours', '0', 'Maximum OT hours cap per day (0 = Unlimited)'),
('lunch_deduction_mins', '30', 'Automatic lunch/break deduction in minutes'),
('late_penalty_threshold_mins', '120', 'Late arrival cutoff in minutes for half-day penalty'),
('sunday_ot_multiplier', '1', 'Overtime multiplier for Sunday work'),
('gemini_api_key', '', NULL),
('weekly_off_forfeiture_threshold', '3', 'Number of weekly offs in same week to forfeit Sunday'),
('monthly_absent_forfeiture_threshold', '4', 'Total monthly absents to forfeit ALL Sundays (except OT worked)'),
('leisure_mins_allowed', '5', 'Leisure grace minutes allowed (e.g. 2 min)'),
('leisure_days_allowed', '2', 'Maximum days per month eligible for leisure time forgiveness (Default: 2)'),
('master_password', 'kki123', 'Master Admin Password for application login and access'),
('totp_enabled', 'true', 'Is Google Authenticator 2FA enabled (true/false)'),
('totp_secret', 'SLFRTE6JFYKYRJV3NFPSEN7576NKOHAF', 'Base32 secret key for Google Authenticator TOTP'),
('emergency_backup_codes', '["98cb9bdd8185c14b3c3d0656657f95421b8f503243b4b290e09d49d4fa300b3d","c5335f8708356bc05b2ae0c8857229d9940c1bc5591f91fb9f34e62b8e8ae4a3","5c328e178301d23441ed1cc7d2883c3186bad27ce7c2e932338b9687892dcea3","1aad751779403b785f683bc5c0dac3dc0167fbaa1a98e12c1cdf83d951b413ce","b19b86ed04e7c195369644753a33da86c5513d985616a2bdbd590554e76e26a4","8c721fd977d15ed8c2d5865db691286b7af80a53a392f868918f651fd40be01d","0ce28c103f8064fe72caa2522e704a595d46f7991daa76ae5679073b28dbd258","4e4aa8b65b4c3f7ee807bc52af411a4231a0478f0f20ac3e0e95ada3468e157d"]', 'One-time emergency backup recovery codes (JSON string)')
ON CONFLICT DO NOTHING;

INSERT INTO "workers" ("id", "staff_no", "staff_name", "department", "monthly_salary", "salary_type", "created_at", "housing_allowance", "food_allowance", "other_allowance", "assigned_shift", "is_exception", "exception_reason") VALUES
(115, '001', 'RAJIV', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(116, '005', 'SHEELA RAI', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(117, '006', 'BINAY KUMAR SINGH', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(118, '007', 'VIKRAMA', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(119, '9', 'Sunil Kumar', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(120, '016', 'SAROJ SINGH', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(121, '20', 'Shivji Ram', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(122, '023', 'RAVI PAL', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(123, '025', 'HIRA LAL', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(124, '030', 'RAM BHAROSA', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(125, '036', 'JHUNA SINGH', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(126, '039', 'rajesh', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(127, '040', 'BIRENDRA RAM', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(128, '041', 'TEK BAHADUR', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(129, '043', 'Dharminder Grinder', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(130, '046', 'PAPPU CNC', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(131, '061', 'MISHRI LAL', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(132, '0062', 'VINOD KUMAR', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(133, '66', 'Parshuram Helper', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(134, '69', 'DILIP KALA', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(135, '079', 'DAVINDER KUMAR', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(136, '081', 'Rintu CNC', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(137, '083', 'MANGAT RAM', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(138, '092', 'RUPENDRA', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(139, '201', 'OM PARKASH', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(140, '205', 'BALWANT  SINGH', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(141, '207', 'SARABJIT SINGH', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(142, '208', 'SURJIT SINGH', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(143, '209', 'RANJIV SAINI', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(144, '217', 'KARAM JIT', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(145, '220', 'JASBIR', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(146, '221', 'BALWINDER SINGH', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(147, '224', 'NAGENDRA SAH', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(148, '225', 'BHIM SAH', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(149, '226', 'GULAB CHAND', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(150, '227', 'RAM SINGAR', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(151, '234', 'HARDEEP KAUR', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(152, '236', 'JATINDER LADDU', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(153, '239', 'GURNAM SINGH', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(154, '240', 'JATINDER KUMAR', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(155, '242', 'NARAYAN BAHADUR', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(156, '243', 'KRISHAN KANT', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(157, '244', 'VISHNU JISEE', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(158, '246', 'INDERJIT SINGH', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(159, '250', 'Abhishek CNC', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(160, '251', 'BABLOO IIND', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(161, '253', 'Prem Bahadur', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(162, '254', 'RAMJEE', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(163, '260', 'SUKHWINDER SAINI', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(164, '262', 'KAPIL DEV', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(165, '267', 'vinod helper broach', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(166, '271', 'URMILA STORE', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(167, '280', 'Manoj Drill old 222', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(168, '285', 'SANJAY CHOUBEY', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(169, '290', 'SURAJ DRIVER', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 1, 'Driver / Flexible Duty Exemption'),
(170, '291', 'Mitlesh', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(171, '295', 'DINESH RAM', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(172, '306', 'Sushil Subedar', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(173, '308', 'Dimple Store', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(174, '315', 'Surjit Singh', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(175, '317', 'HEENA DEVI', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(176, '318', 'URMILA VIKARMA', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(177, '341', 'PARHLAD STORE', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(178, '347', 'MANISHA', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(179, '348', 'ADITYA HELPER', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(180, '356', 'SUBHASH PAL', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(181, '363', 'KULDEEP HELPER', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(182, '369', 'SHABNAM CNC', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(183, '372', 'DARSHAN LAL', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(184, '373', 'GOPI CNC', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(185, '374', 'SHIVPATI', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(186, '375', 'AKHILESH WELDER', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(187, '383', 'MANISHA -II', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(188, '392', 'URMILA (CHOTU)', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(189, '394', 'BEL BAHADUR', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(190, '395', 'MEENU OFC', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(191, '398', 'LAXMAN HELPER', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(192, '402', 'SUNITA DEVI', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(193, '406', 'PANKAJ KUMAR', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(194, '410', 'SUNIL HELPER', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(195, '411', 'PREM HELPER', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(196, '415', 'BHUPINDER CNC', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(197, '422', 'CHAMPA STORE', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(198, '423', 'PRIYANSHI OFC', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(199, '424', 'NEERAJ HELPER', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(200, '425', 'PRAMOD STORE', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(201, '426', 'BRIJESH SUP.', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(202, '428', 'GOLU WELDER', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(203, '501', 'Surjit Office', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(204, '502', 'DEEPAK STORE', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(205, '503', 'SHBANA CNC', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(206, '504', 'KARAN CNC', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(207, '505', 'MAMTA STORE', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(208, '506', 'BABITA STORE', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(209, '509', 'SURJIT KUMAR', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(210, '510', 'BAL DEV', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(211, '511', 'ROHAN KUMAR', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(212, '512', 'NEERAJ KUMAR(STORE)', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(213, '513', 'AKASH KUMAR(FITTER HELPER)', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(214, '514', 'RAHUL KUMAR(MM)', 'WORKER', 15000, 'monthly', '2026-09-07 07:00:45', 0, 0, 0, 'auto', 0, ''),
(291, '408', 'meera drill', 'WORKER', 15000, 'monthly', '2026-10-12 09:46:42', 0, 0, 0, 'auto', 0, ''),
(301, '50', 'RAJINDER(TEJU)', 'WORKER', 15000, 'monthly', '2026-10-12 09:46:42', 0, 0, 0, 'auto', 0, ''),
(314, '515', 'SANGEETA', 'WORKER', 15000, 'monthly', '2026-10-12 09:46:42', 0, 0, 0, 'auto', 0, ''),
(315, '516', 'PAMMIRAJ', 'WORKER', 15000, 'monthly', '2026-10-12 09:46:42', 0, 0, 0, 'auto', 0, ''),
(316, '517', 'Sonu', 'WORKER', 15000, 'monthly', '2026-10-12 09:46:42', 0, 0, 0, 'auto', 0, ''),
(317, '518', 'Sonu(Ram suresh)', 'WORKER', 15000, 'monthly', '2026-10-12 09:46:42', 0, 0, 0, 'auto', 0, ''),
(318, '519', 'Ramu Helper', 'WORKER', 15000, 'monthly', '2026-10-12 09:46:42', 0, 0, 0, 'auto', 0, ''),
(319, '540', 'Pratham Off', 'WORKER', 15000, 'monthly', '2026-10-12 09:46:42', 0, 0, 0, 'auto', 0, '')
ON CONFLICT DO NOTHING;

INSERT INTO "rule_profiles" ("id", "profile_name", "is_default", "shift_start", "shift_end", "grace_slab_minutes", "ot_multiplier", "ot_rounding", "short_hours_threshold", "weekly_off_day", "forfeiture_absent_threshold", "standard_month_days", "created_at") VALUES
(1, 'Standard KKI Factory Rules (08:30 - 16:30 | OT after 4:30 PM)', 1, '08:30', '16:30', 30, 1.5, 'minutes', 4, 'Sun', 2, 'calendar', '2026-08-03 11:15:11')
ON CONFLICT DO NOTHING;

INSERT INTO "paid_holidays" ("id", "holiday_date", "holiday_name", "is_recurring", "created_at") VALUES
(1, '2026-01-26', 'Republic Day 🇮🇳', 1, '2026-08-28 07:43:24'),
(2, '2026-05-01', 'Labour Day / May Day 👷', 1, '2026-08-28 07:43:24'),
(3, '2026-08-15', 'Independence Day 🇮🇳', 1, '2026-08-28 07:43:24'),
(4, '2026-10-02', 'Gandhi Jayanti 🕊️', 1, '2026-08-28 07:43:24')
ON CONFLICT DO NOTHING;

INSERT INTO "factory_calendar" ("id", "date", "day_type", "title", "notes", "is_recurring", "created_at") VALUES
(1, '2026-01-26', 'holiday', 'Republic Day 🇮🇳', '', 1, '2026-09-02 10:21:49'),
(2, '2026-05-01', 'holiday', 'Labour Day / May Day 👷', '', 1, '2026-09-02 10:21:49'),
(3, '2026-08-15', 'holiday', 'Independence Day 🇮🇳', '', 1, '2026-09-02 10:21:49'),
(4, '2026-10-02', 'holiday', 'Gandhi Jayanti 🕊️', '', 1, '2026-09-02 10:21:49')
ON CONFLICT DO NOTHING;

INSERT INTO "advances" ("id", "staff_no", "date", "amount", "note", "created_at") VALUES
(1, '225', '2026-08-03', 4555, 'gg', '2026-08-03 12:09:10')
ON CONFLICT DO NOTHING;

INSERT INTO "audit_logs" ("id", "staff_no", "date", "field_changed", "old_value", "new_value", "edited_by", "reason", "created_at", "action") VALUES
(1, '290', '2026-07-27', 'Fast-Fix Bulk Edit', 'Swipes: 16:23, Status: Incomplete', 'Swipes: 16:23, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:50', ''),
(2, '0062', '2026-07-28', 'Fast-Fix Bulk Edit', 'Swipes: 18:32, Status: Incomplete', 'Swipes: 18:32, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:50', ''),
(3, '043', '2026-07-28', 'Fast-Fix Bulk Edit', 'Swipes: 18:36, Status: Incomplete', 'Swipes: 18:36, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:50', ''),
(4, '092', '2026-07-28', 'Fast-Fix Bulk Edit', 'Swipes: 18:09, Status: Incomplete', 'Swipes: 18:09, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:50', ''),
(5, '290', '2026-07-28', 'Fast-Fix Bulk Edit', 'Swipes: 10:08, Status: Incomplete', 'Swipes: 10:08, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:50', ''),
(6, '043', '2026-07-29', 'Fast-Fix Bulk Edit', 'Swipes: 18:34, Status: Incomplete', 'Swipes: 18:34, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:50', ''),
(7, '290', '2026-07-29', 'Fast-Fix Bulk Edit', 'Swipes: 09:08, Status: Incomplete', 'Swipes: 09:08, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:50', ''),
(8, '290', '2026-07-30', 'Fast-Fix Bulk Edit', 'Swipes: 09:36, Status: Incomplete', 'Swipes: 09:36, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:50', ''),
(9, '092', '2026-07-01', 'Fast-Fix Bulk Edit', 'Swipes: 18:35, Status: Incomplete', 'Swipes: 18:35, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:49', ''),
(10, '290', '2026-07-01', 'Fast-Fix Bulk Edit', 'Swipes: 09:02, Status: Incomplete', 'Swipes: 09:02, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:49', ''),
(11, '428', '2026-07-01', 'Fast-Fix Bulk Edit', 'Swipes: 18:36, Status: Incomplete', 'Swipes: 18:36, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:49', ''),
(12, '0062', '2026-07-02', 'Fast-Fix Bulk Edit', 'Swipes: 08:02, Status: Incomplete', 'Swipes: 08:02, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:49', ''),
(13, '290', '2026-07-02', 'Fast-Fix Bulk Edit', 'Swipes: 09:07, Status: Incomplete', 'Swipes: 09:07, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:49', ''),
(14, '244', '2026-07-03', 'Fast-Fix Bulk Edit', 'Swipes: 19:04, Status: Incomplete', 'Swipes: 19:04, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:49', ''),
(15, '290', '2026-07-04', 'Fast-Fix Bulk Edit', 'Swipes: 09:06, Status: Incomplete', 'Swipes: 09:06, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:49', ''),
(16, '383', '2026-07-04', 'Fast-Fix Bulk Edit', 'Swipes: 07:56, Status: Incomplete', 'Swipes: 07:56, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:49', ''),
(17, '290', '2026-07-06', 'Fast-Fix Bulk Edit', 'Swipes: 08:56, Status: Incomplete', 'Swipes: 08:56, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:49', ''),
(18, '290', '2026-07-07', 'Fast-Fix Bulk Edit', 'Swipes: 11:34, Status: Incomplete', 'Swipes: 11:34, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:49', ''),
(19, '406', '2026-07-07', 'Fast-Fix Bulk Edit', 'Swipes: 07:55, Status: Incomplete', 'Swipes: 07:55, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:49', ''),
(20, '290', '2026-07-08', 'Fast-Fix Bulk Edit', 'Swipes: 09:15, Status: Incomplete', 'Swipes: 09:15, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:49', ''),
(21, '006', '2026-07-09', 'Fast-Fix Bulk Edit', 'Swipes: 18:36, Status: Incomplete', 'Swipes: 18:36, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:49', ''),
(22, '290', '2026-07-11', 'Fast-Fix Bulk Edit', 'Swipes: 09:36, Status: Incomplete', 'Swipes: 09:36, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:49', ''),
(23, '290', '2026-07-13', 'Fast-Fix Bulk Edit', 'Swipes: 09:36, Status: Incomplete', 'Swipes: 09:36, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:49', ''),
(24, '244', '2026-07-17', 'Fast-Fix Bulk Edit', 'Swipes: 07:55, Status: Incomplete', 'Swipes: 07:55, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:49', ''),
(25, '290', '2026-07-17', 'Fast-Fix Bulk Edit', 'Swipes: 09:10, Status: Incomplete', 'Swipes: 09:10, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:49', ''),
(26, '290', '2026-07-18', 'Fast-Fix Bulk Edit', 'Swipes: 10:04, Status: Incomplete', 'Swipes: 10:04, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:49', ''),
(27, '501', '2026-07-20', 'Fast-Fix Bulk Edit', 'Swipes: 14:04 14:08, Status: Incomplete', 'Swipes: 14:04 14:08, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:49', ''),
(28, '290', '2026-07-22', 'Fast-Fix Bulk Edit', 'Swipes: 18:00, Status: Incomplete', 'Swipes: 18:00, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:49', ''),
(29, '290', '2026-07-25', 'Fast-Fix Bulk Edit', 'Swipes: 09:29, Status: Incomplete', 'Swipes: 09:29, Status: Absent', 'Admin Fast-Fix', 'Bulk Fast-Fix Resolution', '2026-09-02 10:55:49', ''),
(30, '503', '2026-08-11', 'Fast-Fix Bulk Edit', 'Swipes: 07:51, Status: Incomplete', 'Swipes: 07:51 16:30, Status: Present (Full)', 'Admin Fast-Fix', 'Individual Fast-Fix Resolution', '2026-09-03 10:03:56', ''),
(31, '217', '2026-08-11', 'Fast-Fix Bulk Edit', 'Swipes: 07:53, Status: Incomplete', 'Swipes: 07:53 16:30, Status: Present (Full)', 'Admin Fast-Fix', 'Individual Fast-Fix Resolution', '2026-09-03 10:03:52', ''),
(32, '512', '2026-08-03', 'Fast-Fix Bulk Edit', 'Swipes: 18:31, Status: Incomplete', 'Swipes: 08:30 18:31, Status: Present (Full)', 'Admin Fast-Fix', 'Individual Fast-Fix Resolution', '2026-09-03 10:03:46', ''),
(33, '041', '2026-08-14', 'Fast-Fix Bulk Edit', 'Swipes: 06:04, Status: Incomplete', 'Swipes: 06:04 17:30, Status: Present (Full)', 'Admin Fast-Fix', 'Individual Fast-Fix Resolution', '2026-09-03 10:02:59', ''),
(34, '369', '2026-08-03', 'Attendance Record', 'Swipes: 11:00 16:32, Status: Present (Full)', 'Swipes: 12:00 16:32, Status: Present (Full)', 'HR Admin', 'gg', '2026-09-03 10:02:25', ''),
(35, '369', '2026-08-21', 'Attendance Record', 'Swipes: 12:00 15:34, Status: Present (Full)', 'Swipes: 11:00 15:34, Status: Present (Full)', 'HR Admin', 'hjh', '2026-09-03 10:01:55', ''),
(36, '369', '2026-08-21', 'Fast-Fix Bulk Edit', 'Swipes: 15:34, Status: Incomplete', 'Swipes: 12:00 15:34, Status: Present (Full)', 'Admin Fast-Fix', 'Individual Fast-Fix Resolution', '2026-09-03 10:00:23', ''),
(37, '369', '2026-08-03', 'Fast-Fix Bulk Edit', 'Swipes: 16:32, Status: Incomplete', 'Swipes: 11:00 16:32, Status: Present (Full)', 'Admin Fast-Fix', 'Individual Fast-Fix Resolution', '2026-09-03 10:00:23', ''),
(38, '285', '2026-08-15', 'Fast-Fix Bulk Edit', 'Swipes: 07:00, Status: Incomplete', 'Swipes: 07:00 15:30, Status: Present (Full)', 'Admin Fast-Fix', 'Individual Fast-Fix Resolution', '2026-09-03 09:58:45', ''),
(39, '285', '2026-08-02', 'Fast-Fix Bulk Edit', 'Swipes: 06:56, Status: Incomplete', 'Swipes: 06:56 15:30, Status: Present (Full)', 'Admin Fast-Fix', 'Individual Fast-Fix Resolution', '2026-09-03 09:58:44', ''),
(40, '501', '2026-08-21', 'Attendance Record', 'Swipes: 17:45, Status: Incomplete', 'Swipes: 07:30 17:30, Status: Present (Full)', 'HR Admin', 'eee', '2026-09-03 08:11:14', ''),
(41, '0062', '2026-08-08', 'Fast-Fix Bulk Edit', 'Swipes: 07:56, Status: Incomplete', 'Swipes: 07:56 19:30, Status: Present (Full)', 'Admin Fast-Fix', 'Individual Fast-Fix Resolution', '2026-09-03 08:04:55', ''),
(42, '0062', '2026-08-04', 'Fast-Fix Bulk Edit', 'Swipes: 07:59, Status: Incomplete', 'Swipes: 07:59 19:30, Status: Present (Full)', 'Admin Fast-Fix', 'Individual Fast-Fix Resolution', '2026-09-03 08:04:55', ''),
(43, '0062', '2026-08-09', 'Fast-Fix Bulk Edit', 'Swipes: 08:52, Status: Incomplete', 'Swipes: 08:52 21:30, Status: Present (Full)', 'Admin Fast-Fix', 'Individual Fast-Fix Resolution', '2026-09-03 08:04:54', ''),
(44, '092', '2026-08-01', 'Attendance Record', 'Swipes: 09:00 18:30, Status: Absent', 'Swipes: 09:00 18:30, Status: Present (Full)', 'HR Admin', 'ght', '2026-09-03 07:54:54', ''),
(45, '092', '2026-08-12', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:30 18:00, Status: Present (Full)', 'HR Admin', 'gg', '2026-09-03 07:54:19', ''),
(46, '092', '2026-08-11', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:28 16:00, Status: Present (Full)', 'HR Admin', 'yy', '2026-09-03 07:54:04', ''),
(47, '092', '2026-08-10', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:30 18:00, Status: Present (Full)', 'HR Admin', 'ukyuk', '2026-09-03 07:53:47', ''),
(48, '092', '2026-08-08', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:25 18:00, Status: Present (Full)', 'HR Admin', 'hjtht', '2026-09-03 07:53:31', ''),
(49, '092', '2026-08-07', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:35 18:30, Status: Present (Full)', 'HR Admin', 'tthth', '2026-09-03 07:53:02', ''),
(50, '092', '2026-08-06', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 09:20 18:00, Status: Present (Full)', 'HR Admin', 'gy', '2026-09-03 07:52:43', ''),
(51, '092', '2026-08-05', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:30 18:00, Status: Present (Full)', 'HR Admin', 'gg', '2026-09-03 07:52:32', ''),
(52, '092', '2026-08-04', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 09:30 18:00, Status: Present (Full)', 'HR Admin', 'ttt', '2026-09-03 07:52:20', ''),
(53, '092', '2026-08-03', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:30 18:00, Status: Present (Full)', 'HR Admin', 'ff', '2026-09-03 07:52:03', ''),
(54, '092', '2026-08-01', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 09:00 18:30, Status: Absent', 'HR Admin', 'dd', '2026-09-03 07:51:39', ''),
(55, '514', '2026-08-02', 'Attendance Record', 'Swipes: 00:00, Status: Weekly Off (Paid)', 'Swipes: 00:00, Status: Weekly Off (Forfeited)', 'HR Admin', 'fvv', '2026-09-03 07:40:49', ''),
(56, '514', '2026-08-15', 'Attendance Record', 'Swipes: 00:00, Status: Weekly Off (Forfeited)', 'Swipes: 00:00, Status: Weekly Off (Forfeited)', 'HR Admin', 'independence day', '2026-09-03 07:39:36', ''),
(57, '514', '2026-08-15', 'Attendance Record', 'Swipes: 00:00, Status: Weekly Off (Paid)', 'Swipes: 00:00, Status: Weekly Off (Forfeited)', 'HR Admin', 'cfd', '2026-09-03 07:39:17', ''),
(58, '514', '2026-08-15', 'Attendance Record', 'Swipes: 00:00, Status: Holiday (Forfeited)', 'Swipes: 00:00, Status: Weekly Off (Paid)', 'HR Admin', 'fbf', '2026-09-03 07:39:00', ''),
(59, '514', '2026-08-20', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'xxdx', '2026-09-03 07:36:51', ''),
(60, '514', '2026-08-19', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'efef', '2026-09-03 07:36:34', ''),
(61, '514', '2026-08-18', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'uui', '2026-09-03 07:36:22', ''),
(62, '514', '2026-08-17', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'dds', '2026-09-03 07:36:13', ''),
(63, '514', '2026-08-21', 'Attendance Record', 'Swipes: 17:39, Status: Incomplete', 'Swipes: 07:00 17:30, Status: Present (Full)', 'HR Admin', 'dd', '2026-09-03 07:35:36', ''),
(64, '513', '2026-08-15', 'Attendance Record', 'Swipes: 00:00, Status: Holiday (Forfeited)', 'Swipes: 00:00, Status: Weekly Off (Paid)', 'HR Admin', 'yy', '2026-09-03 07:34:15', ''),
(65, '513', '2026-08-13', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'ssss', '2026-09-03 07:33:43', ''),
(66, '513', '2026-08-12', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'ss', '2026-09-03 07:33:32', ''),
(67, '513', '2026-08-11', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'ddcd', '2026-09-03 07:33:19', ''),
(68, '239', '2026-08-15', 'Attendance Record', 'Swipes: 00:00, Status: Holiday (Forfeited)', 'Swipes: 00:00, Status: Weekly Off (Paid)', 'HR Admin', 'exception mohit', '2026-09-03 06:37:34', ''),
(69, '511', '2026-08-01', 'Fast-Fix Bulk Edit', 'Swipes: 18:36, Status: Incomplete', 'Swipes: 08:00 18:36, Status: Present (Full)', 'Admin Fast-Fix', 'Individual Fast-Fix Resolution', '2026-09-03 05:55:05', ''),
(70, '295', '2026-08-22', 'Attendance Record', 'Swipes: 07:52, Status: Incomplete', 'Swipes: 07:52 20:00, Status: Present (Full)', 'HR Admin', 'eed', '2026-09-03 05:34:26', ''),
(71, '295', '2026-08-19', 'Attendance Record', 'Swipes: 07:50, Status: Incomplete', 'Swipes: 07:50 20:00, Status: Present (Full)', 'HR Admin', 'er', '2026-09-03 05:34:14', ''),
(72, '295', '2026-08-05', 'Attendance Record', 'Swipes: 07:55, Status: Incomplete', 'Swipes: 07:55 20:00, Status: Present (Full)', 'HR Admin', 'dd', '2026-09-03 05:33:59', ''),
(73, '295', '2026-08-01', 'Attendance Record', 'Swipes: 07:50, Status: Incomplete', 'Swipes: 07:50 20:00, Status: Present (Full)', 'HR Admin', 'dd', '2026-09-03 05:33:40', ''),
(74, '043', '2026-08-31', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'efef', '2026-09-03 05:25:39', ''),
(75, '043', '2026-08-29', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'frf', '2026-09-03 05:25:10', ''),
(76, '043', '2026-08-28', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'ss', '2026-09-03 05:24:56', ''),
(77, '043', '2026-08-24', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'ddx', '2026-09-03 05:24:35', ''),
(78, '043', '2026-08-22', 'Attendance Record', 'Swipes: 18:38, Status: Incomplete', 'Swipes: 08:00 18:38, Status: Present (Full)', 'HR Admin', 'ddd', '2026-09-03 05:22:55', ''),
(79, '043', '2026-08-21', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 07:00 18:30, Status: Present (Full)', 'HR Admin', 'eed', '2026-09-03 05:22:11', ''),
(80, '043', '2026-08-20', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'aa', '2026-09-03 05:21:37', ''),
(81, '043', '2026-08-19', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'dscd', '2026-09-03 05:21:24', ''),
(82, '043', '2026-08-18', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'sss', '2026-09-03 05:21:14', ''),
(83, '043', '2026-08-15', 'Attendance Record', 'Swipes: 00:00, Status: Holiday (Forfeited)', 'Swipes: 00:00, Status: Weekly Off (Paid)', 'HR Admin', 'ff', '2026-09-03 05:20:41', ''),
(84, '043', '2026-08-15', 'Attendance Record', 'Swipes: 00:00, Status: Holiday (Forfeited)', 'Swipes: 00:00, Status: Holiday (Forfeited)', 'HR Admin', 'b', '2026-09-03 05:20:23', ''),
(85, '043', '2026-08-17', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'dsfc', '2026-09-03 05:19:40', ''),
(86, '043', '2026-08-13', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'xdsvc', '2026-09-03 05:19:22', ''),
(87, '043', '2026-08-12', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'nn', '2026-09-03 05:19:09', ''),
(88, '043', '2026-08-11', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'cscfs', '2026-09-03 05:18:54', ''),
(89, '043', '2026-08-10', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'nn', '2026-09-03 05:18:44', ''),
(90, '043', '2026-08-08', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'manual', '2026-09-03 05:18:26', ''),
(91, '043', '2026-08-07', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'manual', '2026-09-03 05:17:57', ''),
(92, '043', '2026-08-06', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'manual', '2026-09-03 05:17:01', ''),
(93, '043', '2026-08-05', 'Attendance Record', 'Swipes: 00:00, Status: Absent', 'Swipes: 08:00 18:30, Status: Present (Full)', 'HR Admin', 'manual', '2026-09-03 05:16:38', ''),
(94, '043', '2026-08-04', 'Attendance Record', 'Swipes: 07:58, Status: Incomplete', 'Swipes: 07:58 18:30, Status: Present (Full)', 'HR Admin', 'manual', '2026-09-03 05:16:16', ''),
(95, '040', '2026-08-15', 'Attendance Record', 'Swipes: 06:57, Status: Incomplete', 'Swipes: 06:57 18:30, Status: Present (Full)', 'HR Admin', 'manual', '2026-09-03 05:04:50', ''),
(96, '006', '2026-08-26', 'Attendance Record', 'Swipes: 07:57, Status: Incomplete', 'Swipes: 07:57 20:00, Status: Present (Full)', 'HR Admin', 'fedf', '2026-09-03 05:02:22', ''),
(97, '423', '2026-08-31', 'Attendance Record', 'Swipes: 09:30, Status: Incomplete', 'Swipes: 09:30 18:30, Status: Present (Full)', 'HR Admin', 'JHJJ', '2026-09-02 12:32:33', ''),
(98, '423', '2026-08-22', 'Attendance Record', 'Swipes: 08:30, Status: Incomplete', 'Swipes: 08:30 18:30, Status: Present (Full)', 'HR Admin', 'HHH', '2026-09-02 12:32:17', ''),
(99, '513', '2026-08-14', 'Attendance Record', 'Swipes: 18:37, Status: Incomplete', 'Swipes: 08:00 18:37, Status: Present (Full)', 'HR Admin', 'BYBYUB', '2026-09-02 12:17:56', ''),
(100, '501', '2026-08-24', 'Attendance Record', 'Status: Absent (OT Credited), Duty: 0, OT: 4.5', 'Status: Present (Full), Duty: 8, OT: 4.5', 'HR Admin', 'Office staff full day attendance approved', '2026-09-07 08:31:57', '')
ON CONFLICT DO NOTHING;

INSERT INTO "user_sessions" ("token", "created_at", "expires_at", "last_activity_at") VALUES
('b8f632196d28d6f506a9676a11fb5d904cff342c881c85a3cfe6004831a715da', '2026-09-08 08:16:24', '2026-09-15T08:16:24.071Z', NULL),
('d006964de82ded75649ab1c5a20fc3306099f6df21fd2bc36259d82874eb0e59', '2026-09-08 08:20:18', '2026-09-15T08:20:18.729Z', NULL),
('a17ef0a14c572e6c317aa51efbe9820876556d82dcb19e213856087bcfecacdc', '2026-09-08 08:20:18', '2026-09-15T08:20:18.763Z', NULL),
('71596d3490b607e21dd73047fb5bb265d5a3863aa419c3d6ac84fbb47d01d955', '2026-09-08 11:14:35', '2026-09-08T12:15:35.776Z', '2026-09-08T11:45:35.776Z')
ON CONFLICT DO NOTHING;

