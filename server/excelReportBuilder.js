const ExcelJS = require('exceljs');
const { parseSwipeRecord, computeDailyAttendance } = require('./rulesEngine');
const { calculateWorkerPayroll } = require('./payrollEngine');

// 🎨 Professional Theme Palette Configurations
const THEMES = {
  NAVY: {
    primary: '1E293B',    // Dark Slate Header
    secondary: '334155',  // Subheader
    accent: '0EA5E9',     // Sky Blue Accent
    headerFont: 'FFFFFF',
    zebraLight: 'F8FAFC',
    zebraDark: 'FFFFFF',
    border: 'CBD5E1',
    highlight: 'F1F5F9'
  },
  TEAL: {
    primary: '0F766E',    // Deep Teal Header
    secondary: '115E59',
    accent: '14B8A6',
    headerFont: 'FFFFFF',
    zebraLight: 'F0FDFA',
    zebraDark: 'FFFFFF',
    border: 'CCFBF1',
    highlight: 'E6FFFA'
  },
  BLUE: {
    primary: '1D4ED8',    // Royal Blue Header
    secondary: '1E40AF',
    accent: '3B82F6',
    headerFont: 'FFFFFF',
    zebraLight: 'EFF6FF',
    zebraDark: 'FFFFFF',
    border: 'BFDBFE',
    highlight: 'DBEAFE'
  },
  CRIMSON: {
    primary: '991B1B',    // Crimson / Burgundy Header
    secondary: '7F1D1D',
    accent: 'E11D48',
    headerFont: 'FFFFFF',
    zebraLight: 'FFF1F2',
    zebraDark: 'FFFFFF',
    border: 'FECDD3',
    highlight: 'FFE4E6'
  },
  INDIGO: {
    primary: '3730A3',    // Deep Indigo Header
    secondary: '312E81',
    accent: '6366F1',
    headerFont: 'FFFFFF',
    zebraLight: 'EEF2FF',
    zebraDark: 'FFFFFF',
    border: 'C7D2FE',
    highlight: 'E0E7FF'
  },
  AMBER: {
    primary: 'B45309',    // Deep Amber / Bronze Header
    secondary: '92400E',
    accent: 'F59E0B',
    headerFont: 'FFFFFF',
    zebraLight: 'FFFBEB',
    zebraDark: 'FFFFFF',
    border: 'FDE68A',
    highlight: 'FEF3C7'
  }
};

/**
 * Creates a professionally styled worksheet with Title Banner, Subtitle, Headers, Zebra Data Rows, and Totals
 */
