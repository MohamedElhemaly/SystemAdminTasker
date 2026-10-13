// ─────────────────────────────────────────────────────────────
// TIME TRACKING & WORK PRESENCE UTILITY HELPERS
// ─────────────────────────────────────────────────────────────

export const WORK_STATUSES = {
  ready: {
    id: 'ready',
    label: 'Ready',
    sublabel: 'Available for work',
    emoji: '🟢',
    colorHex: '#10b981',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
  },
  working: {
    id: 'working',
    label: 'Working',
    sublabel: 'Focusing on a task',
    emoji: '🔴',
    colorHex: '#ef4444',
    dotClass: 'bg-rose-500 animate-pulse',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30'
  },
  in_break: {
    id: 'in_break',
    label: 'In Break',
    sublabel: 'Taking a rest / pause',
    emoji: '🟡',
    colorHex: '#f59e0b',
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30'
  },
  offline: {
    id: 'offline',
    label: 'Offline',
    sublabel: 'Away from desk',
    emoji: '⚪',
    colorHex: '#94a3b8',
    dotClass: 'bg-slate-400',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
  }
};

/**
 * Format total seconds into a compact human string (e.g. "1h 24m", "45m", "15s")
 */
export const formatDurationCompact = (seconds = 0) => {
  const sec = Math.max(0, Math.floor(seconds || 0));
  if (sec === 0) return '0s';

  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const remainingSecs = sec % 60;

  if (hrs > 0) {
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }
  if (mins > 0) {
    return remainingSecs > 0 ? `${mins}m ${remainingSecs}s` : `${mins}m`;
  }
  return `${remainingSecs}s`;
};

/**
 * Format live digital stopwatch timer (e.g. "01:24:05" or "04:12")
 */
export const formatLiveTimer = (seconds = 0) => {
  const sec = Math.max(0, Math.floor(seconds || 0));
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const remSec = sec % 60;

  const pad = (n) => String(n).padStart(2, '0');

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(remSec)}`;
  }
  return `${pad(mins)}:${pad(remSec)}`;
};
