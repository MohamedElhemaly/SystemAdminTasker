import React, { useState, useEffect } from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { Play, Clock, Flame, ShieldAlert } from 'lucide-react';
import { formatDurationCompact, formatLiveTimer } from '../../lib/timeTrackingHelper';

export const TaskTimeTracker = ({ task, isDetailView = false }) => {
  const { 
    activeTimeLog, 
    startTimer, 
    getTaskTotalSeconds, 
    getTaskTimeLogs 
  } = useTasks();
  const { user } = useAuth();

  const currentUserId = user?.id || 'demo-user-123';
  const isTimerRunningOnThisTask = activeTimeLog?.task_id === task.id && activeTimeLog?.user_id === currentUserId;

  // Live running timer: dynamically calculates elapsed time continuously (Date.now() - start_time)
  const [elapsedCurrentSession, setElapsedCurrentSession] = useState(0);

  useEffect(() => {
    let interval = null;
    if (isTimerRunningOnThisTask && activeTimeLog?.start_time) {
      const calcElapsed = () => {
        const startMs = new Date(activeTimeLog.start_time).getTime();
        const nowMs = Date.now();
        setElapsedCurrentSession(Math.max(0, Math.floor((nowMs - startMs) / 1000)));
      };

      calcElapsed();
      interval = setInterval(calcElapsed, 1000);
    } else {
      setElapsedCurrentSession(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunningOnThisTask, activeTimeLog?.start_time]);

  const baseRecordedSeconds = getTaskTotalSeconds(task.id);
  const totalDisplaySeconds = baseRecordedSeconds + (isTimerRunningOnThisTask ? elapsedCurrentSession : 0);

  const handleStartTimer = async (e) => {
    e?.stopPropagation();
    if (!isTimerRunningOnThisTask) {
      await startTimer(task.id);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 1. Task Detail Panel View
  // ─────────────────────────────────────────────────────────────
  if (isDetailView) {
    return (
      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1a1b20] border border-slate-200 dark:border-slate-800 space-y-3 select-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span>Time Tracking (Strict Start-to-Finish)</span>
          </div>
          {isTimerRunningOnThisTask ? (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              Recording Active Work
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
              Total Logged: {formatDurationCompact(totalDisplaySeconds)}
            </span>
          )}
        </div>

        {/* Stopwatch Display */}
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-[#23242a] border border-slate-200 dark:border-slate-700/70 shadow-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-0.5">
              {isTimerRunningOnThisTask ? 'Current Working Session' : 'Accumulated Time'}
            </span>
            <div className={`text-xl md:text-2xl font-mono font-extrabold flex items-baseline gap-2 ${
              isTimerRunningOnThisTask ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
            }`}>
              <span>⏱️ {formatLiveTimer(isTimerRunningOnThisTask ? elapsedCurrentSession : totalDisplaySeconds)}</span>
              {isTimerRunningOnThisTask && (
                <span className="text-xs font-sans font-medium text-slate-400">
                  (Total: {formatDurationCompact(totalDisplaySeconds)})
                </span>
              )}
            </div>
          </div>

          {!task.is_completed && (
            <div>
              {isTimerRunningOnThisTask ? (
                /* When running: Pause is removed! Shows active status indicator */
                <div className="text-right">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-300 dark:border-rose-700 shadow-2xs">
                    <Flame className="w-3.5 h-3.5 text-rose-500 animate-bounce" />
                    <span>In Progress</span>
                  </span>
                  <p className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-1">
                    Stops automatically when marked Done
                  </p>
                </div>
              ) : (
                /* When not running: Shows Start Work button */
                <button
                  type="button"
                  onClick={handleStartTimer}
                  className="px-4 py-2 rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start Work</span>
                </button>
              )}
            </div>
          )}
        </div>

        {isTimerRunningOnThisTask && (
          <div className="p-2 rounded-lg bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-[10.5px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Strict Tracking Policy: Pause is disabled. Work records until task completion.</span>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Task Card Compact View
  // ─────────────────────────────────────────────────────────────
  return (
    <div 
      className="inline-flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {isTimerRunningOnThisTask ? (
        /* Running: NO Pause button, live running timer badge with pulsing ping */
        <div 
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40 shadow-xs text-[11px] font-mono font-bold animate-pulse"
          title="Strict Time Tracking active: Stops automatically when you mark Done"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
          <span>⏱️ {formatLiveTimer(elapsedCurrentSession)}</span>
        </div>
      ) : (
        /* Idle: Shows accumulated duration and Play (Start) button */
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700/50 text-[11px] font-medium">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>{formatDurationCompact(totalDisplaySeconds)}</span>

          {!task.is_completed && (
            <button
              type="button"
              onClick={handleStartTimer}
              className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-500/20 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer ml-0.5 flex items-center gap-0.5"
              title="Start work on this task (Strict Start-to-Finish)"
            >
              <Play className="w-2.5 h-2.5 fill-current" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
