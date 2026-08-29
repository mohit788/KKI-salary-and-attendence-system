const XLSX = require('xlsx');
const WordExtractor = require('word-extractor');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

const extractor = new WordExtractor();

/**
 * Clean whitespace and ditto marks
 */
function cleanVal(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (str === '"' || str === '""' || str.replace(/"/g, '').trim() === '') {
    return '"';
  }
  return str;
}

/**
 * Normalize Date String "2026-07-01 Wed" -> { date: "2026-07-01", weekday: "Wed" }
 */
function parseDateCell(rawDate) {
  if (!rawDate) return { date: '', weekday: '' };
  const str = String(rawDate).trim();

  // Match ISO date YYYY-MM-DD
  const isoMatch = str.match(/(\d{4}-\d{2}-\d{2})\s*([A-Za-z]+)?/);
  if (isoMatch) {
    return {
      date: isoMatch[1],
      weekday: isoMatch[2] || getWeekdayFromISO(isoMatch[1]),
    };
  }

  return { date: str, weekday: '' };
}

function getWeekdayFromISO(isoStr) {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[d.getDay()];
}

/**
 * Parse Swipe Record string into normalized timestamps
 * @param {string} rawSwipes 
 */
function parseSwipeRecord(rawSwipes) {
  if (!rawSwipes) return { timestamps: [], isOdd: false, isEmpty: true };
  
  // Normalize tokens first (handling e.g. "190", "901", "1830", "19:0", "19")
  const tokens = String(rawSwipes).trim().split(/[\s,]+/);
  const normalizedTokens = tokens.map(t => {
    if (!t) return '';
    t = String(t).trim();
    if (/^\d{2}:\d{2}$/.test(t)) return t;
    if (/^\d{1}:\d{1,2}$/.test(t)) {
      const [h, m] = t.split(':');
      const mPadded = m.length === 1 ? `${m}0` : m;
      return `${String(h).padStart(2, '0')}:${mPadded}`;
    }
    if (/^\d{2}:\d{1}$/.test(t)) {
      const [h, m] = t.split(':');
      return `${h}:${m}0`;
    }
    if (/^\d{4}$/.test(t)) {
      const h = t.slice(0, 2);
      const m = t.slice(2, 4);
      if (parseInt(h, 10) < 24 && parseInt(m, 10) < 60) return `${h}:${m}`;
    }
    if (/^\d{3}$/.test(t)) {
      const h2 = parseInt(t.slice(0, 2), 10);
      if (h2 >= 10 && h2 < 24) {
        const m2 = `${t.slice(2)}0`;
        if (parseInt(m2, 10) < 60) return `${h2}:${m2}`;
      }
      const h1 = t.slice(0, 1);
      const m1 = t.slice(1, 3);
      if (parseInt(m1, 10) < 60) return `0${h1}:${m1}`;
    }
    if (/^\d{1,2}$/.test(t)) {
      const hNum = parseInt(t, 10);
      if (hNum >= 0 && hNum < 24) return `${String(hNum).padStart(2, '0')}:00`;
    }
    return t;
  }).filter(Boolean);

  const normalizedStr = normalizedTokens.join(' ');
  const matches = normalizedStr.match(/\b\d{1,2}:\d{2}\b/g) || [];
  const timestamps = matches.filter(t => t !== '00:00').map(t => {
    const parts = t.split(':');
    const hh = parts[0].padStart(2, '0');
    const mm = parts[1].padStart(2, '0');
    return `${hh}:${mm}`;
  });

  return {
    timestamps,
    isOdd: timestamps.length % 2 !== 0,
    isEmpty: timestamps.length === 0,
    normalizedStr: timestamps.join(' ')
  };
}

/**
 * Parse Excel Workbook (.xlsx, .xls)
 * @param {string|Buffer} filePathOrBuffer 
 */
function parseExcelFile(filePathOrBuffer) {
  const workbook = typeof filePathOrBuffer === 'string'
    ? XLSX.readFile(filePathOrBuffer)
    : XLSX.read(filePathOrBuffer, { type: 'buffer' });

  const workersMap = new Map(); // staff_no -> worker object

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    let currentDept = '';
    let currentStaffNo = '';
    let currentStaffName = '';

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      // Find Header row: contains "Department", "Staff No.", "Staff Name"
      const rowStr = row.map(c => String(c)).join(' ');

      if (rowStr.includes('Department') && rowStr.includes('Staff No.')) {
        // Next row contains worker header info
        const nextRow = rows[i + 1];
        if (nextRow) {
          currentDept = cleanVal(nextRow[1]) || 'WORKER';
          currentStaffNo = cleanVal(nextRow[2]);
          currentStaffName = cleanVal(nextRow[3]);

          if (currentStaffNo && currentStaffNo !== '"') {
            if (!workersMap.has(currentStaffNo)) {
              workersMap.set(currentStaffNo, {
                staff_no: currentStaffNo,
                staff_name: currentStaffName,
                department: currentDept,
                records: [],
              });
            }
          }
        }
        i++; // skip header data row
        continue;
      }

      // Check if this row is a daily record row (has Date like 2026-07-01)
      const dateCell = row.find(c => String(c).match(/\d{4}-\d{2}-\d{2}/));
      if (dateCell && currentStaffNo) {
        const { date, weekday } = parseDateCell(dateCell);

        // Find Swipe Record cell (contains HH:MM or blank/ditto)
        let swipeCell = '';
        let machineTimeCell = '';

        row.forEach(cell => {
          const cStr = String(cell).trim();
          if (cStr.match(/\d{1,2}:\d{2}/)) {
            if (!swipeCell) swipeCell = cStr;
            else machineTimeCell = cStr;
          }
        });

        const workerObj = workersMap.get(currentStaffNo);
        if (workerObj) {
          workerObj.records.push({
            staff_no: currentStaffNo,
            date,
            weekday,
            swipe_record: swipeCell,
            machine_work_time: machineTimeCell,
          });
        }
      }
    }
  });

  return Array.from(workersMap.values());
}