function createStyledSheet(workbook, sheetName, options = {}) {
  const theme = options.theme || THEMES.NAVY;
  const ws = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', xSplit: options.freezeCol || 0, ySplit: options.freezeRow || 4, showGridLines: true }],
    properties: { defaultRowHeight: 20 }
  });

  const columns = options.columns || [];
  const title = options.title || sheetName;
  const subtitle = options.subtitle || `Factory Attendance & Payroll System — Generated on ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
  const totalCols = columns.length;

  // 1. Title Banner (Row 1)
  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title.toUpperCase();
  titleCell.font = { name: 'Segoe UI', size: 12.5, bold: true, color: { argb: theme.headerFont } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: theme.primary } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 30;

  // 2. Subtitle / Metadata Bar (Row 2)
  ws.mergeCells(2, 1, 2, totalCols);
  const subCell = ws.getCell(2, 1);
  subCell.value = subtitle;
  subCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'F8FAFC' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: theme.secondary } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(2).height = 20;

  // 3. Blank / Breathing Row (Row 3)
  ws.getRow(3).height = 6;

  // 4. Table Header Row (Row 4)
  const headerRow = ws.getRow(4);
  headerRow.height = 26;
  columns.forEach((col, idx) => {
    const colNum = idx + 1;
    const cell = headerRow.getCell(colNum);
    cell.value = col.header;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: theme.headerFont } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: theme.primary } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: col.align || (col.type === 'number' || col.type === 'currency' ? 'right' : 'center'),
      wrapText: true
    };
    cell.border = {
      top: { style: 'medium', color: { argb: theme.primary } },
      left: { style: 'thin', color: { argb: '94A3B8' } },
      bottom: { style: 'medium', color: { argb: theme.primary } },
      right: { style: 'thin', color: { argb: '94A3B8' } }
    };
  });

  // Enable Auto-Filter on Header Row
  ws.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: totalCols }
  };

  return { ws, startDataRow: 5, totalCols, columns, theme };
}

/**
 * Populates data rows with zebra striping, precise formatting, borders, and status highlighting
 */
function populateDataRows(sheetConfig, rowsData) {
  const { ws, startDataRow, columns, theme } = sheetConfig;
  let currentRowNum = startDataRow;

  const colWidths = columns.map(c => Math.max((c.header || '').length + 4, c.minWidth || 12));

  rowsData.forEach((rowObj, rowIdx) => {
    const row = ws.getRow(currentRowNum);
    row.height = 21;
    const isEven = rowIdx % 2 === 0;
    const bgColor = isEven ? theme.zebraLight : theme.zebraDark;

    columns.forEach((col, colIdx) => {
      const colNum = colIdx + 1;
      const cell = row.getCell(colNum);
      const rawVal = rowObj[col.key] !== undefined ? rowObj[col.key] : (Array.isArray(rowObj) ? rowObj[colIdx] : '');

      let displayVal = rawVal;
      let numFmt = undefined;

      if (col.type === 'number') {
        const num = parseFloat(rawVal);
        displayVal = isNaN(num) ? 0 : num;
        numFmt = col.numFmt || (col.decimals === 0 ? '#,##0' : '0.00');
      } else if (col.type === 'currency') {
        const num = parseFloat(rawVal);
        displayVal = isNaN(num) ? 0 : num;
        numFmt = col.numFmt || '"₹" #,##0.00';
      } else if (col.type === 'date') {
        displayVal = rawVal ? String(rawVal).substring(0, 10) : '';
      } else {
        displayVal = rawVal !== null && rawVal !== undefined ? String(rawVal) : '';
      }

      cell.value = displayVal;
      if (numFmt) cell.numFmt = numFmt;

      // Font & Alignment
      cell.font = {
        name: 'Segoe UI',
        size: 9.5,
        bold: col.bold || false,
        color: { argb: col.textColor ? col.textColor(displayVal, rowObj) : '0F172A' }
      };

      cell.alignment = {
        vertical: 'middle',
        horizontal: col.align || (col.type === 'number' || col.type === 'currency' ? 'right' : (col.type === 'text_left' ? 'left' : 'center')),
        wrapText: col.wrapText || false
      };

      // Background fill (status-aware or zebra)
      let cellBg = bgColor;
      if (col.highlight) {
        const customBg = col.highlight(displayVal, rowObj);
        if (customBg) cellBg = customBg;
      }

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: cellBg }
      };

      // Clean Thin Borders
      cell.border = {
        top: { style: 'thin', color: { argb: theme.border } },
        left: { style: 'thin', color: { argb: theme.border } },
        bottom: { style: 'thin', color: { argb: theme.border } },
        right: { style: 'thin', color: { argb: theme.border } }
      };

      // Measure column width
      const strLen = String(displayVal).length;
      colWidths[colIdx] = Math.max(colWidths[colIdx], strLen + 4);
    });

    currentRowNum++;
  });

  // Set column widths with safety bounds
  columns.forEach((col, idx) => {
    const finalWidth = Math.min(Math.max(colWidths[idx], col.minWidth || 12), col.maxWidth || 55);
    ws.getColumn(idx + 1).width = finalWidth;
  });

  return { lastRowNum: currentRowNum - 1 };
}

/**
 * Adds an executive summary / totals row at the bottom of the table
 */
function addTotalsRow(sheetConfig, lastRowNum, totalsObj) {
  const { ws, columns, theme } = sheetConfig;
  const totalsRowNum = lastRowNum + 1;
  const row = ws.getRow(totalsRowNum);
  row.height = 24;

  columns.forEach((col, colIdx) => {
    const colNum = colIdx + 1;
    const cell = row.getCell(colNum);

    if (totalsObj[col.key] !== undefined) {
      const val = totalsObj[col.key];
      if (typeof val === 'number') {
        cell.value = val;
        if (col.type === 'currency') {
          cell.numFmt = '"₹" #,##0.00';
        } else if (col.type === 'number') {
          cell.numFmt = col.decimals === 0 ? '#,##0' : '0.00';
        }
      } else {
        cell.value = String(val);
      }
    } else if (colIdx === 0) {
      cell.value = 'TOTAL / SUMMARY';
    } else {
      cell.value = '';
    }

    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: '0F172A' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: col.align || (col.type === 'number' || col.type === 'currency' ? 'right' : 'center')
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: theme.highlight }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: theme.primary } },
      left: { style: 'thin', color: { argb: theme.border } },
      bottom: { style: 'double', color: { argb: theme.primary } },
      right: { style: 'thin', color: { argb: theme.border } }
    };
  });
}

// ==========================================
// 1. REPORT 1: 5-COLUMN EXECUTIVE SUMMARY
// ==========================================
async function buildExecutiveSummaryReport({ month, workers, attendanceMap, settings }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'KKI Attendance & Payroll System';
  const monthLabel = month && month !== 'all' ? `Month: ${month}` : 'All Months (Cumulative)';

  const columns = [
    { key: 'staff_no', header: 'WORKER ID', align: 'center', minWidth: 14, bold: true },
    { key: 'staff_name', header: 'WORKER NAME', align: 'left', minWidth: 26, bold: true, type: 'text_left' },
    { key: 'payable_days', header: 'PAYABLE DAYS', align: 'right', type: 'number', decimals: 1, minWidth: 16 },
    { key: 'absent_days', header: 'ABSENT DAYS', align: 'right', type: 'number', decimals: 1, minWidth: 16, textColor: (v) => v > 0 ? 'DC2626' : '0F172A' },
    { key: 'sun_hol_worked', header: 'SUN/HOL WORKED (DAYS)', align: 'right', type: 'number', decimals: 0, minWidth: 22 },
    { key: 'total_ot_hours', header: 'OVERTIME (HOURS)', align: 'right', type: 'number', decimals: 2, minWidth: 18, bold: true }
  ];

  const sheetConfig = createStyledSheet(wb, 'Executive Attendance Summary', {
    theme: THEMES.TEAL,
    title: 'Executive Attendance & Overtime Summary Report',
    subtitle: `KKI Factory Attendance Management — ${monthLabel}`,
    columns
  });

  const rows = [];
  let totPayable = 0, totAbsent = 0, totSunHol = 0, totOT = 0;

  for (const w of workers) {
    const dailyRecords = attendanceMap.get(w.staff_no) || [];
    const p = calculateWorkerPayroll({
      staffNo: w.staff_no,
      monthlySalary: w.monthly_salary || 15000,
      dailyRecords,
      advances: [],
      settings
    });

    const payable = p.payableDays || 0;
    const absent = p.absentDays || 0;
    const sunHol = p.sundayAndHolidayWorkedDays || 0;
    const ot = +((p.totalOtHours || 0) + (p.totalSundayOtHours || 0)).toFixed(2);

    totPayable += payable;
    totAbsent += absent;
    totSunHol += sunHol;
    totOT += ot;

    rows.push({
      staff_no: w.staff_no,
      staff_name: w.staff_name || w.staff_no,
      payable_days: payable,
      absent_days: absent,
      sun_hol_worked: sunHol,
      total_ot_hours: ot
    });
  }

  const { lastRowNum } = populateDataRows(sheetConfig, rows);
  addTotalsRow(sheetConfig, lastRowNum, {
    staff_no: 'TOTAL',
    staff_name: `${workers.length} Workers`,
    payable_days: +totPayable.toFixed(1),
    absent_days: +totAbsent.toFixed(1),
    sun_hol_worked: totSunHol,
    total_ot_hours: +totOT.toFixed(2)
  });

  return await wb.xlsx.writeBuffer();
}

// ==========================================
// 2. REPORT 2: BIOMETRIC TIMINGS REPORT
// ==========================================
async function buildBiometricTimingsReport({ month, records, settings, customRules }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'KKI Attendance & Payroll System';
  const monthLabel = month && month !== 'all' ? `Month: ${month}` : 'All Months';

  const columns = [
    { key: 'staff_no', header: 'Staff No', align: 'center', minWidth: 12, bold: true },
    { key: 'staff_name', header: 'Employee Name', align: 'left', minWidth: 22, type: 'text_left', bold: true },
    { key: 'department', header: 'Department', align: 'center', minWidth: 15 },
    { key: 'date', header: 'Date', align: 'center', type: 'date', minWidth: 14 },
    { key: 'weekday', header: 'Day', align: 'center', minWidth: 10 },
    { key: 'raw_swipes', header: 'Raw Swipes', align: 'left', minWidth: 24, type: 'text_left' },
    { key: 'effective_in', header: 'In Time', align: 'center', minWidth: 12, bold: true },
    { key: 'effective_out', header: 'Out Time', align: 'center', minWidth: 12, bold: true },
    { key: 'regular_hours', header: 'Regular (8h)', align: 'right', type: 'number', decimals: 2, minWidth: 14 },
    { key: 'ot_hours', header: 'Weekday OT', align: 'right', type: 'number', decimals: 2, minWidth: 14 },
    { key: 'sunday_ot_hours', header: 'Sunday/Off OT', align: 'right', type: 'number', decimals: 2, minWidth: 15 },
    { key: 'total_ot', header: 'Total OT (Hrs)', align: 'right', type: 'number', decimals: 2, minWidth: 14, bold: true },
    { key: 'total_hours', header: 'Total Worked', align: 'right', type: 'number', decimals: 2, minWidth: 14 },
    { key: 'late_minutes', header: 'Late (Mins)', align: 'right', type: 'number', decimals: 0, minWidth: 13, textColor: (v) => v > 0 ? 'D97706' : '0F172A' },
    {
      key: 'status',
      header: 'Attendance Status',
      align: 'center',
      minWidth: 22,
      highlight: (v) => {
        if (v?.includes('Present')) return 'DCFCE7'; // light green
        if (v?.includes('Absent')) return 'FEE2E2';  // light red
        if (v?.includes('Weekly Off') || v?.includes('Holiday')) return 'E0E7FF'; // light indigo
        if (v?.includes('Incomplete')) return 'FEF3C7'; // light amber
        return null;
      }
    },
    { key: 'punch_type', header: 'Punch Source', align: 'center', minWidth: 20 }
  ];

  const sheetConfig = createStyledSheet(wb, 'Biometric Daily Timings', {
    theme: THEMES.BLUE,
    title: 'Daily Biometric Timings & Punch Audit Sheet',
    subtitle: `KKI Factory Attendance Management — ${monthLabel}`,
    columns
  });

  const rows = [];
  let totReg = 0, totWeekdayOt = 0, totSunOt = 0, totOt = 0, totWorked = 0, totLate = 0;

  records.forEach(r => {
    const totalOt = +((r.ot_hours || 0) + (r.sunday_ot_hours || 0)).toFixed(2);
    totReg += parseFloat(r.regular_hours || 0);
    totWeekdayOt += parseFloat(r.ot_hours || 0);
    totSunOt += parseFloat(r.sunday_ot_hours || 0);
    totOt += totalOt;
    totWorked += parseFloat(r.total_hours || 0);
    totLate += parseInt(r.late_minutes || 0, 10);

    rows.push({
      staff_no: r.staff_no,
      staff_name: r.staff_name || r.staff_no,
      department: r.department || 'WORKER',
      date: r.date,
      weekday: r.weekday || '',
      raw_swipes: r.raw_swipes || '',
      effective_in: r.effective_in || '—',
      effective_out: r.effective_out || '—',
      regular_hours: parseFloat(r.regular_hours || 0),
      ot_hours: parseFloat(r.ot_hours || 0),
      sunday_ot_hours: parseFloat(r.sunday_ot_hours || 0),
      total_ot: totalOt,
      total_hours: parseFloat(r.total_hours || 0),
      late_minutes: parseInt(r.late_minutes || 0, 10),
      status: r.status || 'Absent',
      punch_type: r.is_manual_override === 1 ? 'Manual Edit / Fixed' : 'Biometric Auto'
    });
  });

  const { lastRowNum } = populateDataRows(sheetConfig, rows);
  addTotalsRow(sheetConfig, lastRowNum, {
    staff_no: 'TOTAL',
    staff_name: `${records.length} Punch Records`,
    regular_hours: +totReg.toFixed(2),
    ot_hours: +totWeekdayOt.toFixed(2),
    sunday_ot_hours: +totSunOt.toFixed(2),
    total_ot: +totOt.toFixed(2),
    total_hours: +totWorked.toFixed(2),
    late_minutes: totLate
  });

  return await wb.xlsx.writeBuffer();
}

// ==========================================
// 3. REPORT 3: FULL PAYROLL & ATTENDANCE REPORT
// ==========================================
async function buildFullPayrollReport({ month, workers, attendanceMap, advancesMap, settings, salaryRules }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'KKI Attendance & Payroll System';
  const monthLabel = month && month !== 'all' ? `Month: ${month}` : 'All Months';

  // Sheet 1: Monthly Attendance & Payroll Summary
  const summaryColumns = [
    { key: 'staff_no', header: 'Staff No', align: 'center', minWidth: 12, bold: true },
    { key: 'staff_name', header: 'Employee Name', align: 'left', minWidth: 24, type: 'text_left', bold: true },
    { key: 'department', header: 'Department', align: 'center', minWidth: 15 },
    { key: 'assigned_shift', header: 'Shift', align: 'center', minWidth: 12 },
    { key: 'full_present_days', header: 'Present Days', align: 'right', type: 'number', decimals: 1, minWidth: 14 },
    { key: 'paid_weekly_offs', header: 'Paid Sundays', align: 'right', type: 'number', decimals: 1, minWidth: 14 },
    { key: 'paid_holidays', header: 'Paid Holidays', align: 'right', type: 'number', decimals: 1, minWidth: 14 },
    { key: 'forfeited_offs', header: 'Deducted Offs', align: 'right', type: 'number', decimals: 1, minWidth: 14, textColor: (v) => v > 0 ? 'DC2626' : '0F172A' },
    { key: 'sun_hol_worked_days', header: 'Off-Days Worked', align: 'right', type: 'number', decimals: 0, minWidth: 16 },
    { key: 'absent_days', header: 'Absents', align: 'right', type: 'number', decimals: 1, minWidth: 12, textColor: (v) => v > 0 ? 'DC2626' : '0F172A' },
    { key: 'payable_days', header: 'Payable Days', align: 'right', type: 'number', decimals: 1, minWidth: 14, bold: true, highlight: () => 'DCFCE7' },
    { key: 'regular_hours', header: 'Regular Duty (8h)', align: 'right', type: 'number', decimals: 2, minWidth: 16 },
    { key: 'weekday_ot_hours', header: 'Weekday OT', align: 'right', type: 'number', decimals: 2, minWidth: 14 },
    { key: 'sunday_ot_hours', header: 'Sunday/Off OT', align: 'right', type: 'number', decimals: 2, minWidth: 15 },
    { key: 'total_ot_hours', header: 'Total OT Hours', align: 'right', type: 'number', decimals: 2, minWidth: 15, bold: true },
    { key: 'monthly_salary', header: 'Base Monthly (₹)', align: 'right', type: 'currency', minWidth: 16 },
    { key: 'earned_wages', header: 'Base Earned (₹)', align: 'right', type: 'currency', minWidth: 16 },
    { key: 'overtime_pay', header: 'OT Pay (₹)', align: 'right', type: 'currency', minWidth: 15 },
    { key: 'advances', header: 'Advance Repaid (₹)', align: 'right', type: 'currency', minWidth: 16, textColor: (v) => v > 0 ? 'DC2626' : '0F172A' },
    { key: 'net_salary', header: 'Net Salary Payable (₹)', align: 'right', type: 'currency', minWidth: 20, bold: true, highlight: () => 'FEF08A' }
  ];

  const summaryConfig = createStyledSheet(wb, 'Monthly Payroll Summary', {
    theme: THEMES.NAVY,
    title: 'Monthly Factory Attendance & Payroll Report',
    subtitle: `KKI Factory Attendance Management — ${monthLabel}`,
    columns: summaryColumns
  });

  const summaryRows = [];
  let totPayable = 0, totOT = 0, totEarned = 0, totOtPay = 0, totAdv = 0, totNet = 0;

  for (const w of workers) {
    const dailyRecords = attendanceMap.get(w.staff_no) || [];
    const advances = advancesMap.get(w.staff_no) || [];

    const p = calculateWorkerPayroll({
      staffNo: w.staff_no,
      monthlySalary: w.monthly_salary,
      housingAllowance: w.housing_allowance,
      foodAllowance: w.food_allowance,
      otherAllowance: w.other_allowance,
      dailyRecords,
      advances,
      settings,
      salaryRules
    });

    const regHours = +(p.totalWorkedHours - p.totalOtHours - p.totalSundayOtHours).toFixed(2);
    const totalOt = +((p.totalOtHours || 0) + (p.totalSundayOtHours || 0)).toFixed(2);
    const forfeitedOffs = (p.forfeitedWeeklyOffs || 0) + (p.forfeitedHolidays || 0);

    totPayable += p.payableDays || 0;
    totOT += totalOt;
    totEarned += p.earnedBasic || 0;
    totOtPay += p.overtimePay || 0;
    totAdv += p.advancesTotal || 0;
    totNet += p.netPayable || 0;

    summaryRows.push({
      staff_no: w.staff_no,
      staff_name: w.staff_name,
      department: w.department || 'WORKER',
      assigned_shift: w.assigned_shift || 'auto',
      full_present_days: p.fullPresentDays || 0,
      paid_weekly_offs: p.paidWeeklyOffs || 0,
      paid_holidays: p.paidHolidays || 0,
      forfeited_offs: forfeitedOffs,
      sun_hol_worked_days: p.sundayAndHolidayWorkedDays || 0,
      absent_days: p.absentDays || 0,
      payable_days: p.payableDays || 0,
      regular_hours: regHours,
      weekday_ot_hours: p.totalOtHours || 0,
      sunday_ot_hours: p.totalSundayOtHours || 0,
      total_ot_hours: totalOt,
      monthly_salary: p.monthlySalary || 15000,
      earned_wages: p.earnedBasic || 0,
      overtime_pay: p.overtimePay || 0,
      advances: p.advancesTotal || 0,
      net_salary: p.netPayable || 0
    });
  }

  const { lastRowNum } = populateDataRows(summaryConfig, summaryRows);
  addTotalsRow(summaryConfig, lastRowNum, {
    staff_no: 'TOTAL',
    staff_name: `${workers.length} Workers`,
    payable_days: +totPayable.toFixed(1),
    total_ot_hours: +totOT.toFixed(2),
    earned_wages: +totEarned.toFixed(2),
    overtime_pay: +totOtPay.toFixed(2),
    advances: +totAdv.toFixed(2),
    net_salary: +totNet.toFixed(2)
  });

  return await wb.xlsx.writeBuffer();
}

// ==========================================
// 4. REPORT 4: DEDUCTED HOLIDAYS & OFFS AUDIT
// ==========================================
async function buildDeductedHolidaysAndOffsReport({ month, workers, attendanceMap, settings, factoryCalendarMap, paidHolidaysMap }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'KKI Attendance & Payroll System';
  const monthLabel = month && month !== 'all' ? `Month: ${month}` : 'All Months';

  // Sheet 1: Worker Deduction Summary
  const summaryCols = [
    { key: 'staff_no', header: 'Staff No', align: 'center', minWidth: 12, bold: true },
    { key: 'staff_name', header: 'Employee Name', align: 'left', minWidth: 24, type: 'text_left', bold: true },
    { key: 'department', header: 'Department', align: 'center', minWidth: 15 },
    { key: 'assigned_shift', header: 'Shift Type', align: 'center', minWidth: 14 },
    { key: 'monthly_salary', header: 'Monthly Salary (₹)', align: 'right', type: 'currency', minWidth: 16 },
    { key: 'granted_offs', header: 'Weekly Offs (Granted)', align: 'right', type: 'number', decimals: 1, minWidth: 16 },
    { key: 'granted_holidays', header: 'Paid Holidays (Granted)', align: 'right', type: 'number', decimals: 1, minWidth: 16 },
    { key: 'forfeited_offs', header: 'Forfeited Sundays (Deducted)', align: 'right', type: 'number', decimals: 1, minWidth: 18, textColor: (v) => v > 0 ? 'DC2626' : '0F172A' },
    { key: 'forfeited_holidays', header: 'Forfeited Holidays (Deducted)', align: 'right', type: 'number', decimals: 1, minWidth: 18, textColor: (v) => v > 0 ? 'DC2626' : '0F172A' },
    { key: 'total_forfeited_days', header: 'Total Deducted Days', align: 'right', type: 'number', decimals: 1, minWidth: 16, bold: true, textColor: (v) => v > 0 ? 'DC2626' : '0F172A' },
    { key: 'salary_loss', header: 'Est. Salary Loss (₹)', align: 'right', type: 'currency', minWidth: 16, bold: true, textColor: (v) => v > 0 ? 'DC2626' : '0F172A' },
    { key: 'payable_days', header: 'Net Payable Days', align: 'right', type: 'number', decimals: 1, minWidth: 15, bold: true },
    { key: 'audit_status', header: 'Audit Status / Rule Notice', align: 'left', minWidth: 28, type: 'text_left' }
  ];

  const summaryConfig = createStyledSheet(wb, 'Worker Summary', {
    theme: THEMES.CRIMSON,
    title: 'Deducted Holidays & Forfeited Weekly Offs Audit Report',
    subtitle: `KKI Factory Attendance Management — ${monthLabel}`,
    columns: summaryCols
  });

  // Sheet 2: Deducted Log
  const deductedCols = [
    { key: 'staff_no', header: 'Staff No', align: 'center', minWidth: 12, bold: true },
    { key: 'staff_name', header: 'Employee Name', align: 'left', minWidth: 22, type: 'text_left', bold: true },
    { key: 'department', header: 'Department', align: 'center', minWidth: 14 },
    { key: 'date', header: 'Date', align: 'center', type: 'date', minWidth: 13 },
    { key: 'weekday', header: 'Day', align: 'center', minWidth: 10 },
    { key: 'category', header: 'Deducted Item Category', align: 'center', minWidth: 20 },
    { key: 'title', header: 'Holiday / Event Title', align: 'center', minWidth: 22 },
    { key: 'status', header: 'Attendance Status', align: 'center', minWidth: 20, highlight: () => 'FEE2E2' },
    { key: 'reason', header: 'Exact Forfeiture Reason & Factory Rule Explanation', align: 'left', minWidth: 44, type: 'text_left', bold: true },
    { key: 'raw_swipes', header: 'Raw Swipes', align: 'left', minWidth: 16, type: 'text_left' },
    { key: 'deduction', header: 'Pay Deduction', align: 'center', minWidth: 18, textColor: () => 'DC2626', bold: true }
  ];

  const deductedConfig = createStyledSheet(wb, 'Deducted & Forfeited Log', {
    theme: THEMES.CRIMSON,
    title: 'Itemized Deduction & Forfeiture Breakdown Log',
    subtitle: `Detailed Sandwich Rule & Absence Penalties — ${monthLabel}`,
    columns: deductedCols
  });

  // Sheet 3: Granted Offs
  const grantedCols = [
    { key: 'staff_no', header: 'Staff No', align: 'center', minWidth: 12, bold: true },
    { key: 'staff_name', header: 'Employee Name', align: 'left', minWidth: 22, type: 'text_left', bold: true },
    { key: 'department', header: 'Department', align: 'center', minWidth: 14 },
    { key: 'date', header: 'Date', align: 'center', type: 'date', minWidth: 13 },
    { key: 'weekday', header: 'Day', align: 'center', minWidth: 10 },
    { key: 'off_type', header: 'Off Category', align: 'center', minWidth: 22 },
    { key: 'title', header: 'Occasion / Description', align: 'center', minWidth: 24 },
    { key: 'status', header: 'Attendance Status', align: 'center', minWidth: 20, highlight: () => 'E0E7FF' },
    { key: 'paid_credit', header: 'Paid Benefit (Day)', align: 'right', type: 'number', decimals: 1, minWidth: 16 },
    { key: 'notes', header: 'Notes / Policy Reference', align: 'left', minWidth: 32, type: 'text_left' }
  ];

  const grantedConfig = createStyledSheet(wb, 'Granted Offs & Reasons', {
    theme: THEMES.CRIMSON,
    title: 'Granted Weekly Offs & Paid Festival Holidays Log',
    subtitle: `All Fully Credited Offs & Paid Holidays — ${monthLabel}`,
    columns: grantedCols
  });

  const summaryRows = [];
  const deductedRows = [];
  const grantedRows = [];

  for (const w of workers) {
    const dailyRecords = attendanceMap.get(w.staff_no) || [];
    const salary = parseFloat(w.monthly_salary || 15000);
    const dayRate = +(salary / (settings.payroll_month_days === 'calendar' ? 30 : 26)).toFixed(2);

    let grantedOffs = 0, grantedHolidays = 0, forfeitedOffs = 0, forfeitedHolidays = 0, payableDaysCount = 0;

    dailyRecords.forEach(r => {
      const calOverride = factoryCalendarMap[r.date] || null;
      const st = r.status || '';

      if (st === 'Weekly Off (Paid)') {
        grantedOffs++;
        payableDaysCount += 1;
        const offType = calOverride?.day_type === 'off_day' ? 'Substitute Factory Paid Off' : 'Default Weekly Off (Sunday)';
        grantedRows.push({
          staff_no: w.staff_no,
          staff_name: w.staff_name,
          department: w.department || 'WORKER',
          date: r.date,
          weekday: r.weekday || '',
          off_type: offType,
          title: calOverride?.title || 'Weekly Off (Sunday)',
          status: st,
          paid_credit: 1.0,
          notes: calOverride ? `Custom schedule override: ${calOverride.notes || ''}` : 'Standard factory weekly rest'
        });
      } else if (st === 'Weekly Off (Worked OT)') {
        grantedOffs++;
        payableDaysCount += 1;
        grantedRows.push({
          staff_no: w.staff_no,
          staff_name: w.staff_name,
          department: w.department || 'WORKER',
          date: r.date,
          weekday: r.weekday || '',
          off_type: 'Weekly Off (Worked OT)',
          title: calOverride?.title || 'Sunday Production Duty',
          status: st,
          paid_credit: 1.0,
          notes: `Worker attended on off-day: earned ${r.sunday_ot_hours || 0}h Special OT`
        });
      } else if (st === 'Holiday (Paid)' || st === 'Holiday (Worked OT)') {
        grantedHolidays++;
        payableDaysCount += 1;
        const holName = calOverride?.title || paidHolidaysMap[r.date] || 'National Holiday';
        grantedRows.push({
          staff_no: w.staff_no,
          staff_name: w.staff_name,
          department: w.department || 'WORKER',
          date: r.date,
          weekday: r.weekday || '',
          off_type: 'Declared Paid Holiday',
          title: holName,
          status: st,
          paid_credit: 1.0,
          notes: st === 'Holiday (Worked OT)' ? `Worked on festival: earned ${r.sunday_ot_hours || 0}h Special OT` : 'Paid festival benefit credited'
        });
      } else if (st === 'Holiday (Forfeited)') {
        forfeitedHolidays++;
        const holName = calOverride?.title || paidHolidaysMap[r.date] || 'National Holiday';
        deductedRows.push({
          staff_no: w.staff_no,
          staff_name: w.staff_name,
          department: w.department || 'WORKER',
          date: r.date,
          weekday: r.weekday || '',
          category: 'Declared Paid Holiday',
          title: holName,
          status: st,
          reason: 'Sandwich Rule: Worker was unapproved absent on adjacent working day(s) immediately before or after holiday',
          raw_swipes: r.raw_swipes || 'No punch',
          deduction: `-₹${dayRate} (1 Day Pay Loss)`
        });
      } else if (st === 'Weekly Off (Forfeited)') {
        forfeitedOffs++;
        deductedRows.push({
          staff_no: w.staff_no,
          staff_name: w.staff_name,
          department: w.department || 'WORKER',
          date: r.date,
          weekday: r.weekday || '',
          category: 'Sunday Weekly Off',
          title: 'Sunday Weekly Off',
          status: st,
          reason: '4+ Absents: Worker had 4 or more unapproved absences during Monday–Saturday work week or exceeded absence quota',
          raw_swipes: r.raw_swipes || 'No punch',
          deduction: `-₹${dayRate} (1 Day Pay Loss)`
        });
      } else if (st.includes('Present')) {
        payableDaysCount += 1;
      } else if (st.includes('Half Day')) {
        payableDaysCount += 0.5;
      }
    });

    const totalForfeited = forfeitedOffs + forfeitedHolidays;
    const loss = +(totalForfeited * dayRate).toFixed(2);
    const isExempt = w.assigned_shift === 'exempt' || w.assigned_shift === 'flexible';

    summaryRows.push({
      staff_no: w.staff_no,
      staff_name: w.staff_name,
      department: w.department || 'WORKER',
      assigned_shift: w.assigned_shift || 'auto',
      monthly_salary: salary,
      granted_offs: grantedOffs,
      granted_holidays: grantedHolidays,
      forfeited_offs: forfeitedOffs,
      forfeited_holidays: forfeitedHolidays,
      total_forfeited_days: totalForfeited,
      salary_loss: loss,
      payable_days: +payableDaysCount.toFixed(1),
      audit_status: isExempt ? 'Exception Worker (Exempt)' : totalForfeited > 0 ? `${totalForfeited} Day(s) Deducted via Policy` : 'Clean (All Offs & Holidays Valid)'
    });
  }

  populateDataRows(summaryConfig, summaryRows);
  populateDataRows(deductedConfig, deductedRows);
  populateDataRows(grantedConfig, grantedRows);

  return await wb.xlsx.writeBuffer();
}

// ==========================================
// 5. REPORT 5: PAID HOLIDAYS & OFF-DAYS DUTY
// ==========================================
async function buildPaidHolidaysAndOffDutyReport({ month, workers, attendanceMap, settings, factoryCalendarMap, paidHolidaysMap }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'KKI Attendance & Payroll System';
  const monthLabel = month && month !== 'all' ? `Month: ${month}` : 'All Months';

  // Sheet 1: Worker Summary
  const summaryCols = [
    { key: 'staff_no', header: 'Staff No', align: 'center', minWidth: 12, bold: true },
    { key: 'staff_name', header: 'Employee Name', align: 'left', minWidth: 24, type: 'text_left', bold: true },
    { key: 'department', header: 'Department', align: 'center', minWidth: 15 },
    { key: 'assigned_shift', header: 'Shift Type', align: 'center', minWidth: 14 },
    { key: 'monthly_salary', header: 'Base Salary (₹)', align: 'right', type: 'currency', minWidth: 16 },
    { key: 'paid_holidays', header: 'Paid Holidays Credited', align: 'right', type: 'number', decimals: 0, minWidth: 16 },
    { key: 'holidays_worked', header: 'Holidays Worked (Duty)', align: 'right', type: 'number', decimals: 0, minWidth: 16 },
    { key: 'sundays_worked', header: 'Sundays/Offs Worked', align: 'right', type: 'number', decimals: 0, minWidth: 16 },
    { key: 'total_off_days_worked', header: 'Total Off-Days Worked', align: 'right', type: 'number', decimals: 0, minWidth: 16, bold: true },
    { key: 'special_ot_hours', header: 'Special OT Hours (2.0x)', align: 'right', type: 'number', decimals: 2, minWidth: 18, bold: true },
    { key: 'hourly_rate', header: 'Hourly Rate (₹)', align: 'right', type: 'currency', minWidth: 14 },
    { key: 'special_ot_pay', header: 'Special OT Pay (₹)', align: 'right', type: 'currency', minWidth: 16, bold: true, highlight: () => 'FEF08A' }
  ];

  const summaryConfig = createStyledSheet(wb, 'Worker Summary', {
    theme: THEMES.INDIGO,
    title: 'Paid Holidays & Off-Days Worked Duty Report',
    subtitle: `KKI Factory Attendance Management — ${monthLabel}`,
    columns: summaryCols
  });

  // Sheet 2: Holiday Detail
  const holidayCols = [
    { key: 'date', header: 'Date', align: 'center', type: 'date', minWidth: 13 },
    { key: 'weekday', header: 'Day', align: 'center', minWidth: 10 },
    { key: 'title', header: 'Holiday / Festival Name', align: 'center', minWidth: 24 },
    { key: 'staff_no', header: 'Staff No', align: 'center', minWidth: 12, bold: true },
    { key: 'staff_name', header: 'Employee Name', align: 'left', minWidth: 22, type: 'text_left', bold: true },
    { key: 'department', header: 'Department', align: 'center', minWidth: 14 },
    { key: 'status', header: 'Attendance Status', align: 'center', minWidth: 20 },
    { key: 'raw_swipes', header: 'Raw Swipes', align: 'left', minWidth: 18, type: 'text_left' },
    { key: 'effective_in', header: 'Effective IN', align: 'center', minWidth: 12 },
    { key: 'effective_out', header: 'Effective OUT', align: 'center', minWidth: 12 },
    { key: 'worked_hours', header: 'Worked Hours', align: 'right', type: 'number', decimals: 2, minWidth: 14 },
    { key: 'special_ot_hours', header: 'Special OT (Hrs)', align: 'right', type: 'number', decimals: 2, minWidth: 15, bold: true },
    { key: 'benefit', header: 'Holiday Paid Benefit', align: 'center', minWidth: 24, bold: true },
    { key: 'notes', header: 'Notes / Policy Reference', align: 'left', minWidth: 32, type: 'text_left' }
  ];

  const holidayConfig = createStyledSheet(wb, 'Paid Holidays Detail', {
    theme: THEMES.INDIGO,
    title: 'Itemized Festival & National Holidays Log',
    subtitle: `Holiday Entitlements & Work Details — ${monthLabel}`,
    columns: holidayCols
  });

  // Sheet 3: Off-Days Duty Log
  const offDutyCols = [
    { key: 'date', header: 'Date', align: 'center', type: 'date', minWidth: 13 },
    { key: 'weekday', header: 'Day', align: 'center', minWidth: 10 },
    { key: 'category', header: 'Off-Day Category', align: 'center', minWidth: 22 },
    { key: 'staff_no', header: 'Staff No', align: 'center', minWidth: 12, bold: true },
    { key: 'staff_name', header: 'Employee Name', align: 'left', minWidth: 22, type: 'text_left', bold: true },
    { key: 'department', header: 'Department', align: 'center', minWidth: 14 },
    { key: 'raw_swipes', header: 'Raw Swipes', align: 'left', minWidth: 18, type: 'text_left' },
    { key: 'effective_in', header: 'In Time', align: 'center', minWidth: 12 },
    { key: 'effective_out', header: 'Out Time', align: 'center', minWidth: 12 },
    { key: 'worked_hours', header: 'Total Worked (Hrs)', align: 'right', type: 'number', decimals: 2, minWidth: 16 },
    { key: 'special_ot_hours', header: 'Special OT Earned', align: 'right', type: 'number', decimals: 2, minWidth: 16, bold: true },
    { key: 'duty_description', header: 'Duty Description & Shift Title', align: 'left', minWidth: 36, type: 'text_left' },
    { key: 'ot_rate', header: 'OT Multiplier / Rate', align: 'center', minWidth: 22, bold: true }
  ];

  const offDutyConfig = createStyledSheet(wb, 'Off-Days Worked Log', {
    theme: THEMES.INDIGO,
    title: 'Off-Days & Sunday Production Duty Log',
    subtitle: `Worker Duties on Non-Working Schedule Days — ${monthLabel}`,
    columns: offDutyCols
  });

  const summaryRows = [];
  const holidayRows = [];
  const offDutyRows = [];

  for (const w of workers) {
    const dailyRecords = attendanceMap.get(w.staff_no) || [];
    const salary = parseFloat(w.monthly_salary || 15000);
    const hourlyRate = +(salary / (settings.payroll_month_days === 'calendar' ? 30 : 26) / 8).toFixed(2);

    let creditedHolidays = 0, holidaysWorkedCount = 0, sundaysWorkedCount = 0, totalSpecialOtHours = 0;

    dailyRecords.forEach(r => {
      const calOverride = factoryCalendarMap[r.date] || null;
      const st = r.status || '';
      const sunOt = parseFloat(r.sunday_ot_hours || 0);
      const workedHrs = parseFloat(r.total_hours || 0);

      const isHolidayDate = !!paidHolidaysMap[r.date] || calOverride?.day_type === 'holiday';
      const isSundayDate = (r.weekday || '').startsWith('Sun') && calOverride?.day_type !== 'working_day';
      const isSubstituteOffDate = calOverride?.day_type === 'off_day';
      const isMandatorySundayWork = (r.weekday || '').startsWith('Sun') && calOverride?.day_type === 'working_day';

      if (isHolidayDate) {
        const holName = calOverride?.title || paidHolidaysMap[r.date] || 'Declared Holiday';
        let benefitText = '1.0 Full Paid Day';
        if (st === 'Holiday (Worked OT)') {
          creditedHolidays += 1;
          holidaysWorkedCount += 1;
          totalSpecialOtHours += sunOt;
          benefitText = '1.0 Paid Day + 2.0x OT';
        } else if (st === 'Holiday (Paid)') {
          creditedHolidays += 1;
          benefitText = '1.0 Full Paid Day';
        } else if (st === 'Holiday (Forfeited)') {
          benefitText = '0.0 Forfeited (Adjacent Absent)';
        }

        holidayRows.push({
          date: r.date,
          weekday: r.weekday || '',
          title: holName,
          staff_no: w.staff_no,
          staff_name: w.staff_name,
          department: w.department || 'WORKER',
          status: st,
          raw_swipes: r.raw_swipes || 'No punch',
          effective_in: r.effective_in || '—',
          effective_out: r.effective_out || '—',
          worked_hours: workedHrs,
          special_ot_hours: sunOt,
          benefit: benefitText,
          notes: st === 'Holiday (Worked OT)' ? `Special Holiday OT: ${sunOt}h` : st === 'Holiday (Forfeited)' ? 'Deducted due to sandwich rule' : 'Paid national holiday'
        });
      }

      if (st === 'Holiday (Worked OT)') {
        const holName = calOverride?.title || paidHolidaysMap[r.date] || 'National Holiday';
        offDutyRows.push({
          date: r.date,
          weekday: r.weekday || '',
          category: 'Declared Paid Holiday',
          staff_no: w.staff_no,
          staff_name: w.staff_name,
          department: w.department || 'WORKER',
          raw_swipes: r.raw_swipes || '',
          effective_in: r.effective_in || '—',
          effective_out: r.effective_out || '—',
          worked_hours: workedHrs,
          special_ot_hours: sunOt,
          duty_description: `Worked on Festival / Holiday: ${holName}`,
          ot_rate: '2.0x Special Holiday OT'
        });
      } else if (st === 'Weekly Off (Worked OT)' || ((isSundayDate || isSubstituteOffDate) && workedHrs > 0)) {
        sundaysWorkedCount += 1;
        totalSpecialOtHours += sunOt;
        const category = isSubstituteOffDate ? 'Substitute Paid Off' : 'Sunday Weekly Off';
        const title = calOverride?.title || (isSubstituteOffDate ? 'Substitute Factory Off' : 'Sunday Factory Production Duty');

        offDutyRows.push({
          date: r.date,
          weekday: r.weekday || '',
          category,
          staff_no: w.staff_no,
          staff_name: w.staff_name,
          department: w.department || 'WORKER',
          raw_swipes: r.raw_swipes || '',
          effective_in: r.effective_in || '—',
          effective_out: r.effective_out || '—',
          worked_hours: workedHrs,
          special_ot_hours: sunOt,
          duty_description: `Worked on Off-Day: ${title}`,
          ot_rate: '2.0x Special Sunday/Off OT'
        });
      } else if (isMandatorySundayWork && workedHrs > 0) {
        offDutyRows.push({
          date: r.date,
          weekday: r.weekday || '',
          category: 'Mandatory Working Sunday',
          staff_no: w.staff_no,
          staff_name: w.staff_name,
          department: w.department || 'WORKER',
          raw_swipes: r.raw_swipes || '',
          effective_in: r.effective_in || '—',
          effective_out: r.effective_out || '—',
          worked_hours: workedHrs,
          special_ot_hours: parseFloat(r.ot_hours || 0),
          duty_description: `Compensatory Sunday Working Day: ${calOverride?.title || 'Factory Production'} (In lieu of substitute off)`,
          ot_rate: '1.0x Regular Duty (8h) + Standard OT'
        });
      }
    });

    const totalOffDays = holidaysWorkedCount + sundaysWorkedCount;
    const specialOtPay = +(totalSpecialOtHours * hourlyRate * 2.0).toFixed(2);

    summaryRows.push({
      staff_no: w.staff_no,
      staff_name: w.staff_name,
      department: w.department || 'WORKER',
      assigned_shift: w.assigned_shift || 'auto',
      monthly_salary: salary,
      paid_holidays: creditedHolidays,
      holidays_worked: holidaysWorkedCount,
      sundays_worked: sundaysWorkedCount,
      total_off_days_worked: totalOffDays,
      special_ot_hours: +totalSpecialOtHours.toFixed(2),
      hourly_rate: hourlyRate,
      special_ot_pay: specialOtPay
    });
  }

  populateDataRows(summaryConfig, summaryRows);
  populateDataRows(holidayConfig, holidayRows);
  populateDataRows(offDutyConfig, offDutyRows);

  return await wb.xlsx.writeBuffer();
}

// =========================================================================
// 6. REPORT 6: FIXES & MANUAL EDITS AUDIT REPORT (NEW REQUESTED REPORT)
// =========================================================================
async function buildFixesAndManualEditsReport({ month, workers, attendanceMap, auditLogs, settings }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'KKI Attendance & Payroll System';
  const monthLabel = month && month !== 'all' ? `Month: ${month}` : 'All Months';

  // Sheet 1: Fixes Summary by Worker
  const summaryCols = [
    { key: 'staff_no', header: 'Staff No', align: 'center', minWidth: 12, bold: true },
    { key: 'staff_name', header: 'Employee Name', align: 'left', minWidth: 24, type: 'text_left', bold: true },
    { key: 'department', header: 'Department', align: 'center', minWidth: 15 },
    { key: 'total_fixes', header: 'Total Fixes / Overrides', align: 'right', type: 'number', decimals: 0, minWidth: 18, bold: true, highlight: (v) => v > 0 ? 'FEF3C7' : null },
    { key: 'missing_out_fixed', header: 'Missing OUT Fixed', align: 'right', type: 'number', decimals: 0, minWidth: 16 },
    { key: 'missing_in_fixed', header: 'Missing IN Fixed', align: 'right', type: 'number', decimals: 0, minWidth: 16 },
    { key: 'manual_punch_edits', header: 'Punch / Time Overrides', align: 'right', type: 'number', decimals: 0, minWidth: 18 },
    { key: 'status_corrections', header: 'Status Rectified', align: 'right', type: 'number', decimals: 0, minWidth: 16 },
    { key: 'credited_hours', header: 'Total Credited Hours (Hrs)', align: 'right', type: 'number', decimals: 2, minWidth: 20, bold: true },
    { key: 'remarks', header: 'Audit Status', align: 'left', minWidth: 28, type: 'text_left' }
  ];

  const summaryConfig = createStyledSheet(wb, 'Worker Fixes Summary', {
    theme: THEMES.AMBER,
    title: 'Worker Attendance Fixes & Manual Overrides Summary',
    subtitle: `KKI Factory Attendance Management — ${monthLabel}`,
    columns: summaryCols
  });

  // Sheet 2: Detailed Fixes Log
  const detailCols = [
    { key: 'staff_no', header: 'Staff No', align: 'center', minWidth: 12, bold: true },
    { key: 'staff_name', header: 'Employee Name', align: 'left', minWidth: 22, type: 'text_left', bold: true },
    { key: 'department', header: 'Department', align: 'center', minWidth: 14 },
    { key: 'date', header: 'Date', align: 'center', type: 'date', minWidth: 13 },
    { key: 'weekday', header: 'Day', align: 'center', minWidth: 10 },
    { key: 'original_swipes', header: 'Original Machine Punches (Before Fix)', align: 'left', minWidth: 26, type: 'text_left', textColor: () => '991B1B' },
    { key: 'fixed_timing', header: 'Fixed / Filled Timings (Management)', align: 'left', minWidth: 26, type: 'text_left', bold: true, textColor: () => '065F46', highlight: () => 'DCFCE7' },
    { key: 'effective_in', header: 'In Time', align: 'center', minWidth: 12 },
    { key: 'effective_out', header: 'Out Time', align: 'center', minWidth: 12 },
    { key: 'shift', header: 'Assigned Shift', align: 'center', minWidth: 14 },
    { key: 'fix_type', header: 'Fix / Override Category', align: 'center', minWidth: 24, bold: true },
    { key: 'resolved_status', header: 'Resolved Status', align: 'center', minWidth: 18 },
    { key: 'regular_hours', header: 'Regular (8h)', align: 'right', type: 'number', decimals: 2, minWidth: 14 },
    { key: 'ot_hours', header: 'OT Hours', align: 'right', type: 'number', decimals: 2, minWidth: 14 },
    { key: 'total_hours', header: 'Total Hours', align: 'right', type: 'number', decimals: 2, minWidth: 14, bold: true },
    { key: 'reason', header: 'Management Reason / Approval Note', align: 'left', minWidth: 36, type: 'text_left' },
    { key: 'updated_at', header: 'Last Modified Timestamp', align: 'center', minWidth: 20 }
  ];

  const detailConfig = createStyledSheet(wb, 'Detailed Fixes Log', {
    theme: THEMES.AMBER,
    title: 'Detailed Log of Punch Corrections & Timings Filled',
    subtitle: `Before vs After Biometric Punch Modifications — ${monthLabel}`,
    columns: detailCols
  });

  // Sheet 3: System Audit Trail
  const auditCols = [
    { key: 'id', header: 'Audit ID', align: 'center', minWidth: 10 },
    { key: 'staff_no', header: 'Staff No', align: 'center', minWidth: 12, bold: true },
    { key: 'date', header: 'Date', align: 'center', type: 'date', minWidth: 13 },
    { key: 'field_changed', header: 'Field Modified', align: 'center', minWidth: 18 },
    { key: 'old_value', header: 'Original Value (Old)', align: 'left', minWidth: 24, type: 'text_left' },
    { key: 'new_value', header: 'Updated Value (New)', align: 'left', minWidth: 24, type: 'text_left', bold: true },
    { key: 'edited_by', header: 'Edited By', align: 'center', minWidth: 14 },
    { key: 'reason', header: 'Change Reason', align: 'left', minWidth: 32, type: 'text_left' },
    { key: 'created_at', header: 'Audit Timestamp', align: 'center', minWidth: 20 }
  ];

  const auditConfig = createStyledSheet(wb, 'System Audit Trail', {
    theme: THEMES.AMBER,
    title: 'Complete System Modification & Audit History',
    subtitle: `Immutable Record of Management Edits — ${monthLabel}`,
    columns: auditCols
  });

  const summaryRows = [];
  const detailRows = [];
  let grandTotalFixes = 0, grandCreditedHours = 0;

  for (const w of workers) {
    const dailyRecords = attendanceMap.get(w.staff_no) || [];
    let workerFixCount = 0;
    let missingOutCount = 0;
    let missingInCount = 0;
    let manualPunchEdits = 0;
    let statusCorrections = 0;
    let workerCreditedHours = 0;

    dailyRecords.forEach(r => {
      if (r.is_manual_override === 1 || r.manual_punches || (r.original_raw_swipes && r.original_raw_swipes !== r.raw_swipes)) {
        workerFixCount++;
        const totalHrs = parseFloat(r.total_hours || 0);
        workerCreditedHours += totalHrs;

        const orig = r.original_raw_swipes || 'Single / Incomplete Punch';
        const fixed = r.raw_swipes || r.manual_punches || 'Manual Punch Filled';

        // Detect category of fix
        let fixCategory = 'Manual Punch Override';
        if (orig.split(' ').filter(Boolean).length === 1 && fixed.split(' ').filter(Boolean).length >= 2) {
          missingOutCount++;
          fixCategory = 'Missing OUT Punch Fixed';
        } else if (!orig || orig.trim() === '') {
          missingInCount++;
          fixCategory = 'Full Attendance Filled Manually';
        } else if (r.override_reason && r.override_reason.toLowerCase().includes('status')) {
          statusCorrections++;
          fixCategory = 'Status Manually Rectified';
        } else {
          manualPunchEdits++;
          fixCategory = 'Punch Timings Modified';
        }

        detailRows.push({
          staff_no: w.staff_no,
          staff_name: w.staff_name,
          department: w.department || 'WORKER',
          date: r.date,
          weekday: r.weekday || '',
          original_swipes: orig,
          fixed_timing: fixed,
          effective_in: r.effective_in || '—',
          effective_out: r.effective_out || '—',
          shift: r.shift || '08:00',
          fix_type: fixCategory,
          resolved_status: r.status || 'Present (Full)',
          regular_hours: parseFloat(r.regular_hours || 0),
          ot_hours: parseFloat(r.ot_hours || 0),
          total_hours: totalHrs,
          reason: r.override_reason || 'Management Fast-Fix Resolution',
          updated_at: r.updated_at || '—'
        });
      }
    });

    grandTotalFixes += workerFixCount;
    grandCreditedHours += workerCreditedHours;

    summaryRows.push({
      staff_no: w.staff_no,
      staff_name: w.staff_name,
      department: w.department || 'WORKER',
      total_fixes: workerFixCount,
      missing_out_fixed: missingOutCount,
      missing_in_fixed: missingInCount,
      manual_punch_edits: manualPunchEdits,
      status_corrections: statusCorrections,
      credited_hours: +workerCreditedHours.toFixed(2),
      remarks: workerFixCount > 0 ? `${workerFixCount} Timings Resolved` : 'No Manual Edits (Pure Biometric)'
    });
  }

  const { lastRowNum } = populateDataRows(summaryConfig, summaryRows);
  addTotalsRow(summaryConfig, lastRowNum, {
    staff_no: 'TOTAL',
    staff_name: `${workers.length} Workers`,
    total_fixes: grandTotalFixes,
    credited_hours: +grandCreditedHours.toFixed(2)
  });

  populateDataRows(detailConfig, detailRows);

  const auditRows = (auditLogs || []).map(l => ({
    id: l.id,
    staff_no: l.staff_no,
    date: l.date,
    field_changed: l.field_changed,
    old_value: l.old_value || '—',
    new_value: l.new_value || '—',
    edited_by: l.edited_by || 'Admin',
    reason: l.reason || 'Manual Update',
    created_at: l.created_at || '—'
  }));
  populateDataRows(auditConfig, auditRows);

  return await wb.xlsx.writeBuffer();
}

module.exports = {
  THEMES,
  createStyledSheet,
  populateDataRows,
  addTotalsRow,
  buildExecutiveSummaryReport,
  buildBiometricTimingsReport,
  buildFullPayrollReport,
  buildDeductedHolidaysAndOffsReport,
  buildPaidHolidaysAndOffDutyReport,
  buildFixesAndManualEditsReport
};
