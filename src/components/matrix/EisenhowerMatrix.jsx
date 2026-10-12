import React, { useState, useMemo } from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, MoreHorizontal, ChevronDown, ChevronRight, 
  Check, Calendar, Search, Tag, X, Sparkles, Filter, Lock
} from 'lucide-react';
import { 
  parseISO, isToday, isTomorrow, isPast, isWithinInterval, addDays, startOfDay, endOfDay, format 
} from 'date-fns';
import { getAvatarUrl } from '../../lib/avatars';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────
// Quadrant Configuration Definitions
// ─────────────────────────────────────────────────────────────
const QUADRANTS = [
  {
    key: 'q1',
    id: 'urgent_important',
    is_urgent: true,
    is_important: true,
    title: 'Urgent & Important',
    badgeText: '!',
    badgeBg: 'bg-rose-500',
    titleColor: 'text-rose-500 dark:text-rose-400',
    borderColor: 'border-rose-200/70 dark:border-rose-900/40',
    checkboxBorder: 'border-rose-500 dark:border-rose-400',
    checkboxBg: 'hover:bg-rose-50 dark:hover:bg-rose-500/10',
    activeDropBorder: 'ring-2 ring-rose-500/70 bg-rose-500/5',
    emptyMessage: 'No urgent & important tasks.',
  },
  {
    key: 'q2',
    id: 'not_urgent_important',
    is_urgent: false,
    is_important: true,
    title: 'Not Urgent & Important',
    badgeText: 'II',
    badgeBg: 'bg-amber-500',
    titleColor: 'text-amber-500 dark:text-amber-400',
    borderColor: 'border-amber-200/70 dark:border-amber-900/40',
    checkboxBorder: 'border-amber-500 dark:border-amber-400',
    checkboxBg: 'hover:bg-amber-50 dark:hover:bg-amber-500/10',
    activeDropBorder: 'ring-2 ring-amber-500/70 bg-amber-500/5',
    emptyMessage: 'Schedule important strategic tasks here.',
  },
  {
    key: 'q3',
    id: 'urgent_not_important',
    is_urgent: true,
    is_important: false,
    title: 'Urgent & Unimportant',
    badgeText: 'III',
    badgeBg: 'bg-blue-500',
    titleColor: 'text-blue-500 dark:text-blue-400',
    borderColor: 'border-blue-200/70 dark:border-blue-900/40',
    checkboxBorder: 'border-blue-500 dark:border-blue-400',
    checkboxBg: 'hover:bg-blue-50 dark:hover:bg-blue-500/10',
    activeDropBorder: 'ring-2 ring-blue-500/70 bg-blue-500/5',
    emptyMessage: 'Delegate or streamline urgent secondary tasks.',
  },
  {
    key: 'q4',
    id: 'not_urgent_not_important',
    is_urgent: false,
    is_important: false,
    title: 'Not Urgent & Unimportant',
    badgeText: 'IV',
    badgeBg: 'bg-emerald-500',
    titleColor: 'text-emerald-500 dark:text-emerald-400',
    borderColor: 'border-emerald-200/70 dark:border-emerald-900/40',
    checkboxBorder: 'border-emerald-500 dark:border-emerald-400',
    checkboxBg: 'hover:bg-emerald-50 dark:hover:bg-emerald-500/10',
    activeDropBorder: 'ring-2 ring-emerald-500/70 bg-emerald-500/5',
    emptyMessage: 'Low priority or backlog items.',
  },
];

// Helper to calculate due date group
const getDueDateGroup = (dueDateStr, isCompleted) => {
  if (isCompleted) return 'Completed';
  if (!dueDateStr) return 'No Date';

  try {
    const d = parseISO(dueDateStr);
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = startOfDay(addDays(now, 1));
    const nextWeekEnd = endOfDay(addDays(now, 7));

    if (isPast(d) && !isToday(d)) return 'Overdue';
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    if (isWithinInterval(d, { start: today, end: nextWeekEnd })) return 'Next 7 Days';
    return 'Later';
  } catch {
    return 'No Date';
  }
};

const formatTaskDueDate = (dueDateStr) => {
  if (!dueDateStr) return null;
  try {
    const d = parseISO(dueDateStr);
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    return format(d, 'MMM d');
  } catch {
    return null;
  }
};

