import React, { useState, useMemo } from 'react';
import { 
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, isSameMonth, isSameDay, isToday, 
  addMonths, subMonths, parseISO, setHours, setMinutes,
  addWeeks, subWeeks, addDays, subDays, addYears, subYears,
  startOfYear, endOfYear, eachMonthOfInterval
} from 'date-fns';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Plus, CheckSquare, Square, Clock, RotateCw, 
  RefreshCw, Sparkles, Filter, MoreHorizontal, X,
  CheckCircle2, ArrowRight, ListTodo, CalendarRange, Sun
} from 'lucide-react';
import { useTasks } from '../../context/TaskContext';
import { GoogleSyncModal } from './GoogleSyncModal';
import { TaskDetailPanel } from '../task-detail/TaskDetailPanel';
import toast from 'react-hot-toast';

export const CalendarView = () => {
  const { 
    allTasks = [], 
    addTask, 
    updateTask, 
    toggleTaskCompletion, 
    selectedTaskId, 
    setSelectedTaskId,
    dropdownPriorities = [],
    dropdownStatuses = []
  } = useTasks();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeViewMode, setActiveViewMode] = useState('Month'); // 'Year' | 'Month' | 'Week' | 'Day' | 'Agenda' | 'Multi-Day' | 'Multi-Week'
  const [isGoogleSyncModalOpen, setIsGoogleSyncModalOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverDateKey, setDragOverDateKey] = useState(null);
  const [quickAddDay, setQuickAddDay] = useState(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  // ─────────────────────────────────────────────────────────────
  // 1. Date Calculations for Different Views
  // ─────────────────────────────────────────────────────────────
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
    const endDate = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentDate]);

  const multiDays = useMemo(() => {
    return [currentDate, addDays(currentDate, 1), addDays(currentDate, 2)];
  }, [currentDate]);

  const multiWeekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = addDays(start, 13);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const yearMonths = useMemo(() => {
    return eachMonthOfInterval({
      start: startOfYear(currentDate),
      end: endOfYear(currentDate)
    });
  }, [currentDate]);

  // ─────────────────────────────────────────────────────────────
  // 2. Map Tasks to Days (keyed by 'yyyy-MM-dd')
  // ─────────────────────────────────────────────────────────────
  const tasksByDay = useMemo(() => {
    const map = new Map();

    allTasks.forEach(task => {
      if (!task.due_date) return;
      try {
        const taskDate = task.due_date instanceof Date ? task.due_date : new Date(task.due_date);
        if (isNaN(taskDate.getTime())) return;
        const dateKey = format(taskDate, 'yyyy-MM-dd');
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        const timeStr = format(taskDate, 'HH:mm');
        map.get(dateKey).push({
          ...task,
          taskTime: timeStr !== '00:00' ? timeStr : null
        });
      } catch (e) {
        // Ignore invalid dates
      }
    });

    return map;
  }, [allTasks]);

  // Chronologically sorted tasks for Agenda view
  const agendaTasksGrouped = useMemo(() => {
    const sorted = [...allTasks].filter(t => t.due_date).sort((a, b) => {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

    const groups = new Map();
    sorted.forEach(task => {
      try {
        const d = new Date(task.due_date);
        if (isNaN(d.getTime())) return;
        const key = format(d, 'yyyy-MM-dd');
        if (!groups.has(key)) groups.set(key, { date: d, tasks: [] });
        groups.get(key).tasks.push(task);
      } catch {
        // Ignore invalid
      }
    });

    return Array.from(groups.values());
  }, [allTasks]);

  // ─────────────────────────────────────────────────────────────
  // 3. Navigation Controls
  // ─────────────────────────────────────────────────────────────
  const handlePrev = () => {
    if (activeViewMode === 'Week') setCurrentDate(prev => subWeeks(prev, 1));
    else if (activeViewMode === 'Day') setCurrentDate(prev => subDays(prev, 1));
    else if (activeViewMode === 'Multi-Day') setCurrentDate(prev => subDays(prev, 3));
    else if (activeViewMode === 'Multi-Week') setCurrentDate(prev => subWeeks(prev, 2));
    else if (activeViewMode === 'Year') setCurrentDate(prev => subYears(prev, 1));
    else setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleNext = () => {
    if (activeViewMode === 'Week') setCurrentDate(prev => addWeeks(prev, 1));
    else if (activeViewMode === 'Day') setCurrentDate(prev => addDays(prev, 1));
    else if (activeViewMode === 'Multi-Day') setCurrentDate(prev => addDays(prev, 3));
    else if (activeViewMode === 'Multi-Week') setCurrentDate(prev => addWeeks(prev, 2));
    else if (activeViewMode === 'Year') setCurrentDate(prev => addYears(prev, 1));
    else setCurrentDate(prev => addMonths(prev, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Header Title Text
  const getViewTitle = () => {
    switch (activeViewMode) {
      case 'Week': {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = endOfWeek(currentDate, { weekStartsOn: 1 });
        return {
          main: `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`,
          sub: format(currentDate, 'yyyy')
        };
      }
      case 'Day':
        return {
          main: format(currentDate, 'EEEE, MMMM d'),
          sub: format(currentDate, 'yyyy')
        };
      case 'Year':
        return {
          main: format(currentDate, 'yyyy'),
          sub: 'Annual View'
        };
      case 'Multi-Day':
        return {
          main: `${format(currentDate, 'MMM d')} – ${format(addDays(currentDate, 2), 'MMM d')}`,
          sub: format(currentDate, 'yyyy')
        };
      case 'Multi-Week': {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = addDays(start, 13);
        return {
          main: `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`,
          sub: format(currentDate, 'yyyy')
        };
      }
      case 'Agenda':
        return {
          main: 'Task Agenda',
          sub: format(currentDate, 'MMMM yyyy')
        };
      case 'Month':
      default:
        return {
          main: format(currentDate, 'MMMM'),
          sub: format(currentDate, 'yyyy')
        };
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 4. Drag & Drop Rescheduling Logic
  // ─────────────────────────────────────────────────────────────
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e, day) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const dateKey = format(day, 'yyyy-MM-dd');
    if (dragOverDateKey !== dateKey) {
      setDragOverDateKey(dateKey);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOverDateKey(null);
  };

  const handleDrop = async (e, targetDay) => {
    e.preventDefault();
    setDragOverDateKey(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDraggedTaskId(null);

    if (!taskId) return;

    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      let newDate = new Date(targetDay);
      if (task.due_date) {
        try {
          const original = parseISO(task.due_date);
          newDate = setHours(newDate, original.getHours());
          newDate = setMinutes(newDate, original.getMinutes());
        } catch {
          newDate = setHours(newDate, 12);
        }
      } else {
        newDate = setHours(newDate, 12);
      }

      const isoDate = newDate.toISOString();
      const success = await updateTask(taskId, { due_date: isoDate });

      if (success) {
        toast.success(`Rescheduled "${task.title}" to ${format(newDate, 'MMM d, yyyy')}`);
      }
    } catch (err) {
      toast.error('Failed to reschedule task: ' + err.message);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 5. Quick Task Creation
  // ─────────────────────────────────────────────────────────────
  const handleQuickAddSubmit = async (e) => {
    e.preventDefault();
    if (!quickAddTitle.trim() || !quickAddDay) return;

    try {
      const taskDate = setHours(new Date(quickAddDay), 12);
      await addTask({
        title: quickAddTitle.trim(),
        due_date: taskDate.toISOString()
      });
      setQuickAddTitle('');
      setQuickAddDay(null);
      toast.success('Task scheduled!');
    } catch (err) {
      toast.error('Failed to create task: ' + err.message);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 6. Color Scheme Generator (Clean Light + Dark Mode Support)
  // ─────────────────────────────────────────────────────────────
  const getTaskPillStyles = (task) => {
    if (task.is_completed) {
      return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300/80 border-emerald-200 dark:border-emerald-800/40 line-through opacity-70';
    }

    const priorityObj = dropdownPriorities.find(p => p.id === task.priority_id);
    const priorityName = priorityObj?.name?.toLowerCase() || '';

    if (priorityName.includes('high') || priorityName.includes('urgent')) {
      return 'bg-rose-100/90 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700/50 hover:bg-rose-200/90 dark:hover:bg-rose-900/60';
    }
    if (priorityName.includes('medium')) {
      return 'bg-amber-100/90 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700/50 hover:bg-amber-200/90 dark:hover:bg-amber-900/60';
    }
    if (priorityName.includes('low')) {
      return 'bg-teal-100/90 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-700/50 hover:bg-teal-200/90 dark:hover:bg-teal-900/60';
    }

    const charCode = task.title.charCodeAt(0) || 0;
    const variants = [
      'bg-amber-100/70 dark:bg-[#2d2a23] text-amber-900 dark:text-[#e0cfb3] border-amber-300/70 dark:border-[#4a4233] hover:bg-amber-200/80 dark:hover:bg-[#38332a]',
      'bg-blue-100/70 dark:bg-[#1e2a38] text-blue-900 dark:text-[#b3d4f0] border-blue-300/70 dark:border-[#31435a] hover:bg-blue-200/80 dark:hover:bg-[#253547]',
      'bg-emerald-100/70 dark:bg-[#20322b] text-emerald-900 dark:text-[#b5decb] border-emerald-300/70 dark:border-[#334d43] hover:bg-emerald-200/80 dark:hover:bg-[#283e35]',
      'bg-purple-100/70 dark:bg-[#2c2235] text-purple-900 dark:text-[#dbbeea] border-purple-300/70 dark:border-[#463654] hover:bg-purple-200/80 dark:hover:bg-[#372a42]',
      'bg-rose-100/70 dark:bg-[#342426] text-rose-900 dark:text-[#e8b6bb] border-rose-300/70 dark:border-[#52373a] hover:bg-rose-200/80 dark:hover:bg-[#412c2e]',
      'bg-cyan-100/70 dark:bg-[#252836] text-cyan-900 dark:text-[#b8c7e0] border-cyan-300/70 dark:border-[#3b4156] hover:bg-cyan-200/80 dark:hover:bg-[#303445]'
    ];

    return variants[charCode % variants.length];
  };

  const weekDayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const titleInfo = getViewTitle();

  // ─────────────────────────────────────────────────────────────
  // Helper: Render Task Pill
  // ─────────────────────────────────────────────────────────────
  const renderTaskPill = (task) => {
    const isSelected = selectedTaskId === task.id;
    const pillStyles = getTaskPillStyles(task);

    return (
      <div
        key={task.id}
        draggable={true}
        onDragStart={(e) => handleDragStart(e, task.id)}
        onClick={() => setSelectedTaskId(task.id)}
        className={`group/task px-2 py-1 rounded-md text-[11px] font-medium border flex items-center justify-between gap-1.5 cursor-pointer transition-all shadow-2xs ${pillStyles} ${
          isSelected ? 'ring-2 ring-blue-500 dark:ring-white/80 shadow-md' : ''
        }`}
        title={`${task.title} (Drag to reschedule, Click to edit)`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleTaskCompletion(task.id);
            }}
            className="shrink-0 text-current opacity-70 hover:opacity-100 transition-opacity"
          >
            {task.is_completed ? (
              <CheckSquare className="w-3 h-3" />
            ) : (
              <Square className="w-3 h-3" />
            )}
          </button>

          <span className="truncate tracking-tight font-medium text-[11px] flex-1">
            {task.title}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 text-[10px] opacity-75">
          {task.recurrence_rule && (
            <RotateCw className="w-2.5 h-2.5 shrink-0" />
          )}
          {task.taskTime && (
            <span className="hidden sm:inline font-mono text-[9px]">{task.taskTime}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 h-screen flex overflow-hidden bg-slate-100 dark:bg-[#141416] text-slate-800 dark:text-slate-100 font-sans select-none relative transition-colors">
      
      {/* Main Calendar View Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* ── Top Header Bar ── */}
        <header className="h-14 px-6 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-white dark:bg-[#18181c] shrink-0 z-10 transition-colors">
          
          {/* Left: View Title & Icon */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-white/5 border border-blue-200/60 dark:border-white/10 flex items-center justify-center text-blue-600 dark:text-slate-300">
              <CalendarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>{titleInfo.main}</span>
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400">{titleInfo.sub}</span>
            </h1>
          </div>

          {/* Right: Quick Add, Navigation Controls & Sync Trigger */}
          <div className="flex items-center gap-2">
            
            {/* Quick Add Button */}
            <button
              type="button"
              onClick={() => {
                setQuickAddDay(currentDate);
              }}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-300/70 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Quick Add Task for Selected Date"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* View Selector Dropdown */}
            <div className="relative">
              <select
                value={activeViewMode}
                onChange={(e) => setActiveViewMode(e.target.value)}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-300/70 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden cursor-pointer"
              >
                <option value="Month" className="bg-white dark:bg-[#1f1f23] text-slate-900 dark:text-slate-100">Month</option>
                <option value="Week" className="bg-white dark:bg-[#1f1f23] text-slate-900 dark:text-slate-100">Week</option>
                <option value="Day" className="bg-white dark:bg-[#1f1f23] text-slate-900 dark:text-slate-100">Day</option>
                <option value="Agenda" className="bg-white dark:bg-[#1f1f23] text-slate-900 dark:text-slate-100">Agenda</option>
                <option value="Multi-Day" className="bg-white dark:bg-[#1f1f23] text-slate-900 dark:text-slate-100">Multi-Day</option>
                <option value="Multi-Week" className="bg-white dark:bg-[#1f1f23] text-slate-900 dark:text-slate-100">Multi-Week</option>
                <option value="Year" className="bg-white dark:bg-[#1f1f23] text-slate-900 dark:text-slate-100">Year</option>
              </select>
            </div>

            {/* Navigation: < Today > */}
            <div className="flex items-center bg-slate-100 dark:bg-white/5 border border-slate-300/70 dark:border-white/10 rounded-lg p-0.5">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 rounded transition-colors cursor-pointer"
                title="Previous"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              
              <button
                type="button"
                onClick={handleToday}
                className="px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Today
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="p-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 rounded transition-colors cursor-pointer"
                title="Next"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Google Calendar 2-Way Sync Button */}
            <button
              type="button"
              onClick={() => setIsGoogleSyncModalOpen(true)}
              className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 dark:bg-blue-600/20 dark:hover:bg-blue-600/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="Google Calendar 2-Way Integration"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Google Sync</span>
            </button>

            {/* Options Menu Button */}
            <button
              type="button"
              onClick={() => setIsGoogleSyncModalOpen(true)}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="More Options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

          </div>
        </header>

        {/* ── Inline Quick Add Modal/Banner (if active) ── */}
        {quickAddDay && (
          <div className="px-6 py-2 bg-blue-50/80 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900/60 flex items-center justify-between gap-4 z-20 shrink-0">
            <form onSubmit={handleQuickAddSubmit} className="flex-1 flex items-center gap-2 max-w-xl">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 shrink-0">
                New task for {format(quickAddDay, 'MMM d, yyyy')}:
              </span>
              <input
                type="text"
                autoFocus
                value={quickAddTitle}
                onChange={(e) => setQuickAddTitle(e.target.value)}
                placeholder="Type task title and press Enter..."
                className="flex-1 bg-white dark:bg-[#23242a] text-xs text-slate-900 dark:text-white px-2.5 py-1.5 rounded-lg border border-blue-300 dark:border-blue-700 focus:outline-hidden shadow-xs"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>Add</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </form>
            <button
              type="button"
              onClick={() => { setQuickAddDay(null); setQuickAddTitle(''); }}
              className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Dynamic Content Based on activeViewMode ── */}
        <div className="flex-1 flex flex-col overflow-hidden pb-20">

          {/* ─────────────────────────────────────────────────────────────
              VIEW 1: MONTH (7x5/6 Grid)
             ───────────────────────────────────────────────────────────── */}
          {activeViewMode === 'Month' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#161619] text-[11px] font-semibold text-slate-500 dark:text-slate-400 py-2 shrink-0">
                {weekDayNames.map((dayName) => (
                  <div key={dayName} className="px-3 text-left">
                    {dayName}
                  </div>
                ))}
              </div>

              {/* Month Grid View */}
              <div className="flex-1 grid grid-cols-7 grid-rows-5 lg:grid-rows-6 divide-x divide-y divide-slate-200 dark:divide-white/5 overflow-y-auto bg-slate-100 dark:bg-[#141416]">
                {monthDays.map((day) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayTasks = tasksByDay.get(dateKey) || [];
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isCurrentDay = isToday(day);
                  const isDropTarget = dragOverDateKey === dateKey;
                  const isFirstDayOfMonth = day.getDate() === 1;

                  return (
                    <div
                      key={dateKey}
                      onDragOver={(e) => handleDragOver(e, day)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, day)}
                      onDoubleClick={() => setQuickAddDay(day)}
                      className={`flex flex-col min-h-[95px] p-1.5 transition-colors group relative ${
                        !isCurrentMonth 
                          ? 'bg-slate-50/70 dark:bg-[#121214]/60 opacity-60 dark:opacity-40' 
                          : 'bg-white dark:bg-[#151518]'
                      } ${
                        isDropTarget ? 'bg-blue-500/10 ring-2 ring-blue-500/50 inset-0 z-10' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1 px-1">
                        <div className="flex items-center gap-1">
                          {isCurrentDay ? (
                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shadow-xs">
                              {format(day, 'd')}
                            </span>
                          ) : (
                            <span className={`text-[11px] font-medium ${
                              isCurrentMonth ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'
                            }`}>
                              {isFirstDayOfMonth ? format(day, 'MMM d') : format(day, 'd')}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setQuickAddDay(day)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-opacity cursor-pointer"
                          title={`Add task on ${format(day, 'MMM d')}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="flex-1 space-y-1 overflow-y-auto no-scrollbar max-h-[120px]">
                        {dayTasks.map(renderTaskPill)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              VIEW 2: WEEK (7 Columns, Mon – Sun)
             ───────────────────────────────────────────────────────────── */}
          {activeViewMode === 'Week' && (
            <div className="flex-1 flex overflow-x-auto divide-x divide-slate-200 dark:divide-white/5 bg-slate-100 dark:bg-[#141416]">
              {weekDays.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayTasks = tasksByDay.get(dateKey) || [];
                const isCurrentDay = isToday(day);
                const isDropTarget = dragOverDateKey === dateKey;

                return (
                  <div
                    key={dateKey}
                    onDragOver={(e) => handleDragOver(e, day)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, day)}
                    className={`flex-1 min-w-[140px] flex flex-col bg-white dark:bg-[#151518] transition-colors ${
                      isDropTarget ? 'bg-blue-500/10 ring-2 ring-blue-500/50' : ''
                    }`}
                  >
                    {/* Day Column Header */}
                    <div className={`p-3 border-b border-slate-200 dark:border-white/5 flex items-center justify-between ${
                      isCurrentDay ? 'bg-blue-50/50 dark:bg-blue-950/20' : 'bg-slate-50 dark:bg-[#18181c]'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {format(day, 'EEE')}
                        </span>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isCurrentDay 
                            ? 'bg-blue-600 text-white shadow-xs' 
                            : 'text-slate-800 dark:text-slate-200'
                        }`}>
                          {format(day, 'd')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQuickAddDay(day)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 cursor-pointer"
                        title="Add task for this day"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Day Task List */}
                    <div className="flex-1 p-2 space-y-1.5 overflow-y-auto">
                      {dayTasks.length === 0 ? (
                        <div className="h-24 border border-dashed border-slate-200 dark:border-white/5 rounded-lg flex items-center justify-center text-[10px] text-slate-400">
                          No tasks
                        </div>
                      ) : (
                        dayTasks.map(renderTaskPill)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              VIEW 3: DAY (Single Focused Day View)
             ───────────────────────────────────────────────────────────── */}
          {activeViewMode === 'Day' && (
            <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-6 overflow-y-auto">
              {(() => {
                const dateKey = format(currentDate, 'yyyy-MM-dd');
                const dayTasks = tasksByDay.get(dateKey) || [];
                const completedCount = dayTasks.filter(t => t.is_completed).length;

                return (
                  <div className="space-y-6">
                    {/* Day Overview Banner */}
                    <div className="bg-white dark:bg-[#18181c] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
                          <Sun className="w-4 h-4" />
                          <span>Daily Focus</span>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                          {format(currentDate, 'EEEE, MMMM d, yyyy')}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {dayTasks.length} {dayTasks.length === 1 ? 'task scheduled' : 'tasks scheduled'} • {completedCount} completed
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setQuickAddDay(currentDate)}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer self-start sm:self-auto"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Task for Today</span>
                      </button>
                    </div>

                    {/* Task List */}
                    <div className="bg-white dark:bg-[#18181c] border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-2 mb-3">
                        Scheduled Tasks
                      </h3>

                      {dayTasks.length === 0 ? (
                        <div className="py-12 text-center text-slate-400">
                          <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-40 text-slate-300 dark:text-slate-600" />
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No tasks scheduled for this day</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Use the button above to add one, or drag tasks from other views.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {dayTasks.map(t => (
                            <div
                              key={t.id}
                              onClick={() => setSelectedTaskId(t.id)}
                              className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                                t.is_completed 
                                  ? 'bg-slate-50 dark:bg-[#141416]/60 border-slate-200 dark:border-white/5 opacity-70' 
                                  : 'bg-slate-50/50 hover:bg-slate-100/80 dark:bg-white/[0.02] dark:hover:bg-white/[0.05] border-slate-200 dark:border-white/5'
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTaskCompletion(t.id);
                                  }}
                                  className="text-slate-400 hover:text-blue-600"
                                >
                                  {t.is_completed ? (
                                    <CheckSquare className="w-4 h-4 text-emerald-500" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </button>
                                <span className={`text-sm font-semibold truncate ${
                                  t.is_completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'
                                }`}>
                                  {t.title}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {t.taskTime && (
                                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                                    {t.taskTime}
                                  </span>
                                )}
                                {t.recurrence_rule && (
                                  <RotateCw className="w-3.5 h-3.5 text-blue-500" title="Recurring task" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              VIEW 4: AGENDA (Chronological Stream)
             ───────────────────────────────────────────────────────────── */}
          {activeViewMode === 'Agenda' && (
            <div className="flex-1 max-w-4xl mx-auto w-full p-6 overflow-y-auto space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <ListTodo className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Upcoming Agenda</h2>
                </div>
                <span className="text-xs font-medium text-slate-500">
                  {allTasks.filter(t => t.due_date).length} scheduled tasks total
                </span>
              </div>

              {agendaTasksGrouped.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <CalendarRange className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
                  <p className="text-base font-semibold text-slate-600 dark:text-slate-300">No scheduled tasks found</p>
                  <p className="text-xs text-slate-400 mt-1">Add due dates to your tasks to see them organized chronologically here.</p>
                </div>
              ) : (
                agendaTasksGrouped.map(({ date, tasks }) => {
                  const isCurrentDay = isToday(date);
                  return (
                    <div key={format(date, 'yyyy-MM-dd')} className="bg-white dark:bg-[#18181c] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                      <div className={`px-4 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-white/5 ${
                        isCurrentDay ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-slate-50 dark:bg-white/[0.02]'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${isCurrentDay ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                            {format(date, 'EEEE, MMMM d, yyyy')}
                          </span>
                          {isCurrentDay && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                              Today
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-semibold text-slate-400">
                          {tasks.length} {tasks.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>

                      <div className="divide-y divide-slate-100 dark:divide-white/5">
                        {tasks.map(t => (
                          <div
                            key={t.id}
                            onClick={() => setSelectedTaskId(t.id)}
                            className="p-3 px-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTaskCompletion(t.id);
                                }}
                                className="text-slate-400 hover:text-blue-600 shrink-0"
                              >
                                {t.is_completed ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-500" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                              <span className={`text-xs font-semibold truncate ${
                                t.is_completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'
                              }`}>
                                {t.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {t.taskTime && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400">
                                  {t.taskTime}
                                </span>
                              )}
                              {t.recurrence_rule && (
                                <RotateCw className="w-3 h-3 text-blue-500" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              VIEW 5: MULTI-DAY (3 Consecutive Days)
             ───────────────────────────────────────────────────────────── */}
          {activeViewMode === 'Multi-Day' && (
            <div className="flex-1 flex overflow-x-auto divide-x divide-slate-200 dark:divide-white/5 bg-slate-100 dark:bg-[#141416]">
              {multiDays.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayTasks = tasksByDay.get(dateKey) || [];
                const isCurrentDay = isToday(day);

                return (
                  <div
                    key={dateKey}
                    onDragOver={(e) => handleDragOver(e, day)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, day)}
                    className="flex-1 min-w-[200px] flex flex-col bg-white dark:bg-[#151518]"
                  >
                    <div className={`p-3 border-b border-slate-200 dark:border-white/5 flex items-center justify-between ${
                      isCurrentDay ? 'bg-blue-50/50 dark:bg-blue-950/20' : 'bg-slate-50 dark:bg-[#18181c]'
                    }`}>
                      <div>
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{format(day, 'EEEE')}</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">{format(day, 'MMM d')}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQuickAddDay(day)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                      {dayTasks.length === 0 ? (
                        <div className="h-32 border border-dashed border-slate-200 dark:border-white/5 rounded-xl flex items-center justify-center text-xs text-slate-400">
                          No tasks scheduled
                        </div>
                      ) : (
                        dayTasks.map(renderTaskPill)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              VIEW 6: MULTI-WEEK (14 Days / 2-Week Sprint)
             ───────────────────────────────────────────────────────────── */}
          {activeViewMode === 'Multi-Week' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="grid grid-cols-7 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#161619] text-[11px] font-semibold text-slate-500 dark:text-slate-400 py-2 shrink-0">
                {weekDayNames.map((d) => (
                  <div key={d} className="px-3 text-left">{d}</div>
                ))}
              </div>

              <div className="flex-1 grid grid-cols-7 grid-rows-2 divide-x divide-y divide-slate-200 dark:divide-white/5 overflow-y-auto bg-slate-100 dark:bg-[#141416]">
                {multiWeekDays.map((day) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayTasks = tasksByDay.get(dateKey) || [];
                  const isCurrentDay = isToday(day);

                  return (
                    <div
                      key={dateKey}
                      onDragOver={(e) => handleDragOver(e, day)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, day)}
                      onDoubleClick={() => setQuickAddDay(day)}
                      className="flex flex-col p-2 bg-white dark:bg-[#151518] min-h-[140px]"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold ${isCurrentDay ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {format(day, 'MMM d')}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuickAddDay(day)}
                          className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
                        {dayTasks.map(renderTaskPill)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              VIEW 7: YEAR (12 Mini Month Calendar Grid)
             ───────────────────────────────────────────────────────────── */}
          {activeViewMode === 'Year' && (
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
                {yearMonths.map((monthDate) => {
                  const mStart = startOfMonth(monthDate);
                  const mEnd = endOfMonth(monthDate);
                  const daysInMonth = eachDayOfInterval({ start: mStart, end: mEnd });
                  const monthName = format(monthDate, 'MMMM');

                  // Count tasks this month
                  const tasksThisMonth = allTasks.filter(t => {
                    if (!t.due_date) return false;
                    try {
                      return isSameMonth(new Date(t.due_date), monthDate);
                    } catch { return false; }
                  }).length;

                  return (
                    <div
                      key={monthName}
                      onClick={() => {
                        setCurrentDate(monthDate);
                        setActiveViewMode('Month');
                      }}
                      className="p-3 bg-white dark:bg-[#18181c] border border-slate-200 dark:border-white/10 rounded-xl hover:border-blue-500/50 hover:shadow-md cursor-pointer transition-all group"
                    >
                      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100 dark:border-white/5">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {monthName}
                        </span>
                        {tasksThisMonth > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                            {tasksThisMonth}
                          </span>
                        )}
                      </div>

                      {/* Mini Day Grid */}
                      <div className="grid grid-cols-7 gap-1 text-center text-[9px]">
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                          <div key={i} className="text-slate-400 font-semibold">{d}</div>
                        ))}
                        {daysInMonth.map(d => {
                          const hasTask = tasksByDay.has(format(d, 'yyyy-MM-dd'));
                          const isCurrent = isToday(d);
                          return (
                            <div
                              key={d.toISOString()}
                              className={`py-0.5 rounded-sm ${
                                isCurrent 
                                  ? 'bg-blue-600 text-white font-bold' 
                                  : hasTask 
                                  ? 'font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40' 
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {format(d, 'd')}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* ── Bottom Floating View Switcher Bar (Supports Light & Dark Modes) ── */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 z-20 pointer-events-auto">
          <div className="bg-white/95 dark:bg-[#1f1f23]/95 backdrop-blur-md border border-slate-300/80 dark:border-white/10 rounded-full p-1.5 shadow-2xl flex items-center gap-1 max-w-[calc(100vw-2rem)] overflow-x-auto no-scrollbar">
            
            {['Year', 'Month', 'Week', 'Day', 'Agenda', 'Multi-Day', 'Multi-Week'].map((mode) => {
              const isActive = activeViewMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setActiveViewMode(mode)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    isActive 
                      ? 'bg-slate-900 text-white dark:bg-white/20 dark:text-white shadow-xs' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  {mode}
                </button>
              );
            })}

            {/* Google Sync Action Pill Button */}
            <button
              type="button"
              onClick={() => setIsGoogleSyncModalOpen(true)}
              className="ml-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Google 2-Way Sync</span>
            </button>

          </div>

          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
            Drag & drop task pills between days to reschedule • Live 2-way Google Calendar integration
          </span>
        </div>

      </div>

      {/* ── Right Slide-over Task Details Panel (Floating Overlay) ── */}
      {selectedTaskId && (
        <div className="absolute right-0 top-0 bottom-0 w-80 lg:w-96 border-l border-slate-200 dark:border-white/10 bg-white dark:bg-[#1b1c20] h-full flex flex-col z-30 shadow-2xl animate-in slide-in-from-right duration-200">
          <button
            type="button"
            onClick={() => setSelectedTaskId(null)}
            className="absolute top-3.5 right-3.5 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors z-40 cursor-pointer"
            title="Close Details"
          >
            <X className="w-4 h-4" />
          </button>
          <TaskDetailPanel />
        </div>
      )}

      {/* ── Google Calendar 2-Way Sync Modal ── */}
      <GoogleSyncModal
        isOpen={isGoogleSyncModalOpen}
        onClose={() => setIsGoogleSyncModalOpen(false)}
      />

    </div>
  );
};
