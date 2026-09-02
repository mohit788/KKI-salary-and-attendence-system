import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  X, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  ArrowLeftRight,
  Briefcase,
  Sun,
  Palmtree,
  Flag,
  RotateCcw,
  CalendarDays,
  Info,
  Edit3
} from 'lucide-react';

export default function FactoryCalendarModal({ 
  isOpen, 
  onClose, 
  onRefreshData,
  initialMonth = ''
}) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar' | 'swap_wizard' | 'list'
  const [currentYear, setCurrentYear] = useState(
    initialMonth ? parseInt(initialMonth.slice(0, 4), 10) : new Date().getFullYear()
  );
  const [currentMonth, setCurrentMonth] = useState(
    initialMonth ? parseInt(initialMonth.slice(5, 7), 10) - 1 : new Date().getMonth()
  );

  const [calendarData, setCalendarData] = useState({ overrides: [], calendarMap: {}, monthSummary: null });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Day Edit Modal / Drawer state
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayType, setDayType] = useState('working_day');
  const [dayTitle, setDayTitle] = useState('');
  const [dayNotes, setDayNotes] = useState('');

  // 1-Click Swap Wizard state
  const [swapWorkDate, setSwapWorkDate] = useState('');
  const [swapOffDate, setSwapOffDate] = useState('');
  const [swapReason, setSwapReason] = useState('');

  const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  const fetchCalendar = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar?month=${monthStr}`).then(r => r.json());
      if (res.success) {
        setCalendarData({
          overrides: res.overrides || [],
          calendarMap: res.calendarMap || {},
          monthSummary: res.monthSummary || null
        });
      }
    } catch (err) {
      console.error('Error fetching factory calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [isOpen, currentYear, currentMonth]);

  // Calendar Grid Calculation
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sunday, 1 = Monday...
    // Convert so Monday = 0, Sunday = 6
    const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const days = [];
    // Blank slots before first day
    for (let i = 0; i < adjustedFirstDay; i++) {
      days.push(null);
    }
    // Days of month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dt = new Date(currentYear, currentMonth, d);
      const isSun = dt.getDay() === 0;
      const dayName = dt.toLocaleDateString('en-US', { weekday: 'short' });
      const override = calendarData.calendarMap[dateStr] || null;

      days.push({
        dayNumber: d,
        dateStr,
        dayName,
        isSunday: isSun,
        override
      });
    }
    return days;
  }, [currentYear, currentMonth, calendarData.calendarMap]);

  // Handle Month Navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  // Click on a Day to Edit
  const handleSelectDay = (dayObj) => {
    if (!dayObj) return;
    setSelectedDay(dayObj);
    if (dayObj.override) {
      setDayType(dayObj.override.day_type || 'holiday');
      setDayTitle(dayObj.override.title || '');
      setDayNotes(dayObj.override.notes || '');
    } else {
      // Default suggested type:
      // If Sunday, suggest "working_day" (Compensatory Sunday Work)
      // If Weekday, suggest "off_day" (Substitute Off) or "holiday"
      if (dayObj.isSunday) {
        setDayType('working_day');
        setDayTitle(`Sunday Working (${dayObj.dayNumber} ${new Date(currentYear, currentMonth, 1).toLocaleString('default', { month: 'short' })})`);
      } else {
        setDayType('off_day');
        setDayTitle(`Substitute Off (${dayObj.dayNumber} ${new Date(currentYear, currentMonth, 1).toLocaleString('default', { month: 'short' })})`);
      }
      setDayNotes('');
    }
  };

  // Quick Preset Helper
  const handleQuickPreset = (type) => {
    if (!selectedDay) return;
    setDayType(type);
    const mName = new Date(currentYear, currentMonth, 1).toLocaleString('default', { month: 'short' });
    if (type === 'working_day') {
      setDayTitle(`Compensatory Working Day (${selectedDay.dayNumber} ${mName})`);
    } else if (type === 'off_day') {
      setDayTitle(`Substitute Paid Off (${selectedDay.dayNumber} ${mName})`);
    } else if (type === 'holiday') {
      setDayTitle(`Festival / Paid Holiday (${selectedDay.dayNumber} ${mName})`);
    } else {
      setDayTitle('');
    }
  };

  // Save Day Override
  const handleSaveDay = async (e) => {
    if (e) e.preventDefault();
    if (!selectedDay) return;

    setActionLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/calendar/declare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDay.dateStr,
          day_type: dayType,
          title: dayTitle.trim(),
          notes: dayNotes.trim()
        })
      }).then(r => r.json());

      if (res.success) {
        setSuccessMsg(res.message || 'Schedule updated & calculations refreshed!');
        setSelectedDay(null);
        await fetchCalendar();
        if (onRefreshData) onRefreshData();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setErrorMsg(res.error || 'Failed to update schedule.');
      }
    } catch (err) {
      setErrorMsg('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Reset Date to Default
  const handleResetDay = async (dateStr) => {
    if (!window.confirm(`Reset schedule for ${dateStr} back to standard default?`)) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/calendar/date/${dateStr}`, {
        method: 'DELETE'
      }).then(r => r.json());

      if (res.success) {
        setSuccessMsg(`Schedule for ${dateStr} reset to default.`);
        setSelectedDay(null);
        await fetchCalendar();
        if (onRefreshData) onRefreshData();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setErrorMsg(res.error || 'Failed to reset schedule.');
      }
    } catch (err) {
      setErrorMsg('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // 1-Click Swap Handler
  const handleSwapSubmit = async (e) => {
    e.preventDefault();
    if (!swapWorkDate || !swapOffDate) {
      setErrorMsg('Please select both a Working Sunday date and a Substitute Off Weekday date.');
      return;
    }
    if (swapWorkDate === swapOffDate) {
      setErrorMsg('Working day and Off day cannot be the same date.');
      return;
    }

    setActionLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/calendar/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workDate: swapWorkDate,
          offDate: swapOffDate,
          reason: swapReason.trim() || 'Factory Compensatory Shift Swap'
        })
      }).then(r => r.json());

      if (res.success) {
        setSuccessMsg(res.message || 'Swap completed successfully!');
        setSwapWorkDate('');
        setSwapOffDate('');
        setSwapReason('');
        await fetchCalendar();
        if (onRefreshData) onRefreshData();
        setActiveTab('calendar');
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setErrorMsg(res.error || 'Failed to execute swap.');
      }
    } catch (err) {
      setErrorMsg('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const monthName = new Date(currentYear, currentMonth, 1).toLocaleString('default', { month: 'long' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="glass-modal w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl p-5 sm:p-6 shadow-2xl border-2 border-indigo-500/40 bg-slate-900 text-slate-100 overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4 mb-4 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-950 text-indigo-300 border-2 border-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-950/50">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-xl font-black text-white tracking-tight font-display">
                  Factory Calendar & Shift Overrides
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 text-xs font-bold font-mono border border-indigo-500/50">
                  {calendarData.overrides.length} Active Overrides
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Declare Working Sundays, Substitute Paid Offs, and National Holidays with automated real-time recalculation.
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Navigation & Status Messages */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 shrink-0">
          <div className="flex items-center space-x-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Monthly Calendar</span>
            </button>
            <button
              onClick={() => setActiveTab('swap_wizard')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'swap_wizard'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4 text-amber-300" />
              <span>1-Click Sunday ⇄ Off Swap</span>
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Flag className="w-4 h-4 text-emerald-300" />
              <span>Special Days List ({calendarData.overrides.length})</span>
            </button>
          </div>

          {/* Month Navigator Controls */}
          {activeTab === 'calendar' && (
            <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-black text-white px-2 min-w-[120px] text-center font-display">
                {monthName} {currentYear}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleCurrentMonth}
                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700"
              >
                Today
              </button>
            </div>
          )}
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="p-3 mb-3 rounded-xl text-xs font-bold bg-emerald-950 text-emerald-200 border border-emerald-500 flex items-center space-x-2 shrink-0 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3 mb-3 rounded-xl text-xs font-bold bg-rose-950 text-rose-200 border border-rose-600 flex items-center space-x-2 shrink-0 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* TAB 1: MONTHLY CALENDAR GRID */}
        {activeTab === 'calendar' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto space-y-3 pr-1">
            
            {/* Month Stats Ribbon */}
            {calendarData.monthSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 shrink-0">
                <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Days</span>
                  <span className="text-base font-black text-white">{calendarData.monthSummary.daysInMonth} Days</span>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">Working Days</span>
                  <span className="text-base font-black text-emerald-300">{calendarData.monthSummary.totalWorkingDays} Days</span>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block">Weekly Offs</span>
                  <span className="text-base font-black text-blue-300">{calendarData.monthSummary.defaultSundaysCount} Sun</span>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block">Paid Holidays</span>
                  <span className="text-base font-black text-teal-300">{calendarData.monthSummary.holidaysCount} Hol</span>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-950 border border-amber-500/40 text-center bg-amber-950/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">⚡ Work Sundays</span>
                  <span className="text-base font-black text-amber-300">{calendarData.monthSummary.workingOverridesCount} Declared</span>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-950 border border-purple-500/40 text-center bg-purple-950/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">🌴 Substitute Offs</span>
                  <span className="text-base font-black text-purple-300">{calendarData.monthSummary.offOverridesCount} Declared</span>
                </div>
              </div>
            )}

            {/* Instruction Banner */}
            <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center space-x-2">
                <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>
                  💡 <strong>Tip:</strong> Click on any date card below to change its status (e.g. declare a Sunday as working or a Friday as substitute off).
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[11px] font-bold">
                <span className="flex items-center space-x-1 text-slate-400"><span className="w-2 h-2 rounded-full bg-slate-500"></span><span>Work</span></span>
                <span className="flex items-center space-x-1 text-blue-400"><span className="w-2 h-2 rounded-full bg-blue-500"></span><span>Sun Off</span></span>
                <span className="flex items-center space-x-1 text-amber-400"><span className="w-2 h-2 rounded-full bg-amber-500"></span><span>Work Sun</span></span>
                <span className="flex items-center space-x-1 text-purple-400"><span className="w-2 h-2 rounded-full bg-purple-500"></span><span>Sub Off</span></span>
                <span className="flex items-center space-x-1 text-teal-400"><span className="w-2 h-2 rounded-full bg-teal-500"></span><span>Holiday</span></span>
              </div>
            </div>

            {/* 7-Column Day Names Header */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-black uppercase tracking-wider text-slate-400 shrink-0">
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80">Mon</div>
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80">Tue</div>
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80">Wed</div>
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80">Thu</div>
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80">Fri</div>
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80">Sat</div>
              <div className="p-2 rounded-xl bg-slate-950 border border-blue-900/60 text-blue-400">Sun</div>
            </div>

            {/* Calendar Grid Cells */}
            <div className="grid grid-cols-7 gap-2">
              {calendarGrid.map((dayObj, index) => {
                if (!dayObj) {
                  return (
                    <div key={`blank-${index}`} className="min-h-[88px] rounded-2xl bg-slate-950/20 border border-dashed border-slate-800/40"></div>
                  );
                }

                const { dayNumber, dateStr, isSunday, override } = dayObj;
                const isWorkingOverride = override?.day_type === 'working_day';
                const isOffOverride = override?.day_type === 'off_day';
                const isHoliday = override?.day_type === 'holiday';

                // Determine border & background styling based on effective status
                let cardClass = 'bg-slate-950 border-slate-800 hover:border-slate-600';
                let badgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
                let badgeText = '💼 Working Day';

                if (isHoliday) {
                  cardClass = 'bg-teal-950/30 border-2 border-teal-500 shadow-md shadow-teal-950/50 hover:border-teal-400';
                  badgeClass = 'bg-teal-900/80 text-teal-200 border-teal-500 font-bold';
                  badgeText = `🇮🇳 ${override.title || 'Holiday'}`;
                } else if (isWorkingOverride) {
                  cardClass = 'bg-amber-950/40 border-2 border-amber-500 shadow-md shadow-amber-950/50 hover:border-amber-400 animate-pulse-subtle';
                  badgeClass = 'bg-amber-900/90 text-amber-200 border-amber-500 font-bold';
                  badgeText = `⚡ ${override.title || 'Working Day'}`;
                } else if (isOffOverride) {
                  cardClass = 'bg-purple-950/40 border-2 border-purple-500 shadow-md shadow-purple-950/50 hover:border-purple-400';
                  badgeClass = 'bg-purple-900/90 text-purple-200 border-purple-500 font-bold';
                  badgeText = `🌴 ${override.title || 'Substitute Off'}`;
                } else if (isSunday) {
                  cardClass = 'bg-blue-950/20 border border-blue-600/50 hover:border-blue-400';
                  badgeClass = 'bg-blue-950 text-blue-300 border-blue-600 font-bold';
                  badgeText = '🏖️ Sunday Off';
                }

                return (
                  <div
                    key={dateStr}
                    onClick={() => handleSelectDay(dayObj)}
                    className={`min-h-[92px] p-2.5 rounded-2xl transition-all cursor-pointer flex flex-col justify-between group relative select-none ${cardClass}`}
                  >
                    {/* Top Row: Date & Override Indicator */}
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-black font-mono ${isSunday && !isWorkingOverride ? 'text-blue-400' : isWorkingOverride ? 'text-amber-400' : isHoliday ? 'text-teal-400' : isOffOverride ? 'text-purple-400' : 'text-white'}`}>
                        {dayNumber}
                      </span>
                      {override && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-500/50" title="Custom Schedule Active"></span>
                      )}
                    </div>

                    {/* Badge */}
                    <div className="mt-1">
                      <div className={`px-1.5 py-0.5 rounded-lg text-[10px] leading-tight font-bold border truncate ${badgeClass}`}>
                        {badgeText}
                      </div>
                    </div>

                    {/* Hover Quick Hint */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end text-[10px] text-slate-400 font-bold mt-1">
                      <span>Click to edit ✏️</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: 1-CLICK SUNDAY ⇄ WEEKDAY SWAP WIZARD */}
        {activeTab === 'swap_wizard' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto space-y-4 p-2 pr-1">
            <div className="p-4 rounded-3xl bg-amber-950/20 border-2 border-amber-500/40 flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-950 text-amber-300 border border-amber-500 flex items-center justify-center shrink-0">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-black text-amber-200 font-display">
                  1-Click Factory Shift Swap Wizard (Compensatory Sunday ⇄ Substitute Weekday Off)
                </h4>
                <p className="text-xs text-amber-300/80 mt-1 leading-relaxed">
                  Example: You made workers come on <strong>Sunday (e.g. Aug 9)</strong> and gave them a <strong>Paid Off day on Friday (e.g. Aug 14)</strong>. 
                  This wizard configures both days simultaneously and recalculates full attendance and payroll so workers get 8h regular duty on Sunday and a paid off on Friday!
                </p>
              </div>
            </div>

            <form onSubmit={handleSwapSubmit} className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Step 1: Pick Working Sunday Date */}
                <div className="p-4 rounded-2xl bg-slate-900 border-2 border-amber-500/50">
                  <label className="block text-xs font-black text-amber-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                    <Briefcase className="w-4 h-4 text-amber-400" />
                    <span>1. Date to make WORKING DAY (e.g. Sunday Aug 9)</span>
                  </label>
                  <input
                    type="date"
                    value={swapWorkDate}
                    onChange={(e) => setSwapWorkDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-2">
                    Workers will receive <strong>8.0 Hours Regular Duty</strong> + standard overtime if they work on this day.
                  </p>
                </div>

                {/* Step 2: Pick Substitute Off Date */}
                <div className="p-4 rounded-2xl bg-slate-900 border-2 border-purple-500/50">
                  <label className="block text-xs font-black text-purple-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                    <Palmtree className="w-4 h-4 text-purple-400" />
                    <span>2. Date to make SUBSTITUTE OFF (e.g. Friday Aug 14)</span>
                  </label>
                  <input
                    type="date"
                    value={swapOffDate}
                    onChange={(e) => setSwapOffDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-2">
                    Workers get <strong>1 Full Paid Day Off</strong> without coming to work. If they work, it counts as Special Sunday/Holiday OT.
                  </p>
                </div>

              </div>

              {/* Optional Reason / Occasion */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Occasion / Shift Swap Reason (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Compensatory shift swap for Janmashtami / Factory Maintenance"
                  value={swapReason}
                  onChange={(e) => setSwapReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                />
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="submit"
                  disabled={actionLoading || !swapWorkDate || !swapOffDate}
                  className="px-6 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs shadow-lg shadow-amber-600/30 transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>{actionLoading ? 'Executing Swap & Recalculating...' : 'Apply 2-Way Swap & Recalculate Now'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: CONFIGURED SPECIAL DAYS LIST */}
        {activeTab === 'list' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto space-y-3 pr-1">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden">
              {calendarData.overrides.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Calendar className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  <p className="text-xs font-bold">No custom schedule overrides or holidays configured yet.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-900 text-slate-300 font-bold uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Title / Occasion</th>
                      <th className="py-3 px-4">Notes / Reason</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {calendarData.overrides.map(o => {
                      let typeBadge = 'bg-teal-950 text-teal-300 border-teal-500';
                      let typeLabel = '🇮🇳 Paid Holiday';
                      if (o.day_type === 'working_day') {
                        typeBadge = 'bg-amber-950 text-amber-300 border-amber-500';
                        typeLabel = '⚡ Mandatory Working Day';
                      } else if (o.day_type === 'off_day') {
                        typeBadge = 'bg-purple-950 text-purple-300 border-purple-500';
                        typeLabel = '🌴 Substitute Paid Off';
                      }

                      return (
                        <tr key={o.id} className="hover:bg-slate-900/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                            {o.date}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${typeBadge}`}>
                              {typeLabel}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-white">
                            {o.title}
                          </td>
                          <td className="py-3 px-4 text-slate-400">
                            {o.notes || '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleResetDay(o.date)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Delete Override / Reset to Default"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* DAY EDIT DRAWER / MODAL POPUP */}
        {selectedDay && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-900 border-2 border-indigo-500/70 rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl text-slate-100 space-y-4">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-500 flex items-center justify-center">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-white font-display">
                      Set Schedule for {selectedDay.dateStr} ({selectedDay.dayName})
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Choose how the factory operates on this specific date.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Day Type Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Select Day Schedule Type:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  
                  {/* Working Day Option */}
                  <button
                    type="button"
                    onClick={() => handleQuickPreset('working_day')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      dayType === 'working_day'
                        ? 'bg-amber-950/50 border-2 border-amber-500 text-amber-200 shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2 font-black text-xs">
                      <Briefcase className="w-4 h-4 text-amber-400" />
                      <span>⚡ Mandatory Working</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      8h regular duty & normal OT (e.g. Sunday made working). Absent = Unpaid.
                    </p>
                  </button>

                  {/* Substitute Off Option */}
                  <button
                    type="button"
                    onClick={() => handleQuickPreset('off_day')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      dayType === 'off_day'
                        ? 'bg-purple-950/50 border-2 border-purple-500 text-purple-200 shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2 font-black text-xs">
                      <Palmtree className="w-4 h-4 text-purple-400" />
                      <span>🌴 Substitute Paid Off</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Paid day off on a weekday (in lieu of Sunday worked). Work = Special OT.
                    </p>
                  </button>

                  {/* Paid Holiday Option */}
                  <button
                    type="button"
                    onClick={() => handleQuickPreset('holiday')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      dayType === 'holiday'
                        ? 'bg-teal-950/50 border-2 border-teal-500 text-teal-200 shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2 font-black text-xs">
                      <Flag className="w-4 h-4 text-teal-400" />
                      <span>🇮🇳 Declared Paid Holiday</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      National / Festival holiday (1 Full Paid Day). Work = Special OT.
                    </p>
                  </button>

                  {/* Standard Default Option */}
                  <button
                    type="button"
                    onClick={() => handleQuickPreset('default')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      dayType === 'default'
                        ? 'bg-blue-950/50 border-2 border-blue-500 text-blue-200 shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2 font-black text-xs">
                      <RotateCcw className="w-4 h-4 text-blue-400" />
                      <span>🟢 Standard Default</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Sunday = Weekly Off, Mon–Sat = Regular Working Day.
                    </p>
                  </button>

                </div>
              </div>

              {/* Title Input (if not default) */}
              {dayType !== 'default' && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Title / Occasion Name
                  </label>
                  <input
                    type="text"
                    value={dayTitle}
                    onChange={(e) => setDayTitle(e.target.value)}
                    placeholder="e.g. Sunday Working for Dispatch / Independence Day"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              )}

              {/* Notes Input (if not default) */}
              {dayType !== 'default' && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Notes / Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={dayNotes}
                    onChange={(e) => setDayNotes(e.target.value)}
                    placeholder="e.g. Approved by Factory Director"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                {selectedDay.override ? (
                  <button
                    type="button"
                    onClick={() => handleResetDay(selectedDay.dateStr)}
                    className="px-3 py-2 rounded-xl bg-rose-950 text-rose-300 hover:bg-rose-900 border border-rose-600 text-xs font-bold transition-all cursor-pointer"
                  >
                    Reset to Default
                  </button>
                ) : (
                  <div></div>
                )}

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDay(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDay}
                    disabled={actionLoading || (dayType !== 'default' && !dayTitle.trim())}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? 'Saving...' : 'Save & Recalculate'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
