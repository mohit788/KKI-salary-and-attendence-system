import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Wallet, 
  Home, 
  Settings as SettingsIcon, 
  History, 
  Building2,
  Lock,
  Unlock,
  AlertTriangle,
  Calendar,
  Sparkles
} from 'lucide-react';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  metrics, 
  isPayrollUnlocked, 
  onOpenUnlockModal, 
  onLockPayroll,
  onOpenIncompleteManager,
  selectedMonth,
  availableMonths = [],
  onSelectMonth,
  onOpenCalendarModal,
  onOpenHolidaysModal
}) {
  const allTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, requiresPayroll: false },
    { id: 'workers', label: 'Workers', icon: Users, badge: metrics?.totalWorkers, requiresPayroll: false },
    { id: 'allowances', label: 'Allowances', icon: Home, requiresPayroll: true },
    { id: 'advance', label: 'Advance Ledger', icon: Wallet, requiresPayroll: true },
    { id: 'audit', label: 'Audit Logs', icon: History, requiresPayroll: false },
    { id: 'settings', label: 'Rules & Settings', icon: SettingsIcon, requiresPayroll: false },
  ];

  // Filter tabs when payroll is locked
  const visibleTabs = isPayrollUnlocked ? allTabs : allTabs.filter(t => !t.requiresPayroll);

  const handleCalendarClick = () => {
    if (onOpenCalendarModal) onOpenCalendarModal();
    else if (onOpenHolidaysModal) onOpenHolidaysModal();
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0b1120] border-b-2 border-slate-700 shadow-lg">
      <div className="max-w-[1650px] w-full mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-18 py-2">
          
          {/* Logo & Brand Header */}
          <div 
            className="flex items-center space-x-3 cursor-pointer py-1 group flex-shrink-0" 
            onClick={() => setActiveTab('dashboard')}
          >
            <div className="w-10 h-10 rounded-xl bg-blue-700 border border-blue-500 flex items-center justify-center shadow-md">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white font-display">
                  KKI Management
                </h1>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${
                  isPayrollUnlocked 
                    ? 'bg-amber-950 text-amber-300 border-amber-500' 
                    : 'bg-blue-950 text-blue-300 border-blue-600'
                }`}>
                  {isPayrollUnlocked ? 'Payroll Mode' : 'Attendance Mode'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium hidden sm:block">
                {isPayrollUnlocked ? 'Biometric Attendance & Full Payroll' : 'Biometric Attendance & Overtime Tracker'}
              </p>
            </div>
          </div>

          {/* Month Selector & Action Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3 flex-wrap justify-end">
            
            {/* Active Month Selector */}
            {availableMonths.length > 0 && (
              <div className="flex items-center bg-slate-900 border-2 border-blue-500/50 rounded-xl px-2.5 py-1 text-xs shadow-md">
                <Calendar className="w-3.5 h-3.5 text-cyan-400 mr-1.5 shrink-0" />
                <select
                  value={selectedMonth || ''}
                  onChange={(e) => onSelectMonth && onSelectMonth(e.target.value)}
                  className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer pr-1"
                >
                  <option value="all" className="bg-slate-900 text-white">All Active Data</option>
                  {availableMonths.map(m => (
                    <option key={m.monthKey} value={m.monthKey} className="bg-slate-900 text-white">
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Factory Calendar & Holidays Button */}
            <button
              onClick={handleCalendarClick}
              className="flex items-center space-x-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 hover:text-indigo-200 border border-indigo-500/50 hover:border-indigo-400 shadow-sm transition-all whitespace-nowrap cursor-pointer group"
              title="Manage Factory Working Sundays, Substitute Offs & Paid Holidays"
            >
              <Calendar className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
              <span>📅 Factory Calendar & Holidays</span>
            </button>

            {/* Nav Tabs */}
            <nav className="flex items-center space-x-1 sm:space-x-2">
              {visibleTabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all border whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white border-blue-400 shadow-md ring-2 ring-blue-500/30'
                        : 'text-slate-200 hover:text-white hover:bg-slate-800 border-transparent hover:border-slate-700'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-300'}`} />
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                        isActive ? 'bg-white text-blue-900' : 'bg-slate-800 text-cyan-300 border border-slate-600'
                      }`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Incomplete Fast-Fix Trigger Button (Glowing when > 0) */}
            {metrics?.incompleteCount > 0 && onOpenIncompleteManager && (
              <button
                onClick={() => onOpenIncompleteManager()}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition-all whitespace-nowrap animate-pulse cursor-pointer"
                title={`${metrics.incompleteCount} incomplete records need resolution - Click to Fast-Fix`}
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Fix Incomplete ({metrics.incompleteCount})</span>
              </button>
            )}

            {/* Payroll Mode Lock / Unlock Toggle Button */}
            {isPayrollUnlocked ? (
              <button
                onClick={onLockPayroll}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white border border-amber-400 shadow-md transition-all whitespace-nowrap cursor-pointer"
                title="Click to Lock & Hide Salary / Finance fields"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock Payroll</span>
              </button>
            ) : (
              <button
                onClick={onOpenUnlockModal}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white border-2 border-amber-500/60 shadow-md transition-all whitespace-nowrap hover:border-amber-400 cursor-pointer"
                title="Enter Admin PIN to view Salary, Gross & Net Pay"
              >
                <Unlock className="w-3.5 h-3.5 text-amber-400" />
                <span>Unlock Payroll</span>
              </button>
            )}

          </div>

        </div>
      </div>
    </header>
  );
}
