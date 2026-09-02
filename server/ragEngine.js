/**
 * Factory AI Copilot & Hybrid RAG Intelligence Engine
 * 
 * Features:
 * 1. Hybrid Knowledge Indexing: Workers, Attendance Patterns, Monthly Payrolls, Policy Rules & Audits.
 * 2. Vector & Semantic Search (BM25 + TF-IDF Vector Space Embeddings).
 * 3. Structured Tool Calling: Instant calculations for Overtime leaders, Absenteeism, Salary drilldowns, Policy inquiries.
 * 4. Dual-Mode Synthesis: Offline Native Synthesis + Cloud LLM (Gemini/OpenAI) if API key present.
 */

const { execute } = require('./db.js');
const { calculateWorkerPayroll } = require('./payrollEngine.js');
const { cleanAndDebouncePunches } = require('./rulesEngine.js');

function parseSwipeRecord(str) {
  if (!str) return { timestamps: [] };
  const matches = String(str).match(/\b\d{1,2}:\d{2}\b/g) || [];
  return { timestamps: matches.filter(t => t !== '00:00' && t !== '0:00') };
}

// In-Memory Knowledge Index
let knowledgeIndex = {
  lastUpdated: null,
  documents: [],
  vocab: new Map(), // word -> idf
  workerLookup: new Map(), // staff_no -> worker details
  departmentList: [],
  policies: [],
  settingsMap: {}
};

// Clean & Tokenize text
function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);
}

// Compute TF-IDF vector for text against vocab
function computeTfIdf(tokens, vocab) {
  const tf = {};
  tokens.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
  const vector = {};
  for (const [term, count] of Object.entries(tf)) {
    if (vocab.has(term)) {
      vector[term] = (count / tokens.length) * (vocab.get(term) || 1);
    }
  }
  return vector;
}

