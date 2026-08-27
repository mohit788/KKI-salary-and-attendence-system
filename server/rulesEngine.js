/**
 * Converts HH:MM string to minutes from midnight
 */
function timeToMins(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * Converts minutes from midnight to HH:MM string
 */
function minsToTime(mins) {
  if (isNaN(mins) || mins < 0) return '00:00';
  const h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Formats decimal hours into real clock time representation (e.g. 8.5 -> "8h 30m" or "8:30 hrs").
 * @param {number|string} decimalHours 
 * @param {'hm'|'clock'|'verbose'} format 
 */
function formatHours(decimalHours, format = 'hm') {
  if (decimalHours === null || decimalHours === undefined || decimalHours === '') {
    return format === 'clock' ? '0:00 hrs' : '0h';
  }

  const num = Number(decimalHours);
  if (isNaN(num) || num === 0) {
    return format === 'clock' ? '0:00 hrs' : '0h';
  }

  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const totalMins = Math.round(absNum * 60);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const prefix = isNegative ? '-' : '';

  if (format === 'clock') {
    return `${prefix}${hrs}:${String(mins).padStart(2, '0')} hrs`;
  }

  if (format === 'verbose') {
    if (hrs === 0) return `${prefix}${mins} mins`;
    if (mins === 0) return `${prefix}${hrs} hr${hrs > 1 ? 's' : ''}`;
    return `${prefix}${hrs} hr${hrs > 1 ? 's' : ''} ${mins} min${mins > 1 ? 's' : ''}`;
  }

  if (mins === 0) return `${prefix}${hrs}h`;
  if (hrs === 0) return `${prefix}${mins}m`;
  return `${prefix}${hrs}h ${String(mins).padStart(2, '0')}m`;
}

/**
 * Detects the factory shift start time for a specific date based on all workers' first IN punches on that date.
 * Uses crowd-clustering / voting among standard factory shift anchors (e.g. 07:00, 08:00, 08:30, 09:00).
 * 
 * @param {Array<string>} firstInTimes - Array of HH:MM strings of first IN punches on that day
 * @param {string} defaultShift - Default shift start (default '08:00')
 * @returns {string} Detected shift start time (e.g. '07:00' or '08:00')
 */
function detectDailyFactoryShift(firstInTimes = [], defaultShift = '08:00') {
  if (!Array.isArray(firstInTimes) || firstInTimes.length === 0) {
    return defaultShift || '08:00';
  }

  // Filter valid HH:MM timestamps
  const validTimes = firstInTimes.filter(t => t && /^\d{1,2}:\d{2}$/.test(String(t).trim()));
  if (validTimes.length === 0) return defaultShift || '08:00';

  const totalWorkers = validTimes.length;

  // Counters for Shift Anchors:
  // 07:00 Shift Slot: Punches between 06:00 and 07:25 (e.g., 6:50, 6:58, 7:10, 7:20)
  // 08:00 Shift Slot: Punches between 07:26 and 08:20 (e.g., 7:45, 7:55, 8:00, 8:15)
  // 08:30 Shift Slot: Punches between 08:21 and 08:45
  // 09:00 Shift Slot: Punches between 08:46 and 09:45
  let early7Count = 0;
  let normal8Count = 0;
  let mid830Count = 0;
  let late9Count = 0;

  validTimes.forEach(timeStr => {
    const mins = timeToMins(timeStr);
    if (mins >= timeToMins('06:00') && mins <= timeToMins('07:25')) {
      early7Count++;
    } else if (mins > timeToMins('07:25') && mins <= timeToMins('08:20')) {
      normal8Count++;
    } else if (mins > timeToMins('08:20') && mins <= timeToMins('08:45')) {
      mid830Count++;
    } else if (mins > timeToMins('08:45') && mins <= timeToMins('09:45')) {
      late9Count++;
    }
  });

  const early7Ratio = early7Count / totalWorkers;
  // If at least 20% of workers (or >=2 in small groups) came early OR early count exceeds 8 AM count -> 07:00 Shift
  if ((early7Count >= 2 && early7Ratio >= 0.20) || early7Ratio >= 0.30 || (early7Count > 0 && early7Count > normal8Count)) {
    return '07:00';
  }

  const late9Ratio = late9Count / totalWorkers;
  if ((late9Count >= 3 && late9Ratio >= 0.40) || (late9Count > normal8Count && late9Count > early7Count)) {
    return '09:00';
  }

  if (mid830Count > normal8Count && mid830Count > early7Count) {
    return '08:30';
  }

  return defaultShift || '08:00';
}

/**
 * Builds a Map of Date -> Detected Factory Shift Start Time for an array of worker records
 * @param {Array<Object>} allRecords - List of objects with { date, swipe_record / raw_swipes }
 * @param {string} defaultShift - Default shift start (default '08:00')
 * @returns {Map<string, string>} Map of 'YYYY-MM-DD' -> 'HH:MM'
 */
function buildDailyShiftMap(allRecords = [], defaultShift = '08:00') {
  const datePunchMap = new Map();

  allRecords.forEach(rec => {
    const date = rec.date;
    if (!date) return;
    const raw = rec.swipe_record || rec.raw_swipes || '';
    if (!raw) return;

    // Extract first IN timestamp
    const matches = String(raw).match(/\b\d{1,2}:\d{2}\b/g) || [];
    const validPunches = matches.filter(t => t !== '00:00');
    if (validPunches.length > 0) {
      const firstIn = validPunches[0];
      if (!datePunchMap.has(date)) {
        datePunchMap.set(date, []);
      }
      datePunchMap.get(date).push(firstIn);
    }
  });

  const shiftMap = new Map();
  for (const [date, firstIns] of datePunchMap.entries()) {
    shiftMap.set(date, detectDailyFactoryShift(firstIns, defaultShift));
  }

  return shiftMap;
}

/**
 * Calculates effective first IN time using late-arrival grace slab rule
 * @param {string} rawInTime - HH:MM
 * @param {string} shiftStart - HH:MM (default 08:00)
 * @param {number} slabMinutes - default 30
 */
function getEffectiveFirstIn(rawInTime, shiftStart = '08:00', slabMinutes = 30) {
  const inMins = timeToMins(rawInTime);
  const shiftMins = timeToMins(shiftStart);

  // Arrived early or on time -> Effective start is shift start (no early credit)
  if (inMins <= shiftMins) {
    return { effectiveTime: shiftStart, effectiveMins: shiftMins, lateMins: 0 };
  }

  // Late arrival: round UP to next slab boundary
  const lateDelta = inMins - shiftMins;
  const slabCount = Math.ceil(lateDelta / slabMinutes);
  const effectiveMins = shiftMins + (slabCount * slabMinutes);

  return {
    effectiveTime: minsToTime(effectiveMins),
    effectiveMins,
    lateMins: lateDelta,
  };
}

/**
 * Cleans and debounces raw biometric punches.
 * Removes duplicate punches occurring within debounceMins (e.g. <= 5 minutes).
 * @param {Array<string>} timestamps - ['07:58', '08:01', '16:30']
 * @param {number} debounceMins - default 5
 */
function cleanAndDebouncePunches(timestamps = [], debounceMins = 5) {
  if (!Array.isArray(timestamps) || timestamps.length === 0) return [];
  const valid = timestamps.filter(t => t && /^\d{1,2}:\d{2}$/.test(String(t).trim()));
  if (valid.length === 0) return [];

  // Chronological sort
  const sorted = [...valid].sort((a, b) => timeToMins(a) - timeToMins(b));
  const cleaned = [];

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    if (cleaned.length === 0) {
      cleaned.push(cur);
      continue;
    }
    const prev = cleaned[cleaned.length - 1];
    const diff = timeToMins(cur) - timeToMins(prev);
    // Ignore rapid duplicate punches within debounce window
    if (diff > debounceMins) {
      cleaned.push(cur);
    }
  }

  return cleaned;
}

/**
 * Compute daily attendance, regular hours (8h duty), OT hours (after completing 8h work + lunch), and status
 * @param {Array<string>} timestamps - array of HH:MM timestamps ["07:54", "16:30"] or ["08:31", "18:30"]
 * @param {Object} settings - rule parameters
 * @param {string} weekday - "Mon", "Tue", "Sun" etc.
 * @param {Array<Object>} customRules - list of active custom rules
 * @param {string} dynamicShiftStart - Optional detected date-specific shift start (e.g. '07:00')
 */
function computeDailyAttendance(timestamps, settings = {}, weekday = '', customRules = [], dynamicShiftStart = '') {
  const shiftStart = dynamicShiftStart || settings.daily_shift_start || settings.shift_start || '08:00';
  const shiftEnd = settings.shift_end || '16:30';
  const slabMinutes = parseInt(settings.grace_slab_minutes || 30, 10);
  const otRounding = settings.ot_rounding || 'minutes';
  const shortThreshold = parseFloat(settings.short_hours_threshold || 4.0);
  const weeklyOffDay = settings.weekly_off_day || 'Sun';
  const maxOtHours = parseFloat(settings.max_ot_hours || 0);
  const lunchDeductionMins = parseInt(settings.lunch_deduction_mins !== undefined ? settings.lunch_deduction_mins : 30, 10);
  const latePenaltyThresholdMins = parseInt(settings.late_penalty_threshold_mins || 120, 10);

  const cleanedPunches = cleanAndDebouncePunches(timestamps, 5);

  // 1. No punches -> Absent / Weekly Off
  if (!cleanedPunches || cleanedPunches.length === 0) {
    const isWeeklyOff = (weekday && weekday.toLowerCase().startsWith(weeklyOffDay.toLowerCase().slice(0, 3)));
    return {
      effectiveIn: '',
      effectiveOut: '',
      punchPairsFormatted: '',
      regularHours: 0,
      otHours: 0,
      sundayOtHours: 0,
      totalHours: 0,
      lateMinutes: 0,
      status: isWeeklyOff ? 'Weekly Off (Paid)' : 'Absent',
    };
  }

  // 2. ODD PUNCHES (1, 3, 5 punches -> Unclosed session / Missing final OUT punch)
  // Flagged as 'Incomplete' until closing punch arrives!
  if (cleanedPunches.length % 2 !== 0) {
    const firstIn = cleanedPunches[0];
    const { effectiveTime: effectiveInTime, lateMins } = getEffectiveFirstIn(firstIn, shiftStart, slabMinutes);

    const incompletePairStrings = [];
    for (let i = 0; i < cleanedPunches.length - 1; i += 2) {
      incompletePairStrings.push(`IN ${cleanedPunches[i]} ➔ OUT ${cleanedPunches[i + 1]}`);
    }
    const lastOddPunch = cleanedPunches[cleanedPunches.length - 1];
    incompletePairStrings.push(`IN ${lastOddPunch} (Missed OUT)`);

    return {
      effectiveIn: effectiveInTime,
      effectiveOut: '—',
      punchPairsFormatted: incompletePairStrings.join(' | '),
      regularHours: 0,
      otHours: 0,
      sundayOtHours: 0,
      totalHours: 0,
      lateMinutes: lateMins,
      status: 'Incomplete',
    };
  }

  const isWeeklyOff = (weekday && weekday.toLowerCase().startsWith(weeklyOffDay.toLowerCase().slice(0, 3)));

  // Span 1: apply grace slab to first IN punch
  const firstIn = cleanedPunches[0];
  const { effectiveTime: effectiveInTime, effectiveMins: effectiveInMins, lateMins } = getEffectiveFirstIn(
    firstIn,
    shiftStart,
    slabMinutes
  );

  let totalRawWorkedMins = 0;
  let totalBreakMins = 0;
  let maxMidDayExitMins = 0;
  const punchPairStrings = [];

  // 4-Hour Morning Session Rule: If a worker left in morning after working < 4 hours (240 mins) and returned later,
  // that morning session is forfeited/deducted (time from arrival to return is cut).
  const hasMultipleSessions = cleanedPunches.length >= 4;
  const rawFirstOut = cleanedPunches[1];
  const firstOutMins = timeToMins(rawFirstOut);
  const firstSessionWorkedMins = Math.max(0, firstOutMins - effectiveInMins);
  const morningSessionThresholdMins = Math.round(shortThreshold * 60); // default 4.0h = 240 mins
  const isMorningSessionForfeited = hasMultipleSessions && (firstSessionWorkedMins < morningSessionThresholdMins);

  // EVEN PUNCHES (2, 4, 6...): Process exact (IN, OUT) pairs
  for (let i = 0; i < cleanedPunches.length; i += 2) {
    const rawIn = cleanedPunches[i];
    const rawOut = cleanedPunches[i + 1];

    // Check break duration between previous OUT and current IN
    if (i >= 2) {
      const prevOut = cleanedPunches[i - 1];
      const prevOutMins = timeToMins(prevOut);
      const curInMins = timeToMins(rawIn);
      if (curInMins > prevOutMins) {
        const breakSpan = curInMins - prevOutMins;
        totalBreakMins += breakSpan;
        if (breakSpan > maxMidDayExitMins) maxMidDayExitMins = breakSpan;
      }
    }

    const inMins = (i === 0) ? effectiveInMins : timeToMins(rawIn);
    const outMins = timeToMins(rawOut);

    if (outMins <= inMins) {
      punchPairStrings.push(`IN ${rawIn} ➔ OUT ${rawOut}`);
      continue;
    }

    const span = outMins - inMins;

    if (i === 0 && isMorningSessionForfeited) {
      punchPairStrings.push(`IN ${rawIn} ➔ OUT ${rawOut} (<4h Morning Exit)`);
    } else {
      punchPairStrings.push(`IN ${rawIn} ➔ OUT ${rawOut}`);
      totalRawWorkedMins += span;
    }
  }

  // 1. Handle Lunch Deduction (UNPAID 30 minutes):
  // 30 minutes lunch is not counted as working hours and not paid.
  // Applies whenever worker is on shift and lunch was not punched out separately.
  let effectiveLunchDeduct = 0;
  if (lunchDeductionMins > 0 && totalBreakMins < lunchDeductionMins && totalRawWorkedMins > 0) {
    const remainingLunch = lunchDeductionMins - totalBreakMins;
    effectiveLunchDeduct = Math.min(remainingLunch, totalRawWorkedMins);
  }

  const netWorkedMins = Math.max(0, totalRawWorkedMins - effectiveLunchDeduct);
  const roundingBlock = (otRounding === '30min_block' || slabMinutes > 0) ? (slabMinutes || 30) : 30;

  // SUNDAY / WEEKLY OFF: ALL worked time = Overtime (no regular hours)
  if (isWeeklyOff) {
    let totalSundayOtMins = netWorkedMins;
    totalSundayOtMins = Math.floor(totalSundayOtMins / roundingBlock) * roundingBlock;

    const sundayOtHours = +(totalSundayOtMins / 60).toFixed(2);
    const totalHours = sundayOtHours;
    const finalOutTime = timestamps[timestamps.length - 1];
    const status = totalHours > 0 ? 'Weekly Off (Worked OT)' : 'Weekly Off (Paid)';

    return {
      effectiveIn: effectiveInTime,
      effectiveOut: finalOutTime,
      punchPairsFormatted: punchPairStrings.join(' | '),
      regularHours: 0,
      otHours: 0,
      sundayOtHours,
      totalHours,
      lateMinutes: lateMins,
      status,
    };
  }

  // REGULAR WORKING DAY:
  // Standard duty is 8 hours (480 minutes) of actual work.
  // FACTORY RULE: Worker MUST complete full 8 hours (480 mins) of duty for the day to count as regular shift.
  // If worker works LESS than 8 hours duty (e.g. 5.5h, 6h, etc.):
  // - Day is marked 'Absent' (no regular daily shift credited)
  // - All net worked hours (after lunch deduction & 30-min rounding) are credited to Overtime (OT Hours)
  const standardDailyDutyMins = 480;
  let totalRegularMins = 0;
  let totalOtMins = 0;
  let status = 'Present (Full)';

  if (netWorkedMins >= standardDailyDutyMins) {
    // Completed full 8 hours duty:
    totalRegularMins = standardDailyDutyMins;
    totalOtMins = netWorkedMins - standardDailyDutyMins;

    // 3. Apply Active Custom Rules (mid-day exit & late penalty)
    if (Array.isArray(customRules)) {
      customRules.forEach(rule => {
        if (!rule || !rule.is_active) return;

        // Mid-day Exit Rule Evaluation
        if (rule.rule_type === 'midday_exit' && maxMidDayExitMins > (rule.threshold_mins || 0)) {
          const deduct = parseInt(rule.deduction_mins || 0, 10);
          if (deduct > 0) totalRegularMins = Math.max(0, totalRegularMins - deduct);
        }

        // Late Penalty Rule Evaluation
        if (rule.rule_type === 'late_penalty' && lateMins > (rule.threshold_mins || 0)) {
          const deduct = parseInt(rule.deduction_mins || 0, 10);
          if (deduct > 0) totalRegularMins = Math.max(0, totalRegularMins - deduct);
        }
      });
    }

    // 4. Apply 30-minute block rounding to both regular hours and overtime
    totalRegularMins = Math.floor(totalRegularMins / roundingBlock) * roundingBlock;
    totalOtMins = Math.floor(totalOtMins / roundingBlock) * roundingBlock;

    // 5. Apply Max OT Cap if configured (> 0)
    if (maxOtHours > 0 && (totalOtMins / 60) > maxOtHours) {
      totalOtMins = maxOtHours * 60;
    }

    if (lateMins >= latePenaltyThresholdMins) {
      status = 'Present (Short)';
    }
  } else if (netWorkedMins > 0) {
    // Incomplete Shift (< 8 hours duty):
    // Count day as Absent, credit all net worked time as Overtime!
    totalRegularMins = 0;
    totalOtMins = Math.floor(netWorkedMins / roundingBlock) * roundingBlock;
    if (maxOtHours > 0 && (totalOtMins / 60) > maxOtHours) {
      totalOtMins = maxOtHours * 60;
    }
    status = 'Absent';
  } else {
    // 0 worked time
    totalRegularMins = 0;
    totalOtMins = 0;
    status = 'Absent';
  }

  const regularHours = +(totalRegularMins / 60).toFixed(2);
  const otHours = +(totalOtMins / 60).toFixed(2);
  const sundayOtHours = 0;
  const totalHours = +(regularHours + otHours).toFixed(2);

  const finalOutTime = timestamps[timestamps.length - 1];

  return {
    effectiveIn: effectiveInTime,
    effectiveOut: finalOutTime,
    punchPairsFormatted: punchPairStrings.join(' | '),
    regularHours,
    otHours,
    sundayOtHours,
    totalHours,
    lateMinutes: lateMins,
    status,
  };
}

/**
 * Helper to determine if an Absent record is a PURE unworked absence (0 hours)
 * Partial duty (<8h) where hours were worked and credited to OT is EXEMPT from Sunday forfeiture.
 */
function isPureAbsentForForfeiture(rec) {
  if (!rec) return false;
  const isAbsent = (rec.status === 'Absent');
  if (!isAbsent) return false;
  const ot = parseFloat(rec.ot_hours || rec.otHours || 0);
  const sunOt = parseFloat(rec.sunday_ot_hours || rec.sundayOtHours || 0);
  const total = parseFloat(rec.total_hours || rec.totalHours || 0);
  return (ot <= 0 && sunOt <= 0 && total <= 0);
}

/**
 * Apply Weekly & Monthly Sunday Forfeiture rules
 * @param {Array<Object>} dailyRecords - Array of daily attendance objects
 * @param {Object} settings - Configuration map
 */
function applyWeeklyOffForfeiture(dailyRecords, settings = {}) {
  const weeklyOffDay = settings.weekly_off_day || 'Sun';
  const absentThreshold = parseInt(settings.forfeiture_absent_threshold || settings.absent_forfeiture_threshold || 3, 10);
  const weeklyOffForfeiture = parseInt(settings.weekly_off_forfeiture_threshold || 4, 10);
  const monthlyAbsentForfeiture = parseInt(settings.monthly_absent_forfeiture_threshold || 5, 10);

  // Count total monthly PURE absents (0h worked)
  let totalMonthlyAbsents = 0;
  dailyRecords.forEach(r => {
    if (isPureAbsentForForfeiture(r)) totalMonthlyAbsents++;
  });

  // Step 1: Evaluate Weekly Forfeiture rules for each Sunday
  for (let i = 0; i < dailyRecords.length; i++) {
    const rec = dailyRecords[i];
    const isWeeklyOff = rec.weekday && rec.weekday.toLowerCase().startsWith(weeklyOffDay.toLowerCase().slice(0, 3));

    if (isWeeklyOff && rec.status.includes('Weekly Off')) {
      // Don't forfeit Sunday if worker worked OT that day
      if (rec.status === 'Weekly Off (Worked OT)' || (rec.sundayOtHours && rec.sundayOtHours > 0) || (rec.sunday_ot_hours && rec.sunday_ot_hours > 0)) {
        rec.status = 'Weekly Off (Worked OT)';
        continue;
      }

      // Check weekly absent count in preceding Mon-Sat stretch (ONLY pure unworked absents)
      let weeklyAbsentCount = 0;
      let weeklyOffsInWeek = 0;
      for (let j = Math.max(0, i - 6); j < i; j++) {
        const prevRec = dailyRecords[j];
        if (isPureAbsentForForfeiture(prevRec)) {
          weeklyAbsentCount++;
          weeklyOffsInWeek++;
        } else if (prevRec.status.includes('Weekly Off')) {
          weeklyOffsInWeek++;
        }
      }

      if (weeklyAbsentCount >= absentThreshold || weeklyOffsInWeek >= weeklyOffForfeiture) {
        rec.status = 'Weekly Off (Forfeited)';
      } else {
        rec.status = 'Weekly Off (Paid)';
      }
    }
  }

  // Step 2: Monthly Forfeiture Rule (If 4+ absents in month, forfeit EXACTLY 1 non-OT Sunday)
  if (totalMonthlyAbsents >= monthlyAbsentForfeiture) {
    let forfeitedCount = dailyRecords.filter(r => r.status === 'Weekly Off (Forfeited)').length;

    // If no Sunday is forfeited yet by weekly rule, forfeit the FIRST available non-OT paid Sunday
    if (forfeitedCount === 0) {
      for (let i = 0; i < dailyRecords.length; i++) {
        const rec = dailyRecords[i];
        const isWeeklyOff = rec.weekday && rec.weekday.toLowerCase().startsWith(weeklyOffDay.toLowerCase().slice(0, 3));
        if (isWeeklyOff && rec.status === 'Weekly Off (Paid)') {
          rec.status = 'Weekly Off (Forfeited)';
          break; // Forfeit ONLY EXACTLY 1 Sunday!
        }
      }
    }
  }

  return dailyRecords;
}

module.exports = {
  timeToMins,
  minsToTime,
  formatHours,
  detectDailyFactoryShift,
  buildDailyShiftMap,
  cleanAndDebouncePunches,
  getEffectiveFirstIn,
  computeDailyAttendance,
  isPureAbsentForForfeiture,
  applyWeeklyOffForfeiture,
};

