import React, { useState } from 'react';
import { 
  Search, 
  Download, 
  FileSpreadsheet, 
  FileCheck, 
  Eye, 
  DollarSign, 
  Edit2, 
  Check, 
  X,
  UserCheck,
  Clock
} from 'lucide-react';
import { formatHours } from '../utils/formatters';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function AllWorkersTable({ workers, onSelectWorker, onAddAdvance, onUpdateSalary }) {
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

  // Export to Excel
  const exportToExcel = () => {
    const exportData = filteredWorkers.map(w => ({
      'Staff No.': w.staff_no,
      'Staff Name': w.staff_name,
      'Department': w.department || 'WORKER',
      'Monthly Base Salary': w.payroll?.monthlySalary || 15000,
      'Payable Days': w.payroll?.payableDays || 0,
      'Full Present Days': w.payroll?.fullPresentDays || 0,
      'Short Days': w.payroll?.shortDays || 0,
      'Paid Weekly Offs': w.payroll?.paidWeeklyOffs || 0,
      'Forfeited Weekly Offs': w.payroll?.forfeitedWeeklyOffs || 0,
      'Sunday Worked Days': w.payroll?.sundayWorkedDays || 0,
      'Absent Days': w.payroll?.absentDays || 0,
      'Weekday OT Hours': w.payroll?.totalOtHours || 0,
      'Sunday OT Hours': w.payroll?.totalSundayOtHours || 0,
      'Base Pay (₹)': w.payroll?.basePay || 0,
      'OT Pay (₹)': w.payroll?.otPay || 0,
      'Sunday OT Pay (₹)': w.payroll?.sundayOtPay || 0,
      'Custom Bonuses (₹)': w.payroll?.customBonuses || 0,
      'Custom Deductions (₹)': w.payroll?.customDeductions || 0,
      'Gross Salary (₹)': w.payroll?.grossSalary || 0,
      'Advances Deducted (₹)': w.payroll?.totalAdvances || 0,
      'Net Payable (₹)': w.payroll?.netPayable || 0,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payroll Summary');
    XLSX.writeFile(workbook, `Monthly_Payroll_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Factory HR - Monthly Payroll Summary Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);

    const tableColumn = [
      'Staff No', 'Name', 'Present', 'Absent', 'OT Hrs', 'Gross (₹)', 'Advances (₹)', 'Net Pay (₹)'
    ];

    const tableRows = filteredWorkers.map(w => [
      w.staff_no,
      w.staff_name,
      w.payroll?.payableDays || 0,
      w.payroll?.absentDays || 0,
      w.payroll?.totalOtHours || 0,
      (w.payroll?.grossSalary || 0).toLocaleString('en-IN'),
      (w.payroll?.totalAdvances || 0).toLocaleString('en-IN'),
      (w.payroll?.netPayable || 0).toLocaleString('en-IN')
    ]);

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`Monthly_Payroll_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white font-display">All Workers Payroll Table</h2>
          <p className="text-xs text-slate-400">Total {filteredWorkers.length} workers in summary</p>
        </div>

        {/* Search & Export Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Name / Staff No..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-900/80 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 w-48 sm:w-64"
            />
          </div>

          <a
            href="/api/export/excel/timings"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-indigo-600/30 transition-all"
          >
            <Clock className="w-3.5 h-3.5 text-indigo-300" />
            <span>Download Daily Timings Sheet (.xlsx)</span>
          </a>

          <a
            href="/api/export/excel"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-emerald-600/30 transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Download Full Factory Excel (.xlsx)</span>
          </a>

          <button
            onClick={() => setShowSheetsModal(true)}
            className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-medium flex items-center space-x-1.5 transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Google Sheets Live Sync</span>
          </button>

          <button
            onClick={exportToExcel}
            className="px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-medium flex items-center space-x-1.5 transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel Export</span>
          </button>

          <button
            onClick={exportToPDF}
            className="px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-medium flex items-center space-x-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF Export</span>
          </button>
        </div>
      </div>

      {/* Workers Table */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Staff No.</th>
                <th className="px-4 py-3.5">Worker Name</th>
                <th className="px-4 py-3.5">Base Salary (₹)</th>
                <th className="px-4 py-3.5 text-center">Payable Days</th>
                <th className="px-4 py-3.5 text-center">Absent</th>
                <th className="px-4 py-3.5 text-center">Wkday OT</th>
                <th className="px-4 py-3.5 text-center">Sun OT ☀️</th>
                <th className="px-4 py-3.5 text-center">Total OT 🔥</th>
                <th className="px-4 py-3.5 text-right">Gross Pay (₹)</th>
                <th className="px-4 py-3.5 text-right">Advances (₹)</th>
                <th className="px-4 py-3.5 text-right">Net Payable (₹)</th>
                <th className="px-4 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-10 text-slate-500">
                    No worker records found. Upload a punch file to get started.
                  </td>
                </tr>
              ) : (
                filteredWorkers.map(w => {
                  const p = w.payroll || {};
                  return (
                    <tr 
                      key={w.staff_no} 
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-white">#{w.staff_no}</td>
                      <td className="px-4 py-3 font-semibold text-slate-100 flex items-center space-x-2">
                        <span>{w.staff_name}</span>
                        {p.incompleteDays > 0 && (
                          <span className="w-2 h-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400" title={`${p.incompleteDays} days need review`} />
                        )}
                      </td>

                      {/* Base Salary inline edit */}
                      <td className="px-4 py-3">
                        {editingStaffNo === w.staff_no ? (
                          <div className="flex items-center space-x-1">
                            <input
                              type="number"
                              value={editSalaryValue}
                              onChange={(e) => setEditSalaryValue(e.target.value)}
                              className="w-20 bg-slate-900 border border-indigo-500 rounded px-1.5 py-0.5 text-xs text-white"
                              autoFocus
                            />
                            <button onClick={() => handleSaveSalary(w.staff_no)} className="text-emerald-400 hover:text-emerald-300">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setEditingStaffNo(null)} className="text-slate-400 hover:text-white">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1 group cursor-pointer" onClick={() => { setEditingStaffNo(w.staff_no); setEditSalaryValue(w.monthly_salary || 15000); }}>
                            <span className="font-mono text-slate-300">₹{(w.monthly_salary || 15000).toLocaleString('en-IN')}</span>
                            <Edit2 className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold font-mono">
                          {p.payableDays || 0} d
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-semibold font-mono ${
                          (p.absentDays || 0) > 0 ? 'bg-rose-500/10 text-rose-400' : 'text-slate-500'
                        }`}>
                          {p.absentDays || 0}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center font-mono text-indigo-300 font-medium">
                        {formatHours(p.totalOtHours)}
                      </td>

                      <td className="px-4 py-3 text-center font-mono text-amber-300 font-medium">
                        {(p.totalSundayOtHours || 0) > 0 ? `${formatHours(p.totalSundayOtHours)} ☀️` : '—'}
                      </td>

                      <td className="px-4 py-3 text-center font-mono text-indigo-400 font-bold">
                        {formatHours((p.totalOtHours || 0) + (p.totalSundayOtHours || 0))}
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-slate-200">
                        ₹{(p.grossSalary || 0).toLocaleString('en-IN')}
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-amber-400">
                        {(p.totalAdvances || 0) > 0 ? `− ₹${p.totalAdvances.toLocaleString('en-IN')}` : '₹0'}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400 text-sm">
                        ₹{(p.netPayable || 0).toLocaleString('en-IN')}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => onSelectWorker(w.staff_no)}
                            className="p-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 transition-all"
                            title="View Worker Attendance & Report"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onAddAdvance(w.staff_no)}
                            className="p-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 transition-all"
                            title="Log Advance Payment"
                          >
                            <DollarSign className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-modal w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-700/60 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-display">Google Sheets Live Sync</h3>
                  <p className="text-xs text-slate-400">Sync live payroll summary directly to your Google Sheet</p>
                </div>
              </div>
              <button onClick={() => setShowSheetsModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGoogleSheetsSync} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Google Apps Script Webhook URL
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Enter your deployed Google Apps Script Web App URL to auto-push all worker rows.
                </p>
              </div>

              {syncMsg && (
                <div className={`p-3 rounded-xl text-xs font-medium ${syncMsg.includes('✅') ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'}`}>
                  {syncMsg}
                </div>
              )}

              <div className="flex justify-end space-x-3 border-t border-slate-800 pt-4 mt-4">
                <button
                  type="button"
                  onClick={() => setShowSheetsModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={syncing || !webhookUrl}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
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
