import React, { useState, useMemo } from 'react';
import { useTasks } from '../../context/TaskContext';
import { QuickAddTask } from './QuickAddTask';
import { TaskItem } from './TaskItem';
import { parseSearchQuery } from '../../lib/searchParser';
import { DateRangeFilter } from './DateRangeFilter';
import { SearchAutocomplete } from './SearchAutocomplete';
import { ViewOptionsMenu } from './ViewOptionsMenu';
import { 
  Inbox, Calendar, CalendarDays, Folder, Users, Search, 
  Plus, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, RefreshCw, CalendarRange, X,
  Layers, Flag, UserCheck
} from 'lucide-react';
import { isToday, isTomorrow, isPast, isWithinInterval, addDays, startOfDay, endOfDay, parseISO } from 'date-fns';

export const TaskListPanel = ({ onOpenCreateList, onOpenCreateTeam }) => {
  const { 
    tasks, 
    lists, 
    selectedListId, 
    refreshTasks, 
    loading, 
    allUsers, 
    dropdownTags,
    dropdownPriorities,
    groupBy,
    sortBy,
    order
  } = useTasks();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateField, setDateField] = useState('due_date'); // 'due_date' | 'created_at'

  const currentList = lists.find(l => l.id === selectedListId) || 
    (selectedListId === 'list-inbox' ? lists.find(l => l.id === 'list-all') : null) || 
    lists[0] || 
    { id: 'list-all', name: 'All' };

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

  // Sort tasks by sortBy ('date' | 'priority' | 'title' | 'created_at') and order ('asc' | 'desc')
  const sortedUncompletedTasks = useMemo(() => {
    const list = [...uncompletedTasks];

    // Priority level resolver
    const getPriorityLevel = (pIdOrName) => {
      if (!pIdOrName) return -1;
      const found = dropdownPriorities.find(p => p.id === pIdOrName || p.name?.toLowerCase() === String(pIdOrName).toLowerCase());
      return found ? (found.level_order ?? 0) : -1;
    };

    return list.sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'title') {
        const titleA = (a.title || '').toLowerCase();
        const titleB = (b.title || '').toLowerCase();
        comparison = titleA.localeCompare(titleB);
      } else if (sortBy === 'priority') {
        const prioA = getPriorityLevel(a.priority || a.priority_id);
        const prioB = getPriorityLevel(b.priority || b.priority_id);
        comparison = prioB - prioA;
      } else if (sortBy === 'created_at') {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        comparison = dateA - dateB;
      } else {
        // Default: 'date' (due_date)
        if (!a.due_date && !b.due_date) comparison = 0;
        else if (!a.due_date) comparison = 1;
        else if (!b.due_date) comparison = -1;
        else {
          comparison = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
      }

      return order === 'desc' ? -comparison : comparison;
    });
  }, [uncompletedTasks, sortBy, order, dropdownPriorities]);

  // Group sorted uncompleted tasks according to groupBy ('date' | 'priority' | 'list' | 'none')
  const taskGroups = useMemo(() => {
    // 1. Dedicated Today Smart View: Consolidate Overdue inside Today view (split into OVERDUE & TODAY)
    if (selectedListId === 'list-today') {
      const overdue = [];
      const today = [];

      sortedUncompletedTasks.forEach(t => {
        if (!t.due_date) return;
        try {
          const d = parseISO(t.due_date);
          if (isToday(d)) {
            today.push(t);
          } else if (isPast(d)) {
            overdue.push(t);
          }
        } catch {
          // ignore invalid date
        }
      });

      const groups = [];
      if (overdue.length > 0) {
        groups.push({
          id: 'date-overdue',
          title: 'OVERDUE',
          icon: AlertCircle,
          colorClass: 'text-red-600 dark:text-red-500 font-extrabold',
          tasks: overdue
        });
      }
      if (today.length > 0) {
        groups.push({
          id: 'date-today',
          title: 'TODAY',
          icon: Calendar,
          colorClass: 'text-emerald-600 dark:text-emerald-400 font-extrabold',
          tasks: today
        });
      }
      return groups;
    }

    if (groupBy === 'none') {
      return [
        {
          id: 'all',
          title: 'All Tasks',
          icon: Layers,
          colorClass: 'text-slate-500 dark:text-slate-400',
          tasks: sortedUncompletedTasks
        }
      ];
    }

    if (groupBy === 'priority') {
      const groups = [];
      const priorityBuckets = {};

      dropdownPriorities.forEach(p => {
        priorityBuckets[p.id] = {
          id: `prio-${p.id}`,
          title: p.name,
          icon: Flag,
          colorHex: p.color_hex,
          tasks: []
        };
      });

      const noPriorityTasks = [];

      sortedUncompletedTasks.forEach(task => {
        const pMatch = dropdownPriorities.find(p => p.id === task.priority || p.id === task.priority_id || p.name?.toLowerCase() === String(task.priority || '').toLowerCase());
        if (pMatch && priorityBuckets[pMatch.id]) {
          priorityBuckets[pMatch.id].tasks.push(task);
        } else {
          noPriorityTasks.push(task);
        }
      });

      dropdownPriorities.forEach(p => {
        if (priorityBuckets[p.id].tasks.length > 0) {
          groups.push(priorityBuckets[p.id]);
        }
      });

      if (noPriorityTasks.length > 0) {
        groups.push({
          id: 'prio-none',
          title: 'No Priority',
          icon: Flag,
          colorClass: 'text-slate-400',
          tasks: noPriorityTasks
        });
      }

      return groups;
    }

    if (groupBy === 'list') {
      const groups = [];
      const listBuckets = {};

      lists.forEach(l => {
        listBuckets[l.id] = {
          id: `list-${l.id}`,
          title: l.name,
          icon: Folder,
          colorHex: l.color,
          tasks: []
        };
      });

      const unlisted = [];
      sortedUncompletedTasks.forEach(task => {
        if (task.list_id && listBuckets[task.list_id]) {
          listBuckets[task.list_id].tasks.push(task);
        } else {
          unlisted.push(task);
        }
      });

      lists.forEach(l => {
        if (listBuckets[l.id].tasks.length > 0) {
          groups.push(listBuckets[l.id]);
        }
      });

      if (unlisted.length > 0) {
        groups.push({
          id: 'list-unassigned',
          title: 'Inbox / Other',
          icon: Inbox,
          colorClass: 'text-slate-400',
          tasks: unlisted
        });
      }

      return groups;
    }

    // Default: groupBy === 'date'
    const overdue = [];
    const today = [];
    const tomorrow = [];
    const upcoming = [];
    const noDate = [];

    sortedUncompletedTasks.forEach(t => {
      if (!t.due_date) {
        noDate.push(t);
        return;
      }
      try {
        const d = parseISO(t.due_date);
        if (isToday(d)) today.push(t);
        else if (isPast(d)) overdue.push(t);
        else if (isTomorrow(d)) tomorrow.push(t);
        else upcoming.push(t);
      } catch {
        noDate.push(t);
      }
    });

    const dateGroups = [];
    if (overdue.length > 0) {
      dateGroups.push({
        id: 'date-overdue',
        title: 'OVERDUE',
        icon: AlertCircle,
        colorClass: 'text-red-600 dark:text-red-500 font-extrabold',
        tasks: overdue
      });
    }
    if (today.length > 0) {
      dateGroups.push({
        id: 'date-today',
        title: 'TODAY',
        icon: Calendar,
        colorClass: 'text-emerald-600 dark:text-emerald-400 font-extrabold',
        tasks: today
      });
    }
    if (tomorrow.length > 0) {
      dateGroups.push({
        id: 'date-tomorrow',
        title: 'Tomorrow',
        icon: CalendarDays,
        colorClass: 'text-amber-700 dark:text-amber-400',
        tasks: tomorrow
      });
    }
    if (upcoming.length > 0) {
      dateGroups.push({
        id: 'date-upcoming',
        title: 'Upcoming',
        icon: Inbox,
        colorClass: 'text-blue-600 dark:text-blue-400',
        tasks: upcoming
      });
    }
    if (noDate.length > 0) {
      dateGroups.push({
        id: 'date-nodate',
        title: 'No Due Date',
        icon: Calendar,
        colorClass: 'text-slate-500 dark:text-slate-400',
        tasks: noDate
      });
    }

    return dateGroups;
  }, [groupBy, sortedUncompletedTasks, dropdownPriorities, lists, selectedListId]);

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
          ) : currentList.id === 'list-assigned-me' ? (
            <UserCheck className="w-6 h-6 text-amber-500 dark:text-amber-400 shrink-0" />
          ) : currentList.id === 'list-all' || currentList.id === 'list-inbox' ? (
            <Layers className="w-6 h-6 text-blue-500 dark:text-blue-400 shrink-0" />
          ) : (
            <Folder className="w-6 h-6 text-blue-500 dark:text-blue-400 shrink-0" />
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

          {/* View Options (Group by, Sort by, Order) */}
          <ViewOptionsMenu />

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

        {/* Dynamic Task Groups */}
        {taskGroups.map(group => group.tasks.length > 0 && (
          <div key={group.id} className="space-y-1.5">
            <div className={`flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider ${group.colorClass || ''}`}>
              {group.icon && <group.icon className="w-3.5 h-3.5" style={group.colorHex ? { color: group.colorHex } : undefined} />}
              <span style={group.colorHex ? { color: group.colorHex } : undefined}>
                {group.title} ({group.tasks.length})
              </span>
            </div>
            {group.tasks.map(task => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        ))}

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
