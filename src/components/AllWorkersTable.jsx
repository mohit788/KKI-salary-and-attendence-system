import React, { useState } from 'react';
import { 
  Search, 
  Download, 
  FileSpreadsheet, 
  Eye, 
  DollarSign, 
  Edit2, 
  Check, 
  X, 
  Clock,
  Lock,
  Unlock,
  AlertTriangle
} from 'lucide-react';
import { formatHours } from '../utils/formatters';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function AllWorkersTable({ 
  workers, 
  onSelectWorker, 
  onAddAdvance, 
  onUpdateSalary,
  isPayrollUnlocked = false,
  onOpenUnlockModal,
  onOpenIncompleteManager,
  selectedMonth
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStaffNo, setEditingStaffNo] = useState(null);
  const [editSalaryValue, setEditSalaryValue] = useState('');
  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(localStorage.getItem('gsheets_webhook') || '');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const monthQueryParam = selectedMonth && selectedMonth !== 'all' ? `?month=${selectedMonth}` : '';

  const handleGoogleSheetsSync = async (e) => {
    e.preventDefault();
    if (!webhookUrl) return;
    setSyncing(true);
    setSyncMsg('');
    localStorage.setItem('gsheets_webhook', webhookUrl);

    try {
      const res = await fetch('/api/google-sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook_url: webhookUrl }),
      }).then(r => r.json());

      if (res.success) {
        setSyncMsg('✅ Successfully live-synced payroll rows to Google Sheets!');
      } else {
        setSyncMsg('❌ Error: ' + res.error);
      }
    } catch (err) {
      setSyncMsg('❌ Failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Filter workers by search term
  const filteredWorkers = (workers || []).filter(w => 
    w.staff_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.staff_no.toString().includes(searchTerm) ||
    (w.department || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveSalary = (staffNo) => {
    if (editSalaryValue && !isNaN(editSalaryValue)) {
      onUpdateSalary(staffNo, parseFloat(editSalaryValue));
    }
    setEditingStaffNo(null);
  };

  // Export to Excel (Full or Timings)
  // Export Concise 6-Column Summary (Worker ID, Name, Payable Days, Absents, Sun/Hol Worked, Overtime)
  const exportConciseExcel = () => {
    const exportData = filteredWorkers.map(w => {
      const p = w.payroll || {};
      const totalOt = +((p.totalOtHours || 0) + (p.totalSundayOtHours || 0)).toFixed(2);
      const sunHolWorked = p.sundayAndHolidayWorkedDays !== undefined ? p.sundayAndHolidayWorkedDays : ((p.sundayWorkedDays || 0) + (p.holidayWorkedDays || 0));
      return {
        'Worker ID': w.staff_no,
        'Worker Name': w.staff_name,
        'Payable Days': p.payableDays || 0,
        'Absent Days': p.absentDays || 0,
        'Sun/Hol Worked (Days)': sunHolWorked,
        'Overtime (Hours)': totalOt,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 32 },
      { wch: 18 },
      { wch: 16 },
      { wch: 22 },
      { wch: 22 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Executive Summary');
    XLSX.writeFile(workbook, `Concise_Attendance_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportToExcel = () => {
    const exportData = filteredWorkers.map(w => {
      const sunHolWorked = w.payroll?.sundayAndHolidayWorkedDays !== undefined 
        ? w.payroll.sundayAndHolidayWorkedDays 
        : ((w.payroll?.sundayWorkedDays || 0) + (w.payroll?.holidayWorkedDays || 0));

      const row = {
        'Staff No.': w.staff_no,
        'Staff Name': w.staff_name,
        'Department': w.department || 'WORKER',
        'Payable Days': w.payroll?.payableDays || 0,
        'Full Present Days': w.payroll?.fullPresentDays || 0,
        'Short Days': w.payroll?.shortDays || 0,
        'Paid Weekly Offs': w.payroll?.paidWeeklyOffs || 0,
        'Paid Holidays': w.payroll?.paidHolidays || 0,
        'Sunday & Holiday Worked Days (Tea/Food Allowance)': sunHolWorked,
        'Sunday Worked Days': w.payroll?.sundayWorkedDays || 0,
        'Absent Days': w.payroll?.absentDays || 0,
        'Weekday OT Hours': w.payroll?.totalOtHours || 0,
        'Sunday OT Hours': w.payroll?.totalSundayOtHours || 0,
        'Total OT Hours': +((w.payroll?.totalOtHours || 0) + (w.payroll?.totalSundayOtHours || 0)).toFixed(2),
      };

      if (isPayrollUnlocked) {
        row['Monthly Base Salary (₹)'] = w.payroll?.monthlySalary || 15000;
        row['Base Pay (₹)'] = w.payroll?.basePay || 0;
        row['OT Pay (₹)'] = w.payroll?.otPay || 0;
        row['Sunday OT Pay (₹)'] = w.payroll?.sundayOtPay || 0;
        row['Gross Salary (₹)'] = w.payroll?.grossSalary || 0;
        row['Advances Deducted (₹)'] = w.payroll?.totalAdvances || 0;
        row['Net Payable (₹)'] = w.payroll?.netPayable || 0;
      }

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, isPayrollUnlocked ? 'Payroll Summary' : 'Attendance Summary');
    XLSX.writeFile(workbook, `Workers_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export PDF
  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(16);
    doc.text(isPayrollUnlocked ? 'Factory Monthly Payroll Summary' : 'Factory Biometric Attendance Summary', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);

    const tableColumn = isPayrollUnlocked
      ? ['Staff No', 'Name', 'Base Sal', 'Pay Days', 'Absent', 'Sun/Hol Work ☕', 'Wk OT', 'Sun OT', 'Gross', 'Advances', 'Net Pay']
      : ['Staff No', 'Name', 'Department', 'Payable Days', 'Present Days', 'Absent Days', 'Sun/Hol Work ☕', 'Wkday OT', 'Sunday OT', 'Total OT'];

    const tableRows = [];

    filteredWorkers.forEach(w => {
      const p = w.payroll || {};
      const sunHolWorked = p.sundayAndHolidayWorkedDays !== undefined ? p.sundayAndHolidayWorkedDays : ((p.sundayWorkedDays || 0) + (p.holidayWorkedDays || 0));
      if (isPayrollUnlocked) {
        tableRows.push([
          w.staff_no,
          w.staff_name,
          `Rs. ${w.monthly_salary || 15000}`,
          p.payableDays || 0,
          p.absentDays || 0,
          `${sunHolWorked} d`,
          `${p.totalOtHours || 0}h`,
          `${p.totalSundayOtHours || 0}h`,
          `Rs. ${p.grossSalary || 0}`,
          `Rs. ${p.totalAdvances || 0}`,
          `Rs. ${p.netPayable || 0}`,
        ]);
      } else {
        const totalOtSum = (p.totalOtHours || 0) + (p.totalSundayOtHours || 0);
        tableRows.push([
          w.staff_no,
          w.staff_name,
          w.department || 'WORKER',
          `${p.payableDays || 0} d`,
          `${p.fullPresentDays || 0} d`,
          `${p.absentDays || 0} d`,
          `${sunHolWorked} d`,
          formatHours(p.totalOtHours || 0),
          formatHours(p.totalSundayOtHours || 0),
          formatHours(totalOtSum),
        ]);
      }
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 28,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 8 },
    });

    doc.save(`Workers_Attendance_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-slate-100">
      
      {/* Top Header & Prominent Action Bar */}
      <div className="glass-card rounded-2xl p-5 sm:p-6 border-2 border-slate-700 bg-slate-900 shadow-md flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white font-display flex items-center gap-3">
            <span>{isPayrollUnlocked ? 'All Workers Payroll Summary' : 'All Workers Attendance Summary'}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-950 text-cyan-300 font-mono font-bold border border-blue-600">
              {filteredWorkers.length} Employees
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-0.5 font-medium">
            {isPayrollUnlocked 
              ? 'Complete list of workers, duty hours, payable days, Sunday/Holiday tea allowance, overtime pay, and net salary'
              : 'Complete list of workers, duty hours, payable days, Sunday/Holiday duty, and overtime breakdown'}
          </p>
        </div>

        {/* Action Buttons & Enlarged Prominent Search Input */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-between xl:justify-end">
          
          {/* EXTRA LARGE, PROMINENT & SPACIOUS SEARCH BAR */}
          <div className="relative w-full sm:w-[520px] md:w-[650px] lg:w-[760px] xl:w-[850px]">
            <Search className="w-6 h-6 text-cyan-400 absolute left-4.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Worker by Name, ID (#341), Dept..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950/95 border-2 border-slate-600 hover:border-cyan-500/60 focus:border-cyan-400 rounded-2xl pl-14 pr-12 py-3.5 text-base sm:text-lg text-white placeholder-slate-400 focus:outline-none w-full font-bold shadow-2xl shadow-cyan-950/30 focus:ring-4 focus:ring-cyan-500/20 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition-colors"
                title="Clear Search"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {workers.some(w => w.payroll?.hasIncompleteEntries || (w.payroll?.incompleteDays || 0) > 0) ? (
            <button
              onClick={() => onOpenIncompleteManager && onOpenIncompleteManager()}
              className="px-4 py-2 bg-amber-950 text-amber-300 border-2 border-amber-500 rounded-xl text-xs font-bold flex items-center space-x-2 shadow-md transition-all whitespace-nowrap cursor-pointer hover:bg-amber-900 animate-pulse"
              title="Reports Locked: Click here to fix all incomplete punches in Fast-Fix Center first"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>🔒 Reports Locked ({workers.reduce((acc, w) => acc + (w.payroll?.incompleteDays || 0), 0)} Incomplete — Click to Fix)</span>
            </button>
          ) : (
            <>
              {/* 5-Col Summary */}
              <a
                href={`/api/export/excel/summary${monthQueryParam}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-teal-700 hover:bg-teal-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 border border-teal-500 shadow-sm transition-all whitespace-nowrap cursor-pointer"
                title="Download Concise 5-Column Summary (Worker ID, Name, Payable Days, Absents, Overtime)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-teal-200" />
                <span>5-Col (.xlsx)</span>
              </a>

              {/* Deducted Holidays & Forfeited Offs Report */}
              <a
                href={`/api/export/excel/deducted-holidays-and-offs${monthQueryParam}${workers.some(w => (w.payroll?.incompleteDays || 0) > 0) ? (monthQueryParam ? '&' : '?') + 'allow_incomplete=true' : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-rose-900/90 hover:bg-rose-800 text-rose-100 rounded-xl text-xs font-bold flex items-center space-x-1.5 border border-rose-500 shadow-sm transition-all whitespace-nowrap cursor-pointer"
                title="Download Deducted Holidays & Forfeited Sundays Report with detailed reasons"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-rose-300" />
                <span>Deducted Offs (.xlsx)</span>
              </a>

              {/* Paid Holidays & Off-Days Duty Report */}
              <a
                href={`/api/export/excel/paid-holidays-and-off-duty${monthQueryParam}${workers.some(w => (w.payroll?.incompleteDays || 0) > 0) ? (monthQueryParam ? '&' : '?') + 'allow_incomplete=true' : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-indigo-800 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 border border-indigo-500 shadow-sm transition-all whitespace-nowrap cursor-pointer"
                title="Download Paid Holidays breakdown and off-days worked with duty descriptions"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-300" />
                <span>Holiday & Off Duty (.xlsx)</span>
              </a>

              {/* Timings */}
              <a
                href={`/api/export/excel/timings${monthQueryParam}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 border border-blue-500 shadow-sm transition-all whitespace-nowrap cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-blue-200" />
                <span>Timings (.xlsx)</span>
              </a>

              {/* Fixes Audit */}
              <a
                href={`/api/export/excel/fixes-audit${monthQueryParam}${workers.some(w => (w.payroll?.incompleteDays || 0) > 0) ? (monthQueryParam ? '&' : '?') + 'allow_incomplete=true' : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-amber-800 hover:bg-amber-700 text-amber-100 rounded-xl text-xs font-bold flex items-center space-x-1.5 border border-amber-500 shadow-sm transition-all whitespace-nowrap cursor-pointer"
                title="Download audit of all worker fixes, manual punch timings filled, and management overrides"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-300" />
                <span>Fixes Audit (.xlsx)</span>
              </a>

              {isPayrollUnlocked ? (
                <>
                  <a
                    href={`/api/export/excel${monthQueryParam}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 border border-emerald-500 shadow-sm transition-all whitespace-nowrap cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Payroll (.xlsx)</span>
                  </a>

                  <button
                    onClick={() => setShowSheetsModal(true)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border-2 border-slate-600 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>G-Sheets</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={onOpenUnlockModal}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border-2 border-amber-500/60 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Unlock Payroll (.xlsx)</span>
                </button>
              )}

              <button
                onClick={exportToPDF}
                className="px-3 py-2 bg-rose-800 hover:bg-rose-700 text-white border border-rose-500 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Workers Table - Crisp Alignment, Sticky Header & Partition Lines */}
      <div className="glass-card rounded-2xl border-2 border-slate-700 overflow-hidden shadow-lg bg-slate-900">
        <div className="overflow-x-auto overflow-y-auto max-h-[72vh] relative">
          <table className="w-full text-left text-sm text-slate-200 border-collapse">
            <thead className="sticky top-0 bg-slate-950 z-20 text-slate-200 font-bold uppercase tracking-wider border-b-2 border-slate-700 text-xs shadow-md">
              <tr className="divide-x divide-slate-800">
                <th className="px-3.5 py-3.5 whitespace-nowrap bg-slate-950">Staff No.</th>
                <th className="px-3.5 py-3.5 whitespace-nowrap bg-slate-950">Worker Name</th>
                {isPayrollUnlocked && (
                  <th className="px-3.5 py-3.5 whitespace-nowrap text-right bg-slate-950">Base Salary</th>
                )}
                <th className="px-3 py-3.5 text-center whitespace-nowrap bg-slate-950">Payable Days</th>
                <th className="px-3 py-3.5 text-center whitespace-nowrap bg-slate-950">Absent</th>
                <th className="px-3 py-3.5 text-center whitespace-nowrap text-amber-300 bg-slate-950" title="Sunday & Paid Holiday Worked Days for Tea/Food Reimbursement">Sun/Hol Work ☕</th>
                <th className="px-3.5 py-3.5 text-center whitespace-nowrap text-blue-300 bg-slate-950">Wkday OT</th>
                <th className="px-3.5 py-3.5 text-center whitespace-nowrap text-amber-300 bg-slate-950">Sun OT ☀️</th>
                <th className="px-3.5 py-3.5 text-center whitespace-nowrap text-cyan-300 bg-slate-950">Total OT 🔥</th>
                {isPayrollUnlocked && (
                  <>
                    <th className="px-3.5 py-3.5 text-right whitespace-nowrap bg-slate-950">Gross Pay</th>
                    <th className="px-3.5 py-3.5 text-right whitespace-nowrap bg-slate-950">Advances</th>
                    <th className="px-3.5 py-3.5 text-right whitespace-nowrap text-emerald-300 bg-slate-950">Net Payable</th>
                  </>
                )}
                <th className="px-3.5 py-3.5 text-center whitespace-nowrap bg-slate-950">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan={isPayrollUnlocked ? 13 : 9} className="text-center py-12 text-slate-400 text-base">
                    No worker records found. Upload a punch file to get started.
                  </td>
                </tr>
              ) : (
                filteredWorkers.map(w => {
                  const p = w.payroll || {};
                  const totalOtSum = (p.totalOtHours || 0) + (p.totalSundayOtHours || 0);
                  const sunHolWorked = p.sundayAndHolidayWorkedDays !== undefined ? p.sundayAndHolidayWorkedDays : ((p.sundayWorkedDays || 0) + (p.holidayWorkedDays || 0));

                  return (
                    <tr 
                      key={w.staff_no} 
                      className="hover:bg-slate-800/90 transition-colors divide-x divide-slate-800/80 even:bg-slate-950/40 odd:bg-slate-900/60"
                    >
                      {/* Staff No */}
                      <td className="px-3.5 py-3 font-mono font-bold text-cyan-300 whitespace-nowrap">
                        <span className="bg-slate-950 px-2 py-0.5 rounded-md border border-slate-700 inline-block">
                          #{w.staff_no}
                        </span>
                      </td>

                      {/* Worker Name & Department */}
                      <td className="px-3.5 py-3 font-bold text-white whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm sm:text-base">{w.staff_name}</span>
                          {p.hasIncompleteEntries && (
                            <button
                              onClick={() => onOpenIncompleteManager && onOpenIncompleteManager(w.staff_no)}
                              className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500 text-[10px] font-bold font-mono hover:bg-amber-900 transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                              title={`${p.incompleteDays} incomplete day(s) - Click to resolve`}
                            >
                              <span>⚠️ {p.incompleteDays} Incomplete (Locked)</span>
                            </button>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-normal block">
                          {w.department || 'WORKER'}
                        </span>
                      </td>

                      {/* Base Salary (if unlocked) */}
                      {isPayrollUnlocked && (
                        <td className="px-3.5 py-3 text-right whitespace-nowrap">
                          {editingStaffNo === w.staff_no ? (
                            <div className="flex items-center justify-end space-x-1">
                              <input
                                type="number"
                                value={editSalaryValue}
                                onChange={(e) => setEditSalaryValue(e.target.value)}
                                className="w-20 bg-slate-950 border-2 border-blue-500 rounded px-1.5 py-0.5 text-xs text-white font-mono"
                                autoFocus
                              />
                              <button onClick={() => handleSaveSalary(w.staff_no)} className="p-1 rounded bg-emerald-700 text-white cursor-pointer">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setEditingStaffNo(null)} className="p-1 rounded bg-slate-800 text-slate-300 cursor-pointer">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div 
                              className="flex items-center justify-end space-x-1 group cursor-pointer" 
                              onClick={() => { setEditingStaffNo(w.staff_no); setEditSalaryValue(w.monthly_salary || 15000); }}
                            >
                              <span className="font-mono font-bold text-slate-200 text-sm">
                                ₹{(w.monthly_salary || 15000).toLocaleString('en-IN')}
                              </span>
                              <Edit2 className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          )}
                        </td>
                      )}

                      {/* Payable Days */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        {p.hasIncompleteEntries ? (
                          <span 
                            onClick={() => onOpenIncompleteManager && onOpenIncompleteManager(w.staff_no)}
                            className="px-2 py-0.5 rounded-lg bg-amber-950/80 text-amber-400 font-bold font-mono text-[11px] border border-amber-600 inline-block cursor-pointer hover:bg-amber-900"
                            title="Locked: Resolve missing punches to calculate payable days"
                          >
                            ⚠️ Locked
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-lg bg-emerald-950 text-emerald-300 font-bold font-mono text-xs border border-emerald-600 inline-block">
                            {p.payableDays || 0} d
                          </span>
                        )}
                      </td>

                      {/* Absent Days */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-lg font-bold font-mono text-xs inline-block ${
                          (p.absentDays || 0) > 0 
                            ? 'bg-rose-950 text-rose-300 border border-rose-600' 
                            : 'text-slate-500'
                        }`}>
                          {p.absentDays || 0}
                        </span>
                      </td>

                      {/* Sunday & Holiday Worked Days (Tea/Food Allowance) */}
                      <td className="px-3 py-3 text-center whitespace-nowrap font-mono">
                        {p.hasIncompleteEntries ? (
                          <span className="text-amber-400/80 text-xs font-medium">⚠️ Hold</span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-lg font-bold text-xs inline-block ${
                            sunHolWorked > 0
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-600' 
                              : 'text-slate-500'
                          }`}
                          title={`Tea/Food Expense: ${p.sundayWorkedDays || 0} Sundays + ${p.holidayWorkedDays || 0} Paid Holidays`}
                          >
                            {sunHolWorked} d
                          </span>
                        )}
                      </td>

                      {/* Wkday OT */}
                      <td className="px-3.5 py-3 text-center font-mono text-blue-300 font-bold whitespace-nowrap">
                        {p.hasIncompleteEntries ? (
                          <span className="text-amber-400/80 text-xs font-medium">⚠️ Hold</span>
                        ) : (
                          p.totalOtHours > 0 ? formatHours(p.totalOtHours) : '0h'
                        )}
                      </td>

                      {/* Sunday OT */}
                      <td className="px-3.5 py-3 text-center font-mono text-amber-300 font-bold whitespace-nowrap">
                        {p.hasIncompleteEntries ? (
                          <span className="text-amber-400/80 text-xs font-medium">⚠️ Hold</span>
                        ) : (
                          (p.totalSundayOtHours || 0) > 0 ? `${formatHours(p.totalSundayOtHours)}` : '—'
                        )}
                      </td>

                      {/* Total OT */}
                      <td className="px-3.5 py-3 text-center font-mono text-cyan-300 font-extrabold text-sm whitespace-nowrap">
                        {p.hasIncompleteEntries ? (
                          <span className="text-amber-400/80 text-xs font-medium">⚠️ Hold</span>
                        ) : (
                          totalOtSum > 0 ? formatHours(totalOtSum) : '0h'
                        )}
                      </td>

                      {/* Financial columns if unlocked */}
                      {isPayrollUnlocked && (
                        <>
                          <td className="px-3.5 py-3 text-right font-mono text-slate-200 font-bold whitespace-nowrap">
                            {p.hasIncompleteEntries ? (
                              <span className="text-amber-400 text-xs font-bold">⚠️ On Hold</span>
                            ) : (
                              `₹${(p.grossSalary || 0).toLocaleString('en-IN')}`
                            )}
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono text-amber-300 font-bold whitespace-nowrap">
                            {(p.totalAdvances || 0) > 0 ? `− ₹${p.totalAdvances.toLocaleString('en-IN')}` : '₹0'}
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono font-extrabold text-emerald-300 text-sm sm:text-base whitespace-nowrap">
                            {p.hasIncompleteEntries ? (
                              <span className="text-amber-300 text-xs font-bold bg-amber-950/80 px-2 py-1 rounded border border-amber-600">
                                ⚠️ Locked (Fix Punches)
                              </span>
                            ) : (
                              `₹${(p.netPayable || 0).toLocaleString('en-IN')}`
                            )}
                          </td>
                        </>
                      )}

                      {/* Action buttons */}
                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => onSelectWorker(w.staff_no)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs flex items-center space-x-1 border border-blue-500 shadow transition-all"
                            title="View Worker Attendance & Report"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>

                          <button
                            onClick={() => onAddAdvance(w.staff_no)}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-800 hover:bg-purple-700 text-white font-bold text-xs flex items-center space-x-1 border border-purple-600 shadow transition-all"
                            title="Record Advance Payment"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>Advance</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Google Sheets Modal */}
      {showSheetsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="glass-modal w-full max-w-lg rounded-2xl p-6 shadow-2xl border-2 border-slate-600 animate-in fade-in zoom-in duration-200 bg-slate-900">
            <div className="flex items-center justify-between border-b-2 border-slate-700 pb-4 mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-600 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white font-display">Google Sheets Live Sync</h3>
                  <p className="text-xs text-slate-300">Sync live payroll summary directly to your Google Sheet</p>
                </div>
              </div>
              <button onClick={() => setShowSheetsModal(false)} className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-slate-800">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleGoogleSheetsSync} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">
                  Google Apps Script Webhook URL
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full bg-slate-950 border-2 border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  required
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  Enter your deployed Google Apps Script Web App URL to auto-push all worker rows.
                </p>
              </div>

              {syncMsg && (
                <div className={`p-3.5 rounded-xl text-sm font-bold ${syncMsg.includes('✅') ? 'bg-emerald-950 text-emerald-300 border border-emerald-600' : 'bg-rose-950 text-rose-300 border border-rose-600'}`}>
                  {syncMsg}
                </div>
              )}

              <div className="flex justify-end space-x-3 border-t-2 border-slate-700 pt-4 mt-4">
                <button
                  type="button"
                  onClick={() => setShowSheetsModal(false)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-600 transition-all"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={syncing || !webhookUrl}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-xl shadow-md border border-emerald-500 transition-all disabled:opacity-50"
                >
                  {syncing ? 'Syncing Rows...' : 'Push Live Data to Google Sheets'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
