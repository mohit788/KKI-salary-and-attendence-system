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
  Unlock
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
  onOpenUnlockModal
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStaffNo, setEditingStaffNo] = useState(null);
  const [editSalaryValue, setEditSalaryValue] = useState('');
  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(localStorage.getItem('gsheets_webhook') || '');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

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
  const exportToExcel = () => {
    const exportData = filteredWorkers.map(w => {
      const row = {
        'Staff No.': w.staff_no,
        'Staff Name': w.staff_name,
        'Department': w.department || 'WORKER',
        'Payable Days': w.payroll?.payableDays || 0,
        'Full Present Days': w.payroll?.fullPresentDays || 0,
        'Short Days': w.payroll?.shortDays || 0,
        'Paid Weekly Offs': w.payroll?.paidWeeklyOffs || 0,
        'Sunday Worked Days': w.payroll?.sundayWorkedDays || 0,
        'Absent Days': w.payroll?.absentDays || 0,
        'Weekday OT Hours': w.payroll?.totalOtHours || 0,
        'Sunday OT Hours': w.payroll?.totalSundayOtHours || 0,
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
      ? ['Staff No', 'Name', 'Base Sal', 'Pay Days', 'Absent', 'Wk OT', 'Sun OT', 'Gross', 'Advances', 'Net Pay']
      : ['Staff No', 'Name', 'Department', 'Payable Days', 'Present Days', 'Absent Days', 'Wkday OT', 'Sunday OT', 'Total OT'];

    const tableRows = [];

    filteredWorkers.forEach(w => {
      const p = w.payroll || {};
      if (isPayrollUnlocked) {
        tableRows.push([
          w.staff_no,
          w.staff_name,
          `Rs. ${w.monthly_salary || 15000}`,
          p.payableDays || 0,
          p.absentDays || 0,
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
      
      {/* Top Header & Perfectly Aligned Action Bar */}
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
              ? 'Complete list of workers, duty hours, payable days, overtime pay, and net salary'
              : 'Complete list of workers, duty hours, payable days, and overtime breakdown'}
          </p>
        </div>

        {/* Action Buttons & Search Input */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Name / Staff No..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 border-2 border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 w-full sm:w-56 font-medium"
            />
          </div>

          <a
            href="/api/export/excel/timings"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 border border-blue-500 shadow-sm transition-all whitespace-nowrap"
          >
            <Clock className="w-3.5 h-3.5 text-blue-200" />
            <span>Timings (.xlsx)</span>
          </a>

          {isPayrollUnlocked ? (
            <>
              <a
                href="/api/export/excel"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 border border-emerald-500 shadow-sm transition-all whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Payroll (.xlsx)</span>
              </a>

              <button
                onClick={() => setShowSheetsModal(true)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border-2 border-slate-600 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>G-Sheets</span>
              </button>
            </>
          ) : (
            <button
              onClick={onOpenUnlockModal}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border-2 border-amber-500/60 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Unlock Payroll (.xlsx)</span>
            </button>
          )}

          <button
            onClick={exportToPDF}
            className="px-3 py-2 bg-rose-800 hover:bg-rose-700 text-white border border-rose-500 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Workers Table - Crisp Alignment, Single-Line Timings */}
      <div className="glass-card rounded-2xl border-2 border-slate-700 overflow-hidden shadow-lg bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-200">
            <thead className="bg-slate-950 text-slate-200 font-bold uppercase tracking-wider border-b-2 border-slate-700 text-xs">
              <tr>
                <th className="px-3.5 py-3.5 whitespace-nowrap">Staff No.</th>
                <th className="px-3.5 py-3.5 whitespace-nowrap">Worker Name</th>
                {isPayrollUnlocked && (
                  <th className="px-3.5 py-3.5 whitespace-nowrap text-right">Base Salary</th>
                )}
                <th className="px-3 py-3.5 text-center whitespace-nowrap">Payable Days</th>
                <th className="px-3 py-3.5 text-center whitespace-nowrap">Absent</th>
                <th className="px-3.5 py-3.5 text-center whitespace-nowrap text-blue-300">Wkday OT</th>
                <th className="px-3.5 py-3.5 text-center whitespace-nowrap text-amber-300">Sun OT ☀️</th>
                <th className="px-3.5 py-3.5 text-center whitespace-nowrap text-cyan-300">Total OT 🔥</th>
                {isPayrollUnlocked && (
                  <>
                    <th className="px-3.5 py-3.5 text-right whitespace-nowrap">Gross Pay</th>
                    <th className="px-3.5 py-3.5 text-right whitespace-nowrap">Advances</th>
                    <th className="px-3.5 py-3.5 text-right whitespace-nowrap text-emerald-300">Net Payable</th>
                  </>
                )}
                <th className="px-3.5 py-3.5 text-center whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan={isPayrollUnlocked ? 12 : 8} className="text-center py-12 text-slate-400 text-base">
                    No worker records found. Upload a punch file to get started.
                  </td>
                </tr>
              ) : (
                filteredWorkers.map(w => {
                  const p = w.payroll || {};
                  const totalOtSum = (p.totalOtHours || 0) + (p.totalSundayOtHours || 0);

                  return (
                    <tr 
                      key={w.staff_no} 
                      className="hover:bg-slate-800/80 transition-colors"
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
                          {p.incompleteDays > 0 && (
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" title={`${p.incompleteDays} days need review`} />
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
                              <button onClick={() => handleSaveSalary(w.staff_no)} className="p-1 rounded bg-emerald-700 text-white">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setEditingStaffNo(null)} className="p-1 rounded bg-slate-800 text-slate-300">
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
                        <span className="px-2.5 py-0.5 rounded-lg bg-emerald-950 text-emerald-300 font-bold font-mono text-xs border border-emerald-600 inline-block">
                          {p.payableDays || 0} d
                        </span>
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

                      {/* Wkday OT */}
                      <td className="px-3.5 py-3 text-center font-mono text-blue-300 font-bold whitespace-nowrap">
                        {p.totalOtHours > 0 ? formatHours(p.totalOtHours) : '0h'}
                      </td>

                      {/* Sunday OT */}
                      <td className="px-3.5 py-3 text-center font-mono text-amber-300 font-bold whitespace-nowrap">
                        {(p.totalSundayOtHours || 0) > 0 ? `${formatHours(p.totalSundayOtHours)}` : '—'}
                      </td>

                      {/* Total OT */}
                      <td className="px-3.5 py-3 text-center font-mono text-cyan-300 font-extrabold text-sm whitespace-nowrap">
                        {totalOtSum > 0 ? formatHours(totalOtSum) : '0h'}
                      </td>

                      {/* Financial columns if unlocked */}
                      {isPayrollUnlocked && (
                        <>
                          <td className="px-3.5 py-3 text-right font-mono text-slate-200 font-bold whitespace-nowrap">
                            ₹{(p.grossSalary || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono text-amber-300 font-bold whitespace-nowrap">
                            {(p.totalAdvances || 0) > 0 ? `− ₹${p.totalAdvances.toLocaleString('en-IN')}` : '₹0'}
                          </td>
                          <td className="px-3.5 py-3 text-right font-mono font-extrabold text-emerald-300 text-sm sm:text-base whitespace-nowrap">
                            ₹{(p.netPayable || 0).toLocaleString('en-IN')}
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

                          {isPayrollUnlocked && (
                            <button
                              onClick={() => onAddAdvance(w.staff_no)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-600 transition-all"
                              title="Log Advance Payment"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                            </button>
                          )}
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
