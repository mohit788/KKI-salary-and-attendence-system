import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Search, 
  Sparkles, 
  Save, 
  Clock, 
  UserCheck, 
  CheckSquare, 
  Square,
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

export default function IncompleteManagerModal({ 
  isOpen, 
  onClose, 
  onRefreshData,
  initialStaffNo = null 
}) {
  if (!isOpen) return null;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [rowEdits, setRowEdits] = useState({}); // key: `${staff_no}_${date}` -> { raw_swipes, status }
  const [globalSuccessMsg, setGlobalSuccessMsg] = useState('');

  // Fetch incomplete records from server
  const fetchIncomplete = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/attendance/incomplete').then(r => r.json());
      if (res.success) {
        setRecords(res.incompleteRecords || []);
        // Initialize editable state
        const initialEdits = {};
        (res.incompleteRecords || []).forEach(r => {
          const key = `${r.staff_no}_${r.date}`;
          initialEdits[key] = {
            raw_swipes: r.raw_swipes || '',
            status: r.status || 'Present (Full)'
          };
        });
        setRowEdits(initialEdits);
      }
    } catch (err) {
      console.error('Error fetching incomplete records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncomplete();
  }, [isOpen]);

  const filteredRecords = records.filter(r => {
    if (initialStaffNo && String(r.staff_no) !== String(initialStaffNo)) return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (r.staff_name || '').toLowerCase().includes(term) ||
      (r.staff_no || '').toString().includes(term) ||
      (r.date || '').includes(term) ||
      (r.department || '').toLowerCase().includes(term)
    );
  });

  const handleSelectAll = () => {
    if (selectedIds.size === filteredRecords.length) {
      setSelectedIds(new Set());
    } else {
      const newSelected = new Set(filteredRecords.map(r => `${r.staff_no}_${r.date}`));
      setSelectedIds(newSelected);
    }
  };

  const handleToggleSelect = (key) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(key)) newSelected.delete(key);
    else newSelected.add(key);
    setSelectedIds(newSelected);
  };

  const handleInputChange = (key, field, val) => {
    setRowEdits(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: val
      }
    }));
  };

  // Append a closing punch timestamp to an existing swipe string
  const handleQuickAppend = (key, currentSwipes, closingPunch, newStatus = 'Present (Full)') => {
    const trimmed = (currentSwipes || '').trim();
    let updated = '';
    if (!trimmed) {
      updated = `08:00 ${closingPunch}`;
    } else {
      updated = `${trimmed} ${closingPunch}`;
    }
    setRowEdits(prev => ({
      ...prev,
      [key]: {
        raw_swipes: updated,
        status: newStatus
      }
    }));
  };

  const handleBatchAppend = (closingPunch, newStatus = 'Present (Full)') => {
    if (selectedIds.size === 0) return;
    setRowEdits(prev => {
      const next = { ...prev };
      selectedIds.forEach(key => {
        const cur = next[key]?.raw_swipes || '';
        const trimmed = cur.trim();
        next[key] = {
          raw_swipes: trimmed ? `${trimmed} ${closingPunch}` : `08:00 ${closingPunch}`,
          status: newStatus
        };
      });
      return next;
    });
  };

  const handleBatchMarkAbsent = () => {
    if (selectedIds.size === 0) return;
    setRowEdits(prev => {
      const next = { ...prev };
      selectedIds.forEach(key => {
        next[key] = {
          raw_swipes: next[key]?.raw_swipes || '',
          status: 'Absent'
        };
      });
      return next;
    });
  };

  // Submit all modified records
  const handleSaveAll = async () => {
    setSaving(true);
    setGlobalSuccessMsg('');

    try {
      const updates = [];
      records.forEach(r => {
        const key = `${r.staff_no}_${r.date}`;
        const edit = rowEdits[key];
        if (edit) {
          updates.push({
            staff_no: r.staff_no,
            date: r.date,
            raw_swipes: edit.raw_swipes,
            status: edit.status,
            reason: 'Fast-Fix Center Manual Resolution'
          });
        }
      });

      if (updates.length === 0) {
        setSaving(false);
        return;
      }

      const res = await fetch('/api/attendance/bulk-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates,
          reason: 'Bulk Fast-Fix Resolution',
          edited_by: 'Admin Fast-Fix'
        })
      }).then(r => r.json());

      if (res.success) {
        setGlobalSuccessMsg(`🎉 Successfully resolved ${res.updatedCount} record(s)! Worker calculations unlocked.`);
        await onRefreshData();
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        alert('Bulk update error: ' + res.error);
      }
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="glass-modal w-full max-w-6xl max-h-[92vh] flex flex-col rounded-3xl p-6 shadow-2xl border-2 border-amber-500/50 bg-slate-900 overflow-hidden">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4 mb-4 shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-950 text-amber-300 border-2 border-amber-500 flex items-center justify-center shadow-lg shadow-amber-950/50">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-black text-white font-display tracking-tight">
                  Incomplete Records Fast-Fix Center
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 text-xs font-bold font-mono border border-amber-500">
                  {records.length} Records Need Resolution
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Fix missing swipes across workers in one click to automatically unlock their payroll & salary calculations.
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Global Notification Banner */}
        {globalSuccessMsg ? (
          <div className="bg-emerald-950/80 border-2 border-emerald-500 text-emerald-200 px-4 py-3 rounded-2xl text-sm font-bold flex items-center space-x-2.5 mb-4 animate-in slide-in-from-top-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{globalSuccessMsg}</span>
          </div>
        ) : (
          records.length > 0 && (
            <div className="bg-amber-950/40 border border-amber-500/40 text-amber-200 px-4 py-2.5 rounded-2xl text-xs flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Locked Calculation Notice:</strong> Salary and total duty hours for workers with incomplete entries are kept on hold until all their entries are completed.
                </span>
              </div>
              <span className="text-[11px] font-mono text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-600">
                Rule: 4h Morning Exit Auto-Evaluated
              </span>
            </div>
          )
        )}

        {/* Search & Bulk Action Bar */}
        <div className="bg-slate-950 border-2 border-slate-800 rounded-2xl p-3.5 mb-4 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3 w-full md:w-auto">
            <button
              onClick={handleSelectAll}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all"
            >
              {selectedIds.size === filteredRecords.length && filteredRecords.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-amber-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>{selectedIds.size > 0 ? `${selectedIds.size} Selected` : 'Select All'}</span>
            </button>

            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search staff, name, date..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Quick Batch Actions */}
          <div className="flex items-center space-x-2 flex-wrap gap-y-2 w-full md:w-auto justify-end">
            <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Batch Fill:</span>
            <button
              onClick={() => handleBatchAppend('16:30')}
              disabled={selectedIds.size === 0}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-blue-900/60 text-cyan-300 text-xs font-bold border border-slate-700 disabled:opacity-40 transition-all"
              title="Append 16:30 OUT to selected"
            >
              + 16:30 OUT
            </button>
            <button
              onClick={() => handleBatchAppend('18:30')}
              disabled={selectedIds.size === 0}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-amber-900/60 text-amber-300 text-xs font-bold border border-slate-700 disabled:opacity-40 transition-all"
              title="Append 18:30 OUT to selected"
            >
              + 18:30 OUT
            </button>
            <button
              onClick={() => handleBatchAppend('19:30')}
              disabled={selectedIds.size === 0}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-purple-900/60 text-purple-300 text-xs font-bold border border-slate-700 disabled:opacity-40 transition-all"
              title="Append 19:30 OUT to selected"
            >
              + 19:30 OUT
            </button>
            <button
              onClick={handleBatchMarkAbsent}
              disabled={selectedIds.size === 0}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-rose-300 text-xs font-bold border border-slate-700 disabled:opacity-40 transition-all"
              title="Mark selected as Absent"
            >
              Mark Absent
            </button>
          </div>
        </div>

        {/* Scrollable Records Table */}
        <div className="flex-1 overflow-y-auto rounded-2xl border-2 border-slate-800 bg-slate-950 min-h-[300px]">
          {loading ? (
            <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-sm font-bold">Loading incomplete punch records...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-20 text-center text-slate-300 flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-950 text-emerald-400 border-2 border-emerald-500 flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-lg font-bold text-white">All Records Are 100% Complete!</h4>
              <p className="text-xs text-slate-400 max-w-sm">
                There are no pending incomplete swipes. All worker salaries and overtime duty calculations are unlocked and up to date.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-900 z-10 text-slate-300 font-bold uppercase tracking-wider border-b-2 border-slate-800">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">Sel</th>
                  <th className="py-3 px-3">Employee</th>
                  <th className="py-3 px-3">Date & Day</th>
                  <th className="py-3 px-3">Current Missing Swipe</th>
                  <th className="py-3 px-3 text-center">Quick Add Action</th>
                  <th className="py-3 px-3">Edited Punch Sequence</th>
                  <th className="py-3 px-3">Target Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredRecords.map(r => {
                  const key = `${r.staff_no}_${r.date}`;
                  const isSelected = selectedIds.has(key);
                  const editData = rowEdits[key] || { raw_swipes: r.raw_swipes || '', status: r.status };

                  return (
                    <tr 
                      key={key} 
                      className={`hover:bg-slate-900/90 transition-colors ${isSelected ? 'bg-amber-950/20' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <button 
                          onClick={() => handleToggleSelect(key)}
                          className="text-slate-400 hover:text-amber-400 transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                      </td>

                      {/* Employee Info */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center space-x-2.5">
                          <span className="w-7 h-7 rounded-lg bg-blue-950 text-cyan-300 border border-blue-600 font-mono font-bold flex items-center justify-center text-[11px]">
                            #{r.staff_no}
                          </span>
                          <div>
                            <p className="font-bold text-white">{r.staff_name || 'WORKER'}</p>
                            <p className="text-[10px] text-slate-400">{r.department || 'WORKER'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Date & Weekday */}
                      <td className="py-3 px-3 whitespace-nowrap font-mono font-bold text-slate-200">
                        {r.date} <span className="text-slate-400 font-normal">({r.weekday || ''})</span>
                      </td>

                      {/* Current Punch with Alert */}
                      <td className="py-3 px-3 font-mono">
                        {r.punchPairsFormatted ? (
                          <span className="px-2 py-1 rounded bg-orange-950 text-orange-300 border border-orange-600/70 text-[11px] font-bold inline-block">
                            {r.punchPairsFormatted}
                          </span>
                        ) : r.raw_swipes ? (
                          <span className="px-2 py-1 rounded bg-orange-950 text-orange-300 border border-orange-600/70 text-[11px] font-bold inline-block">
                            {r.raw_swipes.trim().split(/\s+/).length % 2 !== 0 
                              ? `${r.raw_swipes} (Missing OUT)` 
                              : r.raw_swipes}
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded bg-slate-800 text-slate-400 text-[11px] font-bold inline-block">
                            No Swipes Recorded
                          </span>
                        )}
                      </td>

                      {/* Quick Add Buttons */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => handleQuickAppend(key, r.raw_swipes, '16:30')}
                            className="px-2 py-1 rounded-lg bg-blue-950 hover:bg-blue-900 text-cyan-300 font-mono font-bold text-[11px] border border-blue-700 transition-all shadow-sm"
                            title="Add 16:30 OUT punch"
                          >
                            + 16:30
                          </button>
                          <button
                            onClick={() => handleQuickAppend(key, r.raw_swipes, '18:30')}
                            className="px-2 py-1 rounded-lg bg-amber-950 hover:bg-amber-900 text-amber-300 font-mono font-bold text-[11px] border border-amber-700 transition-all shadow-sm"
                            title="Add 18:30 OUT punch"
                          >
                            + 18:30
                          </button>
                          <button
                            onClick={() => handleQuickAppend(key, r.raw_swipes, '19:30')}
                            className="px-2 py-1 rounded-lg bg-purple-950 hover:bg-purple-900 text-purple-300 font-mono font-bold text-[11px] border border-purple-700 transition-all shadow-sm"
                            title="Add 19:30 OUT punch"
                          >
                            + 19:30
                          </button>
                        </div>
                      </td>

                      {/* Editable Swipes Input */}
                      <td className="py-3 px-3">
                        <input
                          type="text"
                          value={editData.raw_swipes}
                          onChange={(e) => handleInputChange(key, 'raw_swipes', e.target.value)}
                          placeholder="e.g. 08:00 09:00 15:00 19:30"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 font-mono text-white text-xs placeholder-slate-600 focus:outline-none focus:border-amber-500"
                        />
                      </td>

                      {/* Target Status Select */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <select
                          value={editData.status}
                          onChange={(e) => handleInputChange(key, 'status', e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-amber-500"
                        >
                          <option value="Present (Full)">Present (Full Day)</option>
                          <option value="Present (Short)">Present (Short Hours)</option>
                          <option value="Absent">Absent</option>
                          <option value="Weekly Off (Paid)">Weekly Off (Paid)</option>
                          <option value="Weekly Off (Forfeited)">Weekly Off (Forfeited)</option>
                          <option value="Incomplete">Keep Incomplete</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t-2 border-slate-800 pt-4 mt-4 shrink-0">
          <div className="text-xs text-slate-400 font-medium">
            Showing <strong className="text-white">{filteredRecords.length}</strong> incomplete records 
            {selectedIds.size > 0 && <span> • <strong className="text-amber-400">{selectedIds.size}</strong> selected for batch action</span>}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-all"
            >
              Cancel
            </button>

            <button
              onClick={handleSaveAll}
              disabled={saving || records.length === 0}
              className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-600/30 flex items-center space-x-2 border border-emerald-400 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving & Recalculating...' : `Save & Resolve All (${records.length} Records)`}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
