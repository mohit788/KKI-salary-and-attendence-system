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

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [metrics, setMetrics] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [settingsList, setSettingsList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [allAttendance, setAllAttendance] = useState([]);
  const [loading, setLoading] = useState(false);

  // Selected worker details state
  const [selectedStaffNo, setSelectedStaffNo] = useState(null);
  const [selectedWorkerData, setSelectedWorkerData] = useState(null);

  // Modals state
  const [previewData, setPreviewData] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [advanceStaffNo, setAdvanceStaffNo] = useState(null);

  // Fetch baseline metrics & worker list
  const refreshData = async () => {
    try {
      const [dashRes, workRes, setRes, auditRes, attAllRes] = await Promise.all([
        fetch('/api/dashboard').then(r => r.json()),
        fetch('/api/workers').then(r => r.json()),
        fetch('/api/settings').then(r => r.json()),
        fetch('/api/audit-logs').then(r => r.json()),
        fetch('/api/attendance/all').then(r => r.json()),
      ]);

      if (dashRes.success) setMetrics(dashRes.metrics);
      if (workRes.success) setWorkers(workRes.workers);
      if (setRes.success) setSettingsList(setRes.settings);
      if (auditRes.success) setAuditLogs(auditRes.auditLogs);
      if (attAllRes.success) setAllAttendance(attAllRes.records || []);

      if (selectedStaffNo) {
        fetchWorkerDetail(selectedStaffNo);
      }
    } catch (err) {
      console.error('Error refreshing data:', err);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Fetch detail for single worker
  const fetchWorkerDetail = async (staffNo) => {
    try {
      const res = await fetch(`/api/workers/${staffNo}`).then(r => r.json());
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
    fetchWorkerDetail(staffNo);
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
          await refreshData();
          setActiveTab('workers');
          setPreviewData(res);
        } else {
          alert('Upload Error: ' + (res.error || 'Failed to parse file.'));
        }
      } else {
        const text = await response.text();
        console.error('Non-JSON upload response:', text);
        alert('Upload Error: Server returned an invalid response. Please check your document format.');
      }
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Commit preview data (Data is already saved on upload)
  const handleCommitPreview = async () => {
    setPreviewData(null);
    await refreshData();
    setActiveTab('workers');
  };

  // Save Attendance Edit
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

  // Add Advance Payment
  const handleAddAdvance = async (advancePayload) => {
    try {
      const res = await fetch('/api/advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(advancePayload),
      }).then(r => r.json());

      if (res.success) {
        await refreshData();
      } else {
        alert('Advance error: ' + res.error);
      }
    } catch (err) {
      alert('Advance failed: ' + err.message);
    }
  };

  // Delete Advance
  const handleDeleteAdvance = async (advanceId) => {
    try {
      const res = await fetch(`/api/advances/${advanceId}`, {
        method: 'DELETE',
      }).then(r => r.json());

      if (res.success) {
        await refreshData();
      }
    } catch (err) {
      console.error('Delete advance error:', err);
    }
  };

  // Update Worker Compensation (Base Salary & Allowances)
  const handleUpdateCompensation = async (staffNo, compPayload) => {
    try {
      const res = await fetch(`/api/workers/${staffNo}/compensation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(compPayload),
      }).then(r => r.json());

      if (res.success) {
        await refreshData();
      }
    } catch (err) {
      console.error('Update compensation error:', err);
    }
  };

  // Update Worker Base Salary
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

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f19]">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} metrics={metrics} />

      <AiAssistantBar onRefreshData={refreshData} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <Dashboard
            metrics={metrics}
            allAttendance={allAttendance}
            workers={workers}
            onUploadFile={handleUploadFile}
            setActiveTab={setActiveTab}
            onEditRecord={(rec) => setEditingRecord(rec)}
          />
        )}

        {activeTab === 'workers' && (
          <AllWorkersTable
            workers={workers}
            onSelectWorker={handleSelectWorker}
            onAddAdvance={(staffNo) => setAdvanceStaffNo(staffNo)}
            onUpdateSalary={handleUpdateSalary}
          />
        )}

        {activeTab === 'allowances' && (
          <AllowancesSection
            workers={workers}
            onUpdateCompensation={handleUpdateCompensation}
          />
        )}

        {activeTab === 'worker-detail' && (
          <WorkerDetail
            staffNo={selectedStaffNo}
            workerData={selectedWorkerData}
            onBack={() => setActiveTab('workers')}
            onEditRecord={(rec) => setEditingRecord(rec)}
            onAddAdvance={(staffNo) => setAdvanceStaffNo(staffNo)}
          />
        )}

        {activeTab === 'advance' && (
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
            loading={loading}
          />
        )}
      </main>

      {/* Modals */}
      {previewData && (
        <UploadPreviewModal
          previewData={previewData}
          onConfirm={handleCommitPreview}
          onCancel={() => setPreviewData(null)}
          loading={loading}
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
