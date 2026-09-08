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
import FactoryCalendarModal from './components/FactoryCalendarModal';
import LoginGate from './components/LoginGate';
import InactivityWarningModal from './components/InactivityWarningModal';
import { Lock, Unlock, KeyRound, Eye, EyeOff, X } from 'lucide-react';

const FORCED_LOGOUT_MS = 30 * 60 * 1000; // 30 minutes forced session ceiling
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes idle timeout
const INACTIVITY_WARNING_MS = 4 * 60 * 1000; // 4 minutes (60s countdown warning)

export default function App() {
  // Global 2FA Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [logoutReason, setLogoutReason] = useState(() => {
    return sessionStorage.getItem('kki_logout_reason') || null;
  });
  const [sessionRemainingMs, setSessionRemainingMs] = useState(null);
  const [showInactivityModal, setShowInactivityModal] = useState(false);
  const [inactivityCountdownSec, setInactivityCountdownSec] = useState(60);

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

  // Factory Calendar & Holidays Modal State
  const [showCalendarModal, setShowCalendarModal] = useState(false);

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
    if (isAuthenticated) {
      refreshData(validMonth);
    }
  };

  // Check 2FA Auth status on initial load
  const checkAuth = async () => {
    try {
      setAuthChecking(true);
      const res = await fetch('/api/auth/status').then(r => r.json());
      if (res && res.success && res.isAuthenticated) {
        setIsAuthenticated(true);
        const now = Date.now();

        let expiresAt = Number(sessionStorage.getItem('kki_session_expires_at'));
        if (res.remainingSessionMs) {
          expiresAt = now + res.remainingSessionMs;
          sessionStorage.setItem('kki_session_expires_at', String(expiresAt));
        } else if (!expiresAt) {
          expiresAt = now + FORCED_LOGOUT_MS;
          sessionStorage.setItem('kki_session_expires_at', String(expiresAt));
        }
        setSessionRemainingMs(Math.max(0, expiresAt - now));

        if (!localStorage.getItem('kki_last_activity')) {
          localStorage.setItem('kki_last_activity', String(now));
        }

        refreshData();
      } else {
        setIsAuthenticated(false);
        if (res && res.reason) {
          sessionStorage.setItem('kki_logout_reason', res.reason);
          setLogoutReason(res.reason);
        }
      }
    } catch (err) {
      console.error('Failed to verify session:', err);
      setIsAuthenticated(false);
    } finally {
      setAuthChecking(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLoginSuccess = () => {
    const now = Date.now();
    sessionStorage.removeItem('kki_logout_reason');
    setLogoutReason(null);
    sessionStorage.setItem('kki_session_start_time', String(now));
    sessionStorage.setItem('kki_session_expires_at', String(now + FORCED_LOGOUT_MS));
    localStorage.setItem('kki_last_activity', String(now));
    setSessionRemainingMs(FORCED_LOGOUT_MS);
    setIsAuthenticated(true);
    refreshData();
  };

  const handleLogout = async (reason = null) => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error:', e);
    }

    sessionStorage.removeItem('kki_auth_token');
    sessionStorage.removeItem('kki_payroll_unlocked');
    sessionStorage.removeItem('kki_session_start_time');
    sessionStorage.removeItem('kki_session_expires_at');
    localStorage.removeItem('kki_last_activity');

    if (reason && (reason === 'inactivity' || reason === 'session_timeout')) {
      sessionStorage.setItem('kki_logout_reason', reason);
      setLogoutReason(reason);
    } else {
      sessionStorage.removeItem('kki_logout_reason');
      setLogoutReason(null);
    }

    setShowInactivityModal(false);
    setSessionRemainingMs(null);
    setIsAuthenticated(false);
    setIsPayrollUnlocked(false);
  };

  const handleStayLoggedIn = async () => {
    const now = Date.now();
    localStorage.setItem('kki_last_activity', String(now));
    setShowInactivityModal(false);
    try {
      const res = await fetch('/api/auth/ping', { method: 'POST' }).then(r => r.json());
      if (res && res.remainingSessionMs) {
        setSessionRemainingMs(res.remainingSessionMs);
        sessionStorage.setItem('kki_session_expires_at', String(Date.now() + res.remainingSessionMs));
      }
    } catch (e) {
      console.error('Failed to refresh activity ping:', e);
    }
  };

  // Activity & Idle Inactivity Tracking (5 mins) + Forced Session Logout (30 mins)
  useEffect(() => {
    if (!isAuthenticated) return;

    let lastPingTime = Date.now();
    let lastRecordedActivity = Date.now();

    const recordActivity = () => {
      const now = Date.now();
      if (now - lastRecordedActivity > 1000) {
        lastRecordedActivity = now;
        localStorage.setItem('kki_last_activity', String(now));
        setShowInactivityModal(false);
      }

      // Keep server session active every 60 seconds
      if (now - lastPingTime > 60000) {
        lastPingTime = now;
        fetch('/api/auth/ping', { method: 'POST' })
          .then(r => r.json())
          .then(data => {
            if (data && data.remainingSessionMs) {
              setSessionRemainingMs(data.remainingSessionMs);
              sessionStorage.setItem('kki_session_expires_at', String(Date.now() + data.remainingSessionMs));
            }
          })
          .catch(() => {});
      }
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(evt => window.addEventListener(evt, recordActivity, { passive: true }));

    const handleStorageChange = (e) => {
      if (e.key === 'kki_last_activity') {
        setShowInactivityModal(false);
      } else if (e.key === 'kki_logout_reason' && e.newValue) {
        handleLogout(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    const intervalId = setInterval(() => {
      const now = Date.now();

      // 1. Check 30-Minute Forced Logout
      let expiresAt = Number(sessionStorage.getItem('kki_session_expires_at'));
      if (!expiresAt) {
        expiresAt = now + FORCED_LOGOUT_MS;
        sessionStorage.setItem('kki_session_expires_at', String(expiresAt));
      }
      const sessionRemaining = expiresAt - now;
      setSessionRemainingMs(Math.max(0, sessionRemaining));

      if (sessionRemaining <= 0) {
        clearInterval(intervalId);
        handleLogout('session_timeout');
        return;
      }

      // 2. Check 5-Minute Inactivity Idle
      const lastActivity = Number(localStorage.getItem('kki_last_activity')) || now;
      const idleElapsed = now - lastActivity;

      if (idleElapsed >= INACTIVITY_TIMEOUT_MS) {
        clearInterval(intervalId);
        setShowInactivityModal(false);
        handleLogout('inactivity');
        return;
      } else if (idleElapsed >= INACTIVITY_WARNING_MS) {
        const remainingSec = Math.max(0, Math.ceil((INACTIVITY_TIMEOUT_MS - idleElapsed) / 1000));
        setInactivityCountdownSec(remainingSec);
        setShowInactivityModal(true);
      } else {
        setShowInactivityModal(false);
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
      activityEvents.forEach(evt => window.removeEventListener(evt, recordActivity));
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isAuthenticated]);

  // Intercept 401 HTTP responses to handle server-triggered timeouts
  useEffect(() => {
    if (!isAuthenticated) return;

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        if (!url.includes('/api/auth/login') && !url.includes('/api/auth/status')) {
          try {
            const clone = response.clone();
            const body = await clone.json();
            if (body && body.reason) {
              handleLogout(body.reason);
            } else {
              handleLogout('session_timeout');
            }
          } catch {
            handleLogout('session_timeout');
          }
        }
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [isAuthenticated]);

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

  // If initial auth check is in progress
  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 text-sm font-medium tracking-wide">Checking Security Access...</p>
      </div>
    );
  }

  // If unauthenticated, gate the entire system behind Google Authenticator LoginGate
  if (!isAuthenticated) {
    return <LoginGate onLoginSuccess={handleLoginSuccess} logoutReason={logoutReason} />;
  }

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
        onOpenCalendarModal={() => setShowCalendarModal(true)}
        sessionRemainingMs={sessionRemainingMs}
        onLogout={handleLogout}
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
            onRefreshData={refreshData}
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

      {/* MODAL: FACTORY CALENDAR & SHIFT OVERRIDES MANAGER */}
      <FactoryCalendarModal
        isOpen={showCalendarModal}
        initialMonth={selectedMonth && selectedMonth !== 'all' ? selectedMonth : ''}
        onClose={() => {
          setShowCalendarModal(false);
          refreshData(selectedMonth);
        }}
        onRefreshData={() => refreshData(selectedMonth)}
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

      {/* 5-Min Inactivity Warning Modal */}
      <InactivityWarningModal
        isOpen={showInactivityModal}
        secondsRemaining={inactivityCountdownSec}
        onStayLoggedIn={handleStayLoggedIn}
        onLogout={() => handleLogout('inactivity')}
      />
    </div>
  );
}
