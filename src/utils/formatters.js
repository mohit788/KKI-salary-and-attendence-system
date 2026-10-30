/**
 * Formats decimal hours into real clock time representation.
 * Prevents misleading displays like "8:5" by correctly showing "8h 30m" (or "8:30 hrs").
 * 
 * @param {number|string} decimalHours - e.g. 8.5, 1.5, 0.5, 8
 * @param {'hm'|'clock'|'verbose'} format - 'hm' -> "8h 30m", 'clock' -> "8:30 hrs", 'verbose' -> "8 hours 30 mins"
 * @returns {string}
 */
export function formatHours(decimalHours, format = 'hm') {
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

  // Default 'hm' format
  if (mins === 0) return `${prefix}${hrs}h`;
  if (hrs === 0) return `${prefix}${mins}m`;
  return `${prefix}${hrs}h ${String(mins).padStart(2, '0')}m`;
}

/**
 * Formats minutes to HH:MM clock string
 * @param {number} mins 
 */
export function minsToTimeStr(mins) {
  if (isNaN(mins) || mins < 0) return '00:00';
  const h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Normalizes a single time token into valid HH:MM format.
 * Supports:
 * - 3 digits: "901" -> "09:01", "830" -> "08:30", "910" -> "09:10"
 * - 4 digits: "1838" -> "18:38", "0901" -> "09:01", "1830" -> "18:30"
 * - 1-2 digits: "9" -> "09:00", "18" -> "18:00", "8" -> "08:00"
 * - Partial colon: "9:1" -> "09:01", "8:5" -> "08:05"
 * - Standard HH:MM: "09:01", "18:38"
 * @param {string} token 
 * @returns {string} Normalized HH:MM or original if invalid
 */
export function normalizeSingleTimeToken(token) {
  if (!token) return '';
  token = String(token).trim();
  if (!token) return '';

  // Already standard HH:MM
  if (/^\d{2}:\d{2}$/.test(token)) {
    return token;
  }

  // Single digit hour with colon: e.g. "9:05" -> "09:05", "9:1" -> "09:10", "9:0" -> "09:00"
  if (/^\d{1}:\d{1,2}$/.test(token)) {
    const [h, m] = token.split(':');
    const mPadded = m.length === 1 ? `${m}0` : m;
    return `${String(h).padStart(2, '0')}:${mPadded}`;
  }

  // Two digit hour with colon: e.g. "18:5" -> "18:50", "19:0" -> "19:00"
  if (/^\d{2}:\d{1}$/.test(token)) {
    const [h, m] = token.split(':');
    return `${h}:${m}0`;
  }

  // Pure digits: 4 digits (e.g. 0901 -> 09:01, 1838 -> 18:38, 1900 -> 19:00)
  if (/^\d{4}$/.test(token)) {
    const h = token.slice(0, 2);
    const m = token.slice(2, 4);
    const hNum = parseInt(h, 10);
    const mNum = parseInt(m, 10);
    if (hNum < 24 && mNum < 60) {
      return `${h}:${m}`;
    }
  }

  // Pure digits: 3 digits (e.g. 190 -> 19:00, 183 -> 18:30, 901 -> 09:01, 830 -> 08:30)
  if (/^\d{3}$/.test(token)) {
    const h2 = parseInt(token.slice(0, 2), 10);
    if (h2 >= 10 && h2 < 24) {
      const m2 = `${token.slice(2)}0`;
      if (parseInt(m2, 10) < 60) {
        return `${h2}:${m2}`;
      }
    }
    const h1 = token.slice(0, 1);
    const m1 = token.slice(1, 3);
    const m1Num = parseInt(m1, 10);
    if (m1Num < 60) {
      return `0${h1}:${m1}`;
    }
  }

  // Pure digits: 1 or 2 digits (e.g. 9 -> 09:00, 19 -> 19:00, 18 -> 18:00)
  if (/^\d{1,2}$/.test(token)) {
    const hNum = parseInt(token, 10);
    if (hNum >= 0 && hNum < 24) {
      return `${String(hNum).padStart(2, '0')}:00`;
    }
  }

  return token;
}

/**
 * Normalizes user-entered swipe strings into properly formatted HH:MM tokens.
 * e.g. "901 1838" -> "09:01 18:38"
 * e.g. "800 1200 1300 1700" -> "08:00 12:00 13:00 17:00"
 * @param {string} inputStr 
 * @returns {string}
 */
export function normalizeTimeInput(inputStr) {
  if (!inputStr) return '';
  const tokens = String(inputStr).trim().split(/[\s,]+/);
  return tokens.map(normalizeSingleTimeToken).filter(Boolean).join(' ');
}

/**
 * Calculates net working hours between in-time and out-time with automatic lunch deduction.
 * Standard factory lunch window is 12:30 PM to 1:00 PM (30 minutes).
 * Any overlap between the worker's presence and the lunch window is deducted.
 * 
 * Verified Scenarios:
 *  - 12:30 to 18:00 (or "6") -> 5 Hours (Gross 5h 30m, Lunch 30m deducted)
 *  - 12:59 to 18:00 (or "6") -> 5 Hours (Gross 5h 01m, Lunch 1m deducted)
 *  - 13:01 to 18:00 (or "6") -> 4h 59m (Gross 4h 59m, Lunch 0m deducted)
 *  - 09:00 to 18:00 (or "6") -> 8h 30m (Gross 9h 00m, Lunch 30m deducted)
 */
export function calculateWorkingHours(inTimeStr, outTimeStr, lunchStart = '12:30', lunchEnd = '13:00') {
  if (!inTimeStr || !outTimeStr) {
    return {
      grossMins: 0,
      lunchDeductionMins: 0,
      netMins: 0,
      hours: 0,
      remainingMins: 0,
      formatted: '0 Hours',
      decimalHours: 0
    };
  }

  const parseToMins = (str) => {
    let raw = String(str).trim();
    const isPM = /pm/i.test(raw);
    const isAM = /am/i.test(raw);
    raw = raw.replace(/[a-z]/gi, '').trim();

    const parts = raw.split(':');
    let h = parseInt(parts[0], 10) || 0;
    const m = parts.length > 1 ? (parseInt(parts[1], 10) || 0) : 0;

    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    // Ambiguous hour-only input e.g. "6" or "5" representing evening shift end (18:00, 17:00)
    if (!isPM && !isAM && h <= 7 && parts.length === 1) {
      h += 12;
    }

    return h * 60 + m;
  };

  const inMins = parseToMins(inTimeStr);
  let outMins = parseToMins(outTimeStr);
  if (outMins < inMins) outMins += 24 * 60; // Handle overnight shift

  const lStart = parseToMins(lunchStart); // 12:30 -> 750
  const lEnd = parseToMins(lunchEnd);     // 13:00 -> 780

  const grossMins = outMins - inMins;
  const overlapStart = Math.max(inMins, lStart);
  const overlapEnd = Math.min(outMins, lEnd);
  const lunchDeductionMins = Math.max(0, overlapEnd - overlapStart);

  const netMins = Math.max(0, grossMins - lunchDeductionMins);
  const hours = Math.floor(netMins / 60);
  const remainingMins = netMins % 60;
  const decimalHours = Number((netMins / 60).toFixed(2));

  let formatted = '';
  if (remainingMins === 0) {
    formatted = `${hours} Hours`;
  } else if (hours === 0) {
    formatted = `${remainingMins} Mins`;
  } else {
    formatted = `${hours}h ${remainingMins}m`;
  }

  return {
    grossMins,
    lunchDeductionMins,
    netMins,
    hours,
    remainingMins,
    formatted,
    decimalHours
  };
}


