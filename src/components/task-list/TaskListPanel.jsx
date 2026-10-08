import React, { useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import { QuickAddTask } from './QuickAddTask';
import { TaskItem } from './TaskItem';
import { parseSearchQuery } from '../../lib/searchParser';
import { 
  Inbox, Calendar, CalendarDays, Folder, Users, Search, 
  Plus, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, RefreshCw
} from 'lucide-react';
import { isToday, isTomorrow, isPast, isWithinInterval, addDays, startOfDay, endOfDay, parseISO } from 'date-fns';

export const TaskListPanel = ({ onOpenCreateList, onOpenCreateTeam }) => {
  const { tasks, lists, selectedListId, refreshTasks, loading, allUsers } = useTasks();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);

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
      const hasAllTags = parsedSearch.tags.every(searchTag => 
        t.tags?.some(taskTag => taskTag.name.toLowerCase().includes(searchTag.toLowerCase()))
      );
      if (!hasAllTags) return false;
    }

    // 3. Users (Creator, Assignee, Acknowledgers)
    if (parsedSearch.users.length > 0) {
      const creator = allUsers?.find(u => u.id === t.created_by);
      const assignee = allUsers?.find(u => u.id === t.assigned_to);
      const acks = t.task_acknowledgements || [];
      
      const hasAllUsers = parsedSearch.users.every(searchUser => {
        const uLower = searchUser.toLowerCase();
        return (
          creator?.full_name?.toLowerCase().includes(uLower) ||
          creator?.email?.toLowerCase().includes(uLower) ||
          assignee?.full_name?.toLowerCase().includes(uLower) ||
          assignee?.email?.toLowerCase().includes(uLower) ||
          acks.some(ack => ack.full_name?.toLowerCase().includes(uLower))
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

  const uncompletedTasks = filteredBySearch.filter(t => !t.is_completed);
  const completedTasks = filteredBySearch.filter(t => t.is_completed);

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
    <div className="flex-1 h-screen bg-[#18181c] text-slate-100 flex flex-col min-w-0 border-r border-slate-800">
      
      {/* Panel Top Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {currentList.team_id ? (
            <Users className="w-6 h-6 text-pink-400 shrink-0" />
          ) : currentList.id === 'list-today' ? (
            <Calendar className="w-6 h-6 text-emerald-400 shrink-0" />
          ) : currentList.id === 'list-next7' ? (
            <CalendarDays className="w-6 h-6 text-purple-400 shrink-0" />
          ) : (
            <Inbox className="w-6 h-6 text-blue-400 shrink-0" />
          )}

          <div>
            <h1 className="text-lg font-bold text-white truncate flex items-center gap-2">
              {currentList.name}
              <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
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
            className="p-1.5 bg-[#23242a] hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-700/60 transition-all flex items-center justify-center"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-[#23242a] border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-36 sm:w-48 transition-all"
            />
          </div>

          {/* Quick Create Buttons */}
          <button
            onClick={onOpenCreateList}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 flex items-center gap-1 transition-all"
            title="Create Custom List"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">List</span>
          </button>

          <button
            onClick={onOpenCreateTeam}
            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl flex items-center gap-1 shadow-md shadow-indigo-500/20 transition-all"
            title="Create Workspace Team"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Team</span>
          </button>

        </div>
      </div>

      {/* Task List Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Quick Add Bar */}
        <QuickAddTask />

        {/* Overdue Section */}
        {overdueTasks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-red-400 uppercase tracking-wider">
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
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
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
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
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
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
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
          <div className="py-12 text-center text-slate-500 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-slate-600 mx-auto opacity-40" />
            <p className="text-sm font-medium text-slate-400">All tasks completed! Great job.</p>
            <p className="text-xs">Add a task above to keep your workflow organized.</p>
          </div>
        )}

        {/* Completed Tasks Accordion */}
        {completedTasks.length > 0 && (
          <div className="pt-4 border-t border-slate-800/80">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 mb-2 transition-colors"
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
