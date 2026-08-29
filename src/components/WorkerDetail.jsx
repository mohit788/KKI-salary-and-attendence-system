import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Printer, 
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
  ShieldCheck
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
  onOpenUnlockModal
}) {
  const [workerSearchTerm, setWorkerSearchTerm] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

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
      
      {/* Top Action Bar with Quick Worker Searcher & Prev/Next Switcher */}
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

        {/* Center/Right: Quick Search Switcher Dropdown & Action Buttons */}
        <div className="flex items-center space-x-2.5 flex-wrap gap-y-2 justify-between lg:justify-end">
          
          {/* Quick Worker Search Bar */}
          {onSelectWorker && workers.length > 0 && (
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Switch worker (Name / ID)..."
                value={workerSearchTerm}
                onChange={(e) => {
                  setWorkerSearchTerm(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onFocus={() => setShowSearchDropdown(true)}
                className="w-full bg-slate-950 border-2 border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none transition-all shadow-inner"
              />

              {showSearchDropdown && workerSearchTerm.trim() && (
                <>
                  <div 
                    className="fixed inset-0 z-30" 
                    onClick={() => setShowSearchDropdown(false)}
                  />
                  <div className="absolute left-0 top-full mt-1.5 w-72 max-h-60 overflow-y-auto bg-slate-900 border-2 border-slate-700 rounded-2xl shadow-2xl z-40 p-1.5 divide-y divide-slate-800">
                    {filteredWorkersList.length === 0 ? (
                      <div className="py-3 text-center text-xs text-slate-400">No worker matched</div>
                    ) : (
                      filteredWorkersList.slice(0, 10).map(w => (
                        <button
                          key={w.staff_no}
                          onClick={() => {
                            onSelectWorker(w.staff_no);
                            setWorkerSearchTerm('');
                            setShowSearchDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-slate-800 transition-colors flex items-center justify-between cursor-pointer ${
                            String(w.staff_no) === String(staffNo) ? 'bg-blue-950/70 border border-blue-600 text-cyan-300 font-bold' : 'text-slate-200'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-cyan-400 font-bold">#{w.staff_no}</span>
                            <span className="font-bold text-white">{w.staff_name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">{w.department || 'WORKER'}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {isPayrollUnlocked && (
            <button
              onClick={() => onAddAdvance(staffNo)}
              className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-600 transition-all cursor-pointer shadow-sm"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Add Advance</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-700 hover:bg-blue-600 text-white shadow-md border border-blue-500 transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

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
              <div className="flex items-center gap-2.5">
                <h2 className="text-2xl font-extrabold text-white font-display">{worker.staff_name}</h2>
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
                    className={`transition-colors divide-x divide-slate-800/80 ${
                      isManual 
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

                    {/* Raw Swipes - VISUALLY HIGHLIGHTED FOR MANUAL EDITS */}
                    <td className="px-4 py-3 font-mono text-slate-200">
                      {r.raw_swipes ? (
                        <span className={`px-2.5 py-1 rounded border text-xs font-bold font-mono transition-all inline-block ${
                          isManual 
                            ? 'bg-violet-950 text-violet-200 border-violet-400 shadow-md shadow-violet-950/50 ring-1 ring-violet-500' 
                            : 'bg-slate-950 text-cyan-300 border-slate-700'
                        }`}
                        title={isManual ? `Manually adjusted punch: ${r.override_reason || 'Admin Correction'}` : 'Biometric Machine Punch'}
                        >
                          {r.raw_swipes}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">No Swipe</span>
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
