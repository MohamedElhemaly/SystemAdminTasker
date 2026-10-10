import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useClickFeedback } from './ClickFeedback';

export const SoundToggle = ({ isCollapsed }) => {
  const { soundEnabled, toggleSound } = useClickFeedback();

  return (
    <button
      type="button"
      onClick={toggleSound}
      className="w-full flex items-center justify-center gap-2 p-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-[#28292f] hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-all border border-slate-200 dark:border-slate-700/60 shadow-xs cursor-pointer select-none"
      title={soundEnabled ? "Mute Click Sound Effects" : "Enable Tactile Click Sound Effects"}
    >
      {soundEnabled ? (
        <Volume2 className="w-4 h-4 text-emerald-500 shrink-0" />
      ) : (
        <VolumeX className="w-4 h-4 text-slate-400 shrink-0" />
      )}
      {!isCollapsed && (
        <span className="truncate">
          {soundEnabled ? 'Sound' : 'Muted'}
        </span>
      )}
    </button>
  );
};
