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
  onEditRecord 
}) {
  const [dragActive, setDragActive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkerModal, setSelectedWorkerModal] = useState(null);

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
      String(w.department || '').toLowerCase().includes(term)
    );
  }, [workers, searchTerm]);

  // Attendance for currently opened worker modal
  const selectedWorkerAttendance = useMemo(() => {
    if (!selectedWorkerModal) return [];
    return allAttendance.filter(r => String(r.staff_no) === String(selectedWorkerModal.staff_no));
  }, [allAttendance, selectedWorkerModal]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Top Banner / Upload Zone */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Drag & Drop Upload Zone */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white font-display">Biometric Report Import</h2>
              <p className="text-xs text-slate-400">Upload Excel (.xlsx/.xls) or Word (.docx/.doc) punch machine export</p>
            </div>
            <div className="flex space-x-2 text-xs font-semibold">
              <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
              </span>
              <span className="px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> Word
              </span>
            </div>
          </div>

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-7 text-center transition-all cursor-pointer ${
              dragActive
                ? 'border-indigo-500 bg-indigo-500/10 scale-[0.99]'
                : 'border-slate-700/80 hover:border-indigo-500/60 bg-slate-900/40 hover:bg-slate-900/60'
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
            <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-600/10">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-white mb-1">
              Drag & Drop your punch report here, or <span className="text-indigo-400 underline">Browse Files</span>
            </p>
            <p className="text-xs text-slate-400">
              Supports single or multi-worker sheets. Ditto marks (<code>"</code>) & merge cells auto-handled.
            </p>
          </div>
        </div>

        {/* Quick Snapshot Card */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Payroll Snapshot</span>
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-1">Total Net Payable Payroll</p>
            <p className="text-3xl font-extrabold text-white font-display tracking-tight">
              ₹{(metrics?.grandNet || 0).toLocaleString('en-IN')}
            </p>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Gross Payroll:</span>
                <span className="text-slate-200 font-mono font-medium">₹{(metrics?.grandGross || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Advances Deducted:</span>
                <span className="text-amber-400 font-mono font-medium">− ₹{(metrics?.grandAdvances || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <a
              href="/api/export/excel/timings"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Clock className="w-4 h-4 text-indigo-300" />
              <span>Download Daily Biometric Timings Sheet (.xlsx)</span>
            </a>

            <a
              href="/api/export/excel"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/30 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Download Full Factory Payroll Report (.xlsx)</span>
            </a>
          </div>
        </div>

      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Workers Metric */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Processed Workers</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white font-display mt-2">{metrics?.totalWorkers || 0}</p>
          <p className="text-xs text-slate-400 mt-1">Total active worker profiles</p>
        </div>

        {/* Total Attendance Days */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Attendance Days</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white font-display mt-2">{metrics?.totalRecords || 0}</p>
          <p className="text-xs text-slate-400 mt-1">Daily records evaluated</p>
        </div>

        {/* Flagged Incomplete Records */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Needs Review</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-400 font-display mt-2">{metrics?.incompleteCount || 0}</p>
          <p className="text-xs text-slate-400 mt-1">Odd count / missed swipe records</p>
        </div>

        {/* Total Advances */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Advances Ledger</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-purple-300 font-display mt-2">₹{(metrics?.grandAdvances || 0).toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-400 mt-1">Total advances issued this month</p>
        </div>

      </div>

      {/* SIMPLIFIED WORKER LIST & TIMING SELECTOR */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-xl space-y-4">
        
        {/* Header & Search */}
        <div className="p-6 border-b border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <span>Employees Biometric Timing Summary</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-medium border border-indigo-500/30">
                {filteredWorkers.length} Workers
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Click on any employee to view their specific daily punch timings, swipe pairs, and download their Excel report
            </p>
          </div>

          <div className="relative max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by worker name or staff no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Worker Summary Cards Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkers.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500">
              <Users className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
              No workers uploaded yet. Import an Excel or Word punch report above.
            </div>
          ) : (
            filteredWorkers.map(w => {
              const p = w.payroll || {};
              return (
                <div
                  key={w.staff_no}
                  onClick={() => setSelectedWorkerModal(w)}
                  className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60 transition-all cursor-pointer group shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
                        #{w.staff_no}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
                          {w.staff_name}
                        </h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold uppercase">
                          {w.department || 'WORKER'}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-4 gap-1.5 text-center text-xs">
                    <div className="bg-slate-950/60 rounded-xl p-2">
                      <p className="text-[9px] text-slate-400 font-semibold uppercase">Payable</p>
                      <p className="text-sm font-bold text-emerald-400 font-mono mt-0.5">{p.payableDays || 0}d</p>
                    </div>
                    <div className="bg-slate-950/60 rounded-xl p-2">
                      <p className="text-[9px] text-indigo-300 font-semibold uppercase">Wkday OT</p>
                      <p className="text-sm font-bold text-indigo-300 font-mono mt-0.5">{p.totalOtHours || 0}h</p>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2">
                      <p className="text-[9px] text-amber-400 font-semibold uppercase">Sun OT ☀️</p>
                      <p className="text-sm font-bold text-amber-300 font-mono mt-0.5">{(p.totalSundayOtHours || 0)}h</p>
                    </div>
                    <div className="bg-slate-950/60 rounded-xl p-2">
                      <p className="text-[9px] text-slate-400 font-semibold uppercase">Net Pay</p>
                      <p className="text-sm font-bold text-white font-mono mt-0.5">₹{(p.netPayable || 0).toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  <div className="mt-3 text-[11px] text-indigo-400 font-medium flex items-center justify-end gap-1 group-hover:underline">
                    <span>View Daily Timing Entries</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL: SINGLE WORKER SPECIFIC DAILY BIOMETRIC SWIPES & TIMINGS */}
      {selectedWorkerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="glass-modal w-full max-w-4xl max-h-[90vh] rounded-2xl p-6 shadow-2xl border border-slate-700/80 flex flex-col space-y-4 overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-lg border border-indigo-500/30">
                  #{selectedWorkerModal.staff_no}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white font-display flex items-center gap-2">
                    <span>{selectedWorkerModal.staff_name}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 uppercase font-semibold">
                      {selectedWorkerModal.department || 'WORKER'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Daily punch entries, swipe pairs, regular hours (8h duty), overtime (after 8h work + 30m lunch), and status
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <a
                  href={`/api/export/excel/worker/${selectedWorkerModal.staff_no}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center space-x-1.5 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Worker Excel Sheet</span>
                </a>

                <button
                  onClick={() => setSelectedWorkerModal(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Attendance Entries Table for Selected Worker */}
            <div className="flex-1 overflow-y-auto pr-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-900 z-10 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Date & Day</th>
                    <th className="py-3 px-4">Punch Swipes (Pairs)</th>
                    <th className="py-3 px-4">Effective IN</th>
                    <th className="py-3 px-4">Effective OUT</th>
                    <th className="py-3 px-4 text-center">Reg Hrs (8h Duty)</th>
                    <th className="py-3 px-4 text-center text-amber-400">OT Hrs (After 8h Work)</th>
                    <th className="py-3 px-4 text-center">Late Mins</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {selectedWorkerAttendance.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-500">
                        No daily punch records found for this worker.
                      </td>
                    </tr>
                  ) : (
                    selectedWorkerAttendance.map((r, idx) => {
                      const isShort = r.status.includes('Short');
                      const isAbsent = r.status.includes('Absent');
                      const isIncomplete = r.status.includes('Incomplete');
                      const isWeeklyPaid = r.status.includes('Weekly Off (Paid)');

                      let statusBadge = (
                        <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-300 font-semibold border border-emerald-500/20">
                          Present (Full)
                        </span>
                      );
                      if (isShort) {
                        statusBadge = (
                          <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/20">
                            Present (Short)
                          </span>
                        );
                      } else if (isAbsent) {
                        statusBadge = (
                          <span className="px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-300 font-semibold border border-rose-500/20">
                            Absent
                          </span>
                        );
                      } else if (isIncomplete) {
                        statusBadge = (
                          <span className="px-2.5 py-1 rounded-md bg-orange-500/10 text-orange-300 font-semibold border border-orange-500/20">
                            Incomplete
                          </span>
                        );
                      } else if (isWeeklyPaid) {
                        statusBadge = (
                          <span className="px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-300 font-semibold border border-sky-500/20">
                            Weekly Off (Paid)
                          </span>
                        );
                      }

                      return (
                        <tr key={`${r.date}-${idx}`} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-white">
                            {r.date} <span className="text-slate-500 text-[11px]">({r.weekday || ''})</span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-200">
                            {r.punchPairsFormatted ? (
                              <span className="bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-[11px] font-semibold text-indigo-300">
                                {r.punchPairsFormatted}
                              </span>
                            ) : r.raw_swipes ? (
                              <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800 text-[11px]">
                                {r.raw_swipes}
                              </span>
                            ) : (
                              <span className="text-slate-600 italic">No Swipes</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-emerald-300 font-medium">
                            {r.effective_in || '—'}
                          </td>
                          <td className="py-3 px-4 font-mono text-emerald-300 font-medium">
                            {r.effective_out || '—'}
                          </td>
                          <td className="py-3 px-4 font-mono text-center text-slate-200 font-medium">
                            {formatHours(r.regular_hours)}
                          </td>
                          <td className="py-3 px-4 font-mono text-center font-bold text-amber-400">
                            {r.ot_hours > 0 ? formatHours(r.ot_hours) : '0h'}
                          </td>
                          <td className="py-3 px-4 font-mono text-center text-rose-400 font-medium">
                            {r.late_minutes > 0 ? `${r.late_minutes}m` : '0m'}
                          </td>
                          <td className="py-3 px-4">
                            {statusBadge}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {onEditRecord && (
                              <button
                                onClick={() => {
                                  setSelectedWorkerModal(null);
                                  onEditRecord(r);
                                }}
                                className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20"
                                title="Edit Record"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
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
            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedWorkerModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl"
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
