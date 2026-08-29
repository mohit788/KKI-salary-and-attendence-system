import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  RefreshCw,
  CheckCircle,
  Info,
  Sliders,
  Clock,
  ShieldCheck,
  Calculator,
  Plus,
  Sparkles,
  Trash2,
  Calendar,
  CheckCircle2,
  Zap,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Flame,
  Brain,
  Wand2,
  Send,
  Eye,
  Bot,
  IndianRupee,
  Key,
  MessageSquare,
  ArrowRight,
  X,
  Lock,
  Unlock
} from 'lucide-react';

export default function SettingsPanel({
  settingsList = [],
  onSaveSettings,
  onSettingsUpdated,
  workers = [],
  loading
}) {
  const [form, setForm] = useState({
    shift_start: '08:00',
    shift_end: '16:30',
    grace_slab_minutes: '30',
    ot_multiplier: '1.5',
    ot_rounding: '30min_block',
    short_hours_threshold: '4.0',
    weekly_off_day: 'Sun',
    forfeiture_absent_threshold: '3',
    standard_month_days: '26',
    max_ot_hours: '0',
    lunch_deduction_mins: '30',
    late_penalty_threshold_mins: '120',
    sunday_ot_multiplier: '2.0',
    gemini_api_key: '',
  });

  const [ruleProfiles, setRuleProfiles] = useState([]);
  const [customRules, setCustomRules] = useState([]);
  const [salaryRules, setSalaryRules] = useState([]);
  const [showCreateProfileModal, setShowCreateProfileModal] = useState(false);
  const [showCreateRuleModal, setShowCreateRuleModal] = useState(false);
  const [showCreateSalaryRuleModal, setShowCreateSalaryRuleModal] = useState(false);

  const [newProfileName, setNewProfileName] = useState('');

  // Custom Rule Form State (timing-based)
  const [ruleName, setRuleName] = useState('');
  const [ruleType, setRuleType] = useState('midday_exit');
  const [targetStaffNo, setTargetStaffNo] = useState('all');
  const [startTime, setStartTime] = useState('13:00');
  const [endTime, setEndTime] = useState('15:00');
  const [thresholdMins, setThresholdMins] = useState('30');
  const [deductionMins, setDeductionMins] = useState('60');

  // Salary Rule Form State
  const [salaryRuleName, setSalaryRuleName] = useState('');
  const [salaryRuleType, setSalaryRuleType] = useState('bonus');
  const [salaryTargetStaffNo, setSalaryTargetStaffNo] = useState('all');
  const [conditionType, setConditionType] = useState('always');
  const [conditionValue, setConditionValue] = useState('0');
  const [actionType, setActionType] = useState('add_fixed');
  const [actionValue, setActionValue] = useState('0');
  const [salaryRuleDesc, setSalaryRuleDesc] = useState('');

  // AI Rule State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiParsedRule, setAiParsedRule] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const [toast, setToast] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Clear Attendance Logs State
  const [clearMonth, setClearMonth] = useState('');
  const [clearStartDate, setClearStartDate] = useState('');
  const [clearEndDate, setClearEndDate] = useState('');
  const [clearLoading, setClearLoading] = useState(false);

  const handleClearAttendanceLogs = async (mode) => {
    let payload = {};
    let confirmMsg = '';

    if (mode === 'month') {
      if (!clearMonth) return alert('Please select a month to clear.');
      payload = { month: clearMonth };
      confirmMsg = `Are you sure you want to delete ALL attendance records for month ${clearMonth}?`;
    } else if (mode === 'range') {
      if (!clearStartDate || !clearEndDate) return alert('Please select start and end dates.');
      payload = { startDate: clearStartDate, endDate: clearEndDate };
      confirmMsg = `Are you sure you want to delete attendance records from ${clearStartDate} to ${clearEndDate}?`;
    } else if (mode === 'all') {
      payload = { clearAll: true };
      confirmMsg = `⚠️ WARNING: Are you sure you want to delete ALL attendance records in the database? This action CANNOT be undone!`;
    }

    if (!window.confirm(confirmMsg)) return;

    setClearLoading(true);
    try {
      const res = await fetch('/api/attendance/clear-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json());

      if (res.success) {
        setToast(`Deleted ${res.deletedCount} records successfully.`);
        if (typeof onSettingsUpdated === 'function') {
          onSettingsUpdated();
        }
      } else {
        alert('Clear failed: ' + res.error);
      }
    } catch (err) {
      alert('Clear failed: ' + err.message);
    } finally {
      setClearLoading(false);
    }
  };

  useEffect(() => {
    if (settingsList && Array.isArray(settingsList)) {
      const map = {};
      settingsList.forEach(s => {
        map[s.key] = s.value;
      });
      setForm(prev => ({ ...prev, ...map }));
    }
  }, [settingsList]);

  const fetchRuleProfiles = async () => {
    try {
      const res = await fetch('/api/rule-profiles').then(r => r.json());
      if (res.success) setRuleProfiles(res.profiles || []);
    } catch (err) {
      console.error('Error fetching profiles:', err);
    }
  };

  const fetchCustomRules = async () => {
    try {
      const res = await fetch('/api/custom-rules').then(r => r.json());
      if (res.success) setCustomRules(res.rules || []);
    } catch (err) {
      console.error('Error fetching custom rules:', err);
    }
  };

  const fetchSalaryRules = async () => {
    try {
      const res = await fetch('/api/salary-rules').then(r => r.json());
      if (res.success) setSalaryRules(res.rules || []);
    } catch (err) {
      console.error('Error fetching salary rules:', err);
    }
  };

  useEffect(() => {
    fetchRuleProfiles();
    fetchCustomRules();
    fetchSalaryRules();
  }, []);

  const handleChange = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
  };

  const handleSubmitSettings = (e) => {
    e.preventDefault();
    onSaveSettings(form);
    setToast('Active factory rules saved & all attendance recomputed!');
    setTimeout(() => setToast(''), 4000);
  };

  // Create Profile
  const handleCreateProfile = async (e) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/rule-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_name: newProfileName.trim(), ...form }),
      }).then(r => r.json());

      if (res.success) {
        setToast(`New rule profile "${newProfileName}" created!`);
        setTimeout(() => setToast(''), 4000);
        setNewProfileName('');
        setShowCreateProfileModal(false);
        fetchRuleProfiles();
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Activate Profile
  const handleActivateProfile = async (profileId, profileName) => {
    try {
      const res = await fetch(`/api/rule-profiles/${profileId}/activate`, { method: 'POST' }).then(r => r.json());
      if (res.success) {
        setToast(`Activated profile "${profileName}" & recomputed attendance!`);
        setTimeout(() => setToast(''), 4000);
        fetchRuleProfiles();
        const setRes = await fetch('/api/settings').then(r => r.json());
        if (setRes.success && setRes.settings) {
          const map = {};
          setRes.settings.forEach(s => { map[s.key] = s.value; });
          setForm(prev => ({ ...prev, ...map }));
        }
      }
    } catch (err) {
      alert('Activate error: ' + err.message);
    }
  };

  // Delete Profile
  const handleDeleteProfile = async (profileId, profileName) => {
    if (!confirm(`Delete custom profile "${profileName}"?`)) return;
    try {
      const res = await fetch(`/api/rule-profiles/${profileId}`, { method: 'DELETE' }).then(r => r.json());
      if (res.success) fetchRuleProfiles();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Create Custom Rule (timing-based)
  const handleCreateCustomRule = async (e) => {
    e.preventDefault();
    if (!ruleName.trim()) {
      alert('Please enter a rule name.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/custom-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule_name: ruleName.trim(),
          rule_type: ruleType,
          target_staff_no: targetStaffNo || 'all',
          start_time: startTime,
          end_time: endTime,
          threshold_mins: parseInt(thresholdMins, 10) || 0,
          deduction_mins: parseInt(deductionMins, 10) || 0,
        }),
      }).then(r => r.json());

      if (res.success) {
        setToast(`Custom restriction rule "${ruleName}" created & applied!`);
        setTimeout(() => setToast(''), 4000);
        setRuleName('');
        setTargetStaffNo('all');
        setShowCreateRuleModal(false);
        fetchCustomRules();
      } else {
        alert('Error: ' + res.error);
      }
    } catch (err) {
      alert('Create rule failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Custom Rule
  const handleToggleRule = async (ruleId) => {
    try {
      const res = await fetch(`/api/custom-rules/${ruleId}/toggle`, { method: 'POST' }).then(r => r.json());
      if (res.success) {
        fetchCustomRules();
        setToast('Rule status updated & attendance recomputed!');
        setTimeout(() => setToast(''), 3000);
      }
    } catch (err) {
      console.error('Toggle error:', err);
    }
  };

  // Delete Custom Rule
  const handleDeleteRule = async (ruleId, rName) => {
    if (!confirm(`Delete custom rule "${rName}"?`)) return;
    try {
      const res = await fetch(`/api/custom-rules/${ruleId}`, { method: 'DELETE' }).then(r => r.json());
      if (res.success) fetchCustomRules();
    } catch (err) {
      console.error('Delete rule error:', err);
    }
  };

  // Create Salary Rule (manual)
  const handleCreateSalaryRule = async (e) => {
    e.preventDefault();
    if (!salaryRuleName.trim()) {
      alert('Please enter a rule name.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/salary-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule_name: salaryRuleName.trim(),
          rule_type: salaryRuleType,
          target_staff_no: salaryTargetStaffNo || 'all',
          condition_type: conditionType,
          condition_value: conditionValue,
          action_type: actionType,
          action_value: parseFloat(actionValue) || 0,
          description: salaryRuleDesc,
          source: 'manual',
        }),
      }).then(r => r.json());

      if (res.success) {
        setToast(`Salary rule "${salaryRuleName}" created!`);
        setTimeout(() => setToast(''), 4000);
        setSalaryRuleName('');
        setSalaryRuleDesc('');
        setConditionType('always');
        setConditionValue('0');
        setActionType('add_fixed');
        setActionValue('0');
        setShowCreateSalaryRuleModal(false);
        fetchSalaryRules();
      } else {
        alert('Error: ' + res.error);
      }
    } catch (err) {
      alert('Create salary rule failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Salary Rule
  const handleToggleSalaryRule = async (ruleId) => {
    try {
      const res = await fetch(`/api/salary-rules/${ruleId}/toggle`, { method: 'POST' }).then(r => r.json());
      if (res.success) {
        fetchSalaryRules();
        setToast('Salary rule toggled!');
        setTimeout(() => setToast(''), 3000);
      }
    } catch (err) {
      console.error('Toggle error:', err);
    }
  };

  // Delete Salary Rule
  const handleDeleteSalaryRule = async (ruleId, rName) => {
    if (!confirm(`Delete salary rule "${rName}"?`)) return;
    try {
      const res = await fetch(`/api/salary-rules/${ruleId}`, { method: 'DELETE' }).then(r => r.json());
      if (res.success) fetchSalaryRules();
    } catch (err) {
      console.error('Delete salary rule error:', err);
    }
  };

  // AI: Parse rule using Gemini
  const handleAiParse = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError('');
    setAiParsedRule(null);

    try {
      const res = await fetch('/api/ai-rules/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt.trim() }),
      }).then(r => r.json());

      if (res.success) {
        setAiParsedRule(res.parsedRule);
      } else {
        setAiError(res.error || 'Failed to parse rule.');
      }
    } catch (err) {
      setAiError('Network error: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // AI: Save parsed rule
  const handleAiSaveRule = async () => {
    if (!aiParsedRule) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/ai-rules/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsedRule: aiParsedRule, originalPrompt: aiPrompt }),
      }).then(r => r.json());

      if (res.success) {
        setToast(`🤖 AI Rule "${aiParsedRule.rule_name}" saved & activated!`);
        setTimeout(() => setToast(''), 5000);
        setAiPrompt('');
        setAiParsedRule(null);
        fetchSalaryRules();
      } else {
        alert('Save error: ' + res.error);
      }
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper labels
  const conditionLabels = {
    always: 'Always Apply (No Condition)',
    present_days_gt: 'Present Days Greater Than',
    present_days_lt: 'Present Days Less Than',
    ot_hours_gt: 'OT Hours Greater Than',
    ot_hours_lt: 'OT Hours Less Than',
    absent_days_gt: 'Absent Days Greater Than',
    absent_days_lt: 'Absent Days Less Than',
    sunday_worked_gt: 'Sunday Worked Days Greater Than',
    late_days_gt: 'Late/Short Days Greater Than',
    total_hours_gt: 'Total Hours Greater Than',
    salary_gt: 'Monthly Salary Greater Than',
    salary_lt: 'Monthly Salary Less Than',
  };

  const actionLabels = {
    add_fixed: 'Add Fixed Amount (₹)',
    deduct_fixed: 'Deduct Fixed Amount (₹)',
    add_percentage: 'Add % of Salary',
    deduct_percentage: 'Deduct % of Salary',
  };

  const ruleTypeColors = {
    bonus: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)', text: '#34d399', label: '💰 Bonus' },
    deduction: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)', text: '#f87171', label: '📉 Deduction' },
    attendance_bonus: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)', text: '#60a5fa', label: '📋 Attendance Bonus' },
    penalty: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)', text: '#fbbf24', label: '⚠️ Penalty' },
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white font-display">KKI Factory Rules & Restriction Builder</h2>
            <p className="text-xs text-slate-400">Create custom timing restrictions, salary rules, and AI-powered payroll rules</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          <button
            onClick={() => setShowCreateSalaryRuleModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-purple-600/30 flex items-center justify-center space-x-1.5 transition-all"
          >
            <IndianRupee className="w-4 h-4" />
            <span>Create Salary Rule</span>
          </button>

          <button
            onClick={() => setShowCreateRuleModal(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Timing Rule</span>
          </button>

          <button
            onClick={() => setShowCreateProfileModal(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-1.5 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Save Profile</span>
          </button>
        </div>
      </div>

      {toast && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300 flex items-center space-x-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}



      {/* ==================== CLEAR ATTENDANCE LOGS (MONTHLY RESET) ==================== */}
      <div className="glass-card rounded-2xl p-6 border border-red-500/30 space-y-4 bg-gradient-to-br from-red-950/20 to-slate-900/90 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider text-red-300">
                Clear Attendance Logs (Monthly Reset)
              </h3>
              <p className="text-xs text-slate-400">
                Clear attendance records for a specific month or date range before uploading a new month's export sheet.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Option A: By Month */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mb-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>Clear By Specific Month</span>
              </p>
              <input
                type="month"
                value={clearMonth}
                onChange={(e) => setClearMonth(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
            <button
              onClick={() => handleClearAttendanceLogs('month')}
              disabled={clearLoading || !clearMonth}
              className="w-full py-2.5 bg-amber-700/80 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow"
            >
              <Trash2 className="w-4 h-4" />
              <span>{clearLoading ? 'Deleting...' : 'Delete Month Logs'}</span>
            </button>
          </div>

          {/* Option B: By Date Range */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mb-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>Clear By Date Range</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={clearStartDate}
                  onChange={(e) => setClearStartDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
                <input
                  type="date"
                  value={clearEndDate}
                  onChange={(e) => setClearEndDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>
            <button
              onClick={() => handleClearAttendanceLogs('range')}
              disabled={clearLoading || !clearStartDate || !clearEndDate}
              className="w-full py-2.5 bg-amber-700/80 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow"
            >
              <Trash2 className="w-4 h-4" />
              <span>{clearLoading ? 'Deleting...' : 'Delete Range Logs'}</span>
            </button>
          </div>

          {/* Option C: Total Factory Reset / Wipe Everything */}
          <div className="bg-rose-950/40 border-2 border-rose-600/60 rounded-xl p-4 space-y-3 flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold text-rose-300 flex items-center gap-1.5 mb-1">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Wipe All Data (Fresh Reset)</span>
              </p>
              <p className="text-[11px] text-slate-400">
                Deletes all attendance records, worker profiles, advances, and audit logs.
              </p>
            </div>
            <button
              onClick={() => handleClearAttendanceLogs('all')}
              disabled={clearLoading}
              className="w-full py-2.5 bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md border border-rose-500"
            >
              <Trash2 className="w-4 h-4" />
              <span>{clearLoading ? 'Resetting...' : 'Reset All Factory Data'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ==================== CUSTOM SALARY RULES LIST ==================== */}
      <div className="glass-card rounded-2xl p-6 border border-purple-500/30 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider text-purple-300 flex items-center gap-2">
            <IndianRupee className="w-4 h-4" />
            <span>Custom Salary Rules ({salaryRules.length})</span>
          </h3>
          <button
            onClick={() => setShowCreateSalaryRuleModal(true)}
            className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-semibold rounded-lg border border-purple-500/30 flex items-center gap-1 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Manual</span>
          </button>
        </div>

        {salaryRules.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No salary rules yet. Use the AI creator above or click "Create Salary Rule" to add bonus/deduction rules!
          </div>
        ) : (
          <div className="space-y-3">
            {salaryRules.map(r => {
              const colors = ruleTypeColors[r.rule_type] || ruleTypeColors.bonus;
              return (
                <div key={r.id} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="text-sm font-bold text-white">{r.rule_name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold border" style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}>
                        {colors.label}
                      </span>
                      {r.source === 'ai_generated' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          🤖 AI
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-mono truncate">
                      {conditionLabels[r.condition_type] || r.condition_type} {r.condition_value !== '0' ? `(${r.condition_value})` : ''} ➔ {actionLabels[r.action_type] || r.action_type}: {r.action_type?.includes('percentage') ? `${r.action_value}%` : `₹${r.action_value}`}
                    </p>
                    {r.description && <p className="text-[11px] text-slate-500 truncate">{r.description}</p>}
                  </div>

                  <div className="flex items-center space-x-3 flex-shrink-0">
                    <button
                      onClick={() => handleToggleSalaryRule(r.id)}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border"
                      style={{
                        backgroundColor: r.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        borderColor: r.is_active ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                        color: r.is_active ? '#34d399' : '#f87171',
                      }}
                    >
                      {r.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      <span>{r.is_active ? 'Active' : 'Off'}</span>
                    </button>

                    <button
                      onClick={() => handleDeleteSalaryRule(r.id, r.rule_name)}
                      className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ==================== CREATE SALARY RULE MODAL ==================== */}
      {showCreateSalaryRuleModal && (
        <div className="glass-card rounded-2xl p-6 border border-purple-500/40 bg-slate-900/95 shadow-2xl space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-purple-400" />
              <span>Create Custom Salary Rule</span>
            </h3>
            <button onClick={() => setShowCreateSalaryRuleModal(false)} className="text-xs text-slate-400 hover:text-white">
              Cancel
            </button>
          </div>

          <form onSubmit={handleCreateSalaryRule} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Rule Name</label>
              <input
                type="text"
                placeholder="e.g. Full Attendance Bonus ₹1000"
                value={salaryRuleName}
                onChange={(e) => setSalaryRuleName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Rule Type</label>
              <select
                value={salaryRuleType}
                onChange={(e) => setSalaryRuleType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
              >
                <option value="bonus">💰 Bonus</option>
                <option value="deduction">📉 Deduction</option>
                <option value="attendance_bonus">📋 Attendance Bonus</option>
                <option value="penalty">⚠️ Penalty</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Condition (When to Apply)</label>
              <select
                value={conditionType}
                onChange={(e) => setConditionType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
              >
                {Object.entries(conditionLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {conditionType !== 'always' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Condition Threshold Value</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 25"
                  value={conditionValue}
                  onChange={(e) => setConditionValue(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Action (What to Do)</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
              >
                {Object.entries(actionLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {actionType?.includes('percentage') ? 'Percentage (%)' : 'Amount (₹)'}
              </label>
              <input
                type="number"
                step="any"
                placeholder={actionType?.includes('percentage') ? 'e.g. 5' : 'e.g. 1000'}
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Description (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Worker gets ₹1000 bonus for 25+ attendance days"
                value={salaryRuleDesc}
                onChange={(e) => setSalaryRuleDesc(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="sm:col-span-2 flex justify-end space-x-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateSalaryRuleModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-purple-600/30 flex items-center space-x-1"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Save Salary Rule</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CUSTOM RESTRICTIONS & RULES BUILDER (timing-based) */}
      <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <Flame className="w-4 h-4" />
            <span>Active Custom Restriction Rules ({customRules.length})</span>
          </h3>
          <span className="text-xs text-slate-400">Toggle switch to enable/disable rules instantly</span>
        </div>

        {customRules.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No custom restriction rules created yet. Click "+ Create Timing Rule" above to add mid-day exit or late penalty rules!
          </div>
        ) : (
          <div className="space-y-3">
            {customRules.map(r => (
              <div key={r.id} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="text-sm font-bold text-white">{r.rule_name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold uppercase">
                      {r.rule_type === 'midday_exit' ? 'Mid-Day Exit Penalty' : 'Late Arrival Deduction'}
                    </span>
                    {r.target_staff_no && r.target_staff_no !== 'all' ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40 font-mono">
                        👤 #{r.target_staff_no}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px]">
                        🌐 Factory-Wide
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    If condition threshold &gt; {r.threshold_mins}m ➔ Deduct {r.deduction_mins} mins from working hours
                    {r.start_time && r.end_time ? ` (Window: ${r.start_time} - ${r.end_time})` : ''}
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleToggleRule(r.id)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border"
                    style={{
                      backgroundColor: r.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      borderColor: r.is_active ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                      color: r.is_active ? '#34d399' : '#f87171',
                    }}
                  >
                    {r.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    <span>{r.is_active ? 'Rule Active' : 'Rule Inactive'}</span>
                  </button>

                  <button
                    onClick={() => handleDeleteRule(r.id, r.rule_name)}
                    className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: CREATE CUSTOM RULE (timing-based) */}
      {showCreateRuleModal && (
        <div className="glass-card rounded-2xl p-6 border border-indigo-500/40 bg-slate-900/95 shadow-2xl space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              <span>Create Custom Restriction / Timing Rule</span>
            </h3>
            <button onClick={() => setShowCreateRuleModal(false)} className="text-xs text-slate-400 hover:text-white">
              Cancel
            </button>
          </div>

          <form onSubmit={handleCreateCustomRule} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Rule Name</label>
              <input
                type="text"
                placeholder="e.g. Lunch Exit Outside > 30 mins Deduction"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Worker / Scope</label>
              <select
                value={targetStaffNo}
                onChange={(e) => setTargetStaffNo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="all">🌐 All Workers (Factory-Wide)</option>
                {workers.map(w => (
                  <option key={w.staff_no} value={w.staff_no}>
                    👤 #{w.staff_no} - {w.staff_name} ({w.department || 'WORKER'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Rule Restriction Type</label>
              <select
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="midday_exit">Mid-Day Exit Penalty (Outside during shift)</option>
                <option value="late_penalty">Late Arrival Deduction Penalty</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Threshold Limit (Minutes)</label>
              <input
                type="number"
                placeholder="e.g. 30"
                value={thresholdMins}
                onChange={(e) => setThresholdMins(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">Triggers if outside/late time exceeds this many minutes.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Deduction Penalty (Minutes)</label>
              <input
                type="number"
                placeholder="e.g. 60"
                value={deductionMins}
                onChange={(e) => setDeductionMins(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">Minutes to deduct from worker regular hours when triggered.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Time Window (Optional)</label>
              <div className="flex items-center space-x-2">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-1/2 bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-white font-mono"
                />
                <span className="text-xs text-slate-500">to</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-1/2 bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="sm:col-span-2 flex justify-end space-x-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateRuleModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center space-x-1"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Save Custom Rule</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rule Profiles Manager */}
      <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider text-emerald-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span>Saved Custom Rule Profiles ({ruleProfiles.length})</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ruleProfiles.map((prof) => {
            const isActive = prof.is_default === 1;
            return (
              <div
                key={prof.id}
                className={`p-4 rounded-xl border transition-all ${isActive
                  ? 'bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{prof.profile_name}</span>
                      {isActive && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Active Rules
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 font-mono">
                      Shift: {prof.shift_start} - {prof.shift_end} | OT Threshold: {prof.shift_end} (4:30 PM) | Grace: {prof.grace_slab_minutes}m
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!isActive && (
                      <button
                        onClick={() => handleActivateProfile(prof.id, prof.profile_name)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md transition-all flex items-center gap-1"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Apply</span>
                      </button>
                    )}

                    {!isActive && prof.is_default !== 1 && (
                      <button
                        onClick={() => handleDeleteProfile(prof.id, prof.profile_name)}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        title="Delete Profile"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Create New Rule Profile */}
      {showCreateProfileModal && (
        <div className="glass-card rounded-2xl p-6 border border-emerald-500/30 bg-slate-900/95 shadow-2xl space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" />
              <span>Create New Custom Rule Profile</span>
            </h3>
            <button onClick={() => setShowCreateProfileModal(false)} className="text-xs text-slate-400 hover:text-white">
              Cancel
            </button>
          </div>

          <form onSubmit={handleCreateProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Profile Name / Description</label>
              <input
                type="text"
                placeholder="e.g. Summer Shift (09:00 - 17:00 OT after 5:00 PM)"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateProfileModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center space-x-1"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Rule Profile</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Baseline Settings Form */}
      <form onSubmit={handleSubmitSettings} className="space-y-6">

        {/* Section 1: Shift & Late Grace Slab Rules */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider text-indigo-400 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>1. Shift Timings (8h Work + 30m Lunch) & Overtime Threshold</span>
          </h3>

          <p className="text-xs text-slate-400">
            Standard shift is 08:00 to 16:30. 30 minutes lunch is unpaid. Worker must complete 8 hours net duty from effective start time before overtime begins (e.g. 08:31 arrival ➔ 09:00 start ➔ OT starts after 17:30 / 5:30 PM). Total hours & OT rounded in 30-min blocks.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Standard Shift Start Time</label>
              <input
                type="time"
                value={form.shift_start}
                onChange={(e) => handleChange('shift_start', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Default 08:00 AM.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Standard Shift End Time</label>
              <input
                type="time"
                value={form.shift_end}
                onChange={(e) => handleChange('shift_end', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Default 16:30 (4:30 PM).</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Unpaid Lunch Deduction (Mins)</label>
              <input
                type="number"
                value={form.lunch_deduction_mins}
                onChange={(e) => handleChange('lunch_deduction_mins', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-amber-400 font-medium mt-1">Default 30 mins (unpaid).</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Late Grace Slab (Minutes)</label>
              <input
                type="number"
                value={form.grace_slab_minutes}
                onChange={(e) => handleChange('grace_slab_minutes', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Default 30m slab rounding.</p>
            </div>
          </div>
        </div>

        {/* Section 2: Overtime & Short Hours Rules */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider text-indigo-400 flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            <span>2. Overtime Pay Rates & Short Hours Threshold</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">OT Pay Multiplier (Weekday)</label>
              <input
                type="number"
                step="0.1"
                value={form.ot_multiplier}
                onChange={(e) => handleChange('ot_multiplier', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Default 1.5x hourly rate.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Sunday OT Multiplier ☀️</label>
              <input
                type="number"
                step="0.1"
                value={form.sunday_ot_multiplier}
                onChange={(e) => handleChange('sunday_ot_multiplier', e.target.value)}
                className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-sm text-amber-300 font-mono focus:outline-none focus:border-amber-500"
              />
              <p className="text-[11px] text-amber-400 font-medium mt-1">Default 2.0x. Sunday kaam = double rate!</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">OT Calculation Precision</label>
              <select
                value={form.ot_rounding}
                onChange={(e) => handleChange('ot_rounding', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="minutes">Exact Minute Precision</option>
                <option value="30min_block">Completed 30-Minute Blocks</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Short Hours Cutoff (Hours)</label>
              <input
                type="number"
                step="0.5"
                value={form.short_hours_threshold}
                onChange={(e) => handleChange('short_hours_threshold', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Default 4.0 hours.</p>
            </div>
          </div>
        </div>

        {/* Section 3: Weekly Off & Forfeiture Rules */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider text-indigo-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            <span>3. Weekly Off (Sunday) & Salary Base Rules</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Designated Weekly Off Day</label>
              <select
                value={form.weekly_off_day}
                onChange={(e) => handleChange('weekly_off_day', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Sun">Sunday</option>
                <option value="Sat">Saturday</option>
                <option value="Fri">Friday</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Sunday Forfeiture Threshold</label>
              <input
                type="number"
                value={form.forfeiture_absent_threshold}
                onChange={(e) => handleChange('forfeiture_absent_threshold', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Default 2 absences in Mon-Sat forfeits Sunday.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Standard Month Days (Salary Base)</label>
              <select
                value={form.standard_month_days}
                onChange={(e) => handleChange('standard_month_days', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="26">Fixed 26 Working Days</option>
                <option value="30">Fixed 30 Days</option>
                <option value="calendar">Actual Calendar Days in Month</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: Gemini API Key */}
        <div className="glass-card rounded-2xl p-6 border border-purple-500/30 space-y-4">
          <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider text-purple-300 flex items-center gap-2">
            <Key className="w-4 h-4" />
            <span>4. Gemini AI Configuration</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Gemini API Key</label>
            <input
              type="password"
              placeholder="Paste your Gemini API key here..."
              value={form.gemini_api_key}
              onChange={(e) => handleChange('gemini_api_key', e.target.value)}
              className="w-full bg-slate-900 border border-purple-500/30 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Required for AI rule generation. Get your key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-purple-400 underline">Google AI Studio</a>
            </p>
          </div>
        </div>

        {/* Section 5: Security & Payroll Password */}
        <div className="glass-card rounded-2xl p-6 border border-amber-500/30 space-y-4">
          <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider text-amber-300 flex items-center gap-2">
            <Lock className="w-4 h-4" />
            <span>5. Security & Payroll Unlock Password</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Payroll Mode Unlock PIN / Password</label>
            <input
              type="text"
              placeholder="e.g. kki123"
              value={form.payroll_password !== undefined ? form.payroll_password : 'kki123'}
              onChange={(e) => handleChange('payroll_password', e.target.value)}
              className="w-full bg-slate-900 border border-amber-500/30 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              This password protects all salary figures, ₹ financial amounts, allowances, and advance ledgers. (Default: <strong className="text-amber-400 font-mono">kki123</strong>)
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl shadow-xl shadow-indigo-600/30 flex items-center space-x-2 transition-all disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Rules & Recompute All Payroll</span>
          </button>
        </div>

      </form>

    </div>
  );
}
