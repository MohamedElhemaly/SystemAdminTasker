import React, { useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { Flag, Calendar, CheckSquare, Users, CheckCircle2, Clock, Check, Lock } from 'lucide-react';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import { getAvatarUrl } from '../../lib/avatars';

export const TaskItem = ({ task }) => {
  const { 
    selectedTaskId, 
    setSelectedTaskId, 
    toggleTaskCompletion, 
    updateTask, 
    toggleAcknowledgement,
    dropdownPriorities,
    dropdownStatuses,
    dropdownTaskTypes,
    allUsers
  } = useTasks();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);

  const isSelected = selectedTaskId === task.id;
  const currentUserId = user?.id || 'demo-user-123';

  const assignedUser = allUsers?.find(u => u.id === task.assigned_to);
  const assigneeAvatarUrl = assignedUser ? getAvatarUrl(assignedUser.avatar_id, assignedUser.full_name || assignedUser.email) : getAvatarUrl('avatar-1', 'Unknown');

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

  // Team Acknowledgements Breakdown
  const acks = task.task_acknowledgements || [];
  const finishedMembers = acks.filter(a => a.is_acknowledged);
  const workingMembers = acks.filter(a => !a.is_acknowledged);
  const totalAcks = acks.length;
  const isTeam = task.task_type === 'team' || totalAcks > 0;
  const isLocked = isTeam && workingMembers.length > 0 && !task.is_completed;
  const myAck = acks.find(a => a.user_id === currentUserId);

  return (
    <div
      onClick={() => setSelectedTaskId(task.id)}
      className={`group flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer select-none mb-2 ${
        isSelected
          ? 'bg-blue-50/70 dark:bg-[#282932] border-blue-500/70 dark:border-[#4772fa]/70 shadow-xs ring-1 ring-blue-500/20'
          : 'bg-white dark:bg-[#1f2026] border-slate-200/90 dark:border-slate-800/80 hover:bg-slate-50/90 dark:hover:bg-[#25262e] hover:border-slate-300 dark:hover:border-slate-700/60 shadow-xs'
      } ${task.is_completed ? 'opacity-65' : ''}`}
    >
      {/* Custom Circular Tick Checkbox (With Lock Safeguard) */}
      <div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => toggleTaskCompletion(task.id)}
          className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${
            task.is_completed
              ? 'bg-blue-600 border-blue-600 text-white'
              : isLocked
                ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/50 hover:border-amber-500'
                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1b1c20] hover:border-blue-500 dark:hover:border-blue-400'
          }`}
          title={
            task.is_completed 
              ? 'Mark incomplete' 
              : isLocked 
                ? `🔒 Locked: ${workingMembers.length} team member(s) still working (${workingMembers.map(m => m.full_name).join(', ')})` 
                : 'Toggle Task Completion'
          }
        >
          {task.is_completed ? (
            <Check className="w-3 h-3 stroke-[3]" />
          ) : isLocked ? (
            <Lock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
          ) : null}
        </button>
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
                className="w-full bg-slate-50 dark:bg-[#18181c] border border-blue-500 rounded px-2 py-0.5 text-sm text-slate-900 dark:text-white focus:outline-none"
              />
            </form>
          ) : (
            <span
              onDoubleClick={() => setIsEditing(true)}
              className={`text-sm font-semibold text-slate-800 dark:text-slate-100 truncate ${
                task.is_completed ? 'line-through text-slate-400 dark:text-slate-500 font-normal' : ''
              }`}
            >
              {task.title}
            </span>
          )}

          {/* Dynamic Priority Badge */}
          {priorityInfo && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0" style={{
              backgroundColor: `${priorityInfo.color_hex || priorityInfo.color || '#ef4444'}18`,
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
            <span 
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border" 
              style={{
                backgroundColor: `${statusInfo.color_hex || '#3b82f6'}18`,
                color: statusInfo.color_hex || '#3b82f6',
                borderColor: `${statusInfo.color_hex || '#3b82f6'}30`
              }}
            >
              <span>{statusInfo.name}</span>
            </span>
          )}

          {/* Dynamic Task Type Badge */}
          {taskTypeInfo && (
            <span 
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border" 
              style={{
                backgroundColor: `${taskTypeInfo.color_hex || '#ec4899'}18`,
                color: taskTypeInfo.color_hex || '#ec4899',
                borderColor: `${taskTypeInfo.color_hex || '#ec4899'}30`
              }}
            >
              <span>{taskTypeInfo.name}</span>
            </span>
          )}

          {/* Generic Task Tags (#hashtags) */}
          {task.tags && task.tags.map((tg) => (
            <span
              key={tg.id}
              className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border"
              style={{
                backgroundColor: `${tg.color_hex || tg.color || '#3b82f6'}18`,
                color: tg.color_hex || tg.color || '#3b82f6',
                borderColor: `${tg.color_hex || tg.color || '#3b82f6'}35`
              }}
            >
              #{tg.name}
            </span>
          ))}
          
          {/* Due Date Badge */}
          {formattedDueDate && (
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${
              isOverdue
                ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30'
                : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700/50'
            }`}>
              <Calendar className="w-3 h-3" />
              <span>{formattedDueDate}</span>
            </span>
          )}

          {/* Subtasks Counter Badge */}
          {task.subtasks && task.subtasks.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700/50">
              <CheckSquare className="w-3 h-3" />
              <span>
                {task.subtasks.filter(s => s.is_completed).length}/{task.subtasks.length}
              </span>
            </span>
          )}

          {/* Assignee Avatar */}
          <div 
            className={`${isTeam ? '' : 'ml-auto'} flex items-center gap-1.5`} 
            title={`Assigned to: ${assignedUser?.full_name || assignedUser?.email || 'Unknown'}`}
          >
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Assigned:</span>
            <img 
              src={assigneeAvatarUrl} 
              alt="Assignee" 
              className="w-5 h-5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 object-cover shrink-0"
            />
          </div>

          {/* CUSTOM FEATURE: Team Status & Member Breakdown (Finished vs Still Working) */}
          {isTeam && (
            <div className="flex flex-wrap items-center gap-1.5 ml-auto" onClick={(e) => e.stopPropagation()}>
              {/* Progress Summary Pill */}
              <span className={`text-[10px] font-bold tracking-wider flex items-center gap-1 px-2 py-0.5 rounded-md border ${
                workingMembers.length === 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'
              }`}>
                <Users className="w-3 h-3" />
                <span>
                  {workingMembers.length === 0
                    ? `✓ Team: All Done (${totalAcks}/${totalAcks})`
                    : `Team: ${finishedMembers.length}/${totalAcks} Done`}
                </span>
              </span>

              {/* Direct Quick Action: If logged-in user is assigned and still working */}
              {myAck && !myAck.is_acknowledged && (
                <button
                  type="button"
                  onClick={() => toggleAcknowledgement(task.id, myAck.id, currentUserId)}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all cursor-pointer animate-pulse"
                  title="Click to mark your work finished"
                >
                  <Check className="w-3 h-3" />
                  <span>Finish My Part</span>
                </button>
              )}

              {/* Member Breakdown Chips */}
              {acks.map((ack) => {
                const isSelf = ack.user_id === currentUserId;

                return (
                  <button
                    key={ack.id || ack.user_id}
                    type="button"
                    onClick={() => toggleAcknowledgement(task.id, ack.id, ack.user_id)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all cursor-pointer ${
                      ack.is_acknowledged
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
                        : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30'
                    } ${isSelf ? 'ring-2 ring-blue-500/60 shadow-xs' : ''}`}
                    title={
                      ack.is_acknowledged
                        ? `✓ ${ack.full_name || 'Member'} has finished work`
                        : `⏳ ${ack.full_name || 'Member'} is still working`
                    }
                  >
                    {ack.is_acknowledged ? (
                      <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    )}
                    <span>@{ack.full_name || 'Member'}</span>
                    <span className="text-[9px] font-bold opacity-90">
                      {ack.is_acknowledged ? '(Done)' : '(Working)'}
                    </span>
                    {isSelf && (
                      <span className="text-[8px] px-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-500/40 dark:text-blue-200 font-extrabold ml-0.5">
                        YOU
                      </span>
                    )}
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
