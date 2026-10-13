import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { getAvatarUrl } from '../../lib/avatars';
import { 
  Users, CheckCircle2, Clock, CheckSquare, Check, Plus, 
  GripVertical, Play, Flame, Sparkles, Activity
} from 'lucide-react';
import toast from 'react-hot-toast';

export const UserNode = ({ data, selected }) => {
  const { toggleTaskCompletion, setSelectedTaskId, addTask, dropdownPriorities, timeLogs = [] } = useTasks();
  const { user } = useAuth();
  
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickPriority, setQuickPriority] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const avatarSrc = getAvatarUrl(data.avatar_id, data.label);
  
  // Standard user nodes ONLY display tasks where the status is strictly in_progress / working
  const inProgressTasks = data.assignedTasks || [];
  const completedCount = data.allAssignedTasks?.filter(t => t.is_completed).length || 0;
  const totalCount = data.allAssignedTasks?.length || inProgressTasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Drag-and-Drop Handlers
  const handleDragStart = (e, task) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      taskId: task.id,
      taskTitle: task.title,
      sourceUserId: data.userId
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const payload = JSON.parse(dataStr);
      if (payload.taskId && data.onTaskDrop) {
        data.onTaskDrop(payload.taskId, data.userId, payload.sourceUserId);
      }
    } catch (err) {
      console.error('UserNode drop error:', err);
    }
  };

  const handleQuickCreate = async (e) => {
    e?.preventDefault();
    if (!quickTitle.trim()) return;

    try {
      await addTask({
        title: quickTitle.trim(),
        assigned_to: data.userId,
        assigned_users: [data.userId],
        status: 'in_progress',
        priority_id: quickPriority || (dropdownPriorities?.[0]?.id || null),
      });
      setQuickTitle('');
      setIsAddingTask(false);
      toast.success(`Task delegated to ${data.label} (In Progress)!`, {
        id: `delegated-${data.userId}`,
        duration: 2500,
      });
    } catch (err) {
      toast.error('Failed to assign task: ' + err.message);
    }
  };

  const isHighlighted = data.isSearchMatch;
  const isDimmed = data.isSearchActive && !data.isSearchMatch;

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`p-4 rounded-2xl bg-white dark:bg-[#1f1f23] border-2 text-slate-900 dark:text-slate-100 shadow-xl min-w-[290px] max-w-[340px] select-none transition-all duration-200 ${
        isDragOver
          ? 'border-blue-500 ring-4 ring-blue-500/30 scale-[1.03] bg-blue-50/50 dark:bg-blue-950/20 shadow-2xl'
          : isHighlighted 
          ? 'border-blue-500 ring-4 ring-blue-500/20 scale-[1.02] shadow-2xl' 
          : selected
          ? 'border-blue-500 ring-2 ring-blue-500/20'
          : 'border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500'
      } ${isDimmed ? 'opacity-35 grayscale-[0.3]' : 'opacity-100'}`}
    >
      {/* Handles */}
      <Handle type="target" position={Position.Top} className="!bg-blue-500 dark:!bg-[#4772fa] !w-3.5 !h-3.5" />
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 dark:!bg-[#4772fa] !w-3.5 !h-3.5" />
      <Handle type="target" id="left" position={Position.Left} className="!bg-blue-500 dark:!bg-[#4772fa] !w-2.5 !h-2.5" />
      <Handle type="source" id="right" position={Position.Right} className="!bg-blue-500 dark:!bg-[#4772fa] !w-2.5 !h-2.5" />

      {/* User Header */}
      <div className="flex items-start gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="relative shrink-0">
          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 p-0.5 shadow-sm">
            <img src={avatarSrc} alt="" className="w-full h-full rounded-full object-cover bg-slate-100 dark:bg-slate-800" />
          </div>
          {inProgressTasks.length > 0 && (
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white border-2 border-white dark:border-[#1f1f23] bg-amber-500 animate-pulse">
              {inProgressTasks.length}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate" title={data.label}>
              {data.label}
            </h4>
            <span className={`px-1.5 py-0.2 rounded-md text-[8.5px] font-bold uppercase tracking-wider shrink-0 border ${
              data.role === 'manager' 
                ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40' 
                : data.role === 'sub_manager' || data.role === 'deputy_manager'
                ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/40'
                : 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40'
            }`}>
              {data.role === 'manager' ? 'Manager' : data.role === 'sub_manager' || data.role === 'deputy_manager' ? 'Sub-Mgr' : 'Member'}
            </span>
          </div>

          <span className="text-[10.5px] text-slate-400 dark:text-slate-400 block truncate mt-0.5">
            {data.email}
          </span>

          {/* Workload Progress Bar */}
          {totalCount > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                <span>{completedCount}/{totalCount} Completed</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    progressPercent === 100 
                      ? 'bg-emerald-500' 
                      : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drop Target Banner (Visible during Drag Over) */}
      {isDragOver && (
        <div className="mt-2 p-2 rounded-xl bg-blue-500/15 border border-dashed border-blue-500 text-center animate-pulse">
          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Drop to delegate & start! ⚡
          </span>
        </div>
      )}

      {/* Header for Currently Working On */}
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-wider text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1">
          <Activity className="w-3 h-3 text-amber-500 animate-pulse" /> Working On ({inProgressTasks.length})
        </span>

        <button
          type="button"
          onClick={() => setIsAddingTask(!isAddingTask)}
          className="nodrag flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-0.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>{isAddingTask ? 'Close' : 'Delegate'}</span>
        </button>
      </div>

      {/* Inline Quick Task Creator Form */}
      {isAddingTask && (
        <form onSubmit={handleQuickCreate} className="nodrag mt-2 p-2 rounded-xl bg-blue-50/70 dark:bg-blue-900/15 border border-blue-200/80 dark:border-blue-500/30 space-y-2 animate-in fade-in duration-150">
          <input
            type="text"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder={`Task title for ${data.label.split(' ')[0]}...`}
            autoFocus
            className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#18181c] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          <div className="flex items-center justify-between gap-1">
            <select
              value={quickPriority}
              onChange={(e) => setQuickPriority(e.target.value)}
              className="text-[10px] px-1.5 py-1 rounded bg-white dark:bg-[#18181c] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="">Priority: Normal</option>
              {dropdownPriorities?.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsAddingTask(false)}
                className="px-2 py-1 text-[10px] rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!quickTitle.trim()}
                className="px-2.5 py-1 text-[10px] font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors cursor-pointer"
              >
                Assign
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Embedded Active In-Progress Tasks (Draggable) */}
      <div className="mt-2 space-y-1.5">
        {inProgressTasks.length > 0 ? (
          <div className="space-y-1 max-h-44 overflow-y-auto pr-1 custom-scrollbar nodrag">
            {inProgressTasks.map((t) => {
              const isUserTiming = timeLogs.some(l => l.task_id === t.id && !l.end_time);

              return (
                <div 
                  key={t.id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, t)}
                  className="group flex items-center gap-2 p-1.5 rounded-xl bg-slate-50/90 dark:bg-[#25262c] hover:bg-blue-50/70 dark:hover:bg-[#282d3c] border border-slate-200/70 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500/50 transition-all text-xs cursor-grab active:cursor-grabbing"
                  title="Drag to transfer to another user or drop into Task Pool"
                >
                  {/* Drag Handle Icon */}
                  <div className="text-slate-400 group-hover:text-blue-500 transition-colors shrink-0">
                    <GripVertical className="w-3 h-3" />
                  </div>

                  {/* Interactive Checkbox */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTaskCompletion(t.id);
                    }}
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                      t.is_completed 
                        ? 'bg-emerald-600 border-emerald-600 text-white' 
                        : 'border-amber-400 dark:border-amber-500/60 bg-white dark:bg-[#1b1c20] hover:border-emerald-500'
                    }`}
                    title={t.is_completed ? 'Mark Active' : 'Mark Done'}
                  >
                    {t.is_completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </button>

                  {/* Clickable Task Title -> Opens Detail Drawer */}
                  <div 
                    onClick={() => setSelectedTaskId(t.id)}
                    className="flex-1 min-w-0 cursor-pointer"
                    title="Click to view full details"
                  >
                    <span className="block truncate text-slate-800 dark:text-slate-200 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {t.title}
                    </span>
                  </div>

                  {/* Live Status Badge */}
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold shrink-0 flex items-center gap-1 ${
                    isUserTiming
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                  }`}>
                    {isUserTiming && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />}
                    {isUserTiming ? 'Working' : 'In Progress'}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div 
            onClick={() => setIsAddingTask(true)}
            className="p-3 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl hover:border-blue-400 dark:hover:border-blue-500/50 cursor-pointer transition-colors group bg-slate-50/50 dark:bg-slate-900/20"
          >
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 group-hover:text-blue-500">
              No active tasks in progress
            </p>
            <p className="text-[10px] text-slate-400/80 dark:text-slate-600 mt-0.5">
              Drop task here to assign • or click Delegate
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
