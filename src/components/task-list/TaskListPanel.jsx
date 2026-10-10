import React, { useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import { QuickAddTask } from './QuickAddTask';
import { TaskItem } from './TaskItem';
import { parseSearchQuery } from '../../lib/searchParser';
import { DateRangeFilter } from './DateRangeFilter';
import { SearchAutocomplete } from './SearchAutocomplete';
import { 
  Inbox, Calendar, CalendarDays, Folder, Users, Search, 
  Plus, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, RefreshCw, CalendarRange, X
} from 'lucide-react';
import { isToday, isTomorrow, isPast, isWithinInterval, addDays, startOfDay, endOfDay, parseISO } from 'date-fns';

export const TaskListPanel = ({ onOpenCreateList, onOpenCreateTeam }) => {
  const { tasks, lists, selectedListId, refreshTasks, loading, allUsers, dropdownTags } = useTasks();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateField, setDateField] = useState('due_date'); // 'due_date' | 'created_at'

  const currentList = lists.find(l => l.id === selectedListId) || lists[0];

  // Filter tasks by smart search query
  const parsedSearch = parseSearchQuery(searchQuery);
  const filteredBySearch = tasks.filter(t => {
    // 1. General text
    if (parsedSearch.text) {
      const searchLower = parsedSearch.text.toLowerCase();
      const titleMatch = t.title?.toLowerCase().includes(searchLower);
      const descMatch = t.description?.toLowerCase().includes(searchLower);
      if (!titleMatch && !descMatch) return false;
    }

    // 2. Tags
    if (parsedSearch.tags.length > 0) {
      const hasAllTags = parsedSearch.tags.every(searchTag => {
        const tagClean = searchTag.replace(/_/g, ' ').toLowerCase();
        return t.tags?.some(taskTag => taskTag.name.toLowerCase().includes(tagClean));
      });
      if (!hasAllTags) return false;
    }

    // 3. Users (Creator, Assignee, Acknowledgers)
    if (parsedSearch.users.length > 0) {
      const creator = allUsers?.find(u => u.id === t.created_by);
      const assignee = allUsers?.find(u => u.id === t.assigned_to);
      const acks = t.task_acknowledgements || [];
      
      const hasAllUsers = parsedSearch.users.every(searchUser => {
        const uClean = searchUser.replace(/_/g, ' ').toLowerCase();
        return (
          creator?.full_name?.toLowerCase().includes(uClean) ||
          creator?.email?.toLowerCase().includes(uClean) ||
          assignee?.full_name?.toLowerCase().includes(uClean) ||
          assignee?.email?.toLowerCase().includes(uClean) ||
          acks.some(ack => (ack.full_name || ack.user?.full_name)?.toLowerCase().includes(uClean))
        );
      });
      if (!hasAllUsers) return false;
    }

    // 4. Dates
    if (parsedSearch.dates.length > 0) {
      const taskDate = t.due_date ? parseISO(t.due_date) : null;
      const hasDateMatch = parsedSearch.dates.every(searchDate => {
        if (!taskDate) return false;
        const dLower = searchDate.toLowerCase();
        if (dLower === 'اليوم' || dLower === 'today') return isToday(taskDate);
        if (dLower === 'غدا' || dLower === 'غداً' || dLower === 'tomorrow') return isTomorrow(taskDate);
        
        try {
          const specificDate = parseISO(searchDate);
          return taskDate.toISOString().split('T')[0] === specificDate.toISOString().split('T')[0];
        } catch {
          return false;
        }
      });
      if (!hasDateMatch) return false;
    }

    return true;
  });

  // Filter tasks by Date Range (Start Date → End Date)
  const filteredByDate = filteredBySearch.filter(t => {
    if (!startDate && !endDate) return true;

    const rawDate = dateField === 'created_at' ? t.created_at : t.due_date;
    if (!rawDate) return false;

    try {
      const taskDate = parseISO(rawDate);
      if (startDate) {
        const start = startOfDay(parseISO(startDate));
        if (taskDate < start) return false;
      }
      if (endDate) {
        const end = endOfDay(parseISO(endDate));
        if (taskDate > end) return false;
      }
      return true;
    } catch {
      return false;
    }
  });

  const uncompletedTasks = filteredByDate.filter(t => !t.is_completed);
  const completedTasks = filteredByDate.filter(t => t.is_completed);

  // Group uncompleted tasks by Smart Dates safely
  const overdueTasks = uncompletedTasks.filter(t => {
    if (!t?.due_date) return false;
    try {
      const d = parseISO(t.due_date);
      return isPast(d) && !isToday(d);
    } catch (e) {
      return false;
    }
  });

  const todayTasks = uncompletedTasks.filter(t => {
    if (!t?.due_date) return false;
    try {
      return isToday(parseISO(t.due_date));
    } catch (e) {
      return false;
    }
  });

  const tomorrowTasks = uncompletedTasks.filter(t => {
    if (!t?.due_date) return false;
    try {
      return isTomorrow(parseISO(t.due_date));
    } catch (e) {
      return false;
    }
  });

  const laterTasks = uncompletedTasks.filter(t => {
    if (!t?.due_date) return true;
    try {
      const date = parseISO(t.due_date);
      return !isPast(date) && !isToday(date) && !isTomorrow(date);
    } catch (e) {
      return true;
    }
  });

  return (
    <div className="flex-1 h-screen bg-slate-50/60 dark:bg-[#18181c] text-slate-900 dark:text-slate-100 flex flex-col min-w-0 border-r border-slate-200 dark:border-slate-800">
      
      {/* Panel Top Header (Elevated z-30 so DateFilter and Search Autocomplete float above task list) */}
      <div className="relative z-30 p-4 border-b border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-[#18181c]/90 backdrop-blur-md flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {currentList.team_id ? (
            <Users className="w-6 h-6 text-pink-500 dark:text-pink-400 shrink-0" />
          ) : currentList.id === 'list-today' ? (
            <Calendar className="w-6 h-6 text-emerald-500 dark:text-emerald-400 shrink-0" />
          ) : currentList.id === 'list-next7' ? (
            <CalendarDays className="w-6 h-6 text-purple-500 dark:text-purple-400 shrink-0" />
          ) : (
            <Inbox className="w-6 h-6 text-blue-500 dark:text-blue-400 shrink-0" />
          )}

          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate flex items-center gap-2">
              {currentList.name}
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-transparent px-2.5 py-0.5 rounded-full">
                {uncompletedTasks.length} pending
              </span>
            </h1>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-2">
          
          {/* Sync / Refresh Button */}
          <button
            onClick={refreshTasks}
            className="p-1.5 bg-white dark:bg-[#23242a] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700/60 transition-all flex items-center justify-center cursor-pointer shadow-xs"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-500' : ''}`} />
          </button>

          {/* Smart Search with @ Member & # Hashtag Autocomplete */}
          <SearchAutocomplete
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            allUsers={allUsers}
            tags={dropdownTags}
          />

          {/* Date Range Filter (Start Date → End Date) */}
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={({ start, end }) => {
              setStartDate(start);
              setEndDate(end);
            }}
            dateField={dateField}
            onDateFieldChange={setDateField}
            activeMatchesCount={startDate || endDate ? filteredByDate.length : null}
          />

          {/* Quick Create Buttons */}
          <button
            onClick={onOpenCreateList}
            className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-all shadow-xs cursor-pointer"
            title="Create Custom List"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">List</span>
          </button>

          <button
            onClick={onOpenCreateTeam}
            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl flex items-center gap-1 shadow-xs transition-all cursor-pointer"
            title="Create Workspace Team"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Team</span>
          </button>

        </div>
      </div>

      {/* Task List Main Content Area (relative z-10 below header) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10">

        {/* Active Date Range Filter Banner */}
        {(startDate || endDate) && (
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-blue-50/80 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-2xl text-xs text-blue-900 dark:text-blue-200 shadow-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2 min-w-0">
              <CalendarRange className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="truncate">
                Filtered by <strong>{dateField === 'due_date' ? 'Due Date' : 'Created Date'}</strong>: {startDate || 'Start'} → {endDate || 'End'} ({filteredByDate.length} matching task{filteredByDate.length === 1 ? '' : 's'})
              </span>
            </div>
            <button
              type="button"
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="text-xs font-semibold hover:underline flex items-center gap-1 cursor-pointer shrink-0 ml-2 text-blue-700 dark:text-blue-300"
            >
              <X className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
        )}
        
        {/* Quick Add Bar */}
        <QuickAddTask />

        {/* Overdue Section */}
        {overdueTasks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Overdue ({overdueTasks.length})</span>
            </div>
            {overdueTasks.map(task => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        )}

        {/* Today Section */}
        {todayTasks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5" />
              <span>Today ({todayTasks.length})</span>
            </div>
            {todayTasks.map(task => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        )}

        {/* Tomorrow Section */}
        {tomorrowTasks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Tomorrow ({tomorrowTasks.length})</span>
            </div>
            {tomorrowTasks.map(task => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        )}

        {/* Later / No Date Section */}
        {laterTasks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <Inbox className="w-3.5 h-3.5" />
              <span>General Tasks ({laterTasks.length})</span>
            </div>
            {laterTasks.map(task => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {uncompletedTasks.length === 0 && (
          <div className="py-12 text-center text-slate-500 dark:text-slate-400 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto opacity-50" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">All tasks completed! Great job.</p>
            <p className="text-xs">Add a task above to keep your workflow organized.</p>
          </div>
        )}

        {/* Completed Tasks Accordion */}
        {completedTasks.length > 0 && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 mb-2 transition-colors cursor-pointer"
            >
              {showCompleted ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span>Completed Tasks ({completedTasks.length})</span>
            </button>

            {showCompleted && completedTasks.map(task => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
};
