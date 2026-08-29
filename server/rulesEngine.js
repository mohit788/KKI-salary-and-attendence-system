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
 * Detects the shift start anchor for an individual worker based on their first IN punch.
 * Supports standard factory shift slots:
 * - 06:00 Shift: Punches between 05:30 and 06:20 (e.g. 05:45, 05:55, 06:00, 06:04)
 * - 07:00 Shift: Punches between 06:21 and 07:20 (e.g. 06:48, 06:52, 07:00, 07:15)
 * - 08:00 Shift: Punches between 07:21 and 08:20 (e.g. 07:45, 07:55, 08:00, 08:15)
 * - 08:30 Shift: Punches between 08:21 and 08:45
 * - 09:00 Shift: Punches between 08:46 and 09:45
 * 
 * @param {string} firstInTime - First IN punch (e.g. '05:55', '06:52', '07:55')
 * @param {string} defaultShift - Default fallback shift start (default '08:00')
 * @param {string} assignedShift - Optional fixed worker assigned shift (e.g. '06:00', '07:00', 'auto')
 * @returns {string} Detected or assigned shift start time (e.g. '06:00', '07:00', '08:00')
 */
function detectWorkerShiftAnchor(firstInTime, defaultShift = '08:00', assignedShift = 'auto') {
  if (assignedShift && assignedShift !== 'auto' && /^\d{1,2}:\d{2}$/.test(String(assignedShift).trim())) {
    return assignedShift.trim();
  }

  if (!firstInTime || !/^\d{1,2}:\d{2}$/.test(String(firstInTime).trim())) {
    return defaultShift || '08:00';
  }

  const mins = timeToMins(firstInTime);

  // Shift Anchors (30-minute standard slots):
  if (mins >= timeToMins('05:30') && mins <= timeToMins('06:15')) {
    return '06:00';
  }
  if (mins > timeToMins('06:15') && mins <= timeToMins('06:45')) {
    return '06:30';
  }
  if (mins > timeToMins('06:45') && mins <= timeToMins('07:15')) {
    return '07:00';
  }
  if (mins > timeToMins('07:15') && mins <= timeToMins('07:45')) {
    return '07:30';
  }
  if (mins > timeToMins('07:45') && mins <= timeToMins('08:15')) {
    return '08:00';
  }
  if (mins > timeToMins('08:15') && mins <= timeToMins('08:45')) {
    return '08:30';
  }
  if (mins > timeToMins('08:45') && mins <= timeToMins('09:45')) {
    return '09:00';
  }

  return defaultShift || '08:00';
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
  // 06:00 Shift Slot: Punches between 05:30 and 06:20
  // 07:00 Shift Slot: Punches between 06:21 and 07:25 (e.g., 6:50, 6:58, 7:10, 7:20)
  // 08:00 Shift Slot: Punches between 07:26 and 08:20 (e.g., 7:45, 7:55, 8:00, 8:15)
  // 08:30 Shift Slot: Punches between 08:21 and 08:45
  // 09:00 Shift Slot: Punches between 08:46 and 09:45
  let early6Count = 0;
  let early7Count = 0;
  let normal8Count = 0;
  let mid830Count = 0;
  let late9Count = 0;

  validTimes.forEach(timeStr => {
    const mins = timeToMins(timeStr);
    if (mins >= timeToMins('05:30') && mins <= timeToMins('06:20')) {
      early6Count++;
    } else if (mins > timeToMins('06:20') && mins <= timeToMins('07:25')) {
      early7Count++;
    } else if (mins > timeToMins('07:25') && mins <= timeToMins('08:20')) {
      normal8Count++;
    } else if (mins > timeToMins('08:20') && mins <= timeToMins('08:45')) {
      mid830Count++;
    } else if (mins > timeToMins('08:45') && mins <= timeToMins('09:45')) {
      late9Count++;
    }
  });

  const early6Ratio = early6Count / totalWorkers;
  if ((early6Count >= 2 && early6Ratio >= 0.20) || early6Ratio >= 0.30 || (early6Count > 0 && early6Count > normal8Count)) {
    return '06:00';
  }

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
 * @param {boolean} isLeisureForgiven - if true, worker gets 2-minute leisure forgiveness
 */
function getEffectiveFirstIn(rawInTime, shiftStart = '08:00', slabMinutes = 30, isLeisureForgiven = false) {
  const inMins = timeToMins(rawInTime);
  const shiftMins = timeToMins(shiftStart);

  // Arrived early or on time -> Effective start is shift start (no early credit)
  if (inMins <= shiftMins) {
    return { effectiveTime: shiftStart, effectiveMins: shiftMins, lateMins: 0, isLeisureForgiven: false };
  }

  // If leisure time is approved/forgiven for this day
  if (isLeisureForgiven) {
    return { effectiveTime: shiftStart, effectiveMins: shiftMins, lateMins: 0, isLeisureForgiven: true };
  }

  // If worker is exempted from slab rounding (exact minute arrival)
  if (slabMinutes <= 0) {
    return {
      effectiveTime: minsToTime(inMins),
      effectiveMins: inMins,
      lateMins: inMins - shiftMins,
      isLeisureForgiven: false,
    };
  }

  // Late arrival: round UP to next slab boundary
  const lateDelta = inMins - shiftMins;
  const slabCount = Math.ceil(lateDelta / slabMinutes);
  const effectiveMins = shiftMins + (slabCount * slabMinutes);

  return {
    effectiveTime: minsToTime(effectiveMins),
    effectiveMins,
    lateMins: lateDelta,
    isLeisureForgiven: false,
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
  const valid = timestamps.filter(t => {
    if (!t) return false;
    const str = String(t).trim();
    if (str === '00:00' || str === '0:00' || str === '0') return false;
    return /^\d{1,2}:\d{2}$/.test(str);
  });
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
 * @param {string} dynamicShiftStart - Optional detected date-specific shift start (e.g. '07:00' or '06:00')
 * @param {boolean} isPaidHoliday - true if date is a declared paid national/factory holiday
 * @param {string} holidayName - Name of the holiday (e.g. 'Independence Day')
 * @param {boolean} isLeisureForgiven - true if 2-minute leisure time is approved
 */
function computeDailyAttendance(
  timestamps,
  settings = {},
  weekday = '',
  customRules = [],
  dynamicShiftStart = '',
  isPaidHoliday = false,
  holidayName = '',
  isLeisureForgiven = false
) {
  const cleanedPunches = cleanAndDebouncePunches(timestamps, 5);
  const firstIn = cleanedPunches && cleanedPunches.length > 0 ? cleanedPunches[0] : '';

  // Determine individual worker shift start:
  let shiftStart = '08:00';
  const customShiftRule = Array.isArray(customRules) && customRules.find(r => r && r.is_active && (r.exemption_type === 'shift_override' || r.rule_type === 'shift_override') && r.start_time);
  if (customShiftRule && customShiftRule.start_time) {
    shiftStart = customShiftRule.start_time;
  } else if (dynamicShiftStart && dynamicShiftStart !== 'auto') {
    shiftStart = dynamicShiftStart;
  } else if (firstIn) {
    shiftStart = detectWorkerShiftAnchor(firstIn, settings.shift_start || '08:00', settings.assigned_shift || 'auto');
  } else {
    shiftStart = settings.shift_start || '08:00';
  }

  const isGraceExempt = Array.isArray(customRules) && customRules.some(r => r && r.is_active && (r.exemption_type === 'grace_slab_exempt' || r.rule_type === 'grace_slab_exempt'));
  const slabMinutes = isGraceExempt ? 0 : parseInt(settings.grace_slab_minutes || 30, 10);
  const shiftEnd = settings.shift_end || '16:30';
  const otRounding = settings.ot_rounding || '30min_block';
  const shortThreshold = parseFloat(settings.short_hours_threshold || 4.0);
  const weeklyOffDay = settings.weekly_off_day || 'Sun';
  const maxOtHours = parseFloat(settings.max_ot_hours || 0);
  const lunchDeductionMins = parseInt(settings.lunch_deduction_mins !== undefined ? settings.lunch_deduction_mins : 30, 10);
  const latePenaltyThresholdMins = parseInt(settings.late_penalty_threshold_mins || 120, 10);

  // 1. No punches -> Absent / Weekly Off / Paid Holiday
  if (!cleanedPunches || cleanedPunches.length === 0) {
    const isWeeklyOff = (weekday && weekday.toLowerCase().startsWith(weeklyOffDay.toLowerCase().slice(0, 3)));
    
    if (isPaidHoliday) {
      return {
        shift: shiftStart,
        effectiveIn: shiftStart,
        effectiveOut: shiftEnd,
        punchPairsFormatted: holidayName ? `[${holidayName}]` : '[Paid Holiday]',
        regularHours: 8.0,
        otHours: 0,
        sundayOtHours: 0,
        totalHours: 8.0,
        lateMinutes: 0,
        status: 'Holiday (Paid)',
      };
    }

    return {
      shift: shiftStart,
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
    const { effectiveTime: effectiveInTime, lateMins } = getEffectiveFirstIn(firstIn, shiftStart, slabMinutes, isLeisureForgiven);

    const incompletePairStrings = [];
    for (let i = 0; i < cleanedPunches.length - 1; i += 2) {
      incompletePairStrings.push(`IN ${cleanedPunches[i]} ➔ OUT ${cleanedPunches[i + 1]}`);
    }
    const lastOddPunch = cleanedPunches[cleanedPunches.length - 1];
    incompletePairStrings.push(`IN ${lastOddPunch} (Missed OUT)`);

    return {
      shift: shiftStart,
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

  // Span 1: apply grace slab to first IN punch (with 2-min leisure forgiveness if approved)
  const { effectiveTime: effectiveInTime, effectiveMins: effectiveInMins, lateMins } = getEffectiveFirstIn(
    firstIn,
    shiftStart,
    slabMinutes,
    isLeisureForgiven
  );

  let totalRawWorkedMins = 0;
  let totalBreakMins = 0;
  let maxMidDayExitMins = 0;
  const punchPairStrings = [];

  for (let i = 0; i < cleanedPunches.length; i += 2) {
    const rawIn = cleanedPunches[i];
    const rawOut = cleanedPunches[i + 1];

    let sessionInMins = timeToMins(rawIn);
    let sessionOutMins = timeToMins(rawOut);

    if (i === 0) {
      sessionInMins = effectiveInMins;
    }

    let sessionWorkedMins = Math.max(0, sessionOutMins - sessionInMins);
    totalRawWorkedMins += sessionWorkedMins;
    punchPairStrings.push(`IN ${rawIn} ➔ OUT ${rawOut}`);

    if (i + 2 < cleanedPunches.length) {
      const nextIn = cleanedPunches[i + 2];
      const gapMins = Math.max(0, timeToMins(nextIn) - sessionOutMins);
      totalBreakMins += gapMins;
      if (gapMins > maxMidDayExitMins) {
        maxMidDayExitMins = gapMins;
      }
    }
  }

  let finalEffectiveMins = totalRawWorkedMins;

  // Custom Rules deduction
  if (Array.isArray(customRules)) {
    customRules.forEach(rule => {
      if (!rule || !rule.is_active) return;
      if (rule.rule_type === 'midday_exit' && maxMidDayExitMins >= (rule.threshold_mins || 30)) {
        finalEffectiveMins -= (rule.deduction_mins || 30);
      }
    });
  }

  // Automatic lunch deduction
  if (finalEffectiveMins > 300 && lunchDeductionMins > 0) {
    finalEffectiveMins = Math.max(0, finalEffectiveMins - lunchDeductionMins);
  }

  finalEffectiveMins = Math.max(0, finalEffectiveMins);

  const regularDutyMins = 8 * 60; // 480 mins = 8 hours
  let regularHours = 0;
  let otHours = 0;
  let sundayOtHours = 0;
  let status = 'Present (Full)';

  if (isPaidHoliday) {
    // Worker worked on a Paid National / Declared Holiday: In daily breakdown, regular duty is 0, all physical worked time is Sunday/Holiday OT
    regularHours = 0;
    let rawMins = finalEffectiveMins;
    sundayOtHours = otRounding === '30min_block'
      ? Math.floor(rawMins / 30) * 0.5
      : +(rawMins / 60).toFixed(2);
    status = 'Holiday (Worked OT)';
  } else if (isWeeklyOff) {
    // Sunday work: In daily breakdown, regular duty is 0, all physical worked time is Sunday OT
    regularHours = 0;
    let rawMins = finalEffectiveMins;
    sundayOtHours = otRounding === '30min_block'
      ? Math.floor(rawMins / 30) * 0.5
      : +(rawMins / 60).toFixed(2);
    status = 'Weekly Off (Worked OT)';
  } else {
    // Regular weekday work (Mon - Sat)
    // Full Shift Completion: A worker completing standard shift (e.g. leaving at 16:25-16:30 for 16:30 shift end) gets full 8h regular duty
    if (finalEffectiveMins >= (regularDutyMins - 15)) {
      regularHours = 8.0;
      let rawOtMins = Math.max(0, finalEffectiveMins - regularDutyMins);
      let computedOtHours = otRounding === '30min_block'
        ? Math.floor(rawOtMins / 30) * 0.5
        : +(rawOtMins / 60).toFixed(2);

      if (maxOtHours > 0) {
        computedOtHours = Math.min(computedOtHours, maxOtHours);
      }

      otHours = computedOtHours;
      status = 'Present (Full)';
    } else if (finalEffectiveMins > 0) {
      let rawWorkedMins = finalEffectiveMins;
      let workedH = otRounding === '30min_block'
        ? Math.floor(rawWorkedMins / 30) * 0.5
        : +(rawWorkedMins / 60).toFixed(2);

      // Core Rule: Any duty < 8 hours is credited entirely as Overtime (OT), with 0 regular hours and Absent (OT Credited) status.
      otHours = workedH;
      regularHours = 0;
      status = 'Absent (OT Credited)';
    } else {
      status = 'Absent';
    }
  }

  const lastOut = cleanedPunches[cleanedPunches.length - 1];
  let finalOutTime = lastOut || shiftEnd;

  const totalHours = +(regularHours + otHours + sundayOtHours).toFixed(2);

  return {
    shift: shiftStart,
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
 * 5-Minute Leisure Time Policy Evaluation across a worker's monthly attendance:
 * - Each worker is granted up to leisureMinsAllowed (Default: 5 min) on up to leisureDaysAllowed (2 days/month).
 * - 3rd Strike Revocation: If the worker is late 3 or more times (even 1-5 mins),
 *   ALL leisure forgiveness is REVOKED and all late days get full 30-min slab penalty!
 */
function applyMonthlyLeisureGrace(dailyRecords = [], settings = {}, customRules = [], paidHolidaysMap = {}) {
  const leisureMinsAllowed = parseInt(settings.leisure_mins_allowed || 5, 10);
  const leisureDaysAllowed = parseInt(settings.leisure_days_allowed || 2, 10);

  // Identify all late days for this worker in the month
  const lateDayIndices = [];
  const leisureCandidateIndices = [];

  for (let i = 0; i < dailyRecords.length; i++) {
    const r = dailyRecords[i];
    const swipes = r.raw_swipes || r.swipe_record || '';
    // Basic helper replacement for parseSwipeRecord
    const timestamps = (String(swipes).match(/\b\d{1,2}:\d{2}\b/g) || []).filter(t => t !== '00:00' && t !== '0:00');
    const cleaned = cleanAndDebouncePunches(timestamps, 5);
    if (cleaned.length === 0) continue;

    const firstIn = cleaned[0];
    const shiftStart = detectWorkerShiftAnchor(firstIn, settings.shift_start || '08:00', settings.assigned_shift || 'auto');
    const inMins = timeToMins(firstIn);
    const shiftMins = timeToMins(shiftStart);

    if (inMins > shiftMins) {
      const lateDelta = inMins - shiftMins;
      lateDayIndices.push(i);
      if (lateDelta <= leisureMinsAllowed) {
        leisureCandidateIndices.push(i);
      }
    }
  }

  // Revocation Rule: If total late arrivals in month > leisureDaysAllowed (e.g. 3 or more late days in month):
  // 3rd Strike triggers and ALL leisure forgiveness is revoked.
  // If worker had <= leisureDaysAllowed late days (e.g. <= 2 total late days in month),
  // each day with late arrival <= leisureMinsAllowed (up to 2 days) is granted 2-min leisure forgiveness.
  const isRevokedBy3rdStrike = (lateDayIndices.length > leisureDaysAllowed);

  const eligibleLeisureIndices = isRevokedBy3rdStrike
    ? []
    : leisureCandidateIndices.slice(0, leisureDaysAllowed);

  const forgivenSet = new Set(eligibleLeisureIndices);

  // Recompute records with leisure status
  return dailyRecords.map((r, idx) => {
    const swipes = r.raw_swipes || r.swipe_record || '';
    const timestamps = (String(swipes).match(/\b\d{1,2}:\d{2}\b/g) || []).filter(t => t !== '00:00' && t !== '0:00');
    const isLeisure = forgivenSet.has(idx);
    const isHoliday = !!paidHolidaysMap[r.date];
    const holidayName = paidHolidaysMap[r.date] || '';

    const computed = computeDailyAttendance(
      timestamps,
      settings,
      r.weekday,
      customRules,
      settings.assigned_shift || 'auto',
      isHoliday,
      holidayName,
      isLeisure
    );

    return {
      ...r,
      ...computed,
      is_leisure_forgiven: isLeisure ? 1 : 0
    };
  });
}

/**
 * Helper to determine if an Absent record is a PURE unworked absence (0 hours)
 * Partial duty (<8h) where hours were worked and credited to OT is EXEMPT from Sunday forfeiture.
 * Paid holidays are EXEMPT from Sunday forfeiture.
 */
function isPureAbsentForForfeiture(rec) {
  if (!rec) return false;
  const st = rec.status || '';
  if (st.includes('Holiday')) return false; // Paid holidays never count as absents
  const isAbsent = st.includes('Absent') || st.includes('Incomplete') || (!st.includes('Present') && !st.includes('Weekly Off') && (rec.regular_hours || 0) === 0 && (rec.regularHours || 0) === 0);
  if (!isAbsent) return false;
  const ot = parseFloat(rec.ot_hours || rec.otHours || 0);
  const sunOt = parseFloat(rec.sunday_ot_hours || rec.sundayOtHours || 0);
  const total = parseFloat(rec.total_hours || rec.totalHours || 0);
  return (ot <= 0 && sunOt <= 0 && total <= 0);
}

/**
 * Apply Weekly & Monthly Sunday Forfeiture rules (with cross-month boundary resilience)
 * @param {Array<Object>} dailyRecords - Array of daily attendance objects
 * @param {Object} settings - Configuration map
 */
function applyWeeklyOffForfeiture(dailyRecords, settings = {}, customRules = []) {
  // Check if worker has an active forfeiture exemption
  const isForfeitureExempt = Array.isArray(customRules) && customRules.some(r => r && r.is_active && (r.exemption_type === 'forfeiture_exempt' || r.rule_type === 'forfeiture_exempt'));
  if (isForfeitureExempt) {
    return dailyRecords;
  }

  const weeklyOffDay = settings.weekly_off_day || 'Sun';
  const absentThreshold = parseInt(settings.forfeiture_absent_threshold || settings.absent_forfeiture_threshold || 4, 10);
  const weeklyOffForfeiture = parseInt(settings.weekly_off_forfeiture_threshold || 4, 10);
  const monthlyAbsentForfeiture = parseInt(settings.monthly_absent_forfeiture_threshold || 4, 10);

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

  // Step 2: Monthly Forfeiture Rule (If 4+ absents in month, deduct 1 Paid Sunday from earned Sundays if worker has <= 1 forfeited Sunday)
  if (totalMonthlyAbsents >= monthlyAbsentForfeiture) {
    let forfeitedCount = dailyRecords.filter(r => r.status === 'Weekly Off (Forfeited)').length;
    if (forfeitedCount <= 1) {
      for (let i = 0; i < dailyRecords.length; i++) {
        const rec = dailyRecords[i];
        const isWeeklyOff = rec.weekday && rec.weekday.toLowerCase().startsWith(weeklyOffDay.toLowerCase().slice(0, 3));
        if (isWeeklyOff && rec.status === 'Weekly Off (Paid)') {
          rec.status = 'Weekly Off (Forfeited)';
          break; // Forfeit 1 Paid Sunday!
        }
      }
    }
  }

  return dailyRecords;
}

/**
 * Apply Paid Holiday Eligibility & Sandwich Forfeiture Rule:
 * - Immediate Preceding Days (Up to 2 working days right before the holiday, e.g. Aug 13 & 14 for Aug 15):
 *   If worker is absent on either of the 1-2 working days directly before the holiday to bridge a long weekend,
 *   the holiday is forfeited. (Absences earlier in the week like Mon 10, Tue 11, Wed 12 do NOT forfeit).
 * - Immediate Next Scheduled Working Day (Bridge day after holiday/weekend block, e.g. Mon Aug 17):
 *   If worker is absent on the immediate next working day, the holiday is forfeited.
 * @param {Array<Object>} dailyRecords - Array of daily attendance objects
 * @param {Object} settings - Configuration map
 */
function applyPaidHolidayForfeiture(dailyRecords, settings = {}) {
  const weeklyOffDay = settings.weekly_off_day || 'Sun';

  for (let i = 0; i < dailyRecords.length; i++) {
    const rec = dailyRecords[i];
    if (rec.status !== 'Holiday (Paid)') continue;

    let isForfeited = false;

    // 1. Check ONLY the 1-2 immediate preceding working days right before the holiday (e.g. 13th & 14th)
    let precedingWorkingDaysChecked = 0;
    for (let j = i - 1; j >= 0 && precedingWorkingDaysChecked < 2; j--) {
      const prev = dailyRecords[j];
      const prevWeekday = (prev.weekday || '').slice(0, 3);
      
      // Stop if crossed into previous week's Sunday
      if (prevWeekday.toLowerCase() === weeklyOffDay.toLowerCase().slice(0, 3)) break;

      precedingWorkingDaysChecked++;

      // If absent on either of the 1-2 days directly preceding the holiday:
      if (isPureAbsentForForfeiture(prev)) {
        isForfeited = true;
        break;
      }
    }

    // 2. Check immediate next scheduled working day after holiday/weekend block (e.g. Mon 17th)
    if (!isForfeited) {
      for (let k = i + 1; k < dailyRecords.length; k++) {
        const next = dailyRecords[k];
        const nextWeekday = (next.weekday || '').slice(0, 3);
        const isNextOff = nextWeekday.toLowerCase() === weeklyOffDay.toLowerCase().slice(0, 3) || (next.status && next.status.includes('Holiday'));

        // Skip consecutive holidays and Sundays
        if (isNextOff) continue;

        // First regular scheduled working day found (e.g. Mon Aug 17):
        if (isPureAbsentForForfeiture(next)) {
          isForfeited = true;
        }
        break;
      }
    }

    if (isForfeited) {
      rec.status = 'Holiday (Forfeited)';
      rec.regularHours = 0;
      rec.regular_hours = 0;
      rec.totalHours = 0;
      rec.total_hours = 0;
    }
  }

  return dailyRecords;
}

module.exports = {
  timeToMins,
  minsToTime,
  formatHours,
  detectWorkerShiftAnchor,
  detectDailyFactoryShift,
  buildDailyShiftMap,
  cleanAndDebouncePunches,
  getEffectiveFirstIn,
  computeDailyAttendance,
  applyMonthlyLeisureGrace,
  isPureAbsentForForfeiture,
  applyWeeklyOffForfeiture,
  applyPaidHolidayForfeiture,
};
