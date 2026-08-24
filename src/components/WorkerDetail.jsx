import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Printer, 
  Edit3, 
  Clock, 
  DollarSign, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle,
  UserCheck,
  Building2,
  FileText
} from 'lucide-react';
import { formatHours } from '../utils/formatters';

export default function WorkerDetail({ 
  staffNo, 
  workerData, 
  onBack, 
  onEditRecord, 
  onAddAdvance 
}) {
  const [printMode, setPrintMode] = useState(false);

  if (!workerData) {
    return (
      <div className="text-center py-12 text-slate-400">
        Loading worker attendance profile...
      </div>
    );
  }

  const { worker, dailyRecords, advances, auditLogs, payroll } = workerData;

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Present (Full)':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Present (Short)':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Absent':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'Weekly Off (Paid)':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'Weekly Off (Worked OT)':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      case 'Weekly Off (Forfeited)':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'Incomplete':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20 animate-pulse';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Action Bar */}
      <div className="flex items-center justify-between no-print">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-sm text-slate-300 hover:text-white px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Workers</span>
        </button>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => onAddAdvance(staffNo)}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition-all"
          >
            <DollarSign className="w-4 h-4" />
            <span>Add Advance Payment</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Printable Report Header */}
      <div className="glass-card rounded-2xl p-6 border border-slate-800 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-xl text-white font-display shadow-lg shadow-indigo-500/20">
              #{worker.staff_no}
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white font-display tracking-tight">{worker.staff_name}</h2>
              <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
                <span>Dept: <strong className="text-slate-200">{worker.department || 'WORKER'}</strong></span>
                <span>•</span>
                <span>Staff ID: <strong className="text-indigo-400 font-mono">#{worker.staff_no}</strong></span>
                <span>•</span>
                <span>Monthly Base: <strong className="text-slate-200 font-mono">₹{(worker.monthly_salary || 15000).toLocaleString('en-IN')}</strong></span>
              </div>
            </div>
          </div>

          {/* Rate Card */}
          <div className="flex items-center space-x-4 bg-slate-900/80 border border-slate-800 p-3 rounded-xl text-xs font-mono flex-wrap gap-y-2">
            <div>
              <p className="text-slate-400 text-[10px] uppercase">Per-Day Rate</p>
              <p className="text-sm font-bold text-white">₹{payroll?.perDayRate} / day</p>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <p className="text-slate-400 text-[10px] uppercase">OT Rate (Weekday)</p>
              <p className="text-sm font-bold text-indigo-300">₹{payroll?.hourlyOtRate} / hr</p>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <p className="text-slate-400 text-[10px] uppercase">Sunday OT Rate ☀️</p>
              <p className="text-sm font-bold text-amber-300">₹{payroll?.hourlySundayOtRate} / hr ({payroll?.sundayOtMultiplier}x)</p>
            </div>
          </div>
        </div>

        {/* Month Summary Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Payable Days</p>
            <p className="text-lg font-bold text-emerald-400 font-mono mt-0.5">{payroll?.payableDays} d</p>
            <p className="text-[10px] text-slate-500">{payroll?.fullPresentDays || 0} Full + {payroll?.paidWeeklyOffs || 0} Offs</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Total Leaves / Absent</p>
            <p className="text-lg font-bold text-rose-400 font-mono mt-0.5">{(payroll?.totalLeaves || payroll?.absentDays || 0)} d</p>
            <p className="text-[10px] text-slate-500">{payroll?.absentDays || 0} Absent, {payroll?.forfeitedWeeklyOffs || 0} Forfeited</p>
          </div>

          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 col-span-2 sm:col-span-1">
            <p className="text-[10px] font-semibold uppercase text-indigo-300">Total Overtime Hours</p>
            <p className="text-lg font-bold text-indigo-300 font-mono mt-0.5">
              {formatHours(payroll?.totalCombinedOtHours || ((payroll?.totalOtHours || 0) + (payroll?.totalSundayOtHours || 0)))} 🔥
            </p>
            <p className="text-[10px] text-indigo-400 font-mono">
              {formatHours(payroll?.totalOtHours || 0)} Wkday + {formatHours(payroll?.totalSundayOtHours || 0)} Sun
            </p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
            <p className="text-[10px] font-semibold uppercase text-amber-400">Sunday OT ☀️</p>
            <p className="text-lg font-bold text-amber-300 font-mono mt-0.5">{formatHours(payroll?.totalSundayOtHours || 0)}</p>
            <p className="text-[10px] text-amber-400 font-mono">₹{(payroll?.sundayOtPay || 0).toLocaleString('en-IN')} (2.0x)</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Total Worked Hours</p>
            <p className="text-lg font-bold text-sky-300 font-mono mt-0.5">{formatHours(payroll?.totalWorkedHours || 0)}</p>
            <p className="text-[10px] text-slate-500">{payroll?.sundayWorkedDays || 0} Sunday(s) worked</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Weekly Offs</p>
            <p className="text-lg font-bold text-sky-400 font-mono mt-0.5">{payroll?.paidWeeklyOffs || 0} Offs</p>
            <p className="text-[10px] text-sky-300">Paid Weekly Offs</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Base Pay</p>
            <p className="text-lg font-bold text-slate-200 font-mono mt-0.5">₹{(payroll?.basePay || 0).toLocaleString('en-IN')}</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Total OT Pay</p>
            <p className="text-lg font-bold text-indigo-300 font-mono mt-0.5">
              ₹{(payroll?.totalCombinedOtPay || ((payroll?.otPay || 0) + (payroll?.sundayOtPay || 0))).toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-indigo-400">₹{payroll?.otPay || 0} + ₹{payroll?.sundayOtPay || 0} Sun</p>
          </div>

          {(payroll?.customBonuses > 0 || payroll?.customDeductions > 0) && (
            <>
              {payroll?.customBonuses > 0 && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3">
                  <p className="text-[10px] font-semibold uppercase text-purple-400">Rule Bonuses 💰</p>
                  <p className="text-lg font-bold text-purple-300 font-mono mt-0.5">+ ₹{payroll.customBonuses.toLocaleString('en-IN')}</p>
                </div>
              )}
              {payroll?.customDeductions > 0 && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">
                  <p className="text-[10px] font-semibold uppercase text-rose-400">Rule Deductions</p>
                  <p className="text-lg font-bold text-rose-300 font-mono mt-0.5">- ₹{payroll.customDeductions.toLocaleString('en-IN')}</p>
                </div>
              )}
            </>
          )}

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Gross Salary</p>
            <p className="text-lg font-bold text-slate-200 font-mono mt-0.5">₹{(payroll?.grossSalary || 0).toLocaleString('en-IN')}</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Advances Deducted</p>
            <p className="text-lg font-bold text-amber-400 font-mono mt-0.5">− ₹{(payroll?.totalAdvances || 0).toLocaleString('en-IN')}</p>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 col-span-2 sm:col-span-1">
            <p className="text-[10px] font-semibold uppercase text-emerald-400">Net Payable</p>
            <p className="text-xl font-extrabold text-emerald-300 font-mono mt-0.5">₹{(payroll?.netPayable || 0).toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Day-by-Day Calendar Table */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-md font-bold text-white font-display">Daily Attendance Breakdown</h3>
          <span className="text-xs text-slate-400">Total {dailyRecords.length} Days Recorded</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Raw Swipes</th>
                <th className="px-4 py-3">Effective In</th>
                <th className="px-4 py-3">Effective Out</th>
                <th className="px-4 py-3 text-center">Reg Hrs (8h Duty)</th>
                <th className="px-4 py-3 text-center">OT Hrs (After 8h Work)</th>
                <th className="px-4 py-3 text-center">Sun OT</th>
                <th className="px-4 py-3 text-center">Total Hrs</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center no-print">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {dailyRecords.map(r => (
                <tr key={r.date} className={`hover:bg-slate-800/40 transition-colors ${r.status === 'Weekly Off (Worked OT)' ? 'bg-amber-500/5' : ''}`}>
                  <td className="px-4 py-3 font-mono font-semibold text-white">
                    {r.date} <span className="text-slate-500 font-normal">({r.weekday})</span>
                  </td>

                  <td className="px-4 py-3 font-mono text-slate-300">
                    {r.raw_swipes || <span className="text-slate-600 font-italic">No Swipe</span>}
                  </td>

                  <td className="px-4 py-3 font-mono text-slate-200">
                    {r.effective_in || '—'}
                  </td>

                  <td className="px-4 py-3 font-mono text-slate-200">
                    {r.effective_out || '—'}
                  </td>

                  <td className="px-4 py-3 text-center font-mono text-slate-300">
                    {formatHours(r.regular_hours)}
                  </td>

                  <td className="px-4 py-3 text-center font-mono text-indigo-300 font-medium">
                    {r.ot_hours > 0 ? formatHours(r.ot_hours) : '0h'}
                  </td>

                  <td className="px-4 py-3 text-center font-mono text-amber-300 font-medium">
                    {r.sunday_ot_hours > 0 ? `${formatHours(r.sunday_ot_hours)} ☀️` : '—'}
                  </td>

                  <td className="px-4 py-3 text-center font-mono font-bold text-white">
                    {formatHours(r.total_hours)}
                  </td>

                  <td className="px-4 py-3 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${getStatusBadge(r.status)}`}>
                      {r.status}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-center no-print">
                    <button
                      onClick={() => onEditRecord(r)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                      title="Manually Correct Record"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
