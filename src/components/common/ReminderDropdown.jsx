import React, { useState, useRef, useEffect } from 'react';
import { Bell, ChevronDown, Check, X, Crown, Clock } from 'lucide-react';
import { 
  REMINDER_PRESETS, 
  calculateNextReminderAt, 
  getReminderLabel 
} from '../../lib/reminderHelper';

export const ReminderDropdown = ({
  task,
  onChange,
  dueDate,
  buttonClassName = '',
  align = 'left',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Extract initial values from task
  const initialOffset = task?.reminder_offset_days !== undefined ? task.reminder_offset_days : null;
  const initialTime = task?.reminder_time || '09:00';
  const initialConstant = Boolean(task?.is_constant_reminder);

  // Local Draft State inside Popover (committed on "OK", discarded on "Cancel")
  const [draftOffset, setDraftOffset] = useState(initialOffset);
  const [draftTime, setDraftTime] = useState(initialTime);
  const [draftConstant, setDraftConstant] = useState(initialConstant);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customDays, setCustomDays] = useState(1);

  // Sync draft state whenever popover opens or task props change
  useEffect(() => {
    if (isOpen) {
      setDraftOffset(task?.reminder_offset_days !== undefined ? task.reminder_offset_days : null);
      setDraftTime(task?.reminder_time || '09:00');
      setDraftConstant(Boolean(task?.is_constant_reminder));

      const isPreset = REMINDER_PRESETS.some(
        p => p.offsetDays === task?.reminder_offset_days && p.time === (task?.reminder_time || '09:00').slice(0, 5)
      );
      if (task?.reminder_offset_days !== null && task?.reminder_offset_days !== undefined && !isPreset) {
        setIsCustomMode(true);
        setCustomDays(task.reminder_offset_days);
      } else {
        setIsCustomMode(false);
      }
    }
  }, [isOpen, task?.reminder_offset_days, task?.reminder_time, task?.is_constant_reminder]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const currentLabel = getReminderLabel(task?.reminder_offset_days, task?.reminder_time);
  const hasReminder = task?.reminder_offset_days !== null && task?.reminder_offset_days !== undefined;

  // Handle Preset Selection
  const handleSelectPreset = (preset) => {
    setIsCustomMode(false);
    setDraftOffset(preset.offsetDays);
    setDraftTime(preset.time);
  };

  // Handle Custom Selection
  const handleSelectCustom = () => {
    setIsCustomMode(true);
    setDraftOffset(customDays);
  };

  // Handle Clear / Remove
  const handleClear = () => {
    setIsCustomMode(false);
    setDraftOffset(null);
  };

  // Cancel button
  const handleCancel = () => {
    setIsOpen(false);
  };

  // OK button: Commit draft state
  const handleOk = () => {
    const finalOffset = isCustomMode ? customDays : draftOffset;
    const finalTime = draftTime || '09:00';
    const computedNextAt = calculateNextReminderAt(dueDate || task?.due_date, finalOffset, finalTime);

    onChange({
      reminder_offset_days: finalOffset,
      reminder_time: finalOffset !== null ? (finalTime.length === 5 ? `${finalTime}:00` : finalTime) : null,
      next_reminder_at: computedNextAt,
      is_reminder_sent: false,
      is_constant_reminder: draftConstant,
    });

    setIsOpen(false);
  };

  return (
    <div ref={menuRef} className="relative inline-block text-left">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all shadow-xs ${
          disabled ? 'opacity-60 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
        } ${
          hasReminder
            ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40 font-semibold'
            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 dark:bg-[#28292f] dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-700/80'
        } ${buttonClassName}`}
        title="Set Task Reminder"
      >
        <Bell className={`w-3.5 h-3.5 shrink-0 ${hasReminder ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400'}`} />
        <span className="truncate max-w-[130px]">{currentLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>

      {/* Floating Popover Container matching Reference Image */}
      {isOpen && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 z-50 w-64 rounded-2xl p-3 shadow-2xl border backdrop-blur-md bg-white/98 text-slate-800 border-slate-200 dark:bg-[#1e1e22]/98 dark:text-slate-100 dark:border-slate-700/80 animate-in fade-in zoom-in-95 duration-150 select-none`}
        >
          {/* Header indicator */}
          <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100 dark:border-slate-800/80">
            <span className="text-xs font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
              <Bell className="w-3.5 h-3.5 text-amber-500" />
              <span>Reminder</span>
            </span>
            {draftOffset !== null && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-0.5 cursor-pointer"
                title="Remove reminder"
              >
                <X className="w-3 h-3" />
                <span>None</span>
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="space-y-0.5 py-1">
            {REMINDER_PRESETS.map((preset) => {
              const isSelected = !isCustomMode && draftOffset === preset.offsetDays && draftTime.slice(0, 5) === preset.time;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 text-blue-600 font-bold dark:bg-blue-500/20 dark:text-blue-300'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <span>{preset.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 stroke-[3]" />}
                </button>
              );
            })}

            {/* Custom Option */}
            <button
              type="button"
              onClick={handleSelectCustom}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer ${
                isCustomMode
                  ? 'bg-blue-50 text-blue-600 font-bold dark:bg-blue-500/20 dark:text-blue-300'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <span>Custom</span>
              {isCustomMode && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 stroke-[3]" />}
            </button>
          </div>

          {/* Custom Settings Form (if Custom selected) */}
          {isCustomMode && (
            <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-[#25262c] border border-slate-200 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Days early:</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={customDays}
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                      setCustomDays(val);
                      setDraftOffset(val);
                    }}
                    className="w-16 px-2 py-1 bg-white dark:bg-[#1a1b1e] border border-slate-300 dark:border-slate-700 rounded-lg text-center text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">days</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>Time:</span>
                </span>
                <input
                  type="time"
                  value={draftTime.slice(0, 5)}
                  onChange={(e) => setDraftTime(e.target.value || '09:00')}
                  className="px-2 py-1 bg-white dark:bg-[#1a1b1e] border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Subtle Divider */}
          <div className="my-2 border-t border-slate-200 dark:border-slate-700/70" />

          {/* Constant Reminder Option matching Reference Image */}
          <div className="flex items-center justify-between px-1 py-1 text-xs">
            <label htmlFor="constant-reminder-toggle" className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-200">
              <span>Constant Reminder</span>
              <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            </label>

            {/* Toggle Switch */}
            <button
              id="constant-reminder-toggle"
              type="button"
              role="switch"
              aria-checked={draftConstant}
              onClick={() => setDraftConstant(prev => !prev)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                draftConstant ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  draftConstant ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Action Buttons: Cancel and OK matching Reference Image */}
          <div className="flex items-center justify-end gap-2 pt-3 mt-1 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleOk}
              className="px-5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition-all cursor-pointer"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