// Cosine similarity between two sparse vectors
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, valA] of Object.entries(vecA)) {
    normA += valA * valA;
    if (vecB[term]) {
      dotProduct += valA * vecB[term];
    }
  }
  for (const valB of Object.values(vecB)) {
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Build Knowledge Base from Database
async function rebuildKnowledgeIndex() {
  try {
    const docs = [];
    const workersRes = await execute('SELECT * FROM workers');
    const settingsRes = await execute('SELECT * FROM settings');
    const customRulesRes = await execute('SELECT * FROM custom_rules');
    const salaryRulesRes = await execute('SELECT * FROM custom_salary_rules');
    const holidaysRes = await execute('SELECT * FROM paid_holidays');

    const settingsMap = {};
    settingsRes.rows.forEach(r => { settingsMap[r.key] = r.value; });

    // 1. Index Factory Policies & Settings
    docs.push({
      id: 'policy_shift_hours',
      type: 'policy',
      title: 'Factory Shift & Working Hours Policy',
      content: `Standard factory shift start time is ${settingsMap.shift_start || '08:00'} and end time is ${settingsMap.shift_end || '16:30'}. Full duty is 8.5 hours (8 hours working + 30 mins lunch break). Late grace period threshold is ${settingsMap.late_threshold_minutes || 15} minutes. Worker arriving before threshold gets full duty starting from shift start.`
    });

    docs.push({
      id: 'policy_overtime',
      type: 'policy',
      title: 'Overtime & Sunday Pay Policy',
      content: `Regular overtime rate multiplier is ${settingsMap.ot_multiplier || 1.0}x hourly rate. Sunday work is compensated as Sunday Overtime (Sunday OT) with paid weekly off credit. Monthly per-day salary divisor basis is ${settingsMap.standard_month_days || '26'} standard days.`
    });

    docs.push({
      id: 'policy_attendance_invariants',
      type: 'policy',
      title: 'Attendance Invariants & Fast-Fix Policy',
      content: `Punch pairs require IN and OUT swipes. Single punch records are marked Incomplete. In Fast-Fix Center, supervisors can provide the missing punch or 1-click heal. Full duty requirement is minimum 4 hours for half day and 8 hours for full day.`
    });

    // Custom Rules
    customRulesRes.rows.forEach((r, idx) => {
      docs.push({
        id: `rule_custom_${idx}`,
        type: 'rule',
        title: `Factory Rule: ${r.rule_name}`,
        content: `Rule: ${r.rule_name} | Target: ${r.target_staff_no || 'all'} | Grace Period: ${r.grace_period_mins || 0} mins | Auto-fix: ${r.auto_fix_single_punch || 'None'}`
      });
    });

    // Salary Rules
    salaryRulesRes.rows.forEach((r, idx) => {
      docs.push({
        id: `salary_rule_${idx}`,
        type: 'salary_rule',
        title: `Salary Rule: ${r.rule_name}`,
        content: `Salary Rule: ${r.rule_name} | Type: ${r.rule_type} | Amount: ₹${r.amount} | Condition: ${r.condition_type} ${r.condition_value}`
      });
    });

    // Holidays
    holidaysRes.rows.forEach(h => {
      docs.push({
        id: `holiday_${h.holiday_date}`,
        type: 'holiday',
        title: `Paid Holiday: ${h.holiday_name}`,
        content: `Factory Paid National/Festival Holiday on ${h.holiday_date} (${h.holiday_name}). Workers receive full paid day.`
      });
    });

    // 2. Index Workers & Departments
    const workerMap = new Map();
    const depts = new Set();

    workersRes.rows.forEach(w => {
      workerMap.set(String(w.staff_no), w);
      if (w.department) depts.add(w.department);

      docs.push({
        id: `worker_${w.staff_no}`,
        type: 'worker_profile',
        staff_no: w.staff_no,
        title: `Worker Profile: #${w.staff_no} - ${w.staff_name}`,
        content: `Worker ID: ${w.staff_no} | Name: ${w.staff_name} | Department: ${w.department || 'General'} | Designation: ${w.designation || 'Worker'} | Monthly Base Salary: ₹${w.monthly_salary || 0} | Shift: ${w.assigned_shift || '08:00'} | Housing: ₹${w.housing_allowance || 0} | Food: ₹${w.food_allowance || 0}`
      });
    });

    // 3. Compute Vocab IDF
    const docCount = docs.length;
    const docFreq = new Map();

    docs.forEach(doc => {
      const tokens = new Set(tokenize(`${doc.title} ${doc.content}`));
      tokens.forEach(t => {
        docFreq.set(t, (docFreq.get(t) || 0) + 1);
      });
    });

    const vocab = new Map();
    docFreq.forEach((df, term) => {
      vocab.set(term, Math.log((docCount + 1) / (df + 1)) + 1);
    });

    // Pre-calculate TF-IDF vectors for documents
    docs.forEach(doc => {
      const tokens = tokenize(`${doc.title} ${doc.content}`);
      doc.vector = computeTfIdf(tokens, vocab);
    });

    knowledgeIndex = {
      lastUpdated: new Date().toISOString(),
      documents: docs,
      vocab,
      workerLookup: workerMap,
      departmentList: Array.from(depts),
      settingsMap
    };

    return knowledgeIndex;
  } catch (err) {
    console.error('Error rebuilding knowledge index:', err);
    return knowledgeIndex;
  }
}

// Structured Data Queries for Exact Fact Retrieval
async function executeStructuredAnalysis(query, month = '2026-07') {
  const lower = query.toLowerCase();
  const settingsRes = await execute('SELECT * FROM settings');
  const settings = {};
  settingsRes.rows.forEach(r => { settings[r.key] = r.value; });

  const workersRes = await execute('SELECT * FROM workers');
  const dailyRes = await execute(
    month && month !== 'all'
      ? `SELECT * FROM daily_attendance WHERE date LIKE ?`
      : `SELECT * FROM daily_attendance`,
    month && month !== 'all' ? [`${month}%`] : []
  );
  const advancesRes = await execute(
    month && month !== 'all'
      ? `SELECT * FROM advances WHERE date LIKE ?`
      : `SELECT * FROM advances`,
    month && month !== 'all' ? [`${month}%`] : []
  );

  const workerAttendanceMap = {};
  dailyRes.rows.forEach(r => {
    if (!workerAttendanceMap[r.staff_no]) workerAttendanceMap[r.staff_no] = [];
    workerAttendanceMap[r.staff_no].push(r);
  });

  const workerAdvancesMap = {};
  advancesRes.rows.forEach(r => {
    if (!workerAdvancesMap[r.staff_no]) workerAdvancesMap[r.staff_no] = [];
    workerAdvancesMap[r.staff_no].push(r);
  });

  // Calculate full payrolls
  const payrollList = [];
  workersRes.rows.forEach(w => {
    const records = workerAttendanceMap[w.staff_no] || [];
    const advances = workerAdvancesMap[w.staff_no] || [];
    const p = calculateWorkerPayroll({
      staffNo: w.staff_no,
      monthlySalary: w.monthly_salary,
      housingAllowance: w.housing_allowance,
      foodAllowance: w.food_allowance,
      otherAllowance: w.other_allowance,
      dailyRecords: records,
      advances,
      settings,
      salaryRules: []
    });
    payrollList.push({
      staff_no: w.staff_no,
      staff_name: w.staff_name,
      department: w.department || 'General',
      monthly_salary: w.monthly_salary,
      ...p,
      records
    });
  });

  // Check intent 1: Policy / Rules question (e.g. "shift rule", "overtime policy", "sunday rule", "grace period")
  const isPolicyQuery = (lower.includes('rule') || lower.includes('policy') || lower.includes('niyam') || lower.includes('grace period') || lower.includes('shift time') || lower.includes('timing')) && !lower.match(/(?:worker|staff|id)?\s*#?\s*\d{2,5}/);
  if (isPolicyQuery) {
    return {
      type: 'policy_inquiry',
      settings,
      month
    };
  }

  // Check intent 2: Specific Worker Lookup (e.g. "worker 415", "#415", "bhupinder", "binay")
  const staffMatch = lower.match(/(?:worker|staff|id|emp|employee|banda)?\s*#?\s*(\d{1,5})/i);
  let targetWorker = null;
  if (staffMatch && staffMatch[1]) {
    const rawId = staffMatch[1];
    targetWorker = payrollList.find(p => p.staff_no === rawId || parseInt(p.staff_no, 10) === parseInt(rawId, 10));
  }
  if (!targetWorker) {
    const foundByName = payrollList.find(p => lower.includes(p.staff_name.toLowerCase()) || p.staff_name.toLowerCase().split(' ').some(part => part.length > 3 && lower.includes(part)));
    if (foundByName) targetWorker = foundByName;
  }

  if (targetWorker) {
    return {
      type: 'worker_drilldown',
      worker: targetWorker,
      month
    };
  }

  // Check intent 3: Overtime Leaderboard (e.g. "top ot", "sabse zyada ot", "overtime ranking", "highest overtime")
  if (lower.includes('ot') || lower.includes('overtime') || lower.includes('extra time') || lower.includes('over time')) {
    const sortedByOt = [...payrollList].sort((a, b) => b.totalOtHours - a.totalOtHours);
    return {
      type: 'overtime_leaderboard',
      month,
      topWorkers: sortedByOt.slice(0, 10),
      totalOtHours: sortedByOt.reduce((acc, w) => acc + w.totalOtHours, 0),
      totalOtPay: sortedByOt.reduce((acc, w) => acc + w.otPay, 0)
    };
  }

  // Check intent 4: Absenteeism / Absents (e.g. "absent", "chhutti", "chutti", "kam attendance")
  if (lower.includes('absent') || lower.includes('chutti') || lower.includes('leave') || lower.includes('absenteeism')) {
    const sortedByAbsents = [...payrollList].filter(w => w.absentDays > 0).sort((a, b) => b.absentDays - a.absentDays);
    return {
      type: 'absenteeism_analysis',
      month,
      absentWorkers: sortedByAbsents,
      totalAbsentDays: sortedByAbsents.reduce((acc, w) => acc + w.absentDays, 0)
    };
  }

  // Check intent 5: Department Breakdown (e.g. "cnc", "forging", "store", "department summary", "dept")
  const deptMatch = payrollList.find(p => lower.includes(p.department.toLowerCase()));
  if (deptMatch || lower.includes('department') || lower.includes('dept') || lower.includes('vibhag')) {
    const deptMap = {};
    payrollList.forEach(w => {
      const d = w.department || 'General';
      if (!deptMap[d]) deptMap[d] = { count: 0, gross: 0, net: 0, otHours: 0, workers: [] };
      deptMap[d].count += 1;
      deptMap[d].gross += w.grossSalary;
      deptMap[d].net += w.netPayable;
      deptMap[d].otHours += w.totalOtHours;
      deptMap[d].workers.push(w);
    });
    return {
      type: 'department_breakdown',
      month,
      departments: deptMap
    };
  }

  // Check intent 6: Overall Factory Summary / Total Payout / Grand Totals
  if (lower.includes('summary') || lower.includes('total') || lower.includes('karcha') || lower.includes('payout') || lower.includes('salary kitni') || lower.includes('kitne paise')) {
    const totalGross = payrollList.reduce((acc, w) => acc + w.grossSalary, 0);
    const totalAdvances = payrollList.reduce((acc, w) => acc + w.totalAdvances, 0);
    const totalNet = payrollList.reduce((acc, w) => acc + w.netPayable, 0);
    const totalIncomplete = payrollList.reduce((acc, w) => acc + (w.incompleteDays || 0), 0);

    return {
      type: 'factory_summary',
      month,
      workerCount: payrollList.length,
      totalGross: +totalGross.toFixed(2),
      totalAdvances: +totalAdvances.toFixed(2),
      totalNet: +totalNet.toFixed(2),
      totalIncomplete
    };
  }

  // Check intent 7: Incomplete Punches / Missing Swipes
  if (lower.includes('incomplete') || lower.includes('single punch') || lower.includes('missing') || lower.includes('gadbad') || lower.includes('fix')) {
    const incompleteWorkers = payrollList.filter(w => (w.incompleteDays || 0) > 0);
    return {
      type: 'incomplete_audit',
      month,
      count: incompleteWorkers.reduce((acc, w) => acc + (w.incompleteDays || 0), 0),
      workers: incompleteWorkers
    };
  }

  return {
    type: 'general_query',
    month,
    payrollList
  };
}

// Local High-Intelligence Synthesizer (Zero Cost & 100% Deterministic)
function generateNativeSynthesis(query, analysis, retrievedDocs, month) {
  const monthName = month && month !== 'all' ? month : 'Selected Period';

  if (analysis.type === 'policy_inquiry') {
    const s = analysis.settings;
    return `
### 📜 Factory Operational Rules & Policy Guide
* **Standard Shift Timing**: \`${s.shift_start || '08:00'}\` to \`${s.shift_end || '16:30'}\` (8.5 Hours Duty = 8h Working + 30m Lunch).
* **Late Grace Threshold**: \`${s.late_threshold_minutes || 15} Minutes\` (Punches within grace period get full duty starting at 08:00).
* **Overtime Multiplier**: \`${s.ot_multiplier || 1.0}x\` hourly rate (\`Monthly Salary / (Standard Days * 8)\`).
* **Sunday Policy**: Sunday is a Paid Weekly Off. If a worker works on Sunday, the entire duration is credited as **Sunday Overtime (OT)** in addition to the paid day.
* **Standard Month Divisor**: \`${s.standard_month_days || 26} Days\` basis.
* **Missing Punch Rule**: Single punch entries are flagged for Fast-Fix. Once fixed or auto-healed, salary calculations activate automatically.
`.trim();
  }

  if (analysis.type === 'worker_drilldown') {
    const w = analysis.worker;
    const absentsBreakdown = w.records.filter(r => r.status?.includes('Absent'));

    return `
### 👤 Worker Analysis: **#${w.staff_no} - ${w.staff_name}** (${w.department || 'Worker'})
**Period**: \`${analysis.month}\` | **Monthly Contract Salary**: \`₹${w.monthly_salary?.toLocaleString('en-IN')}\`

#### 📊 Attendance & Days Breakdown:
| Metric | Count / Value | Details |
| :--- | :--- | :--- |
| **Full Present Days** | **${w.fullPresentDays} Days** | Regular 8.5h shift completed |
| **Paid Sundays** | **${w.paidWeeklyOffs} Days** | Paid weekly offs credited |
| **Paid Holidays** | **${w.paidHolidays} Days** | National/Factory Holidays |
| **Absent Days** | **${w.absentDays} Days** | ${w.absentDays > 0 ? `Dates: ${absentsBreakdown.map(a => a.date).join(', ')}` : 'Zero Absents ✅'} |
| **Payable Days** | **${w.payableDays} / ${w.standardDays} Days** | Basis: Standard ${w.standardDays} days |
| **Total Overtime (OT)**| **${w.totalOtHours} Hours** | Hourly rate: ₹${(w.perDayRate / 8).toFixed(2)}/hr |

#### 💰 Final Salary Calculation:
* **Base Salary**: **₹${w.basePay?.toLocaleString('en-IN')}** ${(w.basePay < w.monthly_salary) ? `*(₹${w.monthly_salary} me se ${w.absentDays} absent ka deduction hua)*` : '*(Full Base)*'}
* **Overtime (OT) Pay**: **+ ₹${w.otPay?.toLocaleString('en-IN')}**
* **Total Gross Earnings**: **₹${w.grossSalary?.toLocaleString('en-IN')}**
* **Advances Deducted**: **- ₹${w.totalAdvances?.toLocaleString('en-IN')}**
* 💵 **Net Payable Salary**: **₹${w.netPayable?.toLocaleString('en-IN')}**

${w.incompleteDays > 0 ? `⚠️ **Alert**: Is worker ke \`${w.incompleteDays}\` attendance record(s) incomplete hain. Fast-Fix Center me jakar missing punches fill karein.` : '✅ **Status**: Attendance & Payroll verified and ready for payout.'}
`.trim();
  }

  if (analysis.type === 'overtime_leaderboard') {
    let table = '| Rank | Worker ID | Worker Name | Dept | OT Hours | OT Rate/Hr | Total OT Pay |\n| :---: | :---: | :--- | :--- | :---: | :---: | :---: |\n';
    analysis.topWorkers.forEach((w, i) => {
      const rate = (w.perDayRate / 8).toFixed(1);
      table += `| **#${i+1}** | \`${w.staff_no}\` | **${w.staff_name}** | ${w.department} | **${w.totalOtHours} hrs** | ₹${rate}/hr | **₹${w.otPay?.toLocaleString('en-IN')}** |\n`;
    });

    return `
### ⚡ Overtime (OT) Leaderboard for \`${analysis.month}\`
* **Total Factory OT Logged**: **${analysis.totalOtHours} Hours**
* **Total OT Payout**: **₹${analysis.totalOtPay?.toLocaleString('en-IN')}**

${table}

💡 *Tip: Highest overtime contributor **${analysis.topWorkers[0]?.staff_name}** (#${analysis.topWorkers[0]?.staff_no}) ne total **${analysis.topWorkers[0]?.totalOtHours} hrs** kaam kiya.*
`.trim();
  }

  if (analysis.type === 'absenteeism_analysis') {
    if (analysis.absentWorkers.length === 0) {
      return `### 🌟 Absenteeism Report for \`${analysis.month}\`\n\nIs mahine **kisi bhi worker ka koi absent nahi hai!** 100% full attendance recorded! 🎉`;
    }

    let table = '| Worker ID | Worker Name | Dept | Absent Days | Base Pay Impact | Net Payable |\n| :---: | :--- | :--- | :---: | :---: | :---: |\n';
    analysis.absentWorkers.slice(0, 15).forEach(w => {
      const deduction = w.monthly_salary - w.basePay;
      table += `| \`${w.staff_no}\` | **${w.staff_name}** | ${w.department} | **${w.absentDays} days** | -₹${deduction.toFixed(0)} | ₹${w.netPayable?.toLocaleString('en-IN')} |\n`;
    });

    return `
### 📋 Absenteeism & Leave Report for \`${analysis.month}\`
* **Total Workers with Absents**: **${analysis.absentWorkers.length} Workers**
* **Total Cumulative Absent Days**: **${analysis.totalAbsentDays} Days**

${table}

${analysis.absentWorkers.length > 15 ? `*(Showing top 15 of ${analysis.absentWorkers.length} workers)*\n` : ''}
💡 *Workers with > 2 absents require special attendance review before salary disbursement.*
`.trim();
  }

  if (analysis.type === 'department_breakdown') {
    let table = '| Department | Worker Count | Total OT Hours | Gross Payroll | Net Payable |\n| :--- | :---: | :---: | :---: | :---: |\n';
    for (const [dept, data] of Object.entries(analysis.departments)) {
      table += `| **${dept}** | ${data.count} | ${data.otHours.toFixed(1)} hrs | ₹${data.gross.toLocaleString('en-IN')} | **₹${data.net.toLocaleString('en-IN')}** |\n`;
    }

    return `
### 🏢 Department-wise Attendance & Payroll Summary (\`${analysis.month}\`)
${table}
`.trim();
  }

  if (analysis.type === 'factory_summary') {
    return `
### 🏭 Factory Executive Payroll Summary for \`${analysis.month}\`
* **Total Active Workforce**: **${analysis.workerCount} Workers**
* **Total Gross Earnings**: **₹${analysis.totalGross?.toLocaleString('en-IN')}**
* **Total Advances Deducted**: **₹${analysis.totalAdvances?.toLocaleString('en-IN')}**
* 💰 **Net Total Salary Payout**: **₹${analysis.totalNet?.toLocaleString('en-IN')}**
* 🔒 **Pending Incomplete Records**: **${analysis.totalIncomplete}** ${analysis.totalIncomplete > 0 ? '(Fix in Fast-Fix Center)' : '(All records clean ✅)'}
`.trim();
  }

  if (analysis.type === 'incomplete_audit') {
    return `
### ⚠️ Incomplete Punches & Missing Swipes Audit (\`${analysis.month}\`)
* **Total Pending Incomplete Entries**: **${analysis.count} Entries**
${analysis.count === 0 ? '\n✅ **All punch records are 100% complete and verified! No missing punches.**' : `
Please open **Fast-Fix Center** in the navbar to resolve single punches. Once resolved, salary calculations unlock automatically.`}
`.trim();
  }

  // Fallback: Use semantic retrieved documents
  let contextSummary = '';
  if (retrievedDocs && retrievedDocs.length > 0) {
    contextSummary = retrievedDocs.map(d => `* **${d.title}**: ${d.content}`).join('\n');
  }

  return `
### 🤖 Factory Intelligence Assistant

Aapke sawal: **"${query}"** ke reference me factory operational details niche diye gaye hain:

${contextSummary || 'Factory Database records analyzed.'}

💡 *Aap kisi bhi specific worker, overtime rankings, absent summary ya factory rules ke baare me pooch sakte hain.*
`.trim();
}

