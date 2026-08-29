import React, { useState } from 'react';
import { Edit3, CheckCircle, X, AlertTriangle } from 'lucide-react';
import { normalizeTimeInput } from '../utils/formatters';

export default function EditModal({ record, staffNo, onSave, onCancel, loading }) {
  if (!record) return null;

  const [rawSwipes, setRawSwipes] = useState(record.raw_swipes || '');
  const [status, setStatus] = useState(record.status || 'Present (Full)');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A mandatory reason is required for audit trail logging.');
      return;
    }

    const normSwipes = normalizeTimeInput(rawSwipes);

    onSave({
      staff_no: staffNo,
      date: record.date,
      raw_swipes: normSwipes,
      status,
      reason,
      edited_by: 'HR Admin',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-modal w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-700/60 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-display">Correct Attendance Record</h3>
              <p className="text-xs text-slate-400">Date: <strong className="text-indigo-300 font-mono">{record.date} ({record.weekday})</strong></p>
            </div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Raw Swipe Timestamps (Space Separated 24h)
            </label>
            <input
              type="text"
              placeholder="e.g. 08:30 12:30 14:00 17:30"
              value={rawSwipes}
              onChange={(e) => setRawSwipes(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">Enter alternating IN OUT timestamps. 2 or 4 times.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Attendance Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="Present (Full)">Present (Full Day)</option>
              <option value="Present (Short)">Present (Short Hours)</option>
              <option value="Absent">Absent</option>
              <option value="Weekly Off (Paid)">Weekly Off (Paid)</option>
              <option value="Weekly Off (Forfeited)">Weekly Off (Forfeited)</option>
              <option value="Incomplete">Incomplete / Needs Review</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Mandatory Edit Reason (Audit Trail Log)
            </label>
            <textarea
              rows="2"
              placeholder="e.g. Machine missed evening swipe, verified with supervisor."
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(''); }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-400 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 border-t border-slate-800 pt-4 mt-6">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center space-x-2 transition-all"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Save & Log Edit</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
