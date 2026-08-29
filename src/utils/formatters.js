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

