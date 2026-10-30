const {
  calculateWorkingHours,
  computeDailyAttendance,
  formatHours
} = require('../server/rulesEngine');

console.log('=== TEST SUITE: ATTENDANCE WORKING HOURS & LUNCH BREAK DEDUCTION ===\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  } else {
    console.log(`✅ PASS: ${message}`);
    passed++;
  }
}

// Scenario 1: Worker arrived at 12:30 and left at 18:00 (or "6")
// Lunch break is 12:30 - 13:00 (30 mins).
// Gross: 5h 30m. Lunch overlap: 30m. Net: 5 Hours!
const r1 = calculateWorkingHours('12:30', '18:00');
assert(r1.grossMins === 330, 'Scenario 1: Gross minutes is 330 (5h 30m)');
assert(r1.lunchDeductionMins === 30, 'Scenario 1: Lunch deduction is 30m');
assert(r1.netMins === 300, 'Scenario 1: Net minutes is 300 (5 Hours)');
assert(r1.formatted === '5 Hours', 'Scenario 1: Formatted hours is "5 Hours"');

// Scenario 2: Worker arrived at 12:59 and left at 18:00 (or "6")
// Arrived 1 minute before lunch end (13:00).
// Gross: 5h 01m. Lunch overlap: 1m. Net: 5 Hours!
const r2 = calculateWorkingHours('12:59', '18:00');
assert(r2.grossMins === 301, 'Scenario 2: Gross minutes is 301 (5h 01m)');
assert(r2.lunchDeductionMins === 1, 'Scenario 2: Lunch deduction is 1m (12:59 - 13:00)');
assert(r2.netMins === 300, 'Scenario 2: Net minutes is 300 (5 Hours)');
assert(r2.formatted === '5 Hours', 'Scenario 2: Formatted hours is "5 Hours"');

// Scenario 3: Worker arrived at 13:01 and left at 18:00 (or "6")
// Arrived 1 minute after lunch ended (13:00).
// Gross: 4h 59m. Lunch overlap: 0m. Net: 4h 59m!
const r3 = calculateWorkingHours('13:01', '18:00');
assert(r3.grossMins === 299, 'Scenario 3: Gross minutes is 299 (4h 59m)');
assert(r3.lunchDeductionMins === 0, 'Scenario 3: Lunch deduction is 0m');
assert(r3.netMins === 299, 'Scenario 3: Net minutes is 299 (4h 59m)');
assert(r3.formatted === '4h 59m', 'Scenario 3: Formatted hours is "4h 59m"');

// Scenario 4: Natural "6" evening input
const r4 = calculateWorkingHours('12:30', '6');
assert(r4.formatted === '5 Hours', 'Scenario 4: 12:30 to "6" gives "5 Hours"');

const r5 = calculateWorkingHours('12:59', '6');
assert(r5.formatted === '5 Hours', 'Scenario 5: 12:59 to "6" gives "5 Hours"');

const r6 = calculateWorkingHours('13:01', '6');
assert(r6.formatted === '4h 59m', 'Scenario 6: 13:01 to "6" gives "4h 59m"');

// Scenario 7: Standard morning shift with lunch break
// 09:00 to 18:00 = Gross 9h - 30m lunch = 8h 30m!
const r7 = calculateWorkingHours('09:00', '18:00');
assert(r7.netMins === 510, 'Scenario 7: 09:00 to 18:00 gives 510 mins (8h 30m)');
assert(r7.lunchDeductionMins === 30, 'Scenario 7: Full 30m lunch deducted');
assert(r7.formatted === '8h 30m', 'Scenario 7: Formatted is "8h 30m"');

// Scenario 8: Biometric Multi-Punch without double deduction
const settings = {
  shift_start: '08:00',
  shift_end: '16:30',
  grace_slab_minutes: 0,
  lunch_deduction_mins: 30,
  lunch_start: '12:30',
  lunch_end: '13:00',
  ot_rounding: '30min_block'
};

const attMultipunch = computeDailyAttendance(
  ['08:00', '12:30', '13:00', '18:30'],
  settings,
  'Mon'
);
assert(attMultipunch.regularHours === 8, 'Scenario 8: Regular hours is 8.0');
assert(attMultipunch.otHours === 2, 'Scenario 8: OT hours is 2.0 (no double deduction for punched lunch)');
assert(attMultipunch.totalHours === 10, 'Scenario 8: Total hours is 10.0');

console.log(`\n================================`);
console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
console.log(`================================`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL ATTENDANCE LUNCH TESTS PASSED!\n');
}
