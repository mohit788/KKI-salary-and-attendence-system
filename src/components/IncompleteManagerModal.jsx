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
  RefreshCw,
  Check,
  CornerDownLeft,
  Filter,
  Zap,
  Edit3,
  Star
} from 'lucide-react';
import { normalizeTimeInput, normalizeSingleTimeToken } from '../utils/formatters';

function parseMins(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(':');
  return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

export default function IncompleteManagerModal({
  isOpen,
  onClose,
  onRefreshData,
  workers = [],
  allAttendance = [],
  initialStaffNo = null,
  selectedMonth = 'all',
  availableMonths = []
}) {
  if (!isOpen) return null;

  const [modalMonth, setModalMonth] = useState(selectedMonth || 'all');

  useEffect(() => {
    if (selectedMonth) {
      setModalMonth(selectedMonth);
    }
  }, [selectedMonth, isOpen]);

  // High-performance client-side extractor from memory (0ms instant hydration)
  const extractIncompleteFromMemory = (targetMonth = modalMonth) => {
    const map = new Map();
    const exemptStaffSet = new Set();
    (workers || []).forEach(w => {
      if (w.is_exception === 1 || ['exempt', 'flexible', 'exception'].includes(w.assigned_shift)) {
        exemptStaffSet.add(String(w.staff_no));
      }
    });

    (workers || []).forEach(w => {
      if (exemptStaffSet.has(String(w.staff_no))) return; // Skip exception workers!
      (w.dailyRecords || []).forEach(r => {
        if (targetMonth && targetMonth !== 'all' && !r.date?.startsWith(targetMonth)) return;
        const raw = (r.raw_swipes || '').trim();
        const punches = (raw.match(/\b\d{1,2}:\d{2}\b/g) || []).filter(t => t !== '00:00');
        const isIncomplete = (r.status || '').includes('Incomplete') || (punches.length === 1 && !r.status?.includes('Present'));

        if (isIncomplete && (r.is_manual_override !== 1 || (r.status || '').includes('Incomplete'))) {
          const singlePunch = punches.length === 1 ? punches[0] : '';
          let missingType = 'OUT';
          if (singlePunch) {
            const parts = singlePunch.split(':');
            const mins = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
            missingType = mins > 750 ? 'IN' : 'OUT';
          }
          const key = `${w.staff_no}_${r.date}`;
          map.set(key, {
            staff_no: w.staff_no,
            staff_name: w.staff_name || 'WORKER',
            department: w.department || 'WORKER',
            date: r.date,
            weekday: r.weekday || '',
            raw_swipes: r.raw_swipes || '',
            status: r.status || 'Incomplete',
            effective_in: r.effective_in || '',
            effective_out: r.effective_out || '',
            shift: r.shift || '08:00',
            missing_type: missingType,
            existing_punch: singlePunch,
            cleaned_punches: punches,
          });
        }
      });
    });

    (allAttendance || []).forEach(r => {
      if (exemptStaffSet.has(String(r.staff_no))) return; // Skip exception workers!
      if (targetMonth && targetMonth !== 'all' && !r.date?.startsWith(targetMonth)) return;
      const raw = (r.raw_swipes || '').trim();
      const punches = (raw.match(/\b\d{1,2}:\d{2}\b/g) || []).filter(t => t !== '00:00');
      const isIncomplete = (r.status || '').includes('Incomplete') || (punches.length === 1 && !r.status?.includes('Present'));

      if (isIncomplete && (r.is_manual_override !== 1 || (r.status || '').includes('Incomplete'))) {
        const key = `${r.staff_no}_${r.date}`;
        if (!map.has(key)) {
          const singlePunch = punches.length === 1 ? punches[0] : '';
          let missingType = 'OUT';
          if (singlePunch) {
            const parts = singlePunch.split(':');
            const mins = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
            missingType = mins > 750 ? 'IN' : 'OUT';
          }
          map.set(key, {
            staff_no: r.staff_no,
            staff_name: r.staff_name || 'WORKER',
            department: r.department || 'WORKER',
            date: r.date,
            weekday: r.weekday || '',
            raw_swipes: r.raw_swipes || '',
            status: r.status || 'Incomplete',
            effective_in: r.effective_in || '',
            effective_out: r.effective_out || '',
            shift: r.shift || '08:00',
            missing_type: missingType,
            existing_punch: singlePunch,
            cleaned_punches: punches,
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => (a.date || '').localeCompare(b.date || '') || String(a.staff_no).localeCompare(String(b.staff_no)));
  };

  const initialMemoryRecords = extractIncompleteFromMemory(modalMonth);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingRows, setSavingRows] = useState({}); // key -> boolean
  const [savedRows, setSavedRows] = useState({});   // key -> boolean
  const [records, setRecords] = useState(initialMemoryRecords);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Clean row state: missing_input is empty by default so user ONLY enters the missing punch!
  const [rowEdits, setRowEdits] = useState(() => {
    const edits = {};
    initialMemoryRecords.forEach(r => {
      const key = `${r.staff_no}_${r.date}`;
      edits[key] = {
        missing_input: '',
        raw_swipes: r.raw_swipes || '',
        status: r.status && !r.status.includes('Incomplete') ? r.status : 'Present (Full)',
        is_manual_mode: false
      };
    });
    return edits;
  });

  const [globalSuccessMsg, setGlobalSuccessMsg] = useState('');
  const [staffFilter, setStaffFilter] = useState(initialStaffNo);

  useEffect(() => {
    setStaffFilter(initialStaffNo);
  }, [initialStaffNo, isOpen]);

  // Sync memory on workers/allAttendance changes
  useEffect(() => {
    const mem = extractIncompleteFromMemory(modalMonth);
    if (mem.length > 0 && records.length === 0) {
      setRecords(mem);
      setRowEdits(prev => {
        const next = { ...prev };
        mem.forEach(r => {
          const key = `${r.staff_no}_${r.date}`;
          if (!next[key]) {
            next[key] = {
              missing_input: '',
              raw_swipes: r.raw_swipes || '',
              status: r.status && !r.status.includes('Incomplete') ? r.status : 'Present (Full)',
              is_manual_mode: false
            };
          }
        });
        return next;
      });
    }
  }, [workers, allAttendance, modalMonth]);

  // Fetch incomplete records from server in background
  const fetchIncomplete = async (targetMonth = modalMonth) => {
    setLoading(true);
    try {
      const qMonth = targetMonth && targetMonth !== 'all' ? `?month=${encodeURIComponent(targetMonth)}` : '';
      const res = await fetch(`/api/attendance/incomplete${qMonth}`).then(r => r.json());
      if (res.success) {
        const incRecords = res.incompleteRecords && res.incompleteRecords.length > 0
          ? res.incompleteRecords
          : extractIncompleteFromMemory(targetMonth);

        setRecords(incRecords);
        setRowEdits(prev => {
          const next = { ...prev };
          incRecords.forEach(r => {
            const key = `${r.staff_no}_${r.date}`;
            if (!next[key]) {
              next[key] = {
                missing_input: '',
                raw_swipes: r.raw_swipes || '',
                status: r.status && !r.status.includes('Incomplete') ? r.status : 'Present (Full)',
                is_manual_mode: false
              };
            }
          });
          return next;
        });

        if (onRefreshData) {
          onRefreshData();
        }
      }
    } catch (err) {
      console.error('Error fetching incomplete records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncomplete(modalMonth);
  }, [modalMonth, isOpen]);

  const filteredRecords = records.filter(r => {
    if (staffFilter && (typeof staffFilter === 'string' || typeof staffFilter === 'number') && String(r.staff_no) !== String(staffFilter)) return false;
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

  // Helper to extract clean single punch info
  const getSinglePunchInfo = (record) => {
    const raw = (record.raw_swipes || '').trim();
    const punches = (raw.match(/\b\d{1,2}:\d{2}\b/g) || []).filter(t => t !== '00:00');
    if (punches.length === 1) {
      const punch = punches[0];
      const mins = parseMins(punch);
      const isMissingIn = mins > 750; // > 12:30 PM is evening punch -> Missing Morning IN
      return { hasSingle: true, punch, isMissingIn, punchCount: 1 };
    }
    const isOdd = punches.length > 0 && punches.length % 2 !== 0;
    return { hasSingle: false, punch: punches.join(' '), isMissingIn: false, punchCount: punches.length, isOdd };
  };

  // Compute final punch sequence based on missing_input and existing punches
  const computeResolvedSwipes = (record, missingVal) => {
    const cleanMissing = (missingVal || '').trim();
    if (!cleanMissing) return record.raw_swipes || '';

    const normInput = normalizeTimeInput(cleanMissing);
    const { hasSingle, punch, isMissingIn } = getSinglePunchInfo(record);

    if (hasSingle) {
      if (isMissingIn) {
        return `${normInput} ${punch}`;
      } else {
        return `${punch} ${normInput}`;
      }
    } else {
      const raw = (record.raw_swipes || '').trim();
      return raw ? `${raw} ${normInput}` : normInput;
    }
  };

  // Handle typing inside the clean "Enter Missing Punch" input field
  const handleMissingInputChange = (key, record, val) => {
    const computed = computeResolvedSwipes(record, val);
    setRowEdits(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        missing_input: val,
        raw_swipes: computed,
        status: val.trim() ? 'Present (Full)' : (prev[key]?.status || 'Incomplete')
      }
    }));
  };

  // On blur of missing input, auto-normalize shorthands (e.g. 901 -> 09:01)
  const handleMissingInputBlur = (key, record) => {
    const edit = rowEdits[key];
    const val = (edit?.missing_input || '').trim();
    if (!val) return;

    const norm = normalizeSingleTimeToken(val);
    const computed = computeResolvedSwipes(record, norm);

    setRowEdits(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        missing_input: norm,
        raw_swipes: computed,
        status: 'Present (Full)'
      }
    }));
  };

  // Apply 1-click quick punch (Sets missing input & computes resulting sequence)
  const handleQuickFill = (key, record, punchTime) => {
    const norm = normalizeSingleTimeToken(punchTime);
    const computed = computeResolvedSwipes(record, norm);

    setRowEdits(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        missing_input: norm,
        raw_swipes: computed,
        status: 'Present (Full)'
      }
    }));
  };

  // Batch actions
  const handleBatchFill = (punchTime) => {
    if (selectedIds.size === 0) return;
    const norm = normalizeSingleTimeToken(punchTime);

    setRowEdits(prev => {
      const next = { ...prev };
      selectedIds.forEach(key => {
        const record = records.find(r => `${r.staff_no}_${r.date}` === key);
        if (!record) return;
        const computed = computeResolvedSwipes(record, norm);

        next[key] = {
          ...next[key],
          missing_input: norm,
          raw_swipes: computed,
          status: 'Present (Full)'
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
          ...next[key],
          missing_input: 'Absent',
          raw_swipes: next[key]?.raw_swipes || '',
          status: 'Absent'
        };
      });
      return next;
    });
  };

  // Toggle single worker exception
  const handleToggleWorkerException = async (staffNo, isException = true, reason = 'Marked as Exception Worker') => {
    try {
      const res = await fetch(`/api/workers/${staffNo}/toggle-exception`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_exception: isException ? 1 : 0, exception_reason: reason })
      }).then(r => r.json());

      if (res.success) {
        setGlobalSuccessMsg(`Worker #${staffNo} ${isException ? 'marked as Exception Worker (Exempt from Missing Punch Locks)' : 'removed from Exception'}`);
        if (onRefreshData) onRefreshData();
        fetchIncomplete(modalMonth);
      } else {
        alert('Exception update error: ' + res.error);
      }
    } catch (err) {
      alert('Exception toggle failed: ' + err.message);
    }
  };

  // Batch mark workers as exception
  const handleBatchMarkException = async () => {
    const staffNos = Array.from(new Set(
      selectedIds.size > 0
        ? Array.from(selectedIds).map(id => id.split('_')[0])
        : filteredRecords.map(r => r.staff_no)
    ));

    if (staffNos.length === 0) return;

    if (!window.confirm(`Mark ${staffNos.length} worker(s) as Exception Workers (exempt from missing punch locks)?`)) {
      return;
    }

    try {
      const res = await fetch('/api/workers/batch-exception', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_nos: staffNos, is_exception: 1, exception_reason: 'Batch marked as Exception from Fast-Fix Center' })
      }).then(r => r.json());

      if (res.success) {
        setGlobalSuccessMsg(`Successfully marked ${staffNos.length} worker(s) as Exception Workers.`);
        if (onRefreshData) onRefreshData();
        fetchIncomplete(modalMonth);
      } else {
        alert('Batch exception error: ' + res.error);
      }
    } catch (err) {
      alert('Batch exception failed: ' + err.message);
    }
  };

  // INLINE SAVE A SINGLE ROW
  const handleSaveSingleRow = async (record) => {
    const key = `${record.staff_no}_${record.date}`;
    const edit = rowEdits[key];
    if (!edit) return;

    const normSwipes = normalizeTimeInput(edit.raw_swipes);

    setSavingRows(prev => ({ ...prev, [key]: true }));

    try {
      const res = await fetch('/api/attendance/bulk-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [{
            staff_no: record.staff_no,
            date: record.date,
            raw_swipes: normSwipes,
            status: edit.status || 'Present (Full)',
            reason: 'Fast-Fix Center Individual Save'
          }],
          reason: 'Individual Fast-Fix Resolution',
          edited_by: 'Admin Fast-Fix'
        })
      }).then(r => r.json());

      if (res.success) {
        setSavedRows(prev => ({ ...prev, [key]: true }));
        setRowEdits(prev => ({
          ...prev,
          [key]: { ...prev[key], raw_swipes: normSwipes }
        }));
        if (onRefreshData) onRefreshData();
      } else {
        alert('Save error: ' + res.error);
      }
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSavingRows(prev => ({ ...prev, [key]: false }));
    }
  };

  // SUBMIT ALL MODIFIED RECORDS
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
            raw_swipes: normalizeTimeInput(edit.raw_swipes),
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
        if (onRefreshData) await onRefreshData();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        alert('Bulk update error: ' + res.error);
      }
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCloseAndSync = () => {
    if (onRefreshData) onRefreshData();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="glass-modal w-full max-w-7xl max-h-[94vh] flex flex-col rounded-3xl p-5 sm:p-6 shadow-2xl border-2 border-amber-500/50 bg-slate-900 overflow-hidden">

        {/* Header Bar */}
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4 mb-3.5 shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-950 text-amber-300 border-2 border-amber-500 flex items-center justify-center shadow-lg shadow-amber-950/50">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-black text-white font-display tracking-tight">
                  Incomplete Records Fast-Fix Center
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 text-xs font-bold font-mono border border-amber-500">
                  {records.length} Pending Resolution
                </span>

                {staffFilter && (
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-950 text-cyan-300 border border-blue-600 text-xs font-bold font-mono">
                    <Filter className="w-3 h-3 text-cyan-400" />
                    <span>Staff #{staffFilter}</span>
                    <button
                      onClick={() => setStaffFilter(null)}
                      className="text-slate-400 hover:text-white ml-1 p-0.5 hover:bg-blue-900 rounded cursor-pointer"
                      title="Clear staff filter and show all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <button
                  onClick={() => fetchIncomplete(modalMonth)}
                  disabled={loading}
                  className="px-2.5 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold border border-slate-700 flex items-center space-x-1 transition-all cursor-pointer"
                  title="Reload Incomplete Records from Database"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Month Selector Tabs */}
              {availableMonths && availableMonths.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-400 mr-1">Scope Month:</span>
                  {availableMonths.map(m => {
                    const key = m.monthKey || m.month_key;
                    const label = m.label || m.month_label || key;
                    const isActive = modalMonth === key;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          setModalMonth(key);
                          fetchIncomplete(key);
                        }}
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                            : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => {
                      setModalMonth('all');
                      fetchIncomplete('all');
                    }}
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      modalMonth === 'all'
                        ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    All Months
                  </button>
                </div>
              )}

              <p className="text-xs text-slate-300 mt-1">
                Type ONLY the missing punch (e.g. <span className="text-amber-300 font-mono font-bold">901</span> $\rightarrow$ <span className="text-emerald-300 font-mono font-bold">09:01</span>) or click 1-Click Fix. No pre-filled text to delete!
              </p>
            </div>
          </div>

          <button
            onClick={handleCloseAndSync}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
            title="Close modal and refresh parent data"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Global Notification Banner */}
        {globalSuccessMsg ? (
          <div className="bg-emerald-950/80 border-2 border-emerald-500 text-emerald-200 px-4 py-3 rounded-2xl text-sm font-bold flex items-center space-x-2.5 mb-3.5 animate-in slide-in-from-top-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{globalSuccessMsg}</span>
          </div>
        ) : (
          records.length > 0 && (
            <div className="bg-amber-950/40 border border-amber-500/40 text-amber-200 px-4 py-2 rounded-2xl text-xs flex items-center justify-between mb-3.5 shrink-0">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Clean Entry Mode:</strong> Input box is clean & empty. Type only the missing punch or click a button to auto-fill.
                </span>
              </div>
              <span className="text-[11px] font-mono text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-600">
                Short Format: 901 $\rightarrow$ 09:01 | 830 $\rightarrow$ 08:30 | 1838 $\rightarrow$ 18:38
              </span>
            </div>
          )
        )}

        {/* Search & Bulk Action Bar */}
        <div className="bg-slate-950 border-2 border-slate-800 rounded-2xl p-3 mb-3.5 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3 w-full md:w-auto">
            <button
              onClick={handleSelectAll}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all cursor-pointer"
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
              onClick={() => handleBatchFill('08:00')}
              disabled={selectedIds.size === 0}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-900/60 text-emerald-300 text-xs font-bold border border-slate-700 disabled:opacity-40 transition-all cursor-pointer"
              title="Apply 08:00 to selected (Smart IN/OUT)"
            >
              + 08:00 IN
            </button>
            <button
              onClick={() => handleBatchFill('16:30')}
              disabled={selectedIds.size === 0}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-blue-900/60 text-cyan-300 text-xs font-bold border border-slate-700 disabled:opacity-40 transition-all cursor-pointer"
              title="Apply 16:30 to selected"
            >
              + 16:30 OUT
            </button>
            <button
              onClick={() => handleBatchFill('18:30')}
              disabled={selectedIds.size === 0}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-amber-900/60 text-amber-300 text-xs font-bold border border-slate-700 disabled:opacity-40 transition-all cursor-pointer"
              title="Apply 18:30 to selected"
            >
              + 18:30 OUT
            </button>
            <button
              onClick={handleBatchMarkAbsent}
              disabled={selectedIds.size === 0}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-rose-300 text-xs font-bold border border-slate-700 disabled:opacity-40 transition-all cursor-pointer"
              title="Mark selected as Absent"
            >
              Mark Absent
            </button>
            <button
              onClick={handleBatchMarkException}
              disabled={selectedIds.size === 0 && filteredRecords.length === 0}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/50 disabled:opacity-40 transition-all cursor-pointer flex items-center space-x-1 shadow-sm"
              title="Mark selected workers as Exception Workers (exempts them from blocking report downloads)"
            >
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>⭐ Mark {selectedIds.size > 0 ? `${selectedIds.size} Selected` : 'All'} as Exception</span>
            </button>
          </div>
        </div>

        {/* Scrollable Records Table */}
        <div className="flex-1 overflow-y-auto rounded-2xl border-2 border-slate-800 bg-slate-950 min-h-[300px]">
          {loading && records.length === 0 ? (
            <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-sm font-bold">Loading incomplete punch records from database...</p>
            </div>
          ) : records.length > 0 && filteredRecords.length === 0 ? (
            <div className="py-20 text-center text-slate-300 flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-blue-950 text-cyan-400 border-2 border-blue-500 flex items-center justify-center shadow-lg">
                <Search className="w-7 h-7" />
              </div>
              <h4 className="text-lg font-bold text-white">
                {staffFilter ? `Staff #${staffFilter} Has No Incomplete Records` : 'No Records Match Search'}
              </h4>
              <p className="text-xs text-slate-400 max-w-sm">
                There are {records.length} pending incomplete records across all workers.
              </p>
              <button
                onClick={() => { setStaffFilter(null); setSearchTerm(''); }}
                className="mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all"
              >
                View All {records.length} Pending Records
              </button>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-20 text-center text-slate-300 flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-3xl bg-emerald-950 text-emerald-400 border-2 border-emerald-500 flex items-center justify-center shadow-xl shadow-emerald-950/50">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-extrabold text-white">All Records Are 100% Complete!</h4>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md text-center leading-relaxed">
                All punch swipes have been resolved. Worker attendance, regular hours, and overtime calculations are active.
              </p>
              <button
                onClick={handleCloseAndSync}
                className="mt-3 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center space-x-2 border border-emerald-400 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Done — Back to All Workers</span>
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-950 z-20 text-slate-200 font-bold uppercase tracking-wider border-b-2 border-slate-700 shadow-md">
                <tr className="divide-x divide-slate-800">
                  <th className="py-3 px-2.5 w-10 text-center bg-slate-950">Sel</th>
                  <th className="py-3 px-3 bg-slate-950">Employee</th>
                  <th className="py-3 px-3 bg-slate-950">Date</th>
                  <th className="py-3 px-3 bg-slate-950">Detected State</th>
                  <th className="py-3 px-3 text-center bg-slate-950">1-Click Quick Fix</th>
                  <th className="py-3 px-3 bg-slate-950">Type Missing Time</th>
                  <th className="py-3 px-3 bg-slate-950">Resulting Punch Preview</th>
                  <th className="py-3 px-2 text-center bg-slate-950 w-24">Save Row</th>
                  <th className="py-3 px-2 text-center bg-slate-950 w-28">Exception</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredRecords.map(r => {
                  const key = `${r.staff_no}_${r.date}`;
                  const isSelected = selectedIds.has(key);
                  const isRowSaving = savingRows[key];
                  const isRowSaved = savedRows[key];
                  const editData = rowEdits[key] || { missing_input: '', raw_swipes: r.raw_swipes || '', status: r.status };
                  const { hasSingle, punch, isMissingIn } = getSinglePunchInfo(r);
                  const isResolved = editData.raw_swipes && editData.raw_swipes !== r.raw_swipes;

                  return (
                    <tr
                      key={key}
                      className={`hover:bg-slate-800/90 transition-colors divide-x divide-slate-800/80 ${isRowSaved
                        ? 'bg-emerald-950/20 border-l-4 border-l-emerald-500'
                        : isSelected
                          ? 'bg-amber-950/30'
                          : 'even:bg-slate-950/40 odd:bg-slate-900/60'
                        }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2.5 px-2.5 text-center">
                        <button
                          onClick={() => handleToggleSelect(key)}
                          className="text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                      </td>

                      {/* Employee Info */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className="w-7 h-7 rounded-lg bg-blue-950 text-cyan-300 border border-blue-600 font-mono font-bold flex items-center justify-center text-[11px]">
                            #{r.staff_no}
                          </span>
                          <div>
                            <p className="font-bold text-white leading-tight">{r.staff_name || 'WORKER'}</p>
                            <p className="text-[10px] text-slate-400">{r.department || 'WORKER'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Date & Weekday */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-slate-200 text-[11px]">
                        {r.date} <span className="text-slate-400 font-normal">({r.weekday || ''})</span>
                      </td>

                      {/* Detected Missing State */}
                      <td className="py-2.5 px-3 font-mono">
                        {hasSingle ? (
                          isMissingIn ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="px-2 py-0.5 rounded bg-rose-950/90 text-rose-300 border border-rose-600 text-[11px] font-bold inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                                <span>Missing IN (Morning)</span>
                              </span>
                              <span className="text-[10px] text-slate-300">
                                Machine OUT: <strong className="text-cyan-300 font-bold font-mono">{punch}</strong>
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <span className="px-2 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-600 text-[11px] font-bold inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                                <span>Missing OUT (Evening)</span>
                              </span>
                              <span className="text-[10px] text-slate-300">
                                Machine IN: <strong className="text-emerald-300 font-bold font-mono">{punch}</strong>
                              </span>
                            </div>
                          )
                        ) : r.raw_swipes ? (
                          <span className="px-2 py-0.5 rounded bg-orange-950 text-orange-300 border border-orange-600/70 text-[11px] font-bold inline-block">
                            {r.raw_swipes} (Odd)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[11px] font-bold inline-block">
                            No Swipes Recorded
                          </span>
                        )}
                      </td>

                      {/* 1-Click Quick Fix Buttons */}
                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1">
                          {hasSingle && isMissingIn ? (
                            <>
                              <button
                                onClick={() => handleQuickFill(key, r, '08:00')}
                                className="px-2 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 font-mono font-bold text-[11px] border border-emerald-700 transition-all shadow-sm cursor-pointer"
                                title="Set missing morning IN punch to 08:00"
                              >
                                + 08:00 IN
                              </button>
                              <button
                                onClick={() => handleQuickFill(key, r, '08:30')}
                                className="px-2 py-1 rounded-lg bg-teal-950 hover:bg-teal-900 text-teal-300 font-mono font-bold text-[11px] border border-teal-700 transition-all shadow-sm cursor-pointer"
                                title="Set missing morning IN punch to 08:30"
                              >
                                + 08:30 IN
                              </button>
                              <button
                                onClick={() => handleQuickFill(key, r, '09:00')}
                                className="px-2 py-1 rounded-lg bg-blue-950 hover:bg-blue-900 text-cyan-300 font-mono font-bold text-[11px] border border-blue-700 transition-all shadow-sm cursor-pointer"
                                title="Set missing morning IN punch to 09:00"
                              >
                                + 09:00 IN
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleQuickFill(key, r, '16:30')}
                                className="px-2 py-1 rounded-lg bg-blue-950 hover:bg-blue-900 text-cyan-300 font-mono font-bold text-[11px] border border-blue-700 transition-all shadow-sm cursor-pointer"
                                title="Set missing evening OUT punch to 16:30"
                              >
                                + 16:30 OUT
                              </button>
                              <button
                                onClick={() => handleQuickFill(key, r, '18:30')}
                                className="px-2 py-1 rounded-lg bg-amber-950 hover:bg-amber-900 text-amber-300 font-mono font-bold text-[11px] border border-amber-700 transition-all shadow-sm cursor-pointer"
                                title="Set missing evening OUT punch to 18:30"
                              >
                                + 18:30 OUT
                              </button>
                              <button
                                onClick={() => handleQuickFill(key, r, '19:30')}
                                className="px-2 py-1 rounded-lg bg-purple-950 hover:bg-purple-900 text-purple-300 font-mono font-bold text-[11px] border border-purple-700 transition-all shadow-sm cursor-pointer"
                                title="Set missing evening OUT punch to 19:30"
                              >
                                + 19:30 OUT
                              </button>
                            </>
                          )}
                        </div>
                      </td>

                      {/* TYPE MISSING TIME ONLY (Clean, empty input field) */}
                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          <input
                            type="text"
                            value={editData.missing_input || ''}
                            onChange={(e) => handleMissingInputChange(key, r, e.target.value)}
                            onBlur={() => handleMissingInputBlur(key, r)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleMissingInputBlur(key, r);
                                handleSaveSingleRow(r);
                              }
                            }}
                            placeholder={hasSingle ? (isMissingIn ? 'Type IN (e.g. 901)' : 'Type OUT (e.g. 1838)') : 'e.g. 901'}
                            className="w-36 bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-2.5 py-1.5 font-mono text-white text-xs placeholder-slate-600 focus:outline-none font-bold"
                          />
                        </div>
                      </td>

                      {/* RESULTING PUNCH PREVIEW (Clean Badge Preview) */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono">
                        {isResolved ? (
                          <div className="flex items-center space-x-1.5">
                            <span className="px-2.5 py-1 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-500/80 font-bold text-xs shadow-sm">
                              {editData.raw_swipes}
                            </span>
                            <span className="text-[10px] text-emerald-400 font-bold">✓ Ready</span>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-400 text-[11px] font-mono border border-slate-700">
                            {hasSingle ? (isMissingIn ? `Pending IN + ${punch}` : `${punch} + Pending OUT`) : (r.raw_swipes || 'Pending')}
                          </span>
                        )}
                      </td>

                      {/* INLINE ROW SAVE BUTTON */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleSaveSingleRow(r)}
                          disabled={isRowSaving}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-1 w-full cursor-pointer ${isRowSaved
                            ? 'bg-emerald-700 text-white border border-emerald-400'
                            : isResolved
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 animate-pulse'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600'
                            }`}
                          title="Save this single row immediately"
                        >
                          {isRowSaving ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : isRowSaved ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-white" />
                              <span>Saved</span>
                            </>
                          ) : (
                            <>
                              <Save className="w-3.5 h-3.5" />
                              <span>Save</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* WORKER EXCEPTION BUTTON */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleToggleWorkerException(r.staff_no, true)}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-950/70 hover:bg-amber-900 text-amber-300 border border-amber-600/70 text-[11px] font-bold flex items-center justify-center space-x-1 w-full transition-all cursor-pointer shadow-sm"
                          title={`Mark #${r.staff_no} as Exception Worker (exempts from blocking report downloads)`}
                        >
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          <span>⭐ Exception</span>
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t-2 border-slate-800 pt-3.5 mt-3.5 shrink-0">
          <div className="text-xs text-slate-400 font-medium">
            Showing <strong className="text-white">{filteredRecords.length}</strong> incomplete records
            {selectedIds.size > 0 && <span> • <strong className="text-amber-400">{selectedIds.size}</strong> selected for batch action</span>}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleCloseAndSync}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              Close
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
