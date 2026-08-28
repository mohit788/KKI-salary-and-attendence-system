/**
 * Calculate Monthly Payroll summary for a single worker including allowances
 * @param {Object} params 
 */
function calculateWorkerPayroll({
  monthlySalary = 15000,
  housingAllowance = 0,
  foodAllowance = 0,
  otherAllowance = 0,
  dailyRecords = [],
  advances = [],
  settings = {},
  salaryRules = [],
}) {
  // Auto-detect exact calendar days of the month from record dates (e.g. July = 31, Feb = 28/29, April = 30)
  let detectedMonthDays = 30;
  if (Array.isArray(dailyRecords) && dailyRecords.length > 0) {
    const validDateRec = dailyRecords.find(r => r && r.date && /^\d{4}-\d{2}-\d{2}$/.test(String(r.date)));
    if (validDateRec) {
      const parts = String(validDateRec.date).split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (y && m) {
        // Date(y, m, 0) gives the total days in month m (e.g. July -> 31, Feb -> 28/29)
        detectedMonthDays = new Date(y, m, 0).getDate();
      }
    } else if (dailyRecords.length >= 28 && dailyRecords.length <= 31) {
      detectedMonthDays = dailyRecords.length;
    }
  }

  const standardDaysType = settings.standard_month_days || 'calendar';
  let standardDays = detectedMonthDays;
  if (standardDaysType === '26') {
    standardDays = 26;
  } else if (standardDaysType === '30') {
    standardDays = 30;
  } else if (standardDaysType === 'calendar') {
    standardDays = detectedMonthDays;
  } else {
    const parsed = parseInt(standardDaysType, 10);
    standardDays = (!isNaN(parsed) && parsed > 0) ? parsed : detectedMonthDays;
  }

  const otMultiplier = parseFloat(settings.ot_multiplier || 1.5);
  const sundayOtMultiplier = parseFloat(settings.sunday_ot_multiplier || 2.0);

  const perDayRate = +(monthlySalary / standardDays).toFixed(2);
  const hourlyRate = +(perDayRate / 8).toFixed(2);
  const hourlyOtRate = +(hourlyRate * otMultiplier).toFixed(2);
  const hourlySundayOtRate = +(hourlyRate * sundayOtMultiplier).toFixed(2);

  let fullPresentDays = 0;
  let shortDays = 0;
  let paidWeeklyOffs = 0;
  let forfeitedWeeklyOffs = 0;
  let sundayWorkedDays = 0;
  let paidHolidays = 0;
  let holidayWorkedDays = 0;
  let absentDays = 0;
  let incompleteDays = 0;
  let totalOtHours = 0;
  let totalSundayOtHours = 0;
  let totalWorkedHours = 0;

  dailyRecords.forEach(rec => {
    totalOtHours += (rec.ot_hours || 0);
    totalSundayOtHours += (rec.sunday_ot_hours || 0);
    totalWorkedHours += (rec.total_hours || 0);

    const st = rec.status || '';
    if (st.includes('Weekly Off (Worked OT)')) {
      // Worker came on Sunday — gets paid day + all time is Sunday OT
      sundayWorkedDays += 1;
      paidWeeklyOffs += 1; // Sunday is still a paid day
    } else if (st.includes('Holiday (Worked OT)')) {
      // Worker worked on a Paid National/Factory Holiday
      holidayWorkedDays += 1;
      paidHolidays += 1; // Holiday is still a paid day
    } else if (st.includes('Holiday (Paid)')) {
      paidHolidays += 1;
    } else if (st.includes('Present (Full)')) {
      fullPresentDays += 1;
    } else if (st.includes('Present (Short)')) {
      shortDays += 1;
    } else if (st.includes('Weekly Off (Paid)')) {
      paidWeeklyOffs += 1;
    } else if (st.includes('Weekly Off (Forfeited)')) {
      forfeitedWeeklyOffs += 1;
    } else if (st.includes('Absent')) {
      absentDays += 1;
    } else if (st.includes('Incomplete')) {
      incompleteDays += 1;
    }
  });

  // Short days count as 0.5 day (or prorated worked hours / 8)
  const proratedShortDays = +(shortDays * 0.5).toFixed(2);
  const payableDays = +(fullPresentDays + proratedShortDays + paidWeeklyOffs + paidHolidays).toFixed(2);

  const basePay = +(payableDays * perDayRate).toFixed(2);
  const otPay = +(totalOtHours * hourlyOtRate).toFixed(2);
  const sundayOtPay = +(totalSundayOtHours * hourlySundayOtRate).toFixed(2);

  const hAllowance = parseFloat(housingAllowance) || 0;
  const fAllowance = parseFloat(foodAllowance) || 0;
  const oAllowance = parseFloat(otherAllowance) || 0;
  const totalAllowances = +(hAllowance + fAllowance + oAllowance).toFixed(2);

  // Apply Custom Salary Rules (bonuses and deductions)
  let customBonuses = 0;
  let customDeductions = 0;
  const appliedRules = [];

  if (Array.isArray(salaryRules)) {
    salaryRules.forEach(rule => {
      if (!rule || !rule.is_active) return;

      let ruleApplies = false;
      const condValue = parseFloat(rule.condition_value) || 0;
      const actionValue = parseFloat(rule.action_value) || 0;

      // Check condition
      switch (rule.condition_type) {
        case 'always':
          ruleApplies = true;
          break;
        case 'present_days_gt':
          ruleApplies = fullPresentDays > condValue;
          break;
        case 'present_days_lt':
          ruleApplies = fullPresentDays < condValue;
          break;
        case 'ot_hours_gt':
          ruleApplies = (totalOtHours + totalSundayOtHours) > condValue;
          break;
        case 'ot_hours_lt':
          ruleApplies = (totalOtHours + totalSundayOtHours) < condValue;
          break;
        case 'absent_days_gt':
          ruleApplies = absentDays > condValue;
          break;
        case 'absent_days_lt':
          ruleApplies = absentDays < condValue;
          break;
        case 'sunday_worked_gt':
          ruleApplies = sundayWorkedDays > condValue;
          break;
        case 'late_days_gt':
          ruleApplies = shortDays > condValue;
          break;
        case 'total_hours_gt':
          ruleApplies = totalWorkedHours > condValue;
          break;
        case 'salary_gt':
          ruleApplies = monthlySalary > condValue;
          break;
        case 'salary_lt':
          ruleApplies = monthlySalary < condValue;
          break;
        default:
          ruleApplies = false;
      }

      if (!ruleApplies) return;

      // Apply action
      let amount = 0;
      switch (rule.action_type) {
        case 'add_fixed':
          amount = actionValue;
          customBonuses += amount;
          break;
        case 'deduct_fixed':
          amount = actionValue;
          customDeductions += amount;
          break;
        case 'add_percentage':
          amount = +((monthlySalary * actionValue / 100)).toFixed(2);
          customBonuses += amount;
          break;
        case 'deduct_percentage':
          amount = +((monthlySalary * actionValue / 100)).toFixed(2);
          customDeductions += amount;
          break;
        default:
          return;
      }

      appliedRules.push({
        rule_name: rule.rule_name,
        rule_type: rule.rule_type,
        action_type: rule.action_type,
        amount,
      });
    });
  }

  const hasIncompleteEntries = incompleteDays > 0;
  const isCalculationLocked = hasIncompleteEntries;
  const lockReason = hasIncompleteEntries 
    ? `${incompleteDays} incomplete attendance record(s) need resolution before payroll can be calculated.`
    : '';

  const grossSalary = +(basePay + otPay + sundayOtPay + totalAllowances + customBonuses - customDeductions).toFixed(2);
  const totalAdvances = advances.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
  const netPayable = Math.max(0, +(grossSalary - totalAdvances).toFixed(2));

  return {
    monthlySalary,
    housingAllowance: hAllowance,
    foodAllowance: fAllowance,
    otherAllowance: oAllowance,
    totalAllowances,
    standardDays,
    perDayRate,
    hourlyRate,
    hourlyOtRate,
    hourlySundayOtRate,
    sundayOtMultiplier,
    fullPresentDays,
    shortDays,
    paidWeeklyOffs,
    forfeitedWeeklyOffs,
    sundayWorkedDays,
    paidHolidays,
    holidayWorkedDays,
    absentDays,
    incompleteDays,
    hasIncompleteEntries,
    isCalculationLocked,
    lockReason,
    totalOtHours: isCalculationLocked ? 0 : +totalOtHours.toFixed(2),
    totalSundayOtHours: isCalculationLocked ? 0 : +totalSundayOtHours.toFixed(2),
    totalCombinedOtHours: isCalculationLocked ? 0 : +(totalOtHours + totalSundayOtHours).toFixed(2),
    totalWorkedHours: isCalculationLocked ? 0 : +totalWorkedHours.toFixed(2),
    rawTotalOtHours: +totalOtHours.toFixed(2),
    rawTotalSundayOtHours: +totalSundayOtHours.toFixed(2),
    rawTotalWorkedHours: +totalWorkedHours.toFixed(2),
    payableDays: isCalculationLocked ? 0 : payableDays,
    rawPayableDays: payableDays,
    basePay: isCalculationLocked ? 0 : basePay,
    otPay: isCalculationLocked ? 0 : otPay,
    sundayOtPay: isCalculationLocked ? 0 : sundayOtPay,
    totalCombinedOtPay: isCalculationLocked ? 0 : +(otPay + sundayOtPay).toFixed(2),
    totalLeaves: absentDays + forfeitedWeeklyOffs,
    customBonuses: isCalculationLocked ? 0 : +customBonuses.toFixed(2),
    customDeductions: isCalculationLocked ? 0 : +customDeductions.toFixed(2),
    appliedRules: isCalculationLocked ? [] : appliedRules,
    grossSalary: isCalculationLocked ? 0 : grossSalary,
    rawGrossSalary: grossSalary,
    totalAdvances: +totalAdvances.toFixed(2),
    netPayable: isCalculationLocked ? 0 : netPayable,
    rawNetPayable: netPayable,
  };
}

module.exports = {
  calculateWorkerPayroll,
};
