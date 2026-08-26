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

  // Export PDF
  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(16);
    doc.text('Factory Monthly Payroll Summary', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);

    const tableColumn = [
      'Staff No', 'Name', 'Base Sal', 'Pay Days', 'Absent', 'Wk OT', 'Sun OT', 'Gross', 'Advances', 'Net Pay'
    ];
    const tableRows = [];

    filteredWorkers.forEach(w => {
      const p = w.payroll || {};
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
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 28,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 8 },
    });

    doc.save(`Monthly_Payroll_Summary_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-slate-100">
      
      {/* Top Header & Actions Bar */}
      <div className="glass-card rounded-2xl p-6 border-2 border-slate-700 bg-slate-900 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white font-display flex items-center gap-3">
            <span>All Workers Payroll Summary</span>
            <span className="text-xs px-3 py-1 rounded-full bg-blue-950 text-blue-300 font-mono font-bold border border-blue-600">
              {filteredWorkers.length} Employees
            </span>
          </h2>
          <p className="text-sm text-slate-300 mt-1 font-medium">
            Complete list of workers, duty hours, payable days, overtime pay, and net salary
          </p>
        </div>

        {/* Action Buttons & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Name / Staff No..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 border-2 border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 w-56 sm:w-64 font-medium"
            />
          </div>

          <a
            href="/api/export/excel/timings"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2.5 bg-blue-700 hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 border border-blue-500 shadow-md transition-all"
          >
            <Clock className="w-4 h-4 text-blue-200" />
            <span>Timings Sheet (.xlsx)</span>
          </a>

          <a
            href="/api/export/excel"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 border border-emerald-500 shadow-md transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Full Payroll (.xlsx)</span>
          </a>

          <button
            onClick={() => setShowSheetsModal(true)}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border-2 border-slate-600 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>G-Sheets Sync</span>
          </button>

          <button
            onClick={exportToPDF}
            className="px-3.5 py-2.5 bg-rose-800 hover:bg-rose-700 text-white border border-rose-500 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Workers Table - Large Font & High Contrast */}
      <div className="glass-card rounded-2xl border-2 border-slate-700 overflow-hidden shadow-lg bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-200">
            <thead className="bg-slate-950 text-slate-200 font-bold uppercase tracking-wider border-b-2 border-slate-700 text-xs">
              <tr>
                <th className="px-4 py-4">Staff No.</th>
                <th className="px-4 py-4">Worker Name</th>
                <th className="px-4 py-4">Base Salary</th>
                <th className="px-4 py-4 text-center">Payable Days</th>
                <th className="px-4 py-4 text-center">Absent</th>
                <th className="px-4 py-4 text-center">Wkday OT</th>
                <th className="px-4 py-4 text-center text-amber-300">Sun OT ☀️</th>
                <th className="px-4 py-4 text-center">Total OT</th>
                <th className="px-4 py-4 text-right">Gross Pay</th>
                <th className="px-4 py-4 text-right">Advances</th>
                <th className="px-4 py-4 text-right text-emerald-300">Net Payable</th>
                <th className="px-4 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan="12" className="text-center py-12 text-slate-400 text-base">
                    No worker records found. Upload a punch file to get started.
                  </td>
                </tr>
              ) : (
                filteredWorkers.map(w => {
                  const p = w.payroll || {};
                  return (
                    <tr 
                      key={w.staff_no} 
                      className="hover:bg-slate-800/80 transition-colors"
                    >
                      <td className="px-4 py-3.5 font-mono font-bold text-cyan-300 whitespace-nowrap">
                        <span className="bg-slate-950 px-2.5 py-1 rounded-md border border-slate-700">
                          #{w.staff_no}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-white whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className="text-base">{w.staff_name}</span>
                          {p.incompleteDays > 0 && (
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" title={`${p.incompleteDays} days need review`} />
                          )}
                        </div>
                        <span className="text-xs text-slate-400 font-normal">
                          {w.department || 'WORKER'}
                        </span>
                      </td>

                      {/* Base Salary inline edit */}
                      <td className="px-4 py-3.5">
                        {editingStaffNo === w.staff_no ? (
                          <div className="flex items-center space-x-1.5">
                            <input
                              type="number"
                              value={editSalaryValue}
                              onChange={(e) => setEditSalaryValue(e.target.value)}
                              className="w-24 bg-slate-950 border-2 border-blue-500 rounded-lg px-2 py-1 text-sm text-white font-mono"
                              autoFocus
                            />
                            <button onClick={() => handleSaveSalary(w.staff_no)} className="p-1 rounded bg-emerald-700 text-white">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingStaffNo(null)} className="p-1 rounded bg-slate-800 text-slate-300">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div 
                            className="flex items-center space-x-1.5 group cursor-pointer" 
                            onClick={() => { setEditingStaffNo(w.staff_no); setEditSalaryValue(w.monthly_salary || 15000); }}
                          >
                            <span className="font-mono font-bold text-slate-200 text-sm">
                              ₹{(w.monthly_salary || 15000).toLocaleString('en-IN')}
                            </span>
                            <Edit2 className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className="px-3 py-1 rounded-lg bg-emerald-950 text-emerald-300 font-bold font-mono text-sm border border-emerald-600">
                          {p.payableDays || 0} d
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className={`px-2.5 py-1 rounded-lg font-bold font-mono text-sm ${
                          (p.absentDays || 0) > 0 
                            ? 'bg-rose-950 text-rose-300 border border-rose-600' 
                            : 'text-slate-500'
                        }`}>
                          {p.absentDays || 0}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center font-mono text-blue-300 font-bold">
                        {formatHours(p.totalOtHours)}
                      </td>

                      <td className="px-4 py-3.5 text-center font-mono text-amber-300 font-bold">
                        {(p.totalSundayOtHours || 0) > 0 ? `${formatHours(p.totalSundayOtHours)}` : '—'}
                      </td>

                      <td className="px-4 py-3.5 text-center font-mono text-cyan-300 font-extrabold text-sm">
                        {formatHours((p.totalOtHours || 0) + (p.totalSundayOtHours || 0))}
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono text-slate-200 font-bold">
                        ₹{(p.grossSalary || 0).toLocaleString('en-IN')}
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono text-amber-300 font-bold">
                        {(p.totalAdvances || 0) > 0 ? `− ₹${p.totalAdvances.toLocaleString('en-IN')}` : '₹0'}
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono font-extrabold text-emerald-300 text-base">
                        ₹{(p.netPayable || 0).toLocaleString('en-IN')}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => onSelectWorker(w.staff_no)}
                            className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs flex items-center space-x-1 border border-blue-500 shadow transition-all"
                            title="View Worker Attendance & Report"
                          >
                            <Eye className="w-4 h-4" />
                            <span>View</span>
                          </button>

                          <button
                            onClick={() => onAddAdvance(w.staff_no)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-600 transition-all"
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
