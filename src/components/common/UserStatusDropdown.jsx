import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { WORK_STATUSES } from '../../lib/timeTrackingHelper';
import { ChevronDown, Coffee, Play, CheckCircle2, Moon, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export const UserStatusDropdown = ({ compact = false }) => {
  const { profile, user } = useAuth();
  const { updateWorkStatus, activeTimeLog, pauseTimer } = useTasks();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const currentStatusKey = profile?.work_status || 'ready';
  const currentStatus = WORK_STATUSES[currentStatusKey] || WORK_STATUSES.ready;

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelectStatus = async (statusKey) => {
    setIsOpen(false);
    if (statusKey === currentStatusKey) return;

    // If taking a break or going offline, pause any active task timer
    if ((statusKey === 'in_break' || statusKey === 'offline') && activeTimeLog) {
      await pauseTimer(activeTimeLog.task_id, statusKey);
      toast(`⏸️ Active task timer paused because you switched to ${WORK_STATUSES[statusKey]?.label || statusKey}.`, {
        icon: statusKey === 'in_break' ? '☕' : '⚪',
        id: 'presence-timer-paused',
        duration: 3500
      });
      return;
    }

    const success = await updateWorkStatus(statusKey);
    if (success) {
      toast.success(`${WORK_STATUSES[statusKey]?.emoji || '•'} Status updated: ${WORK_STATUSES[statusKey]?.label}`, {
        id: 'presence-status-update',
        duration: 2500
      });
    }
  };

  const getStatusIcon = (key) => {
    switch (key) {
      case 'working':
        return <Play className="w-3 h-3 text-rose-500 fill-rose-500" />;
      case 'in_break':
        return <Coffee className="w-3 h-3 text-amber-500" />;
      case 'offline':
        return <Moon className="w-3 h-3 text-slate-400" />;
      case 'ready':
      default:
        return <CheckCircle2 className="w-3 h-3 text-emerald-500" />;
    }
  };

  if (compact) {
    return (
      <div className="relative inline-block" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-[#1b1c20] cursor-pointer transition-transform hover:scale-110 ${currentStatus.dotClass}`}
          title={`Status: ${currentStatus.label} (Click to change)`}
        />
        {isOpen && renderDropdownMenu()}
      </div>
    );
  }

  function renderDropdownMenu() {
    return (
      <div 
        className={`absolute ${compact ? 'left-6 -top-2' : 'left-0 top-full mt-1.5'} w-48 rounded-xl bg-white dark:bg-[#202127] border border-slate-200 dark:border-slate-800 shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 select-none`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2.5 py-1 mb-1 border-b border-slate-100 dark:border-slate-800/80">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Set Your Work Presence
          </p>
        </div>

        {Object.values(WORK_STATUSES).map((item) => {
          const isSelected = item.id === currentStatusKey;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectStatus(item.id)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-blue-50/70 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-bold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#282932]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${item.dotClass}`} />
                <div>
                  <span className="block leading-none">{item.label}</span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight block mt-0.5">
                    {item.sublabel}
                  </span>
                </div>
              </div>
              {isSelected && <span className="text-blue-600 dark:text-blue-400 text-xs">✓</span>}
            </button>
          );
        })}

        {activeTimeLog && (
          <div className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-800/80 px-2.5 py-1 text-[10px] text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />
            <span className="truncate">Active task timer running</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative inline-block" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer hover:shadow-xs active:scale-95 ${currentStatus.badgeClass}`}
        title="Click to change your real-time presence status"
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${currentStatus.dotClass}`} />
        <span>{currentStatus.label}</span>
        <ChevronDown className="w-2.5 h-2.5 opacity-60 ml-0.5" />
      </button>

      {isOpen && renderDropdownMenu()}
    </div>
  );
};
