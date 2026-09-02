import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import UploadPreviewModal from './components/UploadPreviewModal';
import AllWorkersTable from './components/AllWorkersTable';
import WorkerDetail from './components/WorkerDetail';
import EditModal from './components/EditModal';
import AdvanceModal from './components/AdvanceModal';
import AdvanceSection from './components/AdvanceSection';
import AllowancesSection from './components/AllowancesSection';
import SettingsPanel from './components/SettingsPanel';
import AuditLogsModal from './components/AuditLogsModal';
import AiAssistantBar from './components/AiAssistantBar';
import IncompleteManagerModal from './components/IncompleteManagerModal';
import HolidaysManagerModal from './components/HolidaysManagerModal';
import { Lock, Unlock, KeyRound, Eye, EyeOff, X } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [metrics, setMetrics] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [settingsList, setSettingsList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [allAttendance, setAllAttendance] = useState([]);
  const [loading, setLoading] = useState(false);

  // Month Selection State
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [availableMonths, setAvailableMonths] = useState([]);

  // Paid Holidays Manager State
  const [showHolidaysModal, setShowHolidaysModal] = useState(false);

  // Payroll Security Mode State (Default Locked)
  const [isPayrollUnlocked, setIsPayrollUnlocked] = useState(
    () => sessionStorage.getItem('kki_payroll_unlocked') === 'true'
  );
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [unlockLoading, setUnlockLoading] = useState(false);

  // Incomplete Manager State
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  const [incompleteStaffFilter, setIncompleteStaffFilter] = useState(null);

  // Selected worker details state
  const [selectedStaffNo, setSelectedStaffNo] = useState(null);
  const [selectedWorkerData, setSelectedWorkerData] = useState(null);

  // Modals state
  const [previewData, setPreviewData] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [advanceStaffNo, setAdvanceStaffNo] = useState(null);

  // Fetch baseline metrics & worker list
  const refreshData = async (overrideMonth = null) => {
    try {
      const activeM = overrideMonth !== null ? overrideMonth : selectedMonth;
      const monthQuery = activeM && activeM !== 'all' ? `?month=${activeM}` : '';

      const fetchJson = async (url) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return { success: false };
          return await res.json();
        } catch (e) {
          console.error(`Failed to fetch ${url}:`, e);
          return { success: false, error: e.message };
        }
      };

      const [dashRes, workRes, setRes, auditRes, attAllRes, monthsRes] = await Promise.all([
        fetchJson(`/api/dashboard${monthQuery}`),
        fetchJson(`/api/workers${monthQuery}`),
        fetchJson('/api/settings'),
        fetchJson('/api/audit-logs'),
        fetchJson(`/api/attendance/all${monthQuery}`),
        fetchJson('/api/months'),
      ]);

      if (dashRes && dashRes.success) setMetrics(dashRes.metrics);
      if (workRes && workRes.success) setWorkers(workRes.workers || []);
      if (setRes && setRes.success) setSettingsList(setRes.settings || []);
      if (auditRes && auditRes.success) setAuditLogs(auditRes.auditLogs || []);
      if (attAllRes && attAllRes.success) setAllAttendance(attAllRes.records || []);
      if (monthsRes && monthsRes.success) setAvailableMonths(monthsRes.months || []);

      if (selectedStaffNo) {
        fetchWorkerDetail(selectedStaffNo, activeM);
      }
    } catch (err) {
      console.error('Error refreshing data:', err);
    }
  };

  const handleSelectMonth = (newMonth) => {
    const validMonth = newMonth || 'all';
    setSelectedMonth(validMonth);
    refreshData(validMonth);
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Verify Password & Unlock Payroll
  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    if (!unlockPassword.trim()) {
      setUnlockError('Please enter password.');
      return;
    }

    setUnlockError('');
    setUnlockLoading(true);

    try {
      const res = await fetch('/api/auth/verify-payroll-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: unlockPassword.trim() }),
      }).then(r => r.json());

      if (res.success) {
        setIsPayrollUnlocked(true);
        sessionStorage.setItem('kki_payroll_unlocked', 'true');
        setShowUnlockModal(false);
        setUnlockPassword('');
      } else {
        setUnlockError(res.error || 'Incorrect password! Please try again.');
      }
    } catch (err) {
      setUnlockError('Failed to verify: ' + err.message);
    } finally {
      setUnlockLoading(false);
    }
  };

  // Lock Payroll
  const handleLockPayroll = () => {
    setIsPayrollUnlocked(false);
    sessionStorage.removeItem('kki_payroll_unlocked');
    if (activeTab === 'allowances' || activeTab === 'advance') {
      setActiveTab('dashboard');
    }
  };

  // Fetch detail for single worker (supporting current month filter)
  const fetchWorkerDetail = async (staffNo, overrideMonth = null) => {
    try {
      const monthToUse = overrideMonth !== null ? overrideMonth : selectedMonth;
      const monthQuery = monthToUse && monthToUse !== 'all' ? `?month=${monthToUse}` : '';
      const res = await fetch(`/api/workers/${staffNo}${monthQuery}`).then(r => r.json());
      if (res.success) {
        setSelectedWorkerData(res);
      }
    } catch (err) {
      console.error('Error fetching worker detail:', err);
    }
  };

  // Select a worker to view details
  const handleSelectWorker = (staffNo) => {
    setSelectedStaffNo(staffNo);
    fetchWorkerDetail(staffNo, selectedMonth);
    setActiveTab('worker-detail');
  };

  // Upload file & get preview
  const handleUploadFile = async (file) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const res = await response.json();
        if (res.success) {
          const uploadedMonth = res.detectedMonth?.monthKey || selectedMonth;
          if (uploadedMonth && uploadedMonth !== 'all') {
            setSelectedMonth(uploadedMonth);
          }
          await refreshData(uploadedMonth);
          setActiveTab('workers');
          setPreviewData(res);
        } else {
          alert('Upload error: ' + res.error);
        }
      } else {
        const text = await response.text();
        alert('Server response error: ' + text.slice(0, 150));
      }
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Confirm and close preview modal
  const handleCommitPreview = async () => {
    setPreviewData(null);
    await refreshData();
    setActiveTab('workers');
  };

  // Save manual attendance edit
  const handleSaveEdit = async (editPayload) => {
    setLoading(true);
    try {
      const res = await fetch('/api/attendance/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editPayload),
      }).then(r => r.json());

      if (res.success) {
        setEditingRecord(null);
        await refreshData();
      } else {
        alert('Edit error: ' + res.error);
      }
    } catch (err) {
      alert('Edit failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Add advance payment (supports object or positional arguments)
  const handleAddAdvance = async (staffNoOrObj, amount, note, date) => {
    setLoading(true);
    let payload;
    if (typeof staffNoOrObj === 'object' && staffNoOrObj !== null) {
      payload = staffNoOrObj;
    } else {
      payload = { staff_no: staffNoOrObj, amount, note, date };
    }
    try {
      const res = await fetch('/api/advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json());

      if (res.success) {
        await refreshData();
      } else {
        alert('Advance error: ' + res.error);
      }
    } catch (err) {
      alert('Advance failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete advance payment
  const handleDeleteAdvance = async (advanceId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/advances/${advanceId}`, {
        method: 'DELETE',
      }).then(r => r.json());

      if (res.success) {
        await refreshData();
      } else {
        alert('Delete error: ' + res.error);
      }
    } catch (err) {
      alert('Delete failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Update worker allowances
  const handleUpdateCompensation = async (staffNo, compData) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workers/${staffNo}/compensation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(compData),
      }).then(r => r.json());

      if (res.success) {
        await refreshData();
      } else {
        alert('Allowance error: ' + res.error);
      }
    } catch (err) {
      alert('Allowance update failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Update worker base salary
  const handleUpdateSalary = async (staffNo, newSalary) => {
    try {
      const res = await fetch(`/api/workers/${staffNo}/salary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthly_salary: newSalary }),
      }).then(r => r.json());

      if (res.success) {
        await refreshData();
      }
    } catch (err) {
      console.error('Update salary error:', err);
    }
  };

  // Save Rules & Settings
  const handleSaveSettings = async (settingsForm) => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      }).then(r => r.json());

      if (res.success) {
        await refreshData();
      } else {
        alert('Settings error: ' + res.error);
      }
    } catch (err) {
      alert('Settings failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenIncompleteManager = (staffNo) => {
    const cleanStaffNo = (typeof staffNo === 'string' || typeof staffNo === 'number') ? String(staffNo) : null;
    setIncompleteStaffFilter(cleanStaffNo);
    setShowIncompleteModal(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f19]">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        metrics={metrics}
        isPayrollUnlocked={isPayrollUnlocked}
        onOpenUnlockModal={() => { setUnlockError(''); setShowUnlockModal(true); }}
        onLockPayroll={handleLockPayroll}
        onOpenIncompleteManager={() => handleOpenIncompleteManager(null)}
        selectedMonth={selectedMonth}
        availableMonths={availableMonths}
        onSelectMonth={handleSelectMonth}
        onOpenHolidaysModal={() => setShowHolidaysModal(true)}
      />

      <AiAssistantBar onRefreshData={refreshData} />

      <main className="flex-1 max-w-[1650px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <Dashboard
            metrics={metrics}
            allAttendance={allAttendance}
            workers={workers}
            onUploadFile={handleUploadFile}
            setActiveTab={setActiveTab}
            onEditRecord={(rec) => setEditingRecord(rec)}
            isPayrollUnlocked={isPayrollUnlocked}
            onOpenUnlockModal={() => { setUnlockError(''); setShowUnlockModal(true); }}
            onOpenIncompleteManager={handleOpenIncompleteManager}
            selectedMonth={selectedMonth}
            availableMonths={availableMonths}
            onSelectMonth={handleSelectMonth}
          />
        )}

        {activeTab === 'workers' && (
          <AllWorkersTable
            workers={workers}
            onSelectWorker={handleSelectWorker}
            onAddAdvance={(staffNo) => setAdvanceStaffNo(staffNo)}
            onUpdateSalary={handleUpdateSalary}
            isPayrollUnlocked={isPayrollUnlocked}
            onOpenUnlockModal={() => { setUnlockError(''); setShowUnlockModal(true); }}
            onOpenIncompleteManager={handleOpenIncompleteManager}
            selectedMonth={selectedMonth}
          />
        )}

        {activeTab === 'allowances' && isPayrollUnlocked && (
          <AllowancesSection
            workers={workers}
            onUpdateCompensation={handleUpdateCompensation}
          />
        )}

        {activeTab === 'worker-detail' && (
          <WorkerDetail
            staffNo={selectedStaffNo}
            workerData={selectedWorkerData}
            workers={workers}
            onSelectWorker={handleSelectWorker}
            onBack={() => setActiveTab('workers')}
            onEditRecord={(rec) => setEditingRecord(rec)}
            onAddAdvance={(staffNo) => setAdvanceStaffNo(staffNo)}
            isPayrollUnlocked={isPayrollUnlocked}
            onOpenUnlockModal={() => { setUnlockError(''); setShowUnlockModal(true); }}
            onRefreshData={refreshData}
            selectedMonth={selectedMonth}
            availableMonths={availableMonths}
            onSelectMonth={(m) => {
              handleSelectMonth(m);
              if (selectedStaffNo) {
                fetchWorkerDetail(selectedStaffNo, m);
              }
            }}
          />
        )}

        {activeTab === 'advance' && isPayrollUnlocked && (
          <AdvanceSection
            workers={workers}
            onAddAdvance={handleAddAdvance}
            onDeleteAdvance={handleDeleteAdvance}
          />
        )}

        {activeTab === 'audit' && (
          <AuditLogsModal auditLogs={auditLogs} />
        )}

        {activeTab === 'settings' && (
          <SettingsPanel
            settingsList={settingsList}
            onSaveSettings={handleSaveSettings}
            onSettingsUpdated={refreshData}
            workers={workers}
            loading={loading}
          />
        )}
      </main>

      {/* MODAL: INCOMPLETE RECORDS FAST-FIX MANAGER */}
      <IncompleteManagerModal
        isOpen={showIncompleteModal}
        workers={workers}
        allAttendance={allAttendance}
        selectedMonth={selectedMonth}
        availableMonths={availableMonths}
        onClose={() => {
          setShowIncompleteModal(false);
          refreshData(selectedMonth);
        }}
        onRefreshData={() => refreshData(selectedMonth)}
        initialStaffNo={incompleteStaffFilter}
      />

      {/* MODAL: PAID HOLIDAYS & NATIONAL OFFS MANAGER */}
      <HolidaysManagerModal
        isOpen={showHolidaysModal}
        onClose={() => {
          setShowHolidaysModal(false);
          refreshData();
        }}
        onRefreshData={refreshData}
      />

      {/* MODAL: UNLOCK PAYROLL & SALARY MODE */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
          <div className="glass-modal w-full max-w-md rounded-2xl p-6 shadow-2xl border-2 border-amber-500/60 bg-slate-900 space-y-4">

            <div className="flex items-center justify-between border-b-2 border-slate-700 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-950 text-amber-300 border border-amber-600 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-display">Unlock Salary Mode</h3>
                  <p className="text-xs text-slate-300">Enter Admin Password to view Payroll</p>
                </div>
              </div>
              <button
                onClick={() => setShowUnlockModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVerifyPassword} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">
                  Admin PIN / Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswordText ? 'text' : 'password'}
                    placeholder="Enter password..."
                    value={unlockPassword}
                    onChange={(e) => { setUnlockPassword(e.target.value); setUnlockError(''); }}
                    className="w-full bg-slate-950 border-2 border-slate-700 rounded-xl pl-4 pr-11 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordText(!showPasswordText)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                  >
                    {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Default Password: <strong className="text-amber-400 font-mono">kki123</strong> (Changeable in Rules & Settings)
                </p>
              </div>

              {unlockError && (
                <div className="p-3 rounded-xl text-xs font-bold bg-rose-950 text-rose-300 border border-rose-600 animate-in shake">
                  {unlockError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 border-t-2 border-slate-700 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowUnlockModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-600 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={unlockLoading || !unlockPassword}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-md border border-amber-400 transition-all disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <Unlock className="w-4 h-4" />
                  <span>{unlockLoading ? 'Verifying...' : 'Unlock Payroll & Salaries'}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Modals */}
      {previewData && (
        <UploadPreviewModal
          previewData={previewData}
          onConfirm={handleCommitPreview}
          onCancel={() => setPreviewData(null)}
          loading={loading}
          onOpenIncompleteManager={() => { setIncompleteStaffFilter(null); setShowIncompleteModal(true); }}
        />
      )}

      {editingRecord && (
        <EditModal
          record={editingRecord}
          staffNo={selectedStaffNo}
          onSave={handleSaveEdit}
          onCancel={() => setEditingRecord(null)}
          loading={loading}
        />
      )}

      {advanceStaffNo && (
        <AdvanceModal
          staffNo={advanceStaffNo}
          advances={
            selectedWorkerData?.worker?.staff_no === advanceStaffNo
              ? selectedWorkerData.advances
              : (workers.find(w => w.staff_no === advanceStaffNo)?.advances || [])
          }
          onAddAdvance={handleAddAdvance}
          onDeleteAdvance={handleDeleteAdvance}
          onClose={() => setAdvanceStaffNo(null)}
        />
      )}
    </div>
  );
}
