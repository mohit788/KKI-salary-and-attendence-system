import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Wallet, 
  Home, 
  Settings as SettingsIcon, 
  History, 
  Building2 
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, metrics }) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'workers', label: 'Workers', icon: Users, badge: metrics?.totalWorkers },
    { id: 'allowances', label: 'Allowances', icon: Home },
    { id: 'advance', label: 'Advance Ledger', icon: Wallet },
    { id: 'audit', label: 'Audit Logs', icon: History },
    { id: 'settings', label: 'Rules & Settings', icon: SettingsIcon },
  ];

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
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600 font-bold">
                  Active
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium hidden sm:block">Biometric Attendance & Payroll</p>
            </div>
          </div>

          {/* Navigation Tabs - Seamless, No Horizontal Slide Needed */}
          <nav className="flex items-center space-x-1 sm:space-x-2 flex-wrap justify-end">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all border whitespace-nowrap ${
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

        </div>
      </div>
    </header>
  );
}
