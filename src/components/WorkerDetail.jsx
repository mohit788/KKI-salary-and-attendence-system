import React, { useState } from 'react';
import {
  ArrowLeft,
  Printer,
  Download,
  Edit3,
  Clock,
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Building2,
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Sparkles,
  ShieldCheck,
  X,
  Save,
  Plus,
  Trash2,
  Star,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { formatHours } from '../utils/formatters';

export default function WorkerDetail({
  staffNo,
  workerData,
  workers = [],
  onSelectWorker,
  onBack,
  onEditRecord,
  onAddAdvance,
  isPayrollUnlocked = false,
  onOpenUnlockModal,
  onRefreshData,
  selectedMonth,
  availableMonths = [],
  onSelectMonth
}) {
  const [workerSearchTerm, setWorkerSearchTerm] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Special Rules Form State
  const [showSpecialRulesModal, setShowSpecialRulesModal] = useState(false);
  const [specialShift, setSpecialShift] = useState('auto');
  const [specialGraceExempt, setSpecialGraceExempt] = useState(false);
  const [specialGraceAllowedMins, setSpecialGraceAllowedMins] = useState('15');
  const [specialGraceMaxDays, setSpecialGraceMaxDays] = useState('');
  const [specialGraceValidFrom, setSpecialGraceValidFrom] = useState('');
  const [specialGraceValidTo, setSpecialGraceValidTo] = useState('');
  const [specialBonusAmount, setSpecialBonusAmount] = useState('');
  const [specialBonusName, setSpecialBonusName] = useState('');
  const [specialDeductionAmount, setSpecialDeductionAmount] = useState('');
  const [specialDeductionName, setSpecialDeductionName] = useState('');
  const [savingSpecialRule, setSavingSpecialRule] = useState(false);
  const [workerRulesList, setWorkerRulesList] = useState([]);
  const [togglingException, setTogglingException] = useState(false);

  const handleToggleException = async () => {
    setTogglingException(true);
    try {
      const isCurrentlyException = worker?.is_exception === 1;
      const res = await fetch(`/api/workers/${staffNo}/toggle-exception`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_exception: isCurrentlyException ? 0 : 1,
          exception_reason: isCurrentlyException ? '' : 'Marked from Worker Profile'
        })
      }).then(r => r.json());

      if (res.success) {
        if (onRefreshData) onRefreshData();
      } else {
        alert('Error updating exception status: ' + res.error);
      }
    } catch (err) {
      alert('Failed to update exception: ' + err.message);
    } finally {
      setTogglingException(false);
    }
  };

  const fetchWorkerRules = async () => {
    try {
      const [crRes, srRes] = await Promise.all([
        fetch('/api/custom-rules').then(r => r.json()),
        fetch('/api/salary-rules').then(r => r.json())
      ]);
      const myTimingRules = (crRes?.rules || []).filter(r => String(r.target_staff_no) === String(staffNo));
      const mySalaryRules = (srRes?.rules || []).filter(r => String(r.target_staff_no) === String(staffNo));
      setWorkerRulesList([...myTimingRules, ...mySalaryRules]);

      // Pre-fill existing grace rule if present
      const existingGrace = myTimingRules.find(r => r.is_active && (r.exemption_type === 'grace_slab_exempt' || r.rule_type === 'grace_slab_exempt' || r.rule_type === 'late_penalty_grace'));
      if (existingGrace) {
        setSpecialGraceExempt(true);
        setSpecialGraceAllowedMins(String(existingGrace.grace_allowed_mins || existingGrace.threshold_mins || 15));
        setSpecialGraceMaxDays(existingGrace.max_allowed_days ? String(existingGrace.max_allowed_days) : '');
        setSpecialGraceValidFrom(existingGrace.valid_from || '');
        setSpecialGraceValidTo(existingGrace.valid_to || '');
      }
    } catch (e) {
      console.error('Error fetching worker rules:', e);
    }
  };

  const handleSaveWorkerSpecialRules = async (e) => {
    e.preventDefault();
    setSavingSpecialRule(true);
    try {
      // 1. Update Shift Assignment
      await fetch(`/api/workers/${staffNo}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_name: workerData?.worker?.staff_name,
          department: workerData?.worker?.department,
          assigned_shift: specialShift
        })
      });

      // 2. Grace Slab Exemption with Fine-Grained Grace Mins, Day Limit, and Validity Period
      if (specialGraceExempt) {
        await fetch('/api/custom-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rule_name: `Late Grace Exemption for #${staffNo} (${workerData?.worker?.staff_name || ''})`,
            rule_type: 'grace_slab_exempt',
            target_staff_no: String(staffNo),
            exemption_type: 'grace_slab_exempt',
            threshold_mins: parseInt(specialGraceAllowedMins, 10) || 15,
            grace_allowed_mins: parseInt(specialGraceAllowedMins, 10) || 15,
            max_allowed_days: parseInt(specialGraceMaxDays, 10) || 0,
            valid_from: specialGraceValidFrom || '',
            valid_to: specialGraceValidTo || ''
          })
        });
      }

      // 3. Special Bonus
      if (parseFloat(specialBonusAmount) > 0) {
        await fetch('/api/salary-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rule_name: specialBonusName.trim() || `Special Bonus for #${staffNo}`,
            rule_type: 'bonus',
            target_staff_no: String(staffNo),
            condition_type: 'always',
            condition_value: '0',
            action_type: 'add_fixed',
            action_value: parseFloat(specialBonusAmount),
            description: `Worker #${staffNo} special bonus`,
            source: 'manual'
          })
        });
      }

      // 4. Special Deduction
      if (parseFloat(specialDeductionAmount) > 0) {
        await fetch('/api/salary-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rule_name: specialDeductionName.trim() || `Special Deduction for #${staffNo}`,
            rule_type: 'deduction',
            target_staff_no: String(staffNo),
            condition_type: 'always',
            condition_value: '0',
            action_type: 'deduct_fixed',
            action_value: parseFloat(specialDeductionAmount),
            description: `Worker #${staffNo} special deduction`,
            source: 'manual'
          })
        });
      }

      setShowSpecialRulesModal(false);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      alert('Error saving special rules: ' + err.message);
    } finally {
      setSavingSpecialRule(false);
    }
  };

  const handleDeleteWorkerRule = async (rule) => {
    if (!confirm(`Delete rule "${rule.rule_name}"?`)) return;
    try {
      const endpoint = rule.action_type ? `/api/salary-rules/${rule.id}` : `/api/custom-rules/${rule.id}`;
      await fetch(endpoint, { method: 'DELETE' });
      fetchWorkerRules();
      if (onRefreshData) onRefreshData();
    } catch (e) {
      console.error('Delete rule error:', e);
    }
  };

  if (!workerData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-300 space-y-4">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-base font-semibold text-slate-200">Loading worker attendance profile...</p>
        <button
          onClick={onBack}
          className="mt-2 text-xs font-bold text-slate-300 hover:text-white px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-all cursor-pointer shadow-md"
        >
          ← Back to Workers Table
        </button>
      </div>
    );
  }

  const { worker, dailyRecords = [], advances = [], auditLogs = [], payroll } = workerData;

  const handlePrint = () => {
    window.print();
  };

  const totalRegularDutyHours = dailyRecords.reduce((acc, r) => acc + (parseFloat(r.regular_hours) || 0), 0);
  const sunHolDays = payroll?.sundayAndHolidayWorkedDays !== undefined
    ? payroll.sundayAndHolidayWorkedDays
    : ((payroll?.sundayWorkedDays || 0) + (payroll?.holidayWorkedDays || 0));

  // Worker navigation helpers
  const currentIdx = (workers || []).findIndex(w => String(w.staff_no) === String(staffNo));
  const prevWorker = currentIdx > 0 ? workers[currentIdx - 1] : null;
  const nextWorker = currentIdx >= 0 && currentIdx < (workers.length - 1) ? workers[currentIdx + 1] : null;

  const filteredWorkersList = (workers || []).filter(w => {
    if (!workerSearchTerm.trim()) return true;
    const term = workerSearchTerm.toLowerCase();
    return (
      (w.staff_name || '').toLowerCase().includes(term) ||
      (w.staff_no || '').toString().includes(term) ||
      (w.department || '').toLowerCase().includes(term)
    );
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Present (Full)':
        return 'bg-emerald-950 text-emerald-300 border-emerald-600';
      case 'Present (Short)':
        return 'bg-amber-950 text-amber-300 border-amber-600';
      case 'Absent (OT Credited)':
        return 'bg-cyan-950 text-cyan-300 border-cyan-500 font-bold';
      case 'Absent':
        return 'bg-rose-950 text-rose-300 border-rose-600';
      case 'Weekly Off (Paid)':
        return 'bg-blue-950 text-blue-300 border-blue-600';
      case 'Weekly Off (Worked OT)':
        return 'bg-amber-950 text-amber-300 border-amber-600';
      case 'Weekly Off (Forfeited)':
        return 'bg-slate-800 text-slate-300 border-slate-600';
      case 'Holiday (Paid)':
        return 'bg-teal-950 text-teal-300 border-teal-500 font-bold';
      case 'Holiday (Worked OT)':
        return 'bg-indigo-950 text-indigo-300 border-indigo-500 font-bold';
      case 'Holiday (Forfeited)':
        return 'bg-rose-950 text-rose-300 border-rose-600 font-bold';
      case 'Incomplete':
        return 'bg-orange-950 text-orange-300 border-orange-600';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-slate-100">

      {/* Top Action Bar with Prominent Worker Searcher & Prev/Next Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 no-print">

        {/* Left: Back button + Prev/Next Worker Controls */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-xs sm:text-sm font-bold text-slate-200 hover:text-white px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Workers</span>
          </button>

          {onSelectWorker && (
            <div className="flex items-center space-x-1 bg-slate-900 border border-slate-700 p-1 rounded-xl shadow-sm">
              <button
                onClick={() => prevWorker && onSelectWorker(prevWorker.staff_no)}
                disabled={!prevWorker}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 transition-all cursor-pointer"
                title={prevWorker ? `Previous: #${prevWorker.staff_no} ${prevWorker.staff_name}` : 'No previous worker'}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prev</span>
              </button>

              <span className="text-[11px] font-mono font-bold text-cyan-300 px-2 py-0.5 bg-slate-950 rounded border border-slate-800">
                {currentIdx >= 0 ? `${currentIdx + 1} / ${workers.length}` : `#${staffNo}`}
              </span>

              <button
                onClick={() => nextWorker && onSelectWorker(nextWorker.staff_no)}
                disabled={!nextWorker}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 transition-all cursor-pointer"
                title={nextWorker ? `Next: #${nextWorker.staff_no} ${nextWorker.staff_name}` : 'No next worker'}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Center/Right: Large Quick Search Switcher Dropdown & Action Buttons */}
        <div className="flex items-center space-x-2.5 flex-wrap gap-y-2 justify-between lg:justify-end flex-1">

          {/* Large, Prominent & Spacious Worker Search Bar */}
          {onSelectWorker && workers.length > 0 && (
            <div className="relative flex-1 sm:w-[450px] md:w-[560px] lg:w-[680px]">
              <Search className="w-5 h-5 text-cyan-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Worker by Name, ID (#341), Dept..."
                value={workerSearchTerm}
                onChange={(e) => {
                  setWorkerSearchTerm(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onFocus={() => setShowSearchDropdown(true)}
                className="w-full bg-slate-950/95 border-2 border-slate-600 hover:border-cyan-500/60 focus:border-cyan-400 rounded-2xl pl-12 pr-10 py-3 text-sm sm:text-base text-white placeholder-slate-400 focus:outline-none transition-all shadow-xl shadow-cyan-950/20 font-bold focus:ring-4 focus:ring-cyan-500/20"
              />
              {workerSearchTerm && (
                <button
                  onClick={() => { setWorkerSearchTerm(''); setShowSearchDropdown(false); }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {showSearchDropdown && workerSearchTerm.trim() && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowSearchDropdown(false)}
                  />
                  <div className="absolute left-0 top-full mt-1.5 w-full min-w-[320px] max-h-72 overflow-y-auto bg-slate-900 border-2 border-slate-700 rounded-2xl shadow-2xl z-40 p-2 divide-y divide-slate-800 backdrop-blur-md">
                    {filteredWorkersList.length === 0 ? (
                      <div className="py-4 text-center text-xs text-slate-400 font-medium">No worker matched "{workerSearchTerm}"</div>
                    ) : (
                      filteredWorkersList.slice(0, 12).map(w => (
                        <button
                          key={w.staff_no}
                          onClick={() => {
                            onSelectWorker(w.staff_no);
                            setWorkerSearchTerm('');
                            setShowSearchDropdown(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs hover:bg-slate-800 transition-colors flex items-center justify-between cursor-pointer ${String(w.staff_no) === String(staffNo) ? 'bg-blue-950/80 border border-blue-500 text-cyan-300 font-bold' : 'text-slate-200'
                            }`}
                        >
                          <div className="flex items-center space-x-3">
                            <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-blue-950 text-cyan-300 font-bold border border-blue-700">#{w.staff_no}</span>
                            <span className="font-bold text-sm text-white">{w.staff_name}</span>
                          </div>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase border border-slate-700">{w.department || 'WORKER'}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Exception Worker Quick Toggle Button */}
          <button
            onClick={handleToggleException}
            disabled={togglingException}
            className={`flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer shadow-sm ${worker?.is_exception === 1
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/80 shadow-amber-500/10'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
              }`}
            title="Toggle Exception Worker (Exempts from missing punch download locks)"
          >
            <Star className={`w-3.5 h-3.5 ${worker?.is_exception === 1 ? 'text-amber-400 fill-amber-400' : 'text-slate-500'}`} />
            <span>{worker?.is_exception === 1 ? '⭐ Exception Worker' : 'Set as Exception'}</span>
          </button>

          {/* Worker Special Rules Button */}
          <button
            onClick={() => {
              setSpecialShift(worker?.assigned_shift || 'auto');
              fetchWorkerRules();
              setShowSpecialRulesModal(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30 transition-all cursor-pointer shadow-sm"
            title="Configure Special Rules for this Worker"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Special Rules</span>
          </button>

          {isPayrollUnlocked && (
            <button
              onClick={() => onAddAdvance(staffNo)}
              className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-600 transition-all cursor-pointer shadow-sm"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Add Advance</span>
            </button>
          )}

          <a
            href={`/api/export/excel/worker/${staffNo}${selectedMonth && selectedMonth !== 'all' ? `?month=${selectedMonth}` : ''}${isPayrollUnlocked ? (selectedMonth && selectedMonth !== 'all' ? '&' : '?') + 'payroll_unlocked=true' : ''}`}
            download
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white shadow-md border border-emerald-500 transition-all cursor-pointer"
            title="Download Single Worker Excel Report"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </a>

          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-700 hover:bg-blue-600 text-white shadow-md border border-blue-500 transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* MODAL: WORKER SPECIAL RULES CONFIGURATION */}
      {showSpecialRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
          <div className="glass-modal w-full max-w-xl rounded-2xl p-6 shadow-2xl border-2 border-amber-500/60 bg-slate-900 flex flex-col space-y-4">

            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Special Rules for #{staffNo} {worker?.staff_name}
                  </h3>
                  <p className="text-xs text-slate-300">Set individual shift, grace exemption, allowances or deductions</p>
                </div>
              </div>
              <button onClick={() => setShowSpecialRulesModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWorkerSpecialRules} className="space-y-4">

              {/* 1. Custom Shift Start */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  1. Assigned Shift Timing (Shift Start Anchor)
                </label>
                <select
                  value={specialShift}
                  onChange={(e) => setSpecialShift(e.target.value)}
                  className="w-full bg-slate-950 border-2 border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-amber-500 font-medium"
                >
                  <option value="auto">⚡ Auto-Detect (Based on Arrival: 07:00 / 08:00 / 08:30 / 09:00)</option>
                  <option value="07:00">07:00 AM (Early Factory Shift - 07:00 to 15:30)</option>
                  <option value="08:00">08:00 AM (Standard Factory Shift - 08:00 to 16:30)</option>
                  <option value="08:30">08:30 AM (Regular Shift - 08:30 to 17:00)</option>
                  <option value="09:00">09:00 AM (General Shift - 09:00 to 17:30)</option>
                </select>
              </div>

              {/* 2. Grace Exemption */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Late Penalty Exemption Grace</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">Special Exemption</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">Waives the 30-minute late penalty slab when worker arrives within allowed limit</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={specialGraceExempt}
                    onChange={(e) => setSpecialGraceExempt(e.target.checked)}
                    className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                  />
                </div>

                {specialGraceExempt && (
                  <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Allowed Late Minutes (mins)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          placeholder="e.g. 15"
                          value={specialGraceAllowedMins}
                          onChange={(e) => setSpecialGraceAllowedMins(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                        />
                        <span className="absolute right-3 top-2 text-xs text-slate-400">mins late</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">Late arrival up to this many mins won't cut 30m.</p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Monthly Days Limit (0 = Unlimited)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          placeholder="0 for unlimited, or e.g. 5"
                          value={specialGraceMaxDays}
                          onChange={(e) => setSpecialGraceMaxDays(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                        />
                        <span className="absolute right-3 top-2 text-xs text-slate-400">days/mo</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">Max late days per month worker can use this exemption.</p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Valid From (Start Date)
                      </label>
                      <input
                        type="date"
                        value={specialGraceValidFrom}
                        onChange={(e) => setSpecialGraceValidFrom(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Valid To (End Date)
                      </label>
                      <input
                        type="date"
                        value={specialGraceValidTo}
                        onChange={(e) => setSpecialGraceValidTo(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Special Monthly Bonus */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">Add Worker Bonus (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 1000"
                    value={specialBonusAmount}
                    onChange={(e) => setSpecialBonusAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">Bonus Reason / Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Attendance Bonus"
                    value={specialBonusName}
                    onChange={(e) => setSpecialBonusName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              {/* 4. Special Monthly Deduction */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">Add Worker Deduction (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 500"
                    value={specialDeductionAmount}
                    onChange={(e) => setSpecialDeductionAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">Deduction Reason</label>
                  <input
                    type="text"
                    placeholder="e.g. Uniform / Loan"
                    value={specialDeductionName}
                    onChange={(e) => setSpecialDeductionName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              {/* Active Rules for this Worker */}
              {workerRulesList.length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <h4 className="text-xs font-bold text-slate-300 mb-2">Existing Special Rules on this Worker:</h4>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {workerRulesList.map((r, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs flex items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-amber-200">{r.rule_name}</span>
                            {r.grace_allowed_mins || r.threshold_mins ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                                ≤{r.grace_allowed_mins || r.threshold_mins}m late allowed
                              </span>
                            ) : null}
                            {r.max_allowed_days > 0 ? (
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px]">
                                Max {r.max_allowed_days} days/mo
                              </span>
                            ) : null}
                          </div>
                          {r.valid_from || r.valid_to ? (
                            <p className="text-[10px] text-slate-400 font-mono">
                              Period: {r.valid_from || 'Start'} ➔ {r.valid_to || 'Ongoing'}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteWorkerRule(r)}
                          className="text-rose-400 hover:text-rose-300 px-2 py-1 rounded bg-rose-500/10 text-[10px] font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSpecialRulesModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSpecialRule}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center space-x-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingSpecialRule ? 'Saving & Applying...' : 'Save & Apply Rule'}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* CALCULATION LOCKED WARNING BANNER */}
      {payroll?.hasIncompleteEntries && (
        <div className="bg-amber-950/80 border-2 border-amber-500 rounded-2xl p-4.5 text-amber-200 shadow-xl flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <span>⚠️ Salary & Totals Calculation On Hold ({payroll.incompleteDays} Incomplete Days)</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold font-mono">Action Required</span>
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                This employee has {payroll.incompleteDays} attendance entry(ies) with missing punch swipes. Please complete all missing punches in the breakdown below to unlock salary generation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Printable Report Header */}
      <div className="glass-card rounded-2xl p-6 border-2 border-slate-700 bg-slate-900 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b-2 border-slate-700">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-950 text-cyan-300 border-2 border-blue-600 flex items-center justify-center font-bold text-2xl font-mono shadow-md">
              #{worker.staff_no}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-2xl font-extrabold text-white font-display">{worker.staff_name}</h2>
                {worker.is_exception === 1 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/80 text-[11px] font-bold flex items-center gap-1 shadow-sm">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span>Exception Worker (Exempt)</span>
                  </span>
                )}
                {worker.assigned_shift && worker.assigned_shift !== 'auto' && (
                  <span className="px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-600 text-[11px] font-mono font-bold">
                    Shift Override: {worker.assigned_shift}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-3 text-sm text-slate-300 mt-1 font-medium">
                <span>Dept: <strong className="text-white">{worker.department || 'WORKER'}</strong></span>
                <span>•</span>
                <span>Staff ID: <strong className="text-cyan-300 font-mono">#{worker.staff_no}</strong></span>
                {isPayrollUnlocked && (
                  <>
                    <span>•</span>
                    <span>Monthly Base: <strong className="text-emerald-300 font-mono">₹{(worker.monthly_salary || 15000).toLocaleString('en-IN')}</strong></span>
                  </>
                )}
              </div>

              {/* Month Switcher Pills inside Worker Detail */}
              {availableMonths && availableMonths.length > 1 && onSelectMonth && (
                <div className="flex items-center gap-1.5 mt-2.5 flex-wrap no-print">
                  <span className="text-[11px] font-bold text-slate-400 mr-1">Active Month:</span>
                  {availableMonths.map(m => {
                    const key = m.monthKey || m.month_key;
                    const label = m.label || m.month_label || key;
                    return (
                      <button
                        key={key}
                        onClick={() => onSelectMonth(key)}
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedMonth === key
                          ? 'bg-blue-600 text-white border border-blue-400 shadow-sm'
                          : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700'
                          }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => onSelectMonth('all')}
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedMonth === 'all'
                      ? 'bg-blue-600 text-white border border-blue-400 shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700'
                      }`}
                  >
                    All Months
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Rate Card (Only if unlocked) */}
          {isPayrollUnlocked ? (
            <div className="flex items-center space-x-4 bg-slate-950 border-2 border-slate-700 p-3.5 rounded-xl text-sm font-mono flex-wrap gap-y-2">
              <div>
                <p className="text-slate-400 text-xs uppercase font-bold">Per-Day Rate</p>
                <p className="text-base font-extrabold text-white">₹{payroll?.perDayRate} / day</p>
              </div>
              <div className="border-l-2 border-slate-800 pl-4">
                <p className="text-slate-400 text-xs uppercase font-bold">OT Rate (Wkday)</p>
                <p className="text-base font-extrabold text-blue-300">₹{payroll?.hourlyOtRate} / hr</p>
              </div>
              <div className="border-l-2 border-slate-800 pl-4">
                <p className="text-slate-400 text-xs uppercase font-bold">Sunday OT Rate ☀️</p>
                <p className="text-base font-extrabold text-amber-300">₹{payroll?.hourlySundayOtRate} / hr</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-3 bg-slate-950 border-2 border-slate-700 px-4 py-3 rounded-xl text-xs font-mono">
              <span className="text-slate-400">Duty Model:</span>
              <span className="text-cyan-300 font-bold">8.0 Hours Shift + 30m Lunch</span>
            </div>
          )}
        </div>

        {/* Month Summary Cards Grid (Including Sunday/Holiday Worked Days Card) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mt-6">

          <div className="bg-slate-950 border border-slate-700 rounded-xl p-3">
            <p className="text-xs font-bold uppercase text-slate-300">Payable Days</p>
            {payroll?.hasIncompleteEntries ? (
              <p className="text-sm font-extrabold text-amber-400 font-mono mt-1">⚠️ Locked</p>
            ) : (
              <p className="text-xl font-extrabold text-emerald-300 font-mono mt-1">{payroll?.payableDays || 0} d</p>
            )}
            <p className="text-[11px] text-slate-400 mt-0.5">{payroll?.fullPresentDays || 0} Full + {payroll?.paidWeeklyOffs || 0} Offs</p>
          </div>

          <div className="bg-slate-950 border border-slate-700 rounded-xl p-3">
            <p className="text-xs font-bold uppercase text-slate-300">Leaves / Absent</p>
            <p className="text-xl font-extrabold text-rose-300 font-mono mt-1">{(payroll?.totalLeaves || payroll?.absentDays || 0)} d</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{payroll?.absentDays || 0} Pure Absent</p>
          </div>

          {/* DEDICATED SUNDAY & HOLIDAY WORKED DAYS (TEA/FOOD EXPENSE) */}
          <div className="bg-amber-950/40 border-2 border-amber-500/70 rounded-xl p-3 shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase text-amber-300">Sun & Hol Worked ☕</p>
              <Coffee className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-xl font-extrabold text-amber-300 font-mono mt-1">
              {sunHolDays} Days
            </p>
            <p className="text-[10px] text-amber-200/80 mt-0.5 font-medium">
              {payroll?.sundayWorkedDays || 0} Sun + {payroll?.holidayWorkedDays || 0} Hol (Tea/Food Exp)
            </p>
          </div>

          <div className="bg-blue-950/60 border border-blue-600/60 rounded-xl p-3">
            <p className="text-xs font-bold uppercase text-blue-300">Total OT Hours</p>
            {payroll?.hasIncompleteEntries ? (
              <p className="text-sm font-extrabold text-amber-400 font-mono mt-1">⚠️ On Hold</p>
            ) : (
              <p className="text-xl font-extrabold text-cyan-300 font-mono mt-1">
                {formatHours(payroll?.totalCombinedOtHours || ((payroll?.totalOtHours || 0) + (payroll?.totalSundayOtHours || 0)))}
              </p>
            )}
            <p className="text-[10px] text-blue-300 font-mono">
              {formatHours(payroll?.totalOtHours || 0)} Wk + {formatHours(payroll?.totalSundayOtHours || 0)} Sun
            </p>
          </div>

          <div className="bg-amber-950/60 border border-amber-600/60 rounded-xl p-3">
            <p className="text-xs font-bold uppercase text-amber-300">Sunday OT ☀️</p>
            {payroll?.hasIncompleteEntries ? (
              <p className="text-sm font-extrabold text-amber-400 font-mono mt-1">⚠️ On Hold</p>
            ) : (
              <p className="text-xl font-extrabold text-amber-300 font-mono mt-1">{formatHours(payroll?.totalSundayOtHours || 0)}</p>
            )}
            <p className="text-[10px] text-amber-300 font-mono">
              {isPayrollUnlocked ? `₹${(payroll?.sundayOtPay || 0).toLocaleString('en-IN')}` : 'Sunday Duty OT'}
            </p>
          </div>

          {isPayrollUnlocked ? (
            <>
              <div className="bg-slate-950 border border-slate-700 rounded-xl p-3">
                <p className="text-xs font-bold uppercase text-slate-300">Advances Deducted</p>
                <p className="text-xl font-extrabold text-amber-300 font-mono mt-1">− ₹{(payroll?.totalAdvances || 0).toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Ledger records</p>
              </div>

              <div className="bg-emerald-950/80 border-2 border-emerald-600 rounded-xl p-3 shadow-md">
                <p className="text-xs font-bold uppercase text-emerald-300">Net Payable</p>
                {payroll?.hasIncompleteEntries ? (
                  <p className="text-sm font-extrabold text-amber-300 font-mono mt-1">⚠️ Locked</p>
                ) : (
                  <p className="text-xl font-extrabold text-emerald-300 font-mono mt-1">₹{(payroll?.netPayable || 0).toLocaleString('en-IN')}</p>
                )}
                <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">Final Payout</p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-slate-950 border border-slate-700 rounded-xl p-3">
                <p className="text-xs font-bold uppercase text-slate-300">Total Regular Duty</p>
                {payroll?.hasIncompleteEntries ? (
                  <p className="text-sm font-extrabold text-amber-400 font-mono mt-1">⚠️ On Hold</p>
                ) : (
                  <p className="text-xl font-extrabold text-slate-100 font-mono mt-1">{formatHours(totalRegularDutyHours)}</p>
                )}
                <p className="text-[10px] text-slate-400 mt-0.5">8h Standard Hours</p>
              </div>

              <div className="bg-slate-950 border border-slate-700 rounded-xl p-3">
                <p className="text-xs font-bold uppercase text-slate-300">Recorded Swipes</p>
                <p className="text-xl font-extrabold text-emerald-300 font-mono mt-1">{dailyRecords.length} d</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Evaluated Month Logs</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Day-by-Day Calendar Table with Highlighted Manual Punches */}
      <div className="glass-card rounded-2xl border-2 border-slate-700 overflow-hidden shadow-lg bg-slate-900">
        <div className="p-4 border-b-2 border-slate-700 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-bold text-white font-display">Daily Attendance Breakdown</h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-mono font-bold border border-slate-700">
              {dailyRecords.length} Days Recorded
            </span>
          </div>
          <div className="flex items-center space-x-3 text-xs">
            <span className="flex items-center gap-1.5 text-violet-300 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block shadow-sm"></span>
              <span>Manual Edit Highlighted</span>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[68vh] relative">
          <table className="w-full text-left text-sm text-slate-200 border-collapse">
            <thead className="sticky top-0 bg-slate-950 z-20 text-slate-200 font-bold uppercase tracking-wider border-b-2 border-slate-700 text-xs shadow-md">
              <tr className="divide-x divide-slate-800">
                <th className="px-4 py-3.5 bg-slate-950">Date</th>
                <th className="px-4 py-3.5 bg-slate-950">Raw Swipes</th>
                <th className="px-3 py-3.5 text-center text-teal-300 bg-slate-950">Shift</th>
                <th className="px-4 py-3.5 text-center bg-slate-950">Effective In</th>
                <th className="px-4 py-3.5 text-center bg-slate-950">Effective Out</th>
                <th className="px-4 py-3.5 text-center bg-slate-950">Reg Hrs (8h Duty)</th>
                <th className="px-4 py-3.5 text-center text-blue-300 bg-slate-950">OT Hrs</th>
                <th className="px-4 py-3.5 text-center text-amber-300 bg-slate-950">Sun OT ☀️</th>
                <th className="px-4 py-3.5 text-center bg-slate-950">Total Hrs</th>
                <th className="px-4 py-3.5 text-center bg-slate-950">Status</th>
                <th className="px-4 py-3.5 text-center no-print bg-slate-950">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {dailyRecords.map(r => {
                const isManual = r.is_manual_override === 1 || r.is_manual_override === true;

                return (
                  <tr
                    key={r.date}
                    className={`transition-colors divide-x divide-slate-800/80 ${isManual
                      ? 'bg-violet-950/35 hover:bg-violet-900/45 border-l-4 border-l-violet-500'
                      : r.status === 'Weekly Off (Worked OT)'
                        ? 'bg-amber-950/30 hover:bg-slate-800/90'
                        : 'even:bg-slate-950/40 odd:bg-slate-900/60 hover:bg-slate-800/90'
                      }`}
                  >
                    {/* Date with Manual Override Tag */}
                    <td className="px-4 py-3 font-mono font-bold text-white whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span>{r.date} <span className="text-slate-400 font-normal">({r.weekday})</span></span>
                        {isManual && (
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-900/90 text-violet-200 border border-violet-500 flex items-center gap-1 shadow-sm"
                            title={r.override_reason || 'Manual Admin Correction'}
                          >
                            <Sparkles className="w-2.5 h-2.5 text-violet-300" />
                            <span>Manual Entry</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Raw Swipes - VISUALLY HIGHLIGHTED PER TOKEN FOR MANUAL EDITS */}
                    <td className="px-4 py-3 font-mono text-slate-200">
                      {r.raw_swipes ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(() => {
                            const currentTokens = (r.raw_swipes || '').split(/\s+/).filter(Boolean);
                            const manualTokens = new Set((r.manual_punches || '').split(/\s+/).filter(Boolean));
                            const origTokens = new Set((r.original_raw_swipes || '').split(/\s+/).filter(Boolean));

                            return currentTokens.map((token, idx) => {
                              let isAddedTiming = false;
                              if (isManual) {
                                if (manualTokens.has(token)) {
                                  isAddedTiming = true;
                                } else if (origTokens.size > 0 && !origTokens.has(token)) {
                                  isAddedTiming = true;
                                }
                              }

                              return (
                                <span
                                  key={idx}
                                  className={`px-2 py-0.5 rounded-lg text-xs font-bold font-mono transition-all inline-flex items-center gap-1.5 ${isAddedTiming
                                    ? 'bg-sky-950/90 text-sky-200 border border-sky-400 font-bold shadow-sm shadow-sky-500/20 ring-1 ring-sky-400/40'
                                    : isManual
                                      ? 'bg-violet-950/80 text-violet-200 border border-violet-700/70'
                                      : 'bg-slate-950 text-cyan-300 border border-slate-700/80'
                                    }`}
                                  title={isAddedTiming ? `Manually Added Timing: ${token}` : `Biometric Punch: ${token}`}
                                >
                                  {isAddedTiming && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block"></span>
                                  )}
                                  <span>{token}</span>
                                </span>
                              );
                            });
                          })()}
                        </div>
                      ) : (
                        <span className="text-slate-500 italic text-xs">No Swipe</span>
                      )}
                    </td>

                    {/* Shift Anchor */}
                    <td className="px-3 py-3 font-mono text-center">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-950/80 text-teal-300 border border-teal-700/60 shadow-sm">
                        {r.shift || '08:00'}
                      </span>
                    </td>

                    {/* Effective IN */}
                    <td className="px-4 py-3 font-mono text-center text-emerald-300 font-bold">
                      {r.effective_in || '—'}
                    </td>

                    {/* Effective OUT */}
                    <td className="px-4 py-3 font-mono text-center text-emerald-300 font-bold">
                      {r.effective_out || '—'}
                    </td>

                    {/* Regular Duty Hours (8h) */}
                    <td className="px-4 py-3 text-center font-mono text-slate-100 font-bold">
                      {formatHours(r.regular_hours)}
                    </td>

                    {/* Weekday OT Hours */}
                    <td className="px-4 py-3 text-center font-mono text-blue-300 font-bold">
                      {r.ot_hours > 0 ? formatHours(r.ot_hours) : '0h'}
                    </td>

                    {/* Sunday OT */}
                    <td className="px-4 py-3 text-center font-mono text-amber-300 font-bold">
                      {r.sunday_ot_hours > 0 ? `${formatHours(r.sunday_ot_hours)} ☀️` : '—'}
                    </td>

                    {/* Total Hours */}
                    <td className="px-4 py-3 text-center font-mono font-extrabold text-white text-base">
                      {formatHours(r.total_hours)}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3 text-center">
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${getStatusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>

                    {/* Action Button */}
                    <td className="px-4 py-3 text-center no-print">
                      <button
                        onClick={() => onEditRecord(r)}
                        className="p-1.5 rounded-lg bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-700 transition-all cursor-pointer"
                        title="Edit Record"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
