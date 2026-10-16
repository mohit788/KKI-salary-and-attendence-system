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
 * Check if a cell contains a valid date candidate
 */
function isDateCandidate(cell) {
  if (cell === null || cell === undefined || cell === '') return false;
  if (cell instanceof Date && !isNaN(cell.getTime())) return true;
  if (typeof cell === 'number' && cell > 25000 && cell < 75000) return true;
  const str = String(cell).trim();
  return !!(
    str.match(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/) ||
    str.match(/\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/)
  );
}

/**
 * Normalize Date String to standard ISO YYYY-MM-DD
 * Supports:
 * - "2026-07-01 Wed", "2026/09/30", "2026.09.30" (ISO)
 * - "01-09-2026", "30-09-2026 Wed", "30/09/2026", "30.09.2026" (Indian/UK)
 * - Excel date serial numbers (e.g. 46294)
 * - JavaScript Date objects
 */
function parseDateCell(rawDate) {
  if (!rawDate) return { date: '', weekday: '' };

  // 1. JavaScript Date object
  if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
    const yyyy = rawDate.getFullYear();
    const mm = String(rawDate.getMonth() + 1).padStart(2, '0');
    const dd = String(rawDate.getDate()).padStart(2, '0');
    const iso = `${yyyy}-${mm}-${dd}`;
    return { date: iso, weekday: getWeekdayFromISO(iso) };
  }

  // 2. Excel numeric serial date (e.g. 46294 for 2026-09-30)
  if (typeof rawDate === 'number' && rawDate > 25000 && rawDate < 75000) {
    try {
      const d = XLSX.SSF.parse_date_code(rawDate);
      if (d && d.y && d.m && d.d) {
        const iso = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
        return { date: iso, weekday: getWeekdayFromISO(iso) };
      }
    } catch (e) {}
  }

  const str = String(rawDate).trim();

  // 3. Match ISO format: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const isoMatch = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s+([A-Za-z]+))?/);
  if (isoMatch) {
    const yyyy = isoMatch[1];
    const mm = isoMatch[2].padStart(2, '0');
    const dd = isoMatch[3].padStart(2, '0');
    const iso = `${yyyy}-${mm}-${dd}`;
    return {
      date: iso,
      weekday: isoMatch[4] ? isoMatch[4].slice(0, 3) : getWeekdayFromISO(iso),
    };
  }

  // 4. Match Indian/UK format: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\s+([A-Za-z]+))?/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, '0');
    const mm = dmyMatch[2].padStart(2, '0');
    const yyyy = dmyMatch[3];
    const iso = `${yyyy}-${mm}-${dd}`;
    return {
      date: iso,
      weekday: dmyMatch[4] ? dmyMatch[4].slice(0, 3) : getWeekdayFromISO(iso),
    };
  }

  return { date: '', weekday: '' };
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

      // Check if this row is a daily record row (has Date like 2026-07-01, 30-09-2026, or serial)
      const dateCell = row.find(isDateCandidate);
      if (dateCell && currentStaffNo) {
        const { date, weekday } = parseDateCell(dateCell);
        if (date) {
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
    }
  });

  return Array.from(workersMap.values());
}

/**
 * Extract raw text safely from Word document (.docx or .doc) including headers
 * @param {string} filePath 
 */
async function extractWordDoc(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  let text = '';
  let headerText = '';

  if (ext === '.docx') {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      if (result.value && result.value.trim()) text = result.value;
    } catch (err) {
      console.warn('Mammoth failed for docx, attempting word-extractor fallback:', err.message);
    }
  }

  // Fallback to WordExtractor (OLE2 format)
  try {
    const doc = await extractor.extract(filePath);
    headerText = doc.getHeaders() || '';
    const body = doc.getBody() || '';
    const footer = doc.getFooters() || '';
    if (body.trim()) {
      text = (headerText ? headerText + '\n' : '') + body + (footer ? '\n' + footer : '');
    }
  } catch (err) {
    console.warn('WordExtractor failed, attempting mammoth fallback:', err.message);
    if (!text) {
      try {
        const result = await mammoth.extractRawText({ path: filePath });
        if (result.value) text = result.value;
      } catch (e) {
        // Ignore
      }
    }
  }

  return { text, headerText };
}

/**
 * Extract raw text safely from Word document (.docx or .doc)
 * @param {string} filePath 
 */
async function extractWordText(filePath) {
  const { text } = await extractWordDoc(filePath);
  return text;
}

