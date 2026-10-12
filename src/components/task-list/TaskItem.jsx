import React, { useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { Flag, Calendar, CheckSquare, Users, CheckCircle2, Clock, Check, Lock, RotateCw, BellRing, X } from 'lucide-react';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import { getAvatarUrl } from '../../lib/avatars';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import toast from 'react-hot-toast';

export const TaskItem = ({ task }) => {
  const { 
    selectedTaskId, 
    setSelectedTaskId, 
    toggleTaskCompletion, 
    approveTask,
    rejectTask,
    updateTask, 
    toggleAcknowledgement,
    dropdownPriorities,
    dropdownStatuses,
    dropdownTaskTypes,
    allUsers
  } = useTasks();
  const { user, profile, isDemoMode } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);

  const isSelected = selectedTaskId === task.id;
  const currentUserId = user?.id || 'demo-user-123';
  const currentUserRole = profile?.role || 'member';
  const isManagerRole = ['manager', 'admin'].includes(currentUserRole);
  const isSubManagerRole = ['sub_manager', 'deputy_manager'].includes(currentUserRole);
  const isAdmin = currentUserRole === 'admin';
  const isManagerOrSub = isManagerRole || isSubManagerRole || isAdmin;
  const isMember = currentUserRole === 'member';

  const isUnderReview = task.status === 'under_review' || 
    dropdownStatuses.find(st => st.id === task.status_id)?.name?.toLowerCase() === 'in review';

  const managerApproved = Boolean(task.manager_approved);
  const subManagerApproved = Boolean(task.sub_manager_approved);
  const approvalCount = (managerApproved ? 1 : 0) + (subManagerApproved ? 1 : 0);

  const assignedUserIds = Array.isArray(task.assigned_users) && task.assigned_users.length > 0
    ? task.assigned_users
    : (task.assigned_to ? [task.assigned_to] : []);
  
  const assignedUsers = assignedUserIds.map(uid => allUsers?.find(u => u.id === uid)).filter(Boolean);
  const assignedUser = assignedUsers[0];
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
  const hasMultipleAssignees = Array.isArray(task.assigned_users) && task.assigned_users.length > 1;
  const isTeam = task.task_type === 'team' || totalAcks > 0 || hasMultipleAssignees;
  const isLocked = isTeam && (workingMembers.length > 0 || (totalAcks === 0 && hasMultipleAssignees)) && !task.is_completed;
  const myAck = acks.find(a => a.user_id === currentUserId);

  // Nudge Action: Creator or Admin/Manager only, if pending acknowledgements exist
  const isAdminOrCreator = task.created_by === currentUserId || currentUserRole === 'admin' || currentUserRole === 'manager';
  const canNudge = isTeam && isAdminOrCreator && workingMembers.length > 0;

  const handleNudge = async (e) => {
    e.stopPropagation();
    if (workingMembers.length === 0) return;

    try {
      const actorName = profile?.full_name || user?.email?.split('@')[0] || 'Manager';
      const notifs = workingMembers.map(m => ({
        user_id: m.user_id,
        actor_id: currentUserId,
        type: 'nudge_ack',
        entity_id: task.id,
        message_data: {
          task_id: task.id,
          task_title: task.title,
          actor_name: actorName,
          custom_text: `${actorName} nudged you to finish your part on "${task.title}".`
        },
        is_read: false
      }));

      if (isSupabaseConfigured() && !isDemoMode) {
        const { error } = await supabase.from('notifications').insert(notifs);
        if (error) throw error;
      } else {
        const stored = localStorage.getItem('tasker_live_notifications');
        const existing = stored ? JSON.parse(stored) : [];
        const newItems = notifs.map(n => ({
          id: 'notif-' + Math.random().toString(36).substr(2, 9),
          ...n,
          created_at: new Date().toISOString(),
          actor_avatar: profile?.avatar_id || 'avatar-1'
        }));
        localStorage.setItem('tasker_live_notifications', JSON.stringify([...newItems, ...existing]));
      }

      toast.success(`🔔 Nudge sent to ${workingMembers.length} member(s)!`, {
        id: `nudge-${task.id}`,
        duration: 3500
      });
    } catch (err) {
      toast.error('Failed to send nudge: ' + err.message);
    }
  };

  return (
    <div
      onClick={() => setSelectedTaskId(task.id)}
      className={`group flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer select-none mb-2 ${
        isSelected
          ? 'bg-blue-50/70 dark:bg-[#282932] border-blue-500/70 dark:border-[#4772fa]/70 shadow-xs ring-1 ring-blue-500/20'
          : 'bg-white dark:bg-[#1f2026] border-slate-200/90 dark:border-slate-800/80 hover:bg-slate-50/90 dark:hover:bg-[#25262e] hover:border-slate-300 dark:hover:border-slate-700/60 shadow-xs'
      } ${task.is_completed ? 'opacity-65' : ''}`}
    >
      {/* Custom Circular Tick Checkbox (With Lock Safeguard & Dual Approval Lock) */}
      <div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        {isUnderReview && isMember ? (
          <div 
            className="w-4.5 h-4.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 flex items-center justify-center border border-purple-300 dark:border-purple-600/50" 
            title={`Pending Dual Approval (${approvalCount}/2 Approved) — Cannot be modified while under review`}
          >
            <Lock className="w-2.5 h-2.5" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => toggleTaskCompletion(task.id)}
            className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${
              task.is_completed
                ? 'bg-blue-600 border-blue-600 text-white'
                : isUnderReview
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/20 text-purple-600 hover:border-purple-600'
                  : isLocked
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/50 hover:border-amber-500'
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1b1c20] hover:border-blue-500 dark:hover:border-blue-400'
            }`}
            title={
              task.is_completed 
                ? 'Mark incomplete' 
                : isUnderReview
                  ? `Dual Approval (${approvalCount}/2 Approved) — Click to review`
                  : isLocked 
                    ? `🔒 Locked: ${workingMembers.length} team member(s) still working (${workingMembers.map(m => m.full_name).join(', ')})` 
                    : 'Toggle Task Completion'
            }
          >
            {task.is_completed ? (
              <Check className="w-3 h-3 stroke-[3]" />
            ) : isUnderReview ? (
              <Clock className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" />
            ) : isLocked ? (
              <Lock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
            ) : null}
          </button>
        )}
      </div>

      {/* Task Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          {isEditing && !isMember ? (
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
              onDoubleClick={() => !isMember && setIsEditing(true)}
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
          
          {/* Dynamic Status Badge or Approval Actions */}
          {isUnderReview ? (
            <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40 shadow-xs">
                <Clock className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                <span>Dual Approval: {approvalCount}/2</span>
              </span>

              {/* Manager Status / Action */}
              {managerApproved ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30" title="Manager approved">
                  <Check className="w-2.5 h-2.5 stroke-[3]" /> Mgr Approved
                </span>
              ) : (isManagerRole || isAdmin) ? (
                <button
                  type="button"
                  onClick={() => approveTask(task.id, 'manager')}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="Grant Manager approval"
                >
                  <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                  <span>Approve Mgr</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" title="Awaiting Manager approval">
                  ⏳ Mgr Pending
                </span>
              )}

              {/* Sub-Manager Status / Action */}
              {subManagerApproved ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30" title="Sub-Manager approved">
                  <Check className="w-2.5 h-2.5 stroke-[3]" /> Sub-Mgr Approved
                </span>
              ) : (isSubManagerRole || isAdmin) ? (
                <button
                  type="button"
                  onClick={() => approveTask(task.id, 'sub_manager')}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="Grant Sub-Manager approval"
                >
                  <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                  <span>Approve Sub-Mgr</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" title="Awaiting Sub-Manager approval">
                  ⏳ Sub-Mgr Pending
                </span>
              )}

              {/* Reject Button (Managers / Sub-Managers / Admins) */}
              {isManagerOrSub && (
                <button
                  type="button"
                  onClick={() => rejectTask(task.id)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 dark:text-rose-300 dark:border-rose-500/40 shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="Reject task (Return to To Do)"
                >
                  <X className="w-2.5 h-2.5 stroke-[2.5]" />
                  <span>Reject</span>
                </button>
              )}
            </div>
          ) : statusInfo ? (
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
          ) : null}

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
              {task.recurrence_rule && (
                <RotateCw className="w-2.5 h-2.5 text-blue-500 ml-0.5" title={`Recurring: ${task.recurrence_rule}`} />
              )}
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

          {/* Assignee Avatar / Avatars Stack */}
          {assignedUsers.length > 0 && (
            <div 
              className={`${isTeam ? '' : 'ml-auto'} flex items-center gap-1.5`} 
              title={`Assigned to: ${assignedUsers.map(u => u.full_name || u.email).join(', ')}`}
            >
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Assigned:</span>
              <div className="flex items-center -space-x-1.5 overflow-hidden">
                {assignedUsers.slice(0, 3).map((u, idx) => (
                  <img 
                    key={u.id || idx}
                    src={getAvatarUrl(u.avatar_id, u.full_name || u.email)} 
                    alt={u.full_name} 
                    className="w-5 h-5 rounded-full border border-white dark:border-[#1f2026] bg-slate-100 dark:bg-slate-800 object-cover shrink-0 ring-1 ring-black/5"
                  />
                ))}
                {assignedUsers.length > 3 && (
                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-[9px] font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center border border-white dark:border-[#1f2026]">
                    +{assignedUsers.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}

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

              {/* Remind / Nudge Button (Creator or Manager only, when members still working) */}
              {canNudge && (
                <button
                  type="button"
                  onClick={handleNudge}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/40 shadow-xs transition-all cursor-pointer active:scale-95"
                  title={`Send Nudge reminder to ${workingMembers.length} member(s) still working`}
                >
                  <BellRing className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>Nudge ({workingMembers.length})</span>
                </button>
              )}

              {/* Direct Quick Action: If logged-in user is assigned and still working */}
              {((myAck && !myAck.is_acknowledged) || (!myAck && task.assigned_users?.includes(currentUserId))) && (
                <button
                  type="button"
                  onClick={() => toggleAcknowledgement(task.id, myAck?.id, currentUserId)}
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
