import React, { useState, useMemo } from 'react';
import {
  UploadCloud,
  Users,
  AlertTriangle,
  DollarSign,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  ArrowRight,
  TrendingUp,
  Search,
  Filter,
  Calendar,
  Edit2,
  Edit3,
  CalendarDays,
  User,
  Download,
  X,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { formatHours } from '../utils/formatters';

export default function Dashboard({
  metrics,
  allAttendance = [],
  workers = [],
  onUploadFile,
  setActiveTab,
  onEditRecord,
  isPayrollUnlocked = false,
  onOpenUnlockModal,
  onOpenIncompleteManager,
  selectedMonth,
  availableMonths = [],
  onSelectMonth
}) {
  const [dragActive, setDragActive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkerModal, setSelectedWorkerModal] = useState(null);

  const monthQueryParam = selectedMonth && selectedMonth !== 'all' ? `?month=${selectedMonth}` : '';

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onUploadFile(e.target.files[0]);
    }
  };

  // Filtered workers list
  const filteredWorkers = useMemo(() => {
    if (!searchTerm.trim()) return workers;
    const term = searchTerm.toLowerCase();
    return workers.filter(w =>
      String(w.staff_no).toLowerCase().includes(term) ||
      String(w.staff_name).toLowerCase().includes(term) ||
      (w.department || '').toLowerCase().includes(term)
    );
  }, [workers, searchTerm]);

  // Attendance for currently opened worker modal
  const selectedWorkerAttendance = useMemo(() => {
    if (!selectedWorkerModal) return [];
    return allAttendance.filter(r => String(r.staff_no) === String(selectedWorkerModal.staff_no));
  }, [allAttendance, selectedWorkerModal]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-slate-100">

      {/* DETECTED ACTIVE MONTH BANNER WITH QUICK MONTH SWITCHER */}
      {metrics?.activeMonth?.monthName ? (
        <div className="glass-card rounded-2xl p-5 sm:p-6 border-2 border-blue-500/60 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 border border-blue-400 text-white flex items-center justify-center shadow-lg flex-shrink-0">
              <Calendar className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs uppercase font-extrabold text-blue-400 tracking-wider">
                  Active Attendance Month
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 font-bold border border-emerald-600 font-mono">
                  {metrics.activeMonth.totalDays} Days Cycle
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display mt-0.5 tracking-tight flex items-center gap-2">
                <span>{metrics.activeMonth.label}</span>
                <span className="text-xs font-normal text-slate-300 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700">
                  {metrics.totalWorkers || 0} Workers Enrolled
                </span>
              </h2>

              {/* Quick Month Switch Pills */}
              {availableMonths && availableMonths.length > 1 && onSelectMonth && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-400 mr-1">Switch Month:</span>
                  {availableMonths.map(m => {
                    const key = m.monthKey || m.month_key;
                    const label = m.label || m.month_label || key;
                    return (
                      <button
                        key={key}
                        onClick={() => onSelectMonth(key)}
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          selectedMonth === key
                            ? 'bg-blue-600 text-white border border-blue-400 shadow-sm'
                            : 'bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => onSelectMonth('all')}
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedMonth === 'all'
                        ? 'bg-blue-600 text-white border border-blue-400 shadow-sm'
                        : 'bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    All Records
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm font-mono">
            <div className="bg-slate-950/90 px-3.5 py-2 rounded-xl border border-slate-700">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Swipe Date Range</span>
              <span className="font-bold text-cyan-300">{metrics.activeMonth.startDate} ➔ {metrics.activeMonth.endDate}</span>
            </div>
            <div className="bg-slate-950/90 px-3.5 py-2 rounded-xl border border-slate-700">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Calendar Divisor</span>
              <span className="font-bold text-emerald-300">{metrics.activeMonth.totalDays} Days in Month</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Top Banner / Upload Zone */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Drag & Drop Upload Zone */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6 border-2 border-slate-700 shadow-md bg-slate-900">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white font-display">Biometric File Upload</h2>
              <p className="text-sm text-slate-300 font-medium mt-0.5">
                Upload raw Excel (.xlsx/.xls) or Word (.doc/.docx) machine export
              </p>
            </div>
            <div className="flex space-x-2 text-xs font-bold">
              <span className="px-3 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-600 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Excel
              </span>
              <span className="px-3 py-1 rounded-lg bg-blue-950 text-blue-300 border border-blue-600 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-400" /> Word
              </span>
            </div>
          </div>

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${dragActive
                ? 'border-blue-400 bg-blue-950/40 scale-[0.99]'
                : 'border-slate-600 hover:border-blue-400 bg-slate-950/60 hover:bg-slate-950'
              }`}
            onClick={() => document.getElementById('biometric-file-input').click()}
          >
            <input
              id="biometric-file-input"
              type="file"
              accept=".xlsx,.xls,.docx,.doc"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-blue-900/60 text-blue-300 border border-blue-600 flex items-center justify-center shadow-md">
              <UploadCloud className="w-8 h-8" />
            </div>
            <p className="text-base font-bold text-white mb-1">
              Click to select or Drag & Drop punch report file here
            </p>
            <p className="text-sm text-slate-300">
              Auto-detects shifts, monthly calendar days, 30m grace slabs & overtime.
            </p>
          </div>
        </div>

        {/* Quick Snapshot Card - Conditional for Payroll Lock */}
        <div className="glass-card rounded-2xl p-6 border-2 border-slate-700 shadow-md flex flex-col justify-between bg-slate-900">
          {isPayrollUnlocked ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Payroll Summary</span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-600 text-xs font-bold flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Total Net
                </span>
              </div>
              <p className="text-xs text-slate-400">Total Net Payable Amount</p>
              <div className="mt-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <p className="text-3xl font-extrabold text-emerald-300 font-mono tracking-tight">
                  ₹{(metrics?.grandNet || 0).toLocaleString('en-IN')}
                </p>
              </div>

              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between items-center text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-lg">
                  <span className="font-semibold">Gross Payroll:</span>
                  <span className="text-white font-mono font-bold">₹{(metrics?.grandGross || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-lg">
                  <span className="font-semibold">Advances Deducted:</span>
                  <span className="text-amber-300 font-mono font-bold">− ₹{(metrics?.grandAdvances || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Biometric Overview</span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-950 text-cyan-300 border border-blue-600 text-xs font-bold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Duty & OT
                </span>
              </div>
              <p className="text-xs text-slate-400">Total Processed Staff</p>
              <div className="mt-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <p className="text-3xl font-extrabold text-white font-mono tracking-tight">
                  {metrics?.totalWorkers || 0} <span className="text-lg font-normal text-slate-400">Workers</span>
                </p>
              </div>

              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between items-center text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-lg">
                  <span className="font-semibold">Total Punch Swipes:</span>
                  <span className="text-cyan-300 font-mono font-bold">{metrics?.totalRecords || 0} Logs</span>
                </div>
                <div className="flex justify-between items-center text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-lg">
                  <span className="font-semibold">Review Needed:</span>
                  <span className="text-amber-300 font-mono font-bold">{metrics?.incompleteCount || 0} Records</span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 space-y-2.5">
            {/* 1. Concise Summary */}
            <a
              href={`/api/export/excel/summary${monthQueryParam}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-600 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 border border-teal-500 shadow-md transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-teal-200" />
              <span>Download 5-Column Summary Report (.xlsx)</span>
            </a>

            {/* 2. Deducted Holidays & Offs Audit Report */}
            <a
              href={`/api/export/excel/deducted-holidays-and-offs${monthQueryParam}${metrics?.incompleteCount > 0 ? (monthQueryParam ? '&' : '?') + 'allow_incomplete=true' : ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 bg-rose-900/90 hover:bg-rose-800 text-rose-100 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 border border-rose-500 shadow-md transition-all cursor-pointer"
              title="Download detailed breakdown of forfeited Sundays, deducted paid holidays with exact reasons"
            >
              <FileSpreadsheet className="w-4 h-4 text-rose-300" />
              <span>Deducted Holidays & Forfeited Offs Report (.xlsx)</span>
            </a>

            {/* 3. Paid Holidays & Off-Days Duty Report */}
            <a
              href={`/api/export/excel/paid-holidays-and-off-duty${monthQueryParam}${metrics?.incompleteCount > 0 ? (monthQueryParam ? '&' : '?') + 'allow_incomplete=true' : ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 bg-indigo-800 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 border border-indigo-500 shadow-md transition-all cursor-pointer"
              title="Download paid holidays breakdown and workers who attended on off-days/Sundays with duty descriptions"
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-300" />
              <span>Paid Holidays & Off-Days Duty Report (.xlsx)</span>
            </a>

            {/* 4. Timings Sheet */}
            <a
              href={`/api/export/excel/timings${monthQueryParam}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-600 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 border border-blue-500 shadow-md transition-all cursor-pointer"
            >
              <Clock className="w-4 h-4 text-blue-200" />
              <span>Download Biometric Timings Sheet (.xlsx)</span>
            </a>

            {/* 5. Full Payroll (When Unlocked) */}
            {isPayrollUnlocked ? (
              <a
                href={`/api/export/excel${monthQueryParam}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 border border-emerald-500 shadow-md transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                <span>Download Full Payroll Report (.xlsx)</span>
              </a>
            ) : (
              <button
                onClick={onOpenUnlockModal}
                className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 border border-slate-600 transition-all cursor-pointer"
              >
                <span>🔒 Enter PIN to Unlock Financial / Salary Export</span>
              </button>
            )}

            {/* 6. Exception Download Option (if incomplete punches exist) */}
            {(metrics?.incompleteCount || 0) > 0 && (
              <a
                href={`/api/export/excel${monthQueryParam ? `${monthQueryParam}&allow_incomplete=true` : '?allow_incomplete=true'}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 px-3 bg-amber-950/70 hover:bg-amber-900/90 text-amber-300 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 border border-amber-600/70 transition-all cursor-pointer"
                title="Download Excel reports treating workers with unfixed timings as exceptions"
              >
                <span>⚡ Download All Reports (Allow Exception Workers / Unfixed Timings)</span>
              </a>
            )}
          </div>
        </div>

      </div>

      {/* FAST-FIX ACTION BANNER (When incomplete records exist) */}
      {metrics?.incompleteCount > 0 && (
        <div
          onClick={() => onOpenIncompleteManager && onOpenIncompleteManager()}
          className="cursor-pointer glass-card rounded-2xl p-4.5 border-2 border-amber-500/80 bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-amber-400 transition-all group"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-slate-950 font-black flex items-center justify-center shadow-lg shadow-amber-500/30 animate-pulse shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black text-white group-hover:text-amber-300 transition-colors flex items-center gap-2 flex-wrap">
                <span>⚡ Action Required: {metrics.incompleteCount} Incomplete Records Found!</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold font-mono">
                  Fast-Fix Ready
                </span>
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                Worker salary & duty calculations are on hold. Click here to open the Fast-Fix Center and resolve all missing swipes at once.
              </p>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenIncompleteManager && onOpenIncompleteManager(); }}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-amber-500/20 transition-all shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Open Fast-Fix Manager</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metrics Row - Large & High Contrast */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

        {/* Workers Metric */}
        <div className="glass-card rounded-2xl p-5 border-2 border-slate-700 bg-slate-900 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Processed Workers</span>
            <div className="w-10 h-10 rounded-xl bg-blue-950 text-blue-300 border border-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-white font-mono mt-2">{metrics?.totalWorkers || 0}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">Active worker profiles</p>
        </div>

        {/* Total Attendance Days */}
        <div className="glass-card rounded-2xl p-5 border-2 border-slate-700 bg-slate-900 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Attendance Days</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-300 font-mono mt-2">{metrics?.totalRecords || 0}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">Total evaluated logs</p>
        </div>

        {/* Flagged Incomplete Records (Clickable to open Fast-Fix Manager) */}
        <div
          onClick={() => onOpenIncompleteManager && onOpenIncompleteManager()}
          className={`glass-card rounded-2xl p-5 border-2 bg-slate-900 shadow-md transition-all ${(metrics?.incompleteCount || 0) > 0
              ? 'border-amber-500/80 hover:border-amber-400 cursor-pointer hover:scale-[1.02] ring-2 ring-amber-500/20'
              : 'border-slate-700'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Review Needed</span>
            <div className="w-10 h-10 rounded-xl bg-amber-950 text-amber-300 border border-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <p className="text-3xl font-extrabold text-amber-300 font-mono">{metrics?.incompleteCount || 0}</p>
            {(metrics?.incompleteCount || 0) > 0 && (
              <span className="text-[11px] font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-600">
                Click to Fix ➔
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1 font-medium">Single punch / missed swipes</p>
        </div>

        {/* 4th Metric Card: Advances if Unlocked, or Status Breakdown */}
        {isPayrollUnlocked ? (
          <div className="glass-card rounded-2xl p-5 border-2 border-slate-700 bg-slate-900 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Advances Total</span>
              <div className="w-10 h-10 rounded-xl bg-purple-950 text-purple-300 border border-purple-600 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-amber-300 font-mono mt-2">
              ₹{(metrics?.grandAdvances || 0).toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-slate-400 mt-1 font-medium">Total advance deductions</p>
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-5 border-2 border-slate-700 bg-slate-900 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Present Days</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-emerald-300 font-mono mt-2">
              {metrics?.statusBreakdown?.['Present (Full)'] || 0}
            </p>
            <p className="text-xs text-slate-400 mt-1 font-medium">Full present worker days</p>
          </div>
        )}

      </div>

      {/* WORKER TIMINGS SUMMARY CARDS */}
      <div className="glass-card rounded-2xl border-2 border-slate-700 overflow-hidden shadow-lg space-y-4 bg-slate-900">

        {/* Header & Search */}
        <div className="p-6 border-b border-slate-700 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-white font-display flex items-center gap-2.5">
              <Users className="w-6 h-6 text-blue-400" />
              <span>Employees Biometric Timing Summary</span>
              <span className="text-xs px-3 py-1 rounded-full bg-blue-950 text-blue-300 font-mono font-bold border border-blue-600">
                {filteredWorkers.length} Workers
              </span>
            </h3>
            <p className="text-sm text-slate-300 mt-1 font-medium">
              Click on any employee to view their daily swipe times, regular 8h duty, and overtime breakdown
            </p>
          </div>

          <div className="relative max-w-sm w-full">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or Staff No..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>
        </div>

        {/* Worker Summary Cards Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredWorkers.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 text-base">
              <Users className="w-10 h-10 mx-auto text-slate-500 mb-2 opacity-50" />
              No workers uploaded yet. Import an Excel or Word punch report above.
            </div>
          ) : (
            filteredWorkers.map(w => {
              const p = w.payroll || {};
              const totalOtSum = (p.totalOtHours || 0) + (p.totalSundayOtHours || 0);

              return (
                <div
                  key={w.staff_no}
                  onClick={() => setSelectedWorkerModal(w)}
                  className="p-5 rounded-2xl bg-slate-950 border-2 border-slate-700 hover:border-blue-400 hover:bg-slate-900 transition-all cursor-pointer group shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3.5">
                      <div className="px-3 py-2 rounded-xl bg-blue-950 text-cyan-300 border border-blue-700 font-mono font-bold text-base">
                        #{w.staff_no}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors">
                          {w.staff_name}
                        </h4>
                        <span className="text-xs px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold uppercase border border-slate-700">
                          {w.department || 'WORKER'}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-slate-400 group-hover:text-blue-300 transition-colors" />
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-700 grid grid-cols-4 gap-2 text-center">
                    <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                      <p className="text-[11px] text-slate-400 font-bold uppercase whitespace-nowrap">Payable</p>
                      <p className="text-base font-extrabold text-emerald-300 font-mono mt-0.5 whitespace-nowrap">{p.payableDays || 0}d</p>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                      <p className="text-[11px] text-blue-300 font-bold uppercase whitespace-nowrap">Wkday OT</p>
                      <p className="text-base font-extrabold text-blue-300 font-mono mt-0.5 whitespace-nowrap">{p.totalOtHours || 0}h</p>
                    </div>
                    <div className="bg-amber-950/60 border border-amber-600/50 p-2 rounded-xl">
                      <p className="text-[11px] text-amber-300 font-bold uppercase whitespace-nowrap">Sun OT ☀️</p>
                      <p className="text-base font-extrabold text-amber-300 font-mono mt-0.5 whitespace-nowrap">{p.totalSundayOtHours || 0}h</p>
                    </div>
                    {isPayrollUnlocked ? (
                      <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                        <p className="text-[11px] text-slate-400 font-bold uppercase whitespace-nowrap">Net Pay</p>
                        <p className="text-sm font-extrabold text-white font-mono mt-0.5 whitespace-nowrap">₹{(p.netPayable || 0).toLocaleString('en-IN')}</p>
                      </div>
                    ) : (
                      <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                        <p className="text-[11px] text-cyan-300 font-bold uppercase whitespace-nowrap">Total OT</p>
                        <p className="text-sm font-extrabold text-cyan-300 font-mono mt-0.5 whitespace-nowrap">{totalOtSum > 0 ? formatHours(totalOtSum) : '0h'}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 text-xs text-blue-400 font-bold flex items-center justify-end gap-1 group-hover:underline">
                    <span>View Daily Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL: SINGLE WORKER SPECIFIC DAILY BIOMETRIC SWIPES & TIMINGS */}
      {selectedWorkerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
          <div className="glass-modal w-full max-w-5xl max-h-[90vh] rounded-2xl p-6 shadow-2xl border-2 border-slate-600 flex flex-col space-y-4 overflow-hidden bg-slate-900">

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-700 pb-4">
              <div className="flex items-center space-x-3.5">
                <div className="px-3.5 py-2 rounded-xl bg-blue-950 text-cyan-300 border border-blue-600 font-bold text-lg font-mono">
                  #{selectedWorkerModal.staff_no}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white font-display flex items-center gap-2.5">
                    <span>{selectedWorkerModal.staff_name}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200 uppercase font-bold border border-slate-700">
                      {selectedWorkerModal.department || 'WORKER'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 font-medium">
                    Daily swipe records, effective times, regular hours (8h duty), and overtime
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2.5">
                <a
                  href={`/api/export/excel/worker/${selectedWorkerModal.staff_no}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-md border border-emerald-500 flex items-center space-x-1.5 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Worker Excel</span>
                </a>

                <button
                  onClick={() => setSelectedWorkerModal(null)}
                  className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Attendance Entries Table for Selected Worker */}
            <div className="flex-1 overflow-y-auto overflow-x-auto max-h-[68vh] relative rounded-xl border border-slate-700">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 bg-slate-950 z-20 border-b-2 border-slate-700 text-xs font-bold uppercase tracking-wider text-slate-200 shadow-md">
                  <tr className="divide-x divide-slate-800">
                    <th className="py-3 px-4 bg-slate-950">Date & Day</th>
                    <th className="py-3 px-4 bg-slate-950">Punch Swipes (Pairs)</th>
                    <th className="py-3 px-3 text-center text-teal-300 bg-slate-950">Shift</th>
                    <th className="py-3 px-4 text-center bg-slate-950">Effective IN</th>
                    <th className="py-3 px-4 text-center bg-slate-950">Effective OUT</th>
                    <th className="py-3 px-4 text-center bg-slate-950">Reg Hrs (8h Duty)</th>
                    <th className="py-3 px-4 text-center text-amber-300 bg-slate-950">OT Hrs</th>
                    <th className="py-3 px-4 text-center bg-slate-950">Late Mins</th>
                    <th className="py-3 px-4 bg-slate-950">Status</th>
                    <th className="py-3 px-4 text-right bg-slate-950">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {selectedWorkerAttendance.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="py-12 text-center text-slate-400 text-base">
                        No daily punch records found for this worker.
                      </td>
                    </tr>
                  ) : (
                    selectedWorkerAttendance.map((r, idx) => {
                      const isShort = r.status.includes('Short');
                      const isAbsentOT = r.status.includes('Absent (OT Credited)');
                      const isAbsent = r.status.includes('Absent');
                      const isIncomplete = r.status.includes('Incomplete');
                      const isWeeklyPaid = r.status.includes('Weekly Off (Paid)');
                      const isWeeklyOT = r.status.includes('Worked OT');

                      let statusBadge = (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 font-bold text-xs border border-emerald-600">
                          Present (Full)
                        </span>
                      );
                      if (isAbsentOT) {
                        statusBadge = (
                          <span className="px-2.5 py-1 rounded-lg bg-cyan-950 text-cyan-300 font-bold text-xs border border-cyan-500">
                            Absent (OT Credited)
                          </span>
                        );
                      } else if (isShort) {
                        statusBadge = (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-950 text-amber-300 font-bold text-xs border border-amber-600">
                            Present (Short)
                          </span>
                        );
                      } else if (isAbsent) {
                        statusBadge = (
                          <span className="px-2.5 py-1 rounded-lg bg-rose-950 text-rose-300 font-bold text-xs border border-rose-600">
                            Absent
                          </span>
                        );
                      } else if (isIncomplete) {
                        statusBadge = (
                          <span className="px-2.5 py-1 rounded-lg bg-orange-950 text-orange-300 font-bold text-xs border border-orange-600">
                            Incomplete
                          </span>
                        );
                      } else if (isWeeklyOT) {
                        statusBadge = (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-950 text-amber-300 font-bold text-xs border border-amber-600">
                            Weekly Off (Worked OT)
                          </span>
                        );
                      } else if (isWeeklyPaid) {
                        statusBadge = (
                          <span className="px-2.5 py-1 rounded-lg bg-blue-950 text-blue-300 font-bold text-xs border border-blue-600">
                            Weekly Off (Paid)
                          </span>
                        );
                      }

                      const isManual = r.is_manual_override === 1 || r.is_manual_override === true;

                      return (
                        <tr
                          key={`${r.date}-${idx}`}
                          className={`transition-colors divide-x divide-slate-800/80 ${isManual
                              ? 'bg-violet-950/25 hover:bg-violet-900/35 border-l-4 border-l-violet-500'
                              : 'even:bg-slate-950/40 odd:bg-slate-900/60 hover:bg-slate-800/90'
                            }`}
                        >
                          <td className="py-3 px-4 font-mono font-bold text-white whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <span>{r.date} <span className="text-slate-400 font-normal">({r.weekday || ''})</span></span>
                              {isManual && (
                                <span
                                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-900/90 text-violet-200 border border-violet-500 flex items-center gap-1 shadow-sm"
                                  title={r.override_reason || 'Manual Admin Correction'}
                                >
                                  <Edit3 className="w-2.5 h-2.5 text-violet-300" />
                                  <span>Manual Edit</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-200">
                            {r.raw_swipes ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {(() => {
                                  const currentTokens = (r.raw_swipes || '').split(/\s+/).filter(Boolean);
                                  const manualTokens = new Set((r.manual_punches || '').split(/\s+/).filter(Boolean));
                                  const origTokens = new Set((r.original_raw_swipes || '').split(/\s+/).filter(Boolean));
                                  
                                  return currentTokens.map((token, tokenIdx) => {
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
                                        key={tokenIdx}
                                        className={`px-2 py-0.5 rounded-lg text-xs font-bold font-mono transition-all inline-flex items-center gap-1.5 ${
                                          isAddedTiming
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
                              <span className="text-slate-500 italic text-xs">No Swipes</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-950/80 text-teal-300 border border-teal-700/60 shadow-sm">
                              {r.shift || '08:00'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-center text-emerald-300 font-bold whitespace-nowrap">
                            {r.effective_in || '—'}
                          </td>
                          <td className="py-3 px-4 font-mono text-center text-emerald-300 font-bold whitespace-nowrap">
                            {r.effective_out || '—'}
                          </td>
                          <td className="py-3 px-4 font-mono text-center text-slate-100 font-bold whitespace-nowrap">
                            {formatHours(r.regular_hours)}
                          </td>
                          <td className="py-3 px-4 font-mono text-center font-extrabold text-amber-300 whitespace-nowrap">
                            {r.ot_hours > 0 ? formatHours(r.ot_hours) : '0h'}
                          </td>
                          <td className="py-3 px-4 font-mono text-center text-rose-300 font-bold whitespace-nowrap">
                            {r.late_minutes > 0 ? `${r.late_minutes}m` : '0m'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {statusBadge}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {onEditRecord && (
                              <button
                                onClick={() => {
                                  setSelectedWorkerModal(null);
                                  onEditRecord(r);
                                }}
                                className="p-2 rounded-lg bg-blue-900/60 text-blue-300 hover:bg-blue-800 border border-blue-700"
                                title="Edit Record"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t-2 border-slate-700 flex justify-end">
              <button
                onClick={() => setSelectedWorkerModal(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl border border-slate-600"
              >
                Close View
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
