import React from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { Users, CheckCircle2, Clock, ShieldCheck, AlertCircle, Lock, Check, Sparkles, UserCheck, Hourglass, Activity } from 'lucide-react';

export const TeamAcknowledgementSection = ({ task }) => {
  const { toggleAcknowledgement, dropdownTaskTypes = [] } = useTasks();
  const { user, profile } = useAuth();

  const currentUserId = user?.id || 'demo-user-123';
  const currentUserRole = profile?.role || 'member';
  const acknowledgements = task.task_acknowledgements || [];

  const finishedMembers = acknowledgements.filter(a => a.is_acknowledged);
  const workingMembers = acknowledgements.filter(a => !a.is_acknowledged);

  const totalCount = acknowledgements.length;
  const finishedCount = finishedMembers.length;
  const percentComplete = totalCount > 0 ? Math.round((finishedCount / totalCount) * 100) : 0;

  const myAck = acknowledgements.find(a => a.user_id === currentUserId);
  const isAdmin = currentUserRole === 'manager';

  // Resolve dynamic task type from lookup table
  const currentTaskType = dropdownTaskTypes.find(tt => tt.id === task.task_type_id);
  const taskTypeName = currentTaskType?.name || (task.task_type === 'team' ? 'Team Task' : 'Personal Task');

  if (task.task_type !== 'team' || totalCount === 0) {
    return (
      <div className="p-3.5 rounded-2xl bg-white dark:bg-[#23242a] border border-slate-200 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          {currentTaskType?.color_hex ? (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/10"
              style={{ backgroundColor: currentTaskType.color_hex }}
            />
          ) : (
            <Users className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
          )}
          <span className="truncate">
            Task Scope: <strong className="text-slate-800 dark:text-slate-200 font-bold">{taskTypeName}</strong>
          </span>
        </div>
        <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0 ml-2">
          {task.task_type === 'team' ? 'Team acknowledgements not configured' : 'No team completion required'}
        </span>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-[#23242a] border border-purple-200 dark:border-purple-500/25 shadow-xs space-y-4">
      {/* Header with Progress Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Team Task Progress</span>
          </div>
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
            workingMembers.length === 0
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
              : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'
          }`}>
            {finishedCount} of {totalCount} Finished ({percentComplete}%)
          </span>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800/80 h-2 rounded-full overflow-hidden border border-slate-200/60 dark:border-slate-700/60">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500 rounded-full"
            style={{ width: `${percentComplete}%` }}
          />
        </div>
      </div>

      {/* Completion Lock Safeguard Banner */}
      {workingMembers.length > 0 ? (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2.5 text-amber-800 dark:text-amber-300 text-xs">
          <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-bold">Completion Locked</p>
            <p className="text-amber-700 dark:text-amber-300/90 mt-0.5 text-[11px] leading-relaxed">
              This task <strong>cannot</strong> be marked completed until all team members finish their work. 
              {workingMembers.length} member{workingMembers.length > 1 ? 's are' : ' is'} still working.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="font-semibold text-[11px]">
            🎉 All team members have finished their work! This task is unlocked and can now be marked Done.
          </p>
        </div>
      )}

      {/* Current User Quick-Action Hero Card */}
      {myAck && (
        <div className={`p-3 rounded-xl border transition-all ${
          myAck.is_acknowledged
            ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
            : 'bg-purple-50/70 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30'
        }`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              {myAck.is_acknowledged ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <Hourglass className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 animate-spin" />
              )}
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Your Assignment Status:
                </span>
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  {myAck.is_acknowledged 
                    ? '✓ You marked your part as completed!' 
                    : 'You are assigned to this task. Mark complete when done.'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => toggleAcknowledgement(task.id, myAck.id, myAck.user_id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                myAck.is_acknowledged
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{myAck.is_acknowledged ? 'Reopen (Still Working)' : 'Mark My Part as Finished'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Admin Live Monitor Section: Who Finished vs Who Is Still Working */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-500" />
            <span>Admin Live Monitor</span>
          </span>
          {isAdmin && (
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 font-bold uppercase tracking-wider">
              Manager View
            </span>
          )}
        </div>

        {/* 2-Column Split: Finished vs Still Working */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          
          {/* Box 1: Members Who Finished */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1f2026] border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Finished Work ({finishedMembers.length})</span>
              </span>
            </div>

            {finishedMembers.length === 0 ? (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 italic py-1">
                No members finished yet.
              </p>
            ) : (
              <div className="space-y-1.5">
                {finishedMembers.map((ack) => {
                  const isSelf = ack.user_id === currentUserId;
                  return (
                    <div 
                      key={ack.id || ack.user_id}
                      className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-500/10 border border-emerald-200/70 dark:border-emerald-500/25 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {ack.full_name || 'Team Member'}
                        </span>
                        {isSelf && (
                          <span className="text-[9px] px-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-500/30 dark:text-blue-300 font-bold shrink-0">
                            YOU
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 shrink-0 flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" /> Done
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Box 2: Members Still Working */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1f2026] border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Still Working ({workingMembers.length})</span>
              </span>
            </div>

            {workingMembers.length === 0 ? (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium py-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                All members completed!
              </p>
            ) : (
              <div className="space-y-1.5">
                {workingMembers.map((ack) => {
                  const isSelf = ack.user_id === currentUserId;
                  return (
                    <div 
                      key={ack.id || ack.user_id}
                      className="flex items-center justify-between p-2 rounded-lg bg-amber-50/60 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/25 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                        <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {ack.full_name || 'Team Member'}
                        </span>
                        {isSelf && (
                          <span className="text-[9px] px-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-500/30 dark:text-blue-300 font-bold shrink-0">
                            YOU
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 shrink-0">
                        In Progress
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
};
