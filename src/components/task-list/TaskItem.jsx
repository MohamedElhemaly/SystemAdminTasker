import React, { useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { Flag, Calendar, CheckSquare, Users, CheckCircle2, Clock, Check } from 'lucide-react';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';

export const TaskItem = ({ task }) => {
  const { 
    selectedTaskId, 
    setSelectedTaskId, 
    toggleTaskCompletion, 
    updateTask, 
    toggleAcknowledgement,
    dropdownPriorities,
    dropdownStatuses,
    dropdownTaskTypes
  } = useTasks();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);

  const isSelected = selectedTaskId === task.id;
  const currentUserId = user?.id || 'demo-user-123';

  // Dynamic Lookup References
  const priorityInfo = dropdownPriorities.find(p => p.id === task.priority_id) || dropdownPriorities[0];
  const statusInfo = dropdownStatuses.find(st => st.id === task.status_id) || dropdownStatuses[0];
  const taskTypeInfo = dropdownTaskTypes.find(tt => tt.id === task.task_type_id);

  const handleTitleSubmit = (e) => {
    e.preventDefault();
    if (editedTitle.trim() && editedTitle !== task.title) {
      updateTask(task.id, { title: editedTitle.trim() });
    }
    setIsEditing(false);
  };

  const formattedDueDate = task.due_date ? (() => {
    try {
      const date = parseISO(task.due_date);
      if (isToday(date)) return 'Today';
      if (isTomorrow(date)) return 'Tomorrow';
      return format(date, 'MMM d');
    } catch (e) {
      return null;
    }
  })() : null;

  const isOverdue = task.due_date ? (() => {
    try {
      const date = parseISO(task.due_date);
      return isPast(date) && !isToday(date) && !task.is_completed;
    } catch (e) {
      return false;
    }
  })() : false;

  // Pending Acknowledgements Count
  const pendingAcksCount = task.task_acknowledgements?.filter(a => !a.is_acknowledged).length || 0;

  return (
    <div
      onClick={() => setSelectedTaskId(task.id)}
      className={`group flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer select-none mb-1.5 ${
        isSelected
          ? 'bg-[#282932] border-[#4772fa]/60 shadow-lg'
          : 'bg-[#1f2026] border-slate-800/80 hover:bg-[#25262e] hover:border-slate-700/60'
      } ${task.is_completed ? 'opacity-60' : ''}`}
    >
      {/* Checkbox */}
      <div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={task.is_completed}
          onChange={() => toggleTaskCompletion(task.id)}
          className="w-4 h-4 rounded border-slate-700 text-blue-500 focus:ring-0 cursor-pointer"
          title={pendingAcksCount > 0 ? `Cannot complete! ${pendingAcksCount} pending acknowledgements` : 'Toggle Task'}
        />
      </div>

      {/* Task Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          {isEditing ? (
            <form onSubmit={handleTitleSubmit} className="flex-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                autoFocus
                className="w-full bg-[#18181c] border border-blue-500 rounded px-2 py-0.5 text-sm text-white focus:outline-none"
              />
            </form>
          ) : (
            <span
              onDoubleClick={() => setIsEditing(true)}
              className={`text-sm font-medium text-slate-100 truncate ${
                task.is_completed ? 'line-through text-slate-400' : ''
              }`}
            >
              {task.title}
            </span>
          )}

          {/* Dynamic Priority Flag / Dot */}
          {priorityInfo && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0" style={{
              backgroundColor: `${priorityInfo.color_hex || priorityInfo.color || '#ef4444'}20`,
              color: priorityInfo.color_hex || priorityInfo.color || '#ef4444',
              borderColor: `${priorityInfo.color_hex || priorityInfo.color || '#ef4444'}40`,
              borderWidth: '1px'
            }}>
              {priorityInfo.name}
            </span>
          )}
        </div>

        {/* Details & Custom Team Acknowledgements Bar */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          
          {/* Dynamic Status Badge */}
          {statusInfo && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{
              backgroundColor: `${statusInfo.color_hex || '#3b82f6'}20`,
              color: statusInfo.color_hex || '#3b82f6'
            }}>
              <span>{statusInfo.name}</span>
            </span>
          )}

          {/* Dynamic Task Type Badge */}
          {taskTypeInfo && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{
              backgroundColor: `${taskTypeInfo.color_hex || '#ec4899'}20`,
              color: taskTypeInfo.color_hex || '#ec4899'
            }}>
              <span>{taskTypeInfo.name}</span>
            </span>
          )}

          {/* Generic Task Tags (#hashtags) */}
          {task.tags && task.tags.map((tg) => (
            <span
              key={tg.id}
              className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-700/50"
              style={{
                backgroundColor: `${tg.color_hex || tg.color || '#3b82f6'}20`,
                color: tg.color_hex || tg.color || '#3b82f6'
              }}
            >
              #{tg.name}
            </span>
          ))}
          
          {/* Due Date Badge */}
          {formattedDueDate && (
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${
              isOverdue
                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                : 'bg-slate-800/80 text-slate-400 border border-slate-700/50'
            }`}>
              <Calendar className="w-3 h-3" />
              <span>{formattedDueDate}</span>
            </span>
          )}

          {/* Subtasks Counter Badge */}
          {task.subtasks && task.subtasks.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 border border-slate-700/50">
              <CheckSquare className="w-3 h-3" />
              <span>
                {task.subtasks.filter(s => s.is_completed).length}/{task.subtasks.length}
              </span>
            </span>
          )}

          {/* CUSTOM FEATURE: Team Acknowledgement Tags (Chips) */}
          {task.task_type === 'team' && (
            <div className="flex flex-wrap items-center gap-1.5 ml-auto" onClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                <Users className="w-3 h-3 text-pink-400" /> Team Ack:
              </span>

              {task.task_acknowledgements?.map((ack) => {
                const isSelf = ack.user_id === currentUserId;

                return (
                  <button
                    key={ack.id || ack.user_id}
                    type="button"
                    onClick={() => toggleAcknowledgement(task.id, ack.id, ack.user_id)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all ${
                      ack.is_acknowledged
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                    } ${isSelf ? 'ring-1 ring-blue-400/50 shadow-sm' : ''}`}
                    title={isSelf ? 'Click to toggle your acknowledgement status' : `Tag for ${ack.full_name || 'Member'}`}
                  >
                    {ack.is_acknowledged ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Clock className="w-3 h-3 text-amber-400" />
                    )}
                    <span>@{ack.full_name || 'Member'}</span>
                    <span className="text-[9px] opacity-75">
                      {ack.is_acknowledged ? '(Ack)' : '(Pending)'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
