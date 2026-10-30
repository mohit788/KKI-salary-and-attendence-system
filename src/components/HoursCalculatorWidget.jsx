import React, { useState, useMemo } from 'react';
import { Clock, Calculator, Coffee, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';
import { calculateWorkingHours } from '../utils/formatters';

export default function HoursCalculatorWidget() {
  const [inTime, setInTime] = useState('12:30');
  const [outTime, setOutTime] = useState('6');
  const [lunchStart, setLunchStart] = useState('12:30');
  const [lunchEnd, setLunchEnd] = useState('13:00');

  const result = useMemo(() => {
    return calculateWorkingHours(inTime, outTime, lunchStart, lunchEnd);
  }, [inTime, outTime, lunchStart, lunchEnd]);

  const presets = [
    { label: '12:30 ➔ 6:00', in: '12:30', out: '6', desc: '5 Hours (30m Lunch Cut)' },
    { label: '12:59 ➔ 6:00', in: '12:59', out: '6', desc: '5 Hours (1m Lunch Cut)' },
    { label: '13:01 ➔ 6:00', in: '13:01', out: '6', desc: '4h 59m (0m Lunch Cut)' },
    { label: '08:00 ➔ 16:30', in: '08:00', out: '16:30', desc: '8 Hours (Standard Shift)' },
    { label: '09:00 ➔ 18:00', in: '09:00', out: '18:00', desc: '8h 30m (8h + 30m OT)' },
  ];

  return (
    <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-5 shadow-lg">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Working Hours & Lunch Calculator
              <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                12:30 - 1:00 PM Lunch Cut
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Live calculation with automatic 30-minute lunch overlap deduction
            </p>
          </div>
        </div>
      </div>

      {/* Preset Pills */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Presets:
        </span>
        {presets.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => { setInTime(p.in); setOutTime(p.out); }}
            className={`text-xs px-2.5 py-1 rounded-lg font-mono font-semibold transition-all border ${
              inTime === p.in && outTime === p.out
                ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Inputs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Worker IN Time
          </label>
          <input
            type="text"
            value={inTime}
            onChange={(e) => setInTime(e.target.value)}
            placeholder="e.g. 12:30 or 13:01"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Worker OUT Time
          </label>
          <input
            type="text"
            value={outTime}
            onChange={(e) => setOutTime(e.target.value)}
            placeholder="e.g. 6 or 18:00"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Lunch Window Start
          </label>
          <input
            type="text"
            value={lunchStart}
            onChange={(e) => setLunchStart(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Lunch Window End
          </label>
          <input
            type="text"
            value={lunchEnd}
            onChange={(e) => setLunchEnd(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Result Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <span className="text-[11px] text-slate-400 block uppercase font-bold">Gross Duration</span>
            <span className="text-sm font-bold text-slate-200 font-mono">
              {Math.floor(result.grossMins / 60)}h {result.grossMins % 60}m ({result.grossMins}m)
            </span>
          </div>
          <div>
            <span className="text-[11px] text-amber-400 block uppercase font-bold flex items-center gap-1">
              <Coffee className="w-3.5 h-3.5" /> Lunch Cut
            </span>
            <span className="text-sm font-bold text-amber-300 font-mono">
              − {result.lunchDeductionMins} Mins
            </span>
          </div>
          <div>
            <span className="text-[11px] text-cyan-400 block uppercase font-bold">Lunch Window</span>
            <span className="text-sm font-bold text-cyan-300 font-mono">
              {lunchStart} – {lunchEnd}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 self-start md:self-auto">
          <div className="text-right">
            <span className="text-[10px] text-emerald-400 font-bold block uppercase tracking-wider">
              Net Working Hours
            </span>
            <span className="text-2xl font-black text-emerald-300 font-mono tracking-tight">
              {result.formatted}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>
      </div>
    </div>
  );
}
