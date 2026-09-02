import React, { useState, useEffect, useMemo } from 'react';
import {
  Star,
  ShieldCheck,
  Search,
  CheckCircle2,
  X,
  Users,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Filter,
  CheckSquare,
  Square,
  RefreshCw,
  Zap,
  Check,
  UserX,
  UserCheck,
  Lock
} from 'lucide-react';

const COMMON_REASONS = [
  'Director / Senior Management',
  'Field Staff / Client Visits',
  'Flexible Hours Exemption',
  'Biometric Sensor Malfunction Exemption',
  'Contractor / Special Consultant',
  'Custom Management Approval'
];

export default function ExceptionManagerModal({
  isOpen,
  onClose,
  workers = [],
  onRefreshData,
  onOpenIncompleteManager
}) {
  if (!isOpen) return null;

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'exception' | 'standard'
  const [selectedStaffNos, setSelectedStaffNos] = useState(new Set());
  const [customReason, setCustomReason] = useState('Director / Senior Management');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Local optimistic state
  const [localWorkers, setLocalWorkers] = useState(workers);

  useEffect(() => {
    setLocalWorkers(workers);
  }, [workers]);

  // Derived counts
  const exceptionWorkers = useMemo(() => {
    return localWorkers.filter(w => w.is_exception === 1 || ['exempt', 'flexible', 'exception'].includes(w.assigned_shift));
  }, [localWorkers]);

  const standardWorkers = useMemo(() => {
    return localWorkers.filter(w => w.is_exception !== 1 && !['exempt', 'flexible', 'exception'].includes(w.assigned_shift));
  }, [localWorkers]);

  // Filtered workers based on search and active tab
  const filteredWorkers = useMemo(() => {
    let list = localWorkers;
    if (filterTab === 'exception') {
      list = exceptionWorkers;
    } else if (filterTab === 'standard') {
      list = standardWorkers;
    }

    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase().trim();
    return list.filter(w =>
      String(w.staff_no).toLowerCase().includes(term) ||
      String(w.staff_name || '').toLowerCase().includes(term) ||
      String(w.department || '').toLowerCase().includes(term) ||
      String(w.exception_reason || '').toLowerCase().includes(term)
    );
  }, [localWorkers, filterTab, exceptionWorkers, standardWorkers, searchTerm]);

  // Checkbox handling
  const allFilteredSelected = filteredWorkers.length > 0 && filteredWorkers.every(w => selectedStaffNos.has(String(w.staff_no)));
  const someFilteredSelected = filteredWorkers.some(w => selectedStaffNos.has(String(w.staff_no)));

  const handleToggleSelectAll = () => {
    const next = new Set(selectedStaffNos);
    if (allFilteredSelected) {
      filteredWorkers.forEach(w => next.delete(String(w.staff_no)));
    } else {
      filteredWorkers.forEach(w => next.add(String(w.staff_no)));
    }
    setSelectedStaffNos(next);
  };

  const handleToggleSelectOne = (staffNo) => {
    const key = String(staffNo);
    const next = new Set(selectedStaffNos);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedStaffNos(next);
  };

  // Single Worker Toggle
  const handleToggleSingleWorker = async (staffNo, targetException, reason = '') => {
    const sNoStr = String(staffNo);
    const effectiveReason = reason || customReason || 'Management Exception';

    // Optimistic update
    setLocalWorkers(prev =>
      prev.map(w => (String(w.staff_no) === sNoStr ? { ...w, is_exception: targetException ? 1 : 0, exception_reason: targetException ? effectiveReason : '' } : w))
    );

    try {
      const res = await fetch(`/api/workers/${sNoStr}/toggle-exception`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_exception: targetException ? 1 : 0, reason: effectiveReason })
      }).then(r => r.json());

      if (res.success) {
        setSuccessMsg(targetException ? `Worker #${sNoStr} marked as Exception (Exempt from Missing Punches).` : `Worker #${sNoStr} reverted to Standard.`);
        if (onRefreshData) onRefreshData();
      } else {
        alert('Exception update failed: ' + res.error);
        if (onRefreshData) onRefreshData();
      }
    } catch (err) {
      alert('Network error: ' + err.message);
      if (onRefreshData) onRefreshData();
    }
  };

  // Batch Action (Mark as Exception or Revert)
  const handleBatchUpdate = async (isException) => {
    if (selectedStaffNos.size === 0) return;
    const staffNosArray = Array.from(selectedStaffNos);
    const effectiveReason = customReason || 'Batch Management Exception';

    setLoading(true);

    // Optimistic update
    setLocalWorkers(prev =>
      prev.map(w => (selectedStaffNos.has(String(w.staff_no)) ? { ...w, is_exception: isException ? 1 : 0, exception_reason: isException ? effectiveReason : '' } : w))
    );

    try {
      const res = await fetch('/api/workers/batch-exception', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_nos: staffNosArray, is_exception: isException ? 1 : 0, reason: effectiveReason })
      }).then(r => r.json());

      if (res.success) {
        setSuccessMsg(`Successfully updated ${staffNosArray.length} worker(s) to ${isException ? '⭐ Exception' : 'Standard'}.`);
        setSelectedStaffNos(new Set());
        if (onRefreshData) await onRefreshData();
      } else {
        alert('Batch update error: ' + res.error);
      }
    } catch (err) {
      alert('Batch update failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="glass-modal w-full max-w-5xl max-h-[92vh] rounded-3xl p-5 sm:p-7 shadow-2xl border-2 border-amber-500/60 flex flex-col space-y-4 overflow-hidden bg-slate-900 text-slate-100">

        {/* Modal Top Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-700/80 pb-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 font-black shrink-0">
              <Star className="w-7 h-7 fill-slate-950 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight">
                  Exception & Exempt Workers Manager
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500/80 font-mono text-xs font-extrabold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {exceptionWorkers.length} Exempt Active
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
                Mark directors, flexible workers, or field staff as Exception. Their incomplete punches will not lock reports and are hidden from Fast-Fix Manager.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Success Alert Banner */}
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/80 text-emerald-200 text-xs font-bold flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Active Exception Workers Summary Chips */}
        {exceptionWorkers.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 space-y-2">
            <div className="flex items-center justify-between text-xs font-extrabold text-amber-300">
              <span className="flex items-center gap-1.5 uppercase tracking-wider">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                Active Exception Personnel ({exceptionWorkers.length})
              </span>
              <span className="text-[11px] text-slate-400 font-normal">Click (×) to revert worker to standard</span>
            </div>
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
              {exceptionWorkers.map(w => (
                <div
                  key={w.staff_no}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 border border-amber-500/60 text-xs font-bold text-amber-200 shadow-sm"
                >
                  <span className="font-mono text-cyan-300 font-extrabold">#{w.staff_no}</span>
                  <span className="text-white">{w.staff_name}</span>
                  {w.exception_reason && (
                    <span className="text-[10px] text-slate-400 font-normal truncate max-w-[120px]">
                      ({w.exception_reason})
                    </span>
                  )}
                  <button
                    onClick={() => handleToggleSingleWorker(w.staff_no, false)}
                    title="Remove from Exception"
                    className="ml-1 text-slate-400 hover:text-rose-400 p-0.5 rounded transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search, Filter Tabs & Selection Toolbar */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Staff ID (e.g. 101) or Worker Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border-2 border-slate-700 rounded-xl pl-10 pr-9 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 font-medium"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-700 shrink-0">
              <button
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterTab === 'all'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Workers ({localWorkers.length})
              </button>
              <button
                onClick={() => setFilterTab('exception')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  filterTab === 'exception'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Star className={`w-3 h-3 ${filterTab === 'exception' ? 'fill-slate-950' : 'fill-amber-400'}`} />
                <span>Exceptions ({exceptionWorkers.length})</span>
              </button>
              <button
                onClick={() => setFilterTab('standard')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterTab === 'standard'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Standard ({standardWorkers.length})
              </button>
            </div>
          </div>

          {/* Bulk Action Bar (Active when workers are selected) */}
          <div className="p-3 rounded-2xl bg-slate-950 border-2 border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleToggleSelectAll}
                className="flex items-center space-x-2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-800"
              >
                {allFilteredSelected ? (
                  <CheckSquare className="w-4 h-4 text-amber-400" />
                ) : someFilteredSelected ? (
                  <div className="w-4 h-4 border-2 border-amber-400 bg-amber-400/40 rounded flex items-center justify-center">
                    <div className="w-2 h-0.5 bg-white" />
                  </div>
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
                <span>Select All Filtered ({filteredWorkers.length})</span>
              </button>

              {selectedStaffNos.size > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-blue-950 text-cyan-300 border border-blue-600 font-mono text-xs font-extrabold">
                  {selectedStaffNos.size} Selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Reason Selector / Input */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400">Reason:</span>
                <select
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-medium focus:outline-none focus:border-amber-500"
                >
                  {COMMON_REASONS.map((r, i) => (
                    <option key={i} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Bulk Add Button */}
              <button
                disabled={selectedStaffNos.size === 0 || loading}
                onClick={() => handleBatchUpdate(true)}
                className={`px-4 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                  selectedStaffNos.size > 0
                    ? 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-amber-500/20'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
              >
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>Mark Selected as Exception ({selectedStaffNos.size})</span>
              </button>

              {/* Bulk Remove Button */}
              <button
                disabled={selectedStaffNos.size === 0 || loading}
                onClick={() => handleBatchUpdate(false)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                  selectedStaffNos.size > 0
                    ? 'bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-600/60'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
              >
                <UserX className="w-3.5 h-3.5" />
                <span>Remove Exception</span>
              </button>
            </div>
          </div>
        </div>

        {/* Workers List Table */}
        <div className="flex-1 overflow-y-auto overflow-x-auto max-h-[52vh] rounded-2xl border-2 border-slate-700 bg-slate-950">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="sticky top-0 bg-slate-900 z-10 border-b-2 border-slate-700 text-xs font-bold uppercase tracking-wider text-slate-300 shadow-md">
              <tr className="divide-x divide-slate-800">
                <th className="py-3 px-3.5 text-center w-12">
                  <span className="sr-only">Select</span>
                </th>
                <th className="py-3 px-4">Staff ID</th>
                <th className="py-3 px-4">Worker Name & Department</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Exception Reason</th>
                <th className="py-3 px-4 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-50" />
                    No workers matched your search criteria.
                  </td>
                </tr>
              ) : (
                filteredWorkers.map(w => {
                  const isEx = w.is_exception === 1 || ['exempt', 'flexible', 'exception'].includes(w.assigned_shift);
                  const isSelected = selectedStaffNos.has(String(w.staff_no));

                  return (
                    <tr
                      key={w.staff_no}
                      onClick={() => handleToggleSelectOne(w.staff_no)}
                      className={`hover:bg-slate-900/90 transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-950/40' : isEx ? 'bg-amber-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(w.staff_no)}
                          className="w-4 h-4 rounded text-amber-500 bg-slate-800 border-slate-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Staff ID */}
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-950 text-cyan-300 border border-blue-800 font-mono font-bold text-xs">
                          #{w.staff_no}
                        </span>
                      </td>

                      {/* Name & Dept */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>{w.staff_name}</span>
                          {isEx && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black flex items-center gap-0.5">
                              <Star className="w-2.5 h-2.5 fill-current" /> EXEMPT
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-medium">
                          {w.department || 'GENERAL'}
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4 text-center">
                        {isEx ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-600 font-bold text-xs">
                            <Star className="w-3 h-3 fill-amber-400" />
                            Exception Worker
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-bold text-xs">
                            Standard Tracking
                          </span>
                        )}
                      </td>

                      {/* Reason */}
                      <td className="py-3 px-4 text-xs text-slate-300">
                        {isEx ? (
                          <span className="text-amber-200 font-medium">
                            {w.exception_reason || 'Management Exemption'}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">None</span>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {isEx ? (
                          <button
                            onClick={() => handleToggleSingleWorker(w.staff_no, false)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-600/50 font-bold text-xs transition-all cursor-pointer"
                          >
                            Remove Exception
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleSingleWorker(w.staff_no, true)}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1 ml-auto transition-all cursor-pointer"
                          >
                            <Star className="w-3 h-3 fill-current" />
                            <span>Set Exception</span>
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

        {/* Modal Bottom Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t-2 border-slate-700/80 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Exception workers are exempted from missing punch validation locks & will not appear in the Fast-Fix Manager.
            </span>
          </div>

          <div className="flex items-center gap-2.5 justify-end">
            {onOpenIncompleteManager && (
              <button
                onClick={() => {
                  onClose();
                  onOpenIncompleteManager();
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold border border-slate-600 transition-all cursor-pointer"
              >
                Go to Fast-Fix Center ➔
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black transition-all shadow-md cursor-pointer"
            >
              Done / Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
