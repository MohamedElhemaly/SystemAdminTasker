import React, { useState, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useTasks } from '../../context/TaskContext';
import { 
  Inbox, GripVertical, Search, AlertCircle, Clock, 
  Calendar, CheckSquare, Plus, ArrowRight, Layers, Sparkles
} from 'lucide-react';

export const TaskPoolNode = ({ data, selected }) => {
  const { setSelectedTaskId, dropdownPriorities } = useTasks();
  const [searchFilter, setSearchFilter] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const tasks = data.tasks || [];
  
  // Filter tasks within pool by quick search
  const filteredTasks = useMemo(() => {
    if (!searchFilter.trim()) return tasks;
    const q = searchFilter.toLowerCase().trim();
    return tasks.filter(t => 
      (t.title || '').toLowerCase().includes(q) || 
      (t.description || '').toLowerCase().includes(q)
    );
  }, [tasks, searchFilter]);

  const handleDragStart = (e, task) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      taskId: task.id,
      taskTitle: task.title,
      sourceUserId: 'pool'
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    // Prevent flickering when hovering child elements
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
        data.onTaskDrop(payload.taskId, 'pool', payload.sourceUserId);
      }
    } catch (err) {
      console.error('TaskPoolNode drop error:', err);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`p-4 rounded-2xl bg-white dark:bg-[#1c1d22] border-2 shadow-2xl min-w-[310px] max-w-[350px] select-none transition-all duration-200 ${
        isDragOver
          ? 'border-amber-500 ring-4 ring-amber-500/30 scale-[1.02] bg-amber-50/50 dark:bg-amber-950/20'
          : selected
          ? 'border-amber-500 ring-2 ring-amber-500/20'
          : 'border-amber-400/80 dark:border-amber-500/40 hover:border-amber-500'
      }`}
    >
      {/* Handles for connections */}
      <Handle type="source" position={Position.Right} id="pool-right" className="!bg-amber-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} id="pool-bottom" className="!bg-amber-500 !w-3 !h-3" />
      <Handle type="target" position={Position.Top} id="pool-top" className="!bg-amber-500 !w-3 !h-3" />

      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-amber-100 dark:border-amber-900/30">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-md shrink-0">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                Task Pool
              </h3>
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                Backlog
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Drag & drop onto a member to assign
            </p>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs shrink-0">
          {tasks.length}
        </span>
      </div>

      {/* Drop Zone Banner when item is dragged over */}
      {isDragOver && (
        <div className="mt-2.5 p-2 rounded-xl bg-amber-500/15 border border-dashed border-amber-500 text-center animate-pulse">
          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center justify-center gap-1">
            <Inbox className="w-3.5 h-3.5" /> Drop to return task to pool
          </span>
        </div>
      )}

      {/* Internal Search (Visible when tasks > 3) */}
      {tasks.length > 3 && (
        <div className="nodrag mt-2.5 relative">
          <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter pool tasks..."
            className="w-full text-[11px] pl-7 pr-3 py-1 rounded-lg bg-slate-50 dark:bg-[#25262c] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
      )}

      {/* Draggable Task List */}
      <div className="mt-2.5 space-y-1.5">
        {filteredTasks.length > 0 ? (
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar nodrag">
            {filteredTasks.map((task) => {
              const priority = dropdownPriorities?.find(p => p.id === task.priority_id);
              const isUnassigned = !task.assigned_to && (!task.assigned_users || task.assigned_users.length === 0);

              return (
                <div
                  key={task.id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, task)}
                  className="group flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-[#25262c] hover:bg-amber-50/70 dark:hover:bg-[#2e2b26] border border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-500/50 shadow-2xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing text-xs"
                  title="Drag and drop onto any member node to assign & start"
                >
                  {/* Grip Handle Icon */}
                  <div className="text-slate-400 group-hover:text-amber-500 transition-colors shrink-0">
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>

                  {/* Priority Indicator Dot */}
                  <span 
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: priority?.color_hex || '#94a3b8' }}
                    title={`Priority: ${priority?.name || 'Normal'}`}
                  />

                  {/* Clickable Title (Opens Details) */}
                  <div
                    onClick={() => setSelectedTaskId(task.id)}
                    className="flex-1 min-w-0 cursor-pointer"
                    title={`"${task.title}" • Click to inspect full details`}
                  >
                    <span className="block truncate text-slate-800 dark:text-slate-200 font-medium group-hover:text-amber-700 dark:group-hover:text-amber-300">
                      {task.title}
                    </span>
                  </div>

                  {/* Unassigned / Pending Pill */}
                  <span className={`text-[8.5px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider shrink-0 ${
                    isUnassigned
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                  }`}>
                    {isUnassigned ? 'Unassigned' : 'Pending'}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 text-center border border-dashed border-amber-200 dark:border-amber-800/60 rounded-xl bg-amber-50/30 dark:bg-amber-950/10">
            <Sparkles className="w-4 h-4 text-amber-500 mx-auto mb-1 opacity-70" />
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {tasks.length === 0 ? 'No pending tasks in pool' : 'No matching tasks'}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              All tasks are currently assigned and in progress!
            </p>
          </div>
        )}
      </div>

      {/* Footer Instructions Hint */}
      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1 font-medium">
          <GripVertical className="w-3 h-3 text-amber-500" /> Drag item to delegate
        </span>
        <ArrowRight className="w-3 h-3 text-amber-500" />
      </div>
    </div>
  );
};
