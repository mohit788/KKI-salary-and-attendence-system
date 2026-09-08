import React from 'react';
import { Clock, CheckCircle, LogOut } from 'lucide-react';

export default function InactivityWarningModal({
  isOpen,
  secondsRemaining,
  onStayLoggedIn,
  onLogout
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0f172a] border-2 border-amber-500/60 rounded-2xl p-6 shadow-2xl shadow-amber-500/20 text-center relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Warning Icon with pulse ring */}
        <div className="relative inline-flex items-center justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>
          <span className="absolute top-0 right-0 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500"></span>
          </span>
        </div>

        <h3 className="text-xl font-bold text-white mb-2 font-display">
          Inactivity Warning
        </h3>

        <p className="text-sm text-slate-300 mb-5 leading-relaxed">
          You have been inactive for over 4 minutes. For security, your session will automatically close in:
        </p>

        {/* Countdown Pill */}
        <div className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-amber-950/80 border border-amber-500/60 text-amber-300 font-mono font-bold text-2xl tracking-wider mb-6 shadow-inner">
          00:{secondsRemaining < 10 ? `0${secondsRemaining}` : secondsRemaining}
        </div>

        <p className="text-xs text-slate-400 mb-6">
          Click below or move your mouse / tap any key to keep your session active.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={onStayLoggedIn}
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/40 border border-emerald-400/30 transition-all cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Stay Logged In</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