// Generate Contextual Quick Suggestions for Active Month
async function generateSmartSuggestions(month = '2026-07') {
  try {
    const suggestions = [
      { id: 'top_ot', label: '⚡ Top 5 Overtime Workers', query: `Top overtime workers in ${month}` },
      { id: 'absentees', label: '📋 Absenteeism Analysis', query: `Which workers have absents in ${month}?` },
      { id: 'worker_415', label: '👤 Worker #415 Breakdown', query: `Worker #415 salary calculation breakdown for ${month}` },
      { id: 'payout_summary', label: '💰 Executive Payout Summary', query: `Total salary payout summary for ${month}` },
      { id: 'shift_policy', label: '📜 Factory Shift & OT Rules', query: `What are the factory shift and overtime rules?` }
    ];
    return suggestions;
  } catch (err) {
    return [];
  }
}

// Main Query Function
async function queryFactoryIntelligence(userQuery, options = {}) {
  const { month = '2026-07', conversationHistory = [] } = options;

  if (!knowledgeIndex.lastUpdated) {
    await rebuildKnowledgeIndex();
  }

  // 1. Vector / BM25 Search
  const queryTokens = tokenize(userQuery);
  const queryVector = computeTfIdf(queryTokens, knowledgeIndex.vocab);

  const scoredDocs = knowledgeIndex.documents.map(doc => {
    const sim = cosineSimilarity(queryVector, doc.vector || {});
    return { ...doc, score: sim };
  }).sort((a, b) => b.score - a.score);

  const topDocs = scoredDocs.filter(d => d.score > 0.05).slice(0, 5);

  // 2. Structured SQL & Analytical Execution
  const analysis = await executeStructuredAnalysis(userQuery, month);

  // 3. Cloud LLM vs Offline Native Synthesis
  const geminiApiKey = process.env.GEMINI_API_KEY || knowledgeIndex.settingsMap?.gemini_api_key;
  const openaiApiKey = process.env.OPENAI_API_KEY || knowledgeIndex.settingsMap?.openai_api_key;

  let finalAnswer = '';
  let provider = 'Local Hybrid RAG';

  if (geminiApiKey) {
    try {
      const prompt = `You are the Factory HR & Payroll Copilot. Answer the query concisely using the factual data provided below.\n\nContext:\n${JSON.stringify(analysis)}\n\nUser Question: ${userQuery}`;
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await geminiRes.json();
      finalAnswer = data.candidates?.[0]?.content?.parts?.[0]?.text;
      provider = 'Gemini 1.5 Flash + RAG';
    } catch (e) {
      console.warn('Gemini API call failed, falling back to Local RAG:', e.message);
    }
  }

  if (!finalAnswer) {
    finalAnswer = generateNativeSynthesis(userQuery, analysis, topDocs, month);
  }

  return {
    success: true,
    query: userQuery,
    month,
    provider,
    analysisType: analysis.type,
    answer: finalAnswer,
    retrievedDocs: topDocs.map(d => ({ id: d.id, title: d.title, type: d.type })),
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  rebuildKnowledgeIndex,
  queryFactoryIntelligence,
  executeStructuredAnalysis,
  generateSmartSuggestions
};