/**
 * Parse Word Document (.docx, .doc) supporting both standard vertical log and horizontal matrix formats
 * @param {string} filePath 
 */
async function parseWordFile(filePath) {
  const { text, headerText } = await extractWordDoc(filePath);
  if (!text) return [];

  const rawLines = text.split('\n');
  const lines = rawLines.map(l => l.trim()).filter(Boolean);
  const workersMap = new Map();

  let currentDept = 'WORKER';
  let currentStaffNo = '';
  let currentStaffName = '';

  // 1. Standard Vertical Format: Department, Staff No., Staff Name, Date, Swipe Record, Work Time
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

    // Match daily date line "2026-07-01 Wed", "30-09-2026 Wed", "30/09/2026", etc.
    const parsedDate = parseDateCell(line);
    if (parsedDate && parsedDate.date) {
      const { date, weekday } = parsedDate;
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

  if (workersMap.size > 0) {
    return Array.from(workersMap.values());
  }

  // 2. Matrix Format Fallback: EmpCode, Name, Day numbers (01..N), Arrived TIme, Dept.Time, Working Hrs.
  const fullHeaderText = (headerText ? headerText + ' ' : '') + lines.slice(0, 30).join(' ');
  const mRange = fullHeaderText.match(/(\d{2})[-/](\d{2})[-/](\d{4})/) || fullHeaderText.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
  let year = new Date().getFullYear().toString();
  let month = String(new Date().getMonth() + 1).padStart(2, '0');
  if (mRange) {
    if (mRange[3] && mRange[3].length === 4) {
      month = mRange[2];
      year = mRange[3];
    } else if (mRange[1] && mRange[1].length === 4) {
      year = mRange[1];
      month = mRange[2];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === 'EmpCode') {
      let j = i + 1;
      while (j < lines.length && ['Name', 'Present', 'HL', 'WO', 'Absent', 'Leave', 'PaidDays', 'LateHrs.', 'WorkHrs', 'OvTim'].includes(lines[j])) {
        j++;
      }
      if (j >= lines.length) break;
      const staff_no = lines[j];
      const staff_name = lines[j + 1];
      j += 2;

      while (j < lines.length && !lines[j].match(/^(?:0?1)$/)) {
        j++;
      }
      if (j >= lines.length) break;

      const days = [];
      while (j < lines.length && lines[j].match(/^(?:0?[1-9]|[12]\d|3[01])$/)) {
        days.push(lines[j].padStart(2, '0'));
        j++;
      }

      if (lines[j] && lines[j].toLowerCase().includes('arrived')) {
        j++;
      }
      const arrivedTimes = [];
      for (let k = 0; k < days.length && j < lines.length; k++) {
        arrivedTimes.push(lines[j]);
        j++;
      }

      if (lines[j] && (lines[j].toLowerCase().includes('dept') || lines[j].toLowerCase().includes('departure'))) {
        j++;
      }
      const deptTimes = [];
      for (let k = 0; k < days.length && j < lines.length; k++) {
        deptTimes.push(lines[j]);
        j++;
      }

      if (lines[j] && lines[j].toLowerCase().includes('working')) {
        j++;
      }
      const workHrs = [];
      for (let k = 0; k < days.length && j < lines.length; k++) {
        workHrs.push(lines[j]);
        j++;
      }

      const records = [];
      for (let k = 0; k < days.length; k++) {
        const day = days[k];
        const date = `${year}-${month}-${day}`;
        const weekday = getWeekdayFromISO(date);
        const arr = (arrivedTimes[k] && arrivedTimes[k] !== '00:00') ? arrivedTimes[k] : '';
        const dep = (deptTimes[k] && deptTimes[k] !== '00:00') ? deptTimes[k] : '';
        let swipe = '';
        if (arr && dep) swipe = `${arr} ${dep}`;
        else if (arr) swipe = arr;
        else if (dep) swipe = dep;

        const wTime = (workHrs[k] && workHrs[k] !== '00:00') ? workHrs[k] : '00:00';
        records.push({
          staff_no,
          date,
          weekday,
          swipe_record: swipe,
          machine_work_time: wTime,
        });
      }

      if (staff_no && !workersMap.has(staff_no)) {
        workersMap.set(staff_no, {
          staff_no,
          staff_name,
          department: 'WORKER',
          records,
        });
      }

      i = j - 1;
    }
  }

  return Array.from(workersMap.values());
}

module.exports = {
  parseExcelFile,
  parseWordFile,
  parseSwipeRecord,
  parseDateCell,
  isDateCandidate,
};