export const EisenhowerMatrix = () => {
  const { 
    allTasks, 
    addTask, 
    updateTask, 
    toggleTaskCompletion, 
    selectedTaskId, 
    setSelectedTaskId,
    lists,
    allUsers 
  } = useTasks();

  const [searchQuery, setSearchQuery] = useState('');
  const [dragOverQuadrant, setDragOverQuadrant] = useState(null);
  const [activeQuickAddQ, setActiveQuickAddQ] = useState(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  
  // Track collapsed status of date sub-groups across quadrants
  // e.g. { 'q1-Overdue': false, 'q1-Completed': true }
  const [collapsedGroups, setCollapsedGroups] = useState({
    'q1-Completed': true,
    'q2-Completed': true,
    'q3-Completed': true,
    'q4-Completed': true,
  });

  const toggleGroupCollapse = (groupKey) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  // Filter tasks by search query if any
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return allTasks || [];
    const q = searchQuery.toLowerCase();
    return (allTasks || []).filter(t => 
      t.title?.toLowerCase().includes(q) || 
      t.tags?.some(tag => tag.name?.toLowerCase().includes(q))
    );
  }, [allTasks, searchQuery]);

  // Distribute tasks into 4 quadrants
  const quadrantData = useMemo(() => {
    const data = {
      q1: [],
      q2: [],
      q3: [],
      q4: [],
    };

    filteredTasks.forEach(task => {
      const isUrgent = Boolean(task.is_urgent);
      const isImportant = Boolean(task.is_important);

      if (isUrgent && isImportant) {
        data.q1.push(task);
      } else if (!isUrgent && isImportant) {
        data.q2.push(task);
      } else if (isUrgent && !isImportant) {
        data.q3.push(task);
      } else {
        data.q4.push(task);
      }
    });

    return data;
  }, [filteredTasks]);

  // Group tasks inside each quadrant by due date status
  const getGroupedTasksForQuadrant = (tasksList) => {
    const order = ['Overdue', 'Today', 'Tomorrow', 'Next 7 Days', 'Later', 'No Date', 'Completed'];
    const groups = {};

    tasksList.forEach(task => {
      const groupName = getDueDateGroup(task.due_date, task.is_completed);
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(task);
    });

    return order
      .filter(name => groups[name] && groups[name].length > 0)
      .map(name => ({
        name,
        tasks: groups[name]
      }));
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, quadrantKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverQuadrant !== quadrantKey) {
      setDragOverQuadrant(quadrantKey);
    }
  };

  const handleDragLeave = (e, quadrantKey) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    if (dragOverQuadrant === quadrantKey) {
      setDragOverQuadrant(null);
    }
  };

  const handleDrop = async (e, targetQuadrant) => {
    e.preventDefault();
    setDragOverQuadrant(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    const targetConfig = QUADRANTS.find(q => q.key === targetQuadrant);
    if (!targetConfig) return;

    // Check if task already has these values
    if (Boolean(task.is_urgent) === targetConfig.is_urgent && Boolean(task.is_important) === targetConfig.is_important) {
      return;
    }

    try {
      await updateTask(taskId, {
        is_urgent: targetConfig.is_urgent,
        is_important: targetConfig.is_important
      });

      toast.success(`Moved to ${targetConfig.title}`, {
        id: `matrix-move-${taskId}`,
        duration: 2500
      });
    } catch (err) {
      toast.error('Failed to move task: ' + err.message);
    }
  };

  // Inline Quick Add Handler
  const handleQuickAddSubmit = async (e, quadrantConfig) => {
    e.preventDefault();
    if (!quickAddTitle.trim()) {
      setActiveQuickAddQ(null);
      return;
    }

    try {
      await addTask({
        title: quickAddTitle.trim(),
        is_urgent: quadrantConfig.is_urgent,
        is_important: quadrantConfig.is_important,
        due_date: new Date().toISOString()
      });

      setQuickAddTitle('');
      setActiveQuickAddQ(null);
    } catch (err) {
      toast.error('Failed to create task: ' + err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100 dark:bg-[#141418] text-slate-900 dark:text-slate-100 transition-colors">
      
      {/* ── Top Header Bar ── */}
      <div className="p-4 px-6 border-b border-slate-200 dark:border-white/5 flex items-center justify-between gap-4 bg-white dark:bg-[#1a1b20] shrink-0 transition-colors">
        <div className="flex items-center gap-3">
          <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>Eisenhower Matrix</span>
          </h1>
          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-slate-300">
            {filteredTasks.length} Tasks
          </span>
        </div>

        {/* Header Right: Real-time search filter */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search matrix tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-blue-500 w-44 md:w-60 text-slate-800 dark:text-white placeholder-slate-400 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button 
            type="button"
            className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Matrix View Options"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── 2x2 Quadrant Grid Container ── */}
      <div className="flex-1 overflow-y-auto p-3 md:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full min-h-[720px]">
          {QUADRANTS.map((quadrant) => {
            const tasksInQuadrant = quadrantData[quadrant.key] || [];
            const groupedList = getGroupedTasksForQuadrant(tasksInQuadrant);
            const isDragOver = dragOverQuadrant === quadrant.key;
            const isQuickAddActive = activeQuickAddQ === quadrant.key;

            return (
              <div
                key={quadrant.key}
                onDragOver={(e) => handleDragOver(e, quadrant.key)}
                onDragLeave={(e) => handleDragLeave(e, quadrant.key)}
                onDrop={(e) => handleDrop(e, quadrant.key)}
                className={`flex flex-col rounded-2xl bg-white dark:bg-[#1a1b20] border transition-all duration-200 overflow-hidden shadow-xs select-none ${
                  isDragOver 
                    ? quadrant.activeDropBorder 
                    : `${quadrant.borderColor} hover:border-slate-300 dark:hover:border-slate-700/80`
                }`}
              >
                {/* ── Quadrant Header ── */}
                <div className="p-3.5 px-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-white/[0.02]">
                  
                  {/* Left: Indicator Icon + Title + Total Count */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-5 h-5 rounded-full ${quadrant.badgeBg} text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-xs font-mono`}>
                      {quadrant.badgeText}
                    </div>
                    <h2 className={`text-sm font-bold truncate ${quadrant.titleColor}`}>
                      {quadrant.title}
                    </h2>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                      {tasksInQuadrant.length}
                    </span>
                  </div>

                  {/* Right Header Buttons: Quick Add & More */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveQuickAddQ(isQuickAddActive ? null : quadrant.key)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      title={`Add task directly to ${quadrant.title}`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Inline Quick Add Form */}
                {isQuickAddActive && (
                  <form 
                    onSubmit={(e) => handleQuickAddSubmit(e, quadrant)}
                    className="p-2.5 px-3 bg-slate-100/70 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 flex items-center gap-2"
                  >
                    <input
                      type="text"
                      autoFocus
                      placeholder={`Add task to ${quadrant.title}... (Enter to save)`}
                      value={quickAddTitle}
                      onChange={(e) => setQuickAddTitle(e.target.value)}
                      className="flex-1 bg-white dark:bg-[#23242a] border border-slate-300 dark:border-white/15 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer shrink-0"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveQuickAddQ(null)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}

                {/* ── Tasks Scroll Area ── */}
                <div className="flex-1 overflow-y-auto p-2 px-3 divide-y divide-transparent space-y-3">
                  {tasksInQuadrant.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center">
                      <p className="text-xs font-medium">{quadrant.emptyMessage}</p>
                      <button
                        type="button"
                        onClick={() => setActiveQuickAddQ(quadrant.key)}
                        className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        + Add task
                      </button>
                    </div>
                  ) : (
                    groupedList.map(group => {
                      const groupKey = `${quadrant.key}-${group.name}`;
                      const isCollapsed = Boolean(collapsedGroups[groupKey]);

                      return (
                        <div key={group.name} className="space-y-1">
                          
                          {/* Collapsible Date Subgroup Header */}
                          <button
                            type="button"
                            onClick={() => toggleGroupCollapse(groupKey)}
                            className="w-full flex items-center gap-1.5 py-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer select-none text-left"
                          >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`} />
                            <span className={group.name === 'Overdue' ? 'text-rose-500 dark:text-rose-400' : ''}>
                              {group.name}
                            </span>
                            <span className="text-[10px] font-mono opacity-80 font-normal">
                              {group.tasks.length}
                            </span>
                          </button>

                          {/* Task Cards List */}
                          {!isCollapsed && (
                            <div className="space-y-1 pl-1">
                              {group.tasks.map(task => {
                                const isSelected = selectedTaskId === task.id;
                                const isOverdue = group.name === 'Overdue';
                                const formattedDate = formatTaskDueDate(task.due_date);
                                const listObj = lists?.find(l => l.id === task.list_id);

                                // Multi-Assignee lookups
                                const assignedUserIds = Array.isArray(task.assigned_users) && task.assigned_users.length > 0
                                  ? task.assigned_users
                                  : (task.assigned_to ? [task.assigned_to] : []);
                                const assignees = assignedUserIds.map(uid => allUsers?.find(u => u.id === uid)).filter(Boolean);
                                const firstAssignee = assignees[0];

                                return (
                                  <div
                                    key={task.id}
                                    draggable="true"
                                    onDragStart={(e) => handleDragStart(e, task.id)}
                                    onClick={() => setSelectedTaskId(task.id)}
                                    className={`group flex items-center gap-2.5 p-2 rounded-xl transition-all cursor-pointer ${
                                      isSelected 
                                        ? 'bg-blue-500/10 dark:bg-blue-500/15 ring-1 ring-blue-500/40 text-blue-900 dark:text-blue-100'
                                        : 'hover:bg-slate-100/80 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200'
                                    } ${task.is_completed ? 'opacity-55' : ''}`}
                                  >
                                    {/* Quadrant-Coloured Checkbox Button */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleTaskCompletion(task.id);
                                      }}
                                      className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                                        task.is_completed
                                          ? 'bg-blue-600 border-blue-600 text-white'
                                          : `${quadrant.checkboxBorder} ${quadrant.checkboxBg} bg-transparent`
                                      }`}
                                      title={task.is_completed ? 'Mark incomplete' : 'Mark complete'}
                                    >
                                      {task.is_completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                    </button>

                                    {/* Task Title (Arabic / English / RTL Friendly) */}
                                    <span 
                                      dir="auto"
                                      className={`flex-1 min-w-0 text-xs font-medium truncate ${
                                        task.is_completed ? 'line-through text-slate-400 dark:text-slate-500' : ''
                                      }`}
                                    >
                                      {task.title}
                                    </span>

                                    {/* Right Metadata Badges */}
                                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                      
                                      {/* Tags */}
                                      {task.tags && task.tags.slice(0, 2).map(tg => (
                                        <span 
                                          key={tg.id}
                                          className="text-[9px] px-1.5 py-0.2 rounded-full font-semibold border max-w-[70px] truncate hidden sm:inline-block"
                                          style={{
                                            backgroundColor: `${tg.color_hex || tg.color || '#3b82f6'}15`,
                                            color: tg.color_hex || tg.color || '#3b82f6',
                                            borderColor: `${tg.color_hex || tg.color || '#3b82f6'}30`
                                          }}
                                        >
                                          {tg.name}
                                        </span>
                                      ))}

                                      {task.tags && task.tags.length > 2 && (
                                        <span className="text-[8px] font-bold text-slate-400 hidden sm:inline-block">
                                          +{task.tags.length - 2}
                                        </span>
                                      )}

                                      {/* List Name Badge */}
                                      {listObj && (
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate max-w-[50px] hidden md:inline-block">
                                          {listObj.name}
                                        </span>
                                      )}

                                      {/* Due Date Badge */}
                                      {formattedDate && (
                                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-medium ${
                                          isOverdue
                                            ? 'text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10'
                                            : 'text-slate-500 dark:text-slate-400'
                                        }`}>
                                          {formattedDate}
                                        </span>
                                      )}

                                      {/* Assignee Avatar */}
                                      {firstAssignee ? (
                                        <img
                                          src={getAvatarUrl(firstAssignee.avatar_id, firstAssignee.full_name || firstAssignee.email)}
                                          alt={firstAssignee.full_name}
                                          className="w-4.5 h-4.5 rounded-full object-cover ring-1 ring-slate-300 dark:ring-white/10 shrink-0"
                                          title={`Assigned to: ${firstAssignee.full_name || firstAssignee.email}`}
                                        />
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
