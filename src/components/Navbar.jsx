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
    { id: 'workers', label: 'Workers Summary', icon: Users, badge: metrics?.totalWorkers },
    { id: 'allowances', label: 'Allowances', icon: Home },
    { id: 'advance', label: 'Advance Ledger', icon: Wallet },
    { id: 'audit', label: 'Audit Logs', icon: History },
    { id: 'settings', label: 'Rules & Settings', icon: SettingsIcon },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#0f172a] border-b-2 border-slate-700 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & High-Contrast Brand Header */}
          <div 
            className="flex items-center space-x-3.5 cursor-pointer py-2 group" 
            onClick={() => setActiveTab('dashboard')}
          >
            <div className="w-12 h-12 rounded-xl bg-blue-700 border border-blue-500 flex items-center justify-center shadow-md">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-white font-display">
                  KKI Management
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600 font-bold">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">Biometric Attendance & Payroll System</p>
            </div>
          </div>

          {/* Navigation Tabs - Large & High Contrast */}
          <nav className="flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto py-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-400 shadow-md ring-2 ring-blue-500/30'
                      : 'text-slate-200 hover:text-white hover:bg-slate-800 border-transparent hover:border-slate-700'
                  }`}
                >
                  <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-white' : 'text-slate-300'}`} />
                  <span className="whitespace-nowrap">{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`ml-1 px-2 py-0.5 text-xs font-bold rounded-full ${
                      isActive ? 'bg-white text-blue-900' : 'bg-slate-800 text-slate-200 border border-slate-600'
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
