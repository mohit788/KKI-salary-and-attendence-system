import React from 'react';
import { FileCheck, AlertTriangle, Users, Calendar, CheckCircle, X, Sparkles } from 'lucide-react';

export default function UploadPreviewModal({ previewData, onConfirm, onCancel, loading, onOpenIncompleteManager }) {
  if (!previewData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-modal w-full max-w-2xl rounded-2xl p-6 shadow-2xl border border-slate-700/60 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-display">Biometric Upload Preview</h3>
              <p className="text-xs text-slate-400">Verify extracted summary before committing to database</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Details */}
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Source File</p>
            <p className="text-sm font-semibold text-indigo-300 font-mono">{previewData.filename}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
              <div className="flex items-center space-x-2 text-slate-400 text-xs mb-1">
                <Users className="w-3.5 h-3.5" />
                <span>Workers Found</span>
              </div>
              <p className="text-xl font-bold text-white font-display">{previewData.workerCount}</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
              <div className="flex items-center space-x-2 text-slate-400 text-xs mb-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Date Range</span>
              </div>
              <p className="text-xs font-semibold text-slate-200 mt-1">
                {previewData.startDate} <span className="text-slate-500">to</span> {previewData.endDate}
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 col-span-2 sm:col-span-1">
              <div className="flex items-center space-x-2 text-amber-400 text-xs mb-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Flagged Records</span>
              </div>
              <p className="text-xl font-bold text-amber-400 font-display">
                {previewData.flaggedCount}
              </p>
            </div>
          </div>

          {previewData.flaggedCount > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-xs text-amber-300 flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                {previewData.flaggedCount} daily records have an odd count of punches (missed swipe). They are flagged as <strong>"Incomplete / Needs Review"</strong> and their salary calculations are on hold until resolved.
              </span>
            </div>
          )}

          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 text-xs text-emerald-300 flex items-center space-x-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              All ditto marks (<code>"</code>) and merged worker header cells have been forward-filled automatically.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-800 pt-4 mt-6">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
          >
            Cancel
          </button>

          {previewData.flaggedCount > 0 && onOpenIncompleteManager && (
            <button
              onClick={() => {
                onConfirm();
                onOpenIncompleteManager();
              }}
              className="px-5 py-2.5 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-lg shadow-amber-400/20 flex items-center space-x-2 transition-all cursor-pointer border border-amber-300"
            >
              <Sparkles className="w-4 h-4" />
              <span>Quick-Fix {previewData.flaggedCount} Incomplete Records</span>
            </button>
          )}

          <button
            onClick={() => onConfirm()}
            className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-600/30 flex items-center space-x-2 transition-all cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            <span>View Processed Workers & Attendance</span>
          </button>
        </div>

      </div>
    </div>
  );
}
