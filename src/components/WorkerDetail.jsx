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
  onAddAdvance,
  isPayrollUnlocked = false,
  onOpenUnlockModal
}) {
  if (!workerData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-300 space-y-4">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-base font-semibold text-slate-200">Loading worker attendance profile...</p>
        <button
          onClick={onBack}
          className="mt-2 text-xs font-bold text-slate-300 hover:text-white px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-all cursor-pointer shadow-md"
        >
          ← Back to Workers Table
        </button>
      </div>
    );
  }

  const { worker, dailyRecords = [], advances = [], auditLogs = [], payroll } = workerData;

  const handlePrint = () => {
    window.print();
  };

  const totalRegularDutyHours = dailyRecords.reduce((acc, r) => acc + (parseFloat(r.regular_hours) || 0), 0);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Present (Full)':
        return 'bg-emerald-950 text-emerald-300 border-emerald-600';
      case 'Present (Short)':
        return 'bg-amber-950 text-amber-300 border-amber-600';
      case 'Absent':
        return 'bg-rose-950 text-rose-300 border-rose-600';
      case 'Weekly Off (Paid)':
        return 'bg-blue-950 text-blue-300 border-blue-600';
      case 'Weekly Off (Worked OT)':
        return 'bg-amber-950 text-amber-300 border-amber-600';
      case 'Weekly Off (Forfeited)':
        return 'bg-slate-800 text-slate-300 border-slate-600';
      case 'Incomplete':
        return 'bg-orange-950 text-orange-300 border-orange-600';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-slate-100">
      
      {/* Top Action Bar */}
      <div className="flex items-center justify-between no-print">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-sm font-bold text-slate-200 hover:text-white px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-all"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
          <span>Back to All Workers</span>
        </button>

        <div className="flex items-center space-x-3">
          {isPayrollUnlocked && (
            <button
              onClick={() => onAddAdvance(staffNo)}
              className="flex items-center space-x-1.5 px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-600 transition-all"
            >
              <DollarSign className="w-4 h-4" />
              <span>Add Advance Payment</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-5 py-2.5 text-xs font-bold rounded-xl bg-blue-700 hover:bg-blue-600 text-white shadow-md border border-blue-500 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* CALCULATION LOCKED WARNING BANNER */}
      {payroll?.hasIncompleteEntries && (
        <div className="bg-amber-950/80 border-2 border-amber-500 rounded-2xl p-4.5 text-amber-200 shadow-xl flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <span>⚠️ Salary & Totals Calculation On Hold ({payroll.incompleteDays} Incomplete Days)</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold font-mono">Action Required</span>
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                This employee has {payroll.incompleteDays} attendance entry(ies) with missing punch swipes. Please complete all missing punches in the breakdown below to unlock salary generation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Printable Report Header */}
      <div className="glass-card rounded-2xl p-6 border-2 border-slate-700 bg-slate-900 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b-2 border-slate-700">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-950 text-cyan-300 border-2 border-blue-600 flex items-center justify-center font-bold text-2xl font-mono shadow-md">
              #{worker.staff_no}
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white font-display">{worker.staff_name}</h2>
              <div className="flex items-center space-x-3 text-sm text-slate-300 mt-1 font-medium">
                <span>Dept: <strong className="text-white">{worker.department || 'WORKER'}</strong></span>
                <span>•</span>
                <span>Staff ID: <strong className="text-cyan-300 font-mono">#{worker.staff_no}</strong></span>
                {isPayrollUnlocked && (
                  <>
                    <span>•</span>
                    <span>Monthly Base: <strong className="text-emerald-300 font-mono">₹{(worker.monthly_salary || 15000).toLocaleString('en-IN')}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Rate Card (Only if unlocked) */}
          {isPayrollUnlocked ? (
            <div className="flex items-center space-x-4 bg-slate-950 border-2 border-slate-700 p-3.5 rounded-xl text-sm font-mono flex-wrap gap-y-2">
              <div>
                <p className="text-slate-400 text-xs uppercase font-bold">Per-Day Rate</p>
                <p className="text-base font-extrabold text-white">₹{payroll?.perDayRate} / day</p>
              </div>
              <div className="border-l-2 border-slate-800 pl-4">
                <p className="text-slate-400 text-xs uppercase font-bold">OT Rate (Wkday)</p>
                <p className="text-base font-extrabold text-blue-300">₹{payroll?.hourlyOtRate} / hr</p>
              </div>
              <div className="border-l-2 border-slate-800 pl-4">
                <p className="text-slate-400 text-xs uppercase font-bold">Sunday OT Rate ☀️</p>
                <p className="text-base font-extrabold text-amber-300">₹{payroll?.hourlySundayOtRate} / hr</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-3 bg-slate-950 border-2 border-slate-700 px-4 py-3 rounded-xl text-xs font-mono">
              <span className="text-slate-400">Duty Model:</span>
              <span className="text-cyan-300 font-bold">8.0 Hours Shift + 30m Lunch</span>
            </div>
          )}
        </div>

        {/* Month Summary Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mt-6">
          <div className="bg-slate-950 border border-slate-700 rounded-xl p-3.5">
            <p className="text-xs font-bold uppercase text-slate-300">Payable Days</p>
            {payroll?.hasIncompleteEntries ? (
              <p className="text-sm font-extrabold text-amber-400 font-mono mt-1">⚠️ Locked ({payroll.incompleteDays} Incomplete)</p>
            ) : (
              <p className="text-xl font-extrabold text-emerald-300 font-mono mt-1">{payroll?.payableDays || 0} d</p>
            )}
            <p className="text-xs text-slate-400 mt-0.5">{payroll?.fullPresentDays || 0} Full + {payroll?.paidWeeklyOffs || 0} Offs</p>
          </div>

          <div className="bg-slate-950 border border-slate-700 rounded-xl p-3.5">
            <p className="text-xs font-bold uppercase text-slate-300">Leaves / Absent</p>
            <p className="text-xl font-extrabold text-rose-300 font-mono mt-1">{(payroll?.totalLeaves || payroll?.absentDays || 0)} d</p>
            <p className="text-xs text-slate-400 mt-0.5">{payroll?.absentDays || 0} Pure Absent</p>
          </div>

          <div className="bg-blue-950/60 border border-blue-600/60 rounded-xl p-3.5">
            <p className="text-xs font-bold uppercase text-blue-300">Total OT Hours</p>
            {payroll?.hasIncompleteEntries ? (
              <p className="text-sm font-extrabold text-amber-400 font-mono mt-1">⚠️ On Hold</p>
            ) : (
              <p className="text-xl font-extrabold text-cyan-300 font-mono mt-1">
                {formatHours(payroll?.totalCombinedOtHours || ((payroll?.totalOtHours || 0) + (payroll?.totalSundayOtHours || 0)))}
              </p>
            )}
            <p className="text-xs text-blue-300 font-mono">
              {formatHours(payroll?.totalOtHours || 0)} Wk + {formatHours(payroll?.totalSundayOtHours || 0)} Sun
            </p>
          </div>

          <div className="bg-amber-950/60 border border-amber-600/60 rounded-xl p-3.5">
            <p className="text-xs font-bold uppercase text-amber-300">Sunday OT ☀️</p>
            {payroll?.hasIncompleteEntries ? (
              <p className="text-sm font-extrabold text-amber-400 font-mono mt-1">⚠️ On Hold</p>
            ) : (
              <p className="text-xl font-extrabold text-amber-300 font-mono mt-1">{formatHours(payroll?.totalSundayOtHours || 0)}</p>
            )}
            <p className="text-xs text-amber-300 font-mono">
              {isPayrollUnlocked ? `₹${(payroll?.sundayOtPay || 0).toLocaleString('en-IN')}` : 'Sunday Duty OT'}
            </p>
          </div>

          {isPayrollUnlocked ? (
            <>
              <div className="bg-slate-950 border border-slate-700 rounded-xl p-3.5">
                <p className="text-xs font-bold uppercase text-slate-300">Advances Deducted</p>
                <p className="text-xl font-extrabold text-amber-300 font-mono mt-1">− ₹{(payroll?.totalAdvances || 0).toLocaleString('en-IN')}</p>
                <p className="text-xs text-slate-400 mt-0.5">Ledger records</p>
              </div>

              <div className="bg-emerald-950/80 border-2 border-emerald-600 rounded-xl p-3.5 shadow-md">
                <p className="text-xs font-bold uppercase text-emerald-300">Net Payable</p>
                {payroll?.hasIncompleteEntries ? (
                  <p className="text-sm font-extrabold text-amber-300 font-mono mt-1">⚠️ Locked (Fix Punches)</p>
                ) : (
                  <p className="text-2xl font-extrabold text-emerald-300 font-mono mt-1">₹{(payroll?.netPayable || 0).toLocaleString('en-IN')}</p>
                )}
                <p className="text-xs text-emerald-400 font-semibold mt-0.5">Final Payout</p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-slate-950 border border-slate-700 rounded-xl p-3.5">
                <p className="text-xs font-bold uppercase text-slate-300">Total Regular Duty</p>
                {payroll?.hasIncompleteEntries ? (
                  <p className="text-sm font-extrabold text-amber-400 font-mono mt-1">⚠️ On Hold</p>
                ) : (
                  <p className="text-xl font-extrabold text-slate-100 font-mono mt-1">{formatHours(totalRegularDutyHours)}</p>
                )}
                <p className="text-xs text-slate-400 mt-0.5">8h Standard Hours</p>
              </div>

              <div className="bg-slate-950 border border-slate-700 rounded-xl p-3.5">
                <p className="text-xs font-bold uppercase text-slate-300">Recorded Swipes</p>
                <p className="text-xl font-extrabold text-emerald-300 font-mono mt-1">{dailyRecords.length} d</p>
                <p className="text-xs text-slate-400 mt-0.5">Evaluated Month Logs</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Day-by-Day Calendar Table */}
      <div className="glass-card rounded-2xl border-2 border-slate-700 overflow-hidden shadow-lg bg-slate-900">
        <div className="p-4 border-b-2 border-slate-700 bg-slate-950 flex items-center justify-between">
          <h3 className="text-base font-bold text-white font-display">Daily Attendance Breakdown</h3>
          <span className="text-sm text-slate-300 font-bold">{dailyRecords.length} Days Recorded</span>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[68vh] relative">
          <table className="w-full text-left text-sm text-slate-200 border-collapse">
            <thead className="sticky top-0 bg-slate-950 z-20 text-slate-200 font-bold uppercase tracking-wider border-b-2 border-slate-700 text-xs shadow-md">
              <tr className="divide-x divide-slate-800">
                <th className="px-4 py-3.5 bg-slate-950">Date</th>
                <th className="px-4 py-3.5 bg-slate-950">Raw Swipes</th>
                <th className="px-3 py-3.5 text-center text-teal-300 bg-slate-950">Shift</th>
                <th className="px-4 py-3.5 text-center bg-slate-950">Effective In</th>
                <th className="px-4 py-3.5 text-center bg-slate-950">Effective Out</th>
                <th className="px-4 py-3.5 text-center bg-slate-950">Reg Hrs (8h Duty)</th>
                <th className="px-4 py-3.5 text-center text-blue-300 bg-slate-950">OT Hrs</th>
                <th className="px-4 py-3.5 text-center text-amber-300 bg-slate-950">Sun OT ☀️</th>
                <th className="px-4 py-3.5 text-center bg-slate-950">Total Hrs</th>
                <th className="px-4 py-3.5 text-center bg-slate-950">Status</th>
                <th className="px-4 py-3.5 text-center no-print bg-slate-950">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {dailyRecords.map(r => {
                const isManual = r.is_manual_override === 1 || r.is_manual_override === true;

                return (
                  <tr 
                    key={r.date} 
                    className={`transition-colors divide-x divide-slate-800/80 ${
                      isManual 
                        ? 'bg-violet-950/25 hover:bg-violet-900/35 border-l-4 border-l-violet-500' 
                        : r.status === 'Weekly Off (Worked OT)' 
                          ? 'bg-amber-950/30 hover:bg-slate-800/90' 
                          : 'even:bg-slate-950/40 odd:bg-slate-900/60 hover:bg-slate-800/90'
                    }`}
                  >
                    <td className="px-4 py-3.5 font-mono font-bold text-white whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span>{r.date} <span className="text-slate-400 font-normal">({r.weekday})</span></span>
                        {isManual && (
                          <span 
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-900/90 text-violet-200 border border-violet-500 flex items-center gap-1 shadow-sm"
                            title={r.override_reason || 'Manual Admin Correction'}
                          >
                            <Edit3 className="w-2.5 h-2.5 text-violet-300" />
                            <span>Manual Edit</span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 font-mono text-slate-200">
                      {r.raw_swipes ? (
                        <span className="bg-slate-950 px-2.5 py-1 rounded border border-slate-700 text-xs font-bold text-cyan-300">
                          {r.raw_swipes}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">No Swipe</span>
                      )}
                    </td>

                    <td className="px-3 py-3.5 font-mono text-center">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-950/80 text-teal-300 border border-teal-700/60 shadow-sm">
                        {r.shift || '08:00'}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 font-mono text-center text-emerald-300 font-bold">
                      {r.effective_in || '—'}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-center text-emerald-300 font-bold">
                      {r.effective_out || '—'}
                    </td>

                    <td className="px-4 py-3.5 text-center font-mono text-slate-100 font-bold">
                      {formatHours(r.regular_hours)}
                    </td>

                    <td className="px-4 py-3.5 text-center font-mono text-blue-300 font-bold">
                      {r.ot_hours > 0 ? formatHours(r.ot_hours) : '0h'}
                    </td>

                    <td className="px-4 py-3.5 text-center font-mono text-amber-300 font-bold">
                      {r.sunday_ot_hours > 0 ? `${formatHours(r.sunday_ot_hours)} ☀️` : '—'}
                    </td>

                    <td className="px-4 py-3.5 text-center font-mono font-extrabold text-white text-base">
                      {formatHours(r.total_hours)}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${getStatusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-center no-print">
                      <button
                        onClick={() => onEditRecord(r)}
                        className="p-1.5 rounded-lg bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-700 transition-all"
                        title="Edit Record"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
