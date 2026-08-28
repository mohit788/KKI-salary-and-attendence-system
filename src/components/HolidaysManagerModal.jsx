import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Plus, 
  Trash2, 
  X, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

export default function HolidaysManagerModal({ 
  isOpen, 
  onClose, 
  onRefreshData 
}) {
  if (!isOpen) return null;

  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/holidays').then(r => r.json());
      if (res.success) {
        setHolidays(res.holidays || []);
      }
    } catch (err) {
      console.error('Error fetching holidays:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, [isOpen]);

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!newDate || !newName.trim()) {
      setErrorMsg('Please select a date and enter holiday name.');
      return;
    }

    setErrorMsg('');
    setAdding(true);
    try {
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holiday_date: newDate,
          holiday_name: newName.trim(),
          is_recurring: isRecurring
        })
      }).then(r => r.json());

      if (res.success) {
        setSuccessMsg(`🎉 Holiday "${newName.trim()}" added & calculations updated!`);
        setNewDate('');
        setNewName('');
        setIsRecurring(false);
        await fetchHolidays();
        if (onRefreshData) onRefreshData();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg(res.error || 'Failed to add holiday.');
      }
    } catch (err) {
      setErrorMsg('Error: ' + err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteHoliday = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? Attendance will be recomputed automatically.`)) return;

    try {
      const res = await fetch(`/api/holidays/${id}`, {
        method: 'DELETE'
      }).then(r => r.json());

      if (res.success) {
        setSuccessMsg(`Holiday removed & calculations updated.`);
        await fetchHolidays();
        if (onRefreshData) onRefreshData();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="glass-modal w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl p-6 shadow-2xl border-2 border-emerald-500/50 bg-slate-900 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4 mb-4 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-950 text-emerald-300 border-2 border-emerald-500 flex items-center justify-center shadow-lg">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white font-display">
                  Paid Holidays & National Offs
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 text-xs font-bold font-mono border border-emerald-500">
                  {holidays.length} Active
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Workers get 1 Full Paid Day on these dates. If worked, hours are credited as Special Overtime.
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="p-3 mb-3 rounded-xl text-xs font-bold bg-emerald-950 text-emerald-200 border border-emerald-500 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3 mb-3 rounded-xl text-xs font-bold bg-rose-950 text-rose-200 border border-rose-600 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Add Holiday Form */}
        <form onSubmit={handleAddHoliday} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-4 shrink-0">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Declare New Paid Holiday</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Date (YYYY-MM-DD)</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Holiday Name / Occasion</label>
              <input
                type="text"
                placeholder="e.g. Independence Day 🇮🇳"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder-slate-500"
                required
              />
            </div>
            <div className="sm:col-span-3 flex items-end">
              <button
                type="submit"
                disabled={adding || !newDate || !newName.trim()}
                className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{adding ? 'Saving...' : 'Add Holiday'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Holidays List */}
        <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950">
          {loading ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
              <p className="text-xs font-bold">Loading holidays...</p>
            </div>
          ) : holidays.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Calendar className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <p className="text-xs font-bold">No paid holidays declared yet.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-900 text-slate-300 font-bold uppercase border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Holiday Name</th>
                  <th className="py-2.5 px-4 text-center">Type</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {holidays.map(h => (
                  <tr key={h.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                      {h.holiday_date}
                    </td>
                    <td className="py-3 px-4 font-bold text-white">
                      {h.holiday_name}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 text-[10px] font-bold border border-emerald-700">
                        Paid Day Off (1.0 Day)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteHoliday(h.id, h.holiday_name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Delete Holiday"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