/**
 * Extract raw text safely from Word document (.docx or .doc)
 * @param {string} filePath 
 */
async function extractWordText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.docx') {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      if (result.value && result.value.trim()) return result.value;
    } catch (err) {
      console.warn('Mammoth failed for docx, attempting word-extractor fallback:', err.message);
    }
  }

  // Fallback to WordExtractor (OLE2 format)
  try {
    const doc = await extractor.extract(filePath);
    const body = doc.getBody();
    if (body && body.trim()) return body;
  } catch (err) {
    console.warn('WordExtractor failed, attempting mammoth fallback:', err.message);
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      if (result.value) return result.value;
    } catch (e) {
      // Ignore
    }
  }

  return '';
}

/**
 * Parse Word Document (.docx, .doc)
 * @param {string} filePath 
 */
async function parseWordFile(filePath) {
  const text = await extractWordText(filePath);
  if (!text) return [];

  const rawLines = text.split('\n');
  const lines = rawLines.map(l => l.trim()).filter(Boolean);
  const workersMap = new Map();

  let currentDept = 'WORKER';
  let currentStaffNo = '';
  let currentStaffName = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect Header block: "Department", "Staff No.", "Staff Name"
    if (line.includes('Department') && (line.includes('Staff No') || lines[i + 1]?.includes('Staff No'))) {
      let j = i + 1;
      while (
        j < lines.length &&
        (lines[j] === '' ||
          lines[j] === '"' ||
          lines[j].includes('Staff') ||
          lines[j] === 'Department' ||
          lines[j] === 'Date' ||
          lines[j] === 'Swipe Record' ||
          lines[j] === 'Work Time')
      ) {
        j++;
      }

      if (j < lines.length) {
        const candidateDept = lines[j] || 'WORKER';
        const candidateStaffNo = lines[j + 1] || '';
        const candidateStaffName = lines[j + 2] || '';

        if (candidateStaffNo && candidateStaffNo !== '"' && /^\d{1,6}$/.test(candidateStaffNo)) {
          currentDept = candidateDept;
          currentStaffNo = candidateStaffNo;
          currentStaffName = candidateStaffName;
        } else {
          const block = lines.slice(j, j + 5).join(' ');
          const staffNoMatch = block.match(/\b\d{1,6}\b/);
          if (staffNoMatch) {
            currentStaffNo = staffNoMatch[0];
            const nameMatch = block.match(/([A-Z\s]{3,30})/i);
            currentStaffName = nameMatch ? nameMatch[1].trim() : `Worker ${currentStaffNo}`;
          }
        }

        if (currentStaffNo && currentStaffNo !== '"' && !workersMap.has(currentStaffNo)) {
          workersMap.set(currentStaffNo, {
            staff_no: currentStaffNo,
            staff_name: currentStaffName,
            department: currentDept,
            records: [],
          });
        }
      }
    }

    // Match daily date line "2026-07-01 Wed" or similar ISO date
    const dateMatch = line.match(/(\d{4}-\d{2}-\d{2})\s*([A-Za-z]+)?/);
    if (dateMatch) {
      const date = dateMatch[1];
      const weekday = dateMatch[2] || getWeekdayFromISO(date);
      const nextLine = lines[i + 1] || '';
      const nextNextLine = lines[i + 2] || '';

      let swipe_record = '';
      let machine_work_time = '';

      if (nextLine.match(/\d{1,2}:\d{2}/)) {
        swipe_record = nextLine;
        if (nextNextLine.match(/\d{1,2}:\d{2}/)) {
          machine_work_time = nextNextLine;
        }
      }

      if (currentStaffNo && workersMap.has(currentStaffNo)) {
        workersMap.get(currentStaffNo).records.push({
          staff_no: currentStaffNo,
          date,
          weekday,
          swipe_record,
          machine_work_time,
        });
      }
    }
  }

  return Array.from(workersMap.values());
}

module.exports = {
  parseExcelFile,
  parseWordFile,
  parseSwipeRecord,
  parseDateCell,
};

