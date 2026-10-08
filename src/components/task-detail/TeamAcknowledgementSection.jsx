import React from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { Users, CheckCircle, Clock, ShieldCheck, AlertCircle, Lock } from 'lucide-react';

export const TeamAcknowledgementSection = ({ task }) => {
  const { toggleAcknowledgement } = useTasks();
  const { user } = useAuth();

  const currentUserId = user?.id || 'demo-user-123';
  const acknowledgements = task.task_acknowledgements || [];

  const pendingCount = acknowledgements.filter(a => !a.is_acknowledged).length;
  const acknowledgedCount = acknowledgements.filter(a => a.is_acknowledged).length;

  if (task.task_type !== 'team') {
    return (
      <div className="p-3.5 rounded-2xl bg-[#23242a] border border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-500" />
          <span>Task Type: <strong>Personal</strong></span>
        </div>
        <span className="text-[11px] text-slate-400">No team acknowledgements required</span>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-[#23242a] border border-pink-500/20 shadow-lg space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-pink-300 uppercase tracking-wider">
          <ShieldCheck className="w-4.5 h-4.5 text-pink-400" />
          <span>Mandatory Team Acknowledgement</span>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
          pendingCount === 0
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        }`}>
          {pendingCount === 0 ? '✓ Ready to Complete' : `${pendingCount} Pending Tag(s)`}
        </span>
      </div>

      {/* Completion Lock Safeguard Banner */}
      {pendingCount > 0 && (
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-amber-300 text-xs">
          <Lock className="w-4 h-4 shrink-0" />
          <span>
            Completion Status Lock: This task <strong>cannot</strong> be completed until all team members acknowledge their tag below.
          </span>
        </div>
      )}

      {/* Interactive Member Tags (Chips) */}
      <div className="space-y-2 pt-1">
        <span className="text-[11px] font-semibold text-slate-400 block">
          Team Member Acknowledgement Tags (Click your own tag to acknowledge):
        </span>

        {acknowledgements.length === 0 ? (
          <p className="text-xs text-slate-400 italic">
            No team members found in the assigned team list.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {acknowledgements.map((ack) => {
              const isSelf = ack.user_id === currentUserId;

              return (
                <button
                  key={ack.id || ack.user_id}
                  type="button"
                  onClick={() => toggleAcknowledgement(task.id, ack.id, ack.user_id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                    ack.is_acknowledged
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30 shadow-md shadow-emerald-500/10'
                      : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:border-amber-500/60 hover:text-amber-300'
                  } ${isSelf ? 'ring-2 ring-blue-500/60' : ''}`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${ack.is_acknowledged ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                  <span>@{ack.full_name || 'Team Member'}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                    ack.is_acknowledged ? 'bg-emerald-500/30 text-emerald-200' : 'bg-slate-700 text-slate-400'
                  }`}>
                    {ack.is_acknowledged ? 'Acknowledged' : 'Pending'}
                  </span>
                  {isSelf && (
                    <span className="text-[9px] bg-blue-500/30 text-blue-300 px-1 rounded ml-1 font-bold">
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
  );
};
