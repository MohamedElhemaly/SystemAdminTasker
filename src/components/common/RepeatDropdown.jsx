import React, { useState, useRef, useEffect } from 'react';
import { RotateCw, ChevronDown, Check, Ban, X, ChevronRight } from 'lucide-react';
import { 
  WEEKDAYS, 
  getQuickRepeatOptions, 
  getRRuleLabel, 
  parseRRule, 
  buildRRule, 
  getDayCode 
} from '../../lib/rruleHelper';

export const RepeatDropdown = ({
  value,
  onChange,
  dueDate,
  buttonClassName = '',
  align = 'left',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState('presets'); // 'presets' | 'custom'
  const menuRef = useRef(null);

  // Custom Form State
  const [freq, setFreq] = useState('WEEKLY');
  const [interval, setInterval] = useState(1);
  const [byDays, setByDays] = useState(['SU']);
  const [mode, setMode] = useState('due_date');

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
        setView('presets');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Synchronize custom state whenever opening or value changes
  useEffect(() => {
    if (isOpen) {
      const parsed = parseRRule(value, dueDate);
      setFreq(parsed.freq || 'WEEKLY');
      setInterval(parsed.interval || 1);
      setByDays(parsed.byDays && parsed.byDays.length > 0 ? parsed.byDays : [getDayCode(dueDate || new Date())]);
      setMode(parsed.mode || 'due_date');
    }
  }, [isOpen, value, dueDate]);

  const quickOptions = getQuickRepeatOptions(dueDate);
  const currentLabel = getRRuleLabel(value, dueDate);
  const isRecurring = Boolean(value);

  const handleSelectQuick = (rule) => {
    onChange(rule);
    setIsOpen(false);
    setView('presets');
  };

  const handleClearRepeat = () => {
    onChange(null);
    setIsOpen(false);
    setView('presets');
  };

  const toggleDay = (code) => {
    setByDays(prev => {
      if (prev.includes(code)) {
        if (prev.length === 1) return prev; // keep at least one
        return prev.filter(d => d !== code);
      } else {
        return [...prev, code];
      }
    });
  };

  const handleSaveCustom = () => {
    const generated = buildRRule({
      freq,
      interval,
      byDays: freq === 'WEEKLY' ? byDays : [],
      mode
    });
    onChange(generated);
    setIsOpen(false);
    setView('presets');
  };

  // Dynamic header title matching reference image e.g. "Weekly on Su"
  const getCustomSummaryTitle = () => {
    const unit = freq === 'DAILY' ? 'Day' : freq === 'WEEKLY' ? 'Week' : freq === 'MONTHLY' ? 'Month' : 'Year';
    if (freq === 'WEEKLY') {
      if (interval === 1 && byDays.length === 1) {
        return `Weekly on ${byDays[0].charAt(0) + byDays[0].slice(1).toLowerCase()}`;
      }
      if (byDays.length > 0) {
        const days = byDays.map(d => d.charAt(0) + d.slice(1).toLowerCase()).join(', ');
        return interval === 1 ? `Weekly on ${days}` : `Every ${interval} Weeks on ${days}`;
      }
    }
    return interval === 1 ? `${unit}ly` : `Every ${interval} ${unit}s`;
  };

  const isCustomRule = isRecurring && !quickOptions.some(q => q.rule === value);

  return (
    <div ref={menuRef} className="relative inline-block text-left">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setIsOpen(prev => !prev);
          setView('presets');
        }}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all shadow-xs ${
          disabled ? 'opacity-60 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
        } ${
          isRecurring
            ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40 font-semibold'
            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 dark:bg-[#28292f] dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-700/80'
        } ${buttonClassName}`}
        title="Set Task Recurrence (RRULE)"
      >
        <RotateCw className={`w-3.5 h-3.5 shrink-0 ${isRecurring ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400'}`} />
        <span className="truncate max-w-[130px]">{currentLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>

      {/* Floating Popover Container (Seamlessly Light/Dark Native, No Fullscreen Backdrop!) */}
      {isOpen && (
        <div 
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 z-50 ${
            view === 'custom' ? 'w-[290px]' : 'w-56'
          } rounded-2xl p-2 shadow-2xl border backdrop-blur-md bg-white/98 text-slate-800 border-slate-200 dark:bg-[#1e1e22]/98 dark:text-slate-100 dark:border-slate-700/80 animate-in fade-in zoom-in-95 duration-150 select-none`}
        >
          {/* VIEW 1: PRESET RECURRENCE OPTIONS */}
          {view === 'presets' && (
            <div>
              <div className="space-y-0.5">
                {quickOptions.map((opt) => {
                  const isSelected = value === opt.rule;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectQuick(opt.rule)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 font-semibold'
                          : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#282932]'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>

              <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />

              {/* Custom Option Switcher */}
              <button
                type="button"
                onClick={() => setView('custom')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer text-left ${
                  isCustomRule
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 font-semibold'
                    : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#282932]'
                }`}
              >
                <span>Custom</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-2" />
              </button>

              {/* Clear Recurrence Option */}
              {isRecurring && (
                <>
                  <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />
                  <button
                    type="button"
                    onClick={handleClearRepeat}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 transition-colors cursor-pointer text-left font-medium"
                  >
                    <Ban className="w-3.5 h-3.5 shrink-0" />
                    <span>Don't Repeat</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* VIEW 2: CUSTOM REPEAT INLINE EDITOR (Exact match to Reference Image 2) */}
          {view === 'custom' && (
            <div className="space-y-3 p-1 animate-in slide-in-from-right-3 duration-150">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <RotateCw className="w-4 h-4 text-blue-500 shrink-0" />
                  <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400 truncate">
                    {getCustomSummaryTitle()}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Row 1: By Due Dates vs By Completion Date */}
              <div className="relative">
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full appearance-none bg-slate-100 hover:bg-slate-200/80 dark:bg-[#27282e] dark:hover:bg-[#2d2e35] text-xs text-slate-800 dark:text-slate-200 font-medium px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer pr-8"
                >
                  <option value="due_date">By Due Dates</option>
                  <option value="completion">By Completion Date</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Row 2: Every [X] [Unit] */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#27282e] border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-1.5 flex-1 min-w-0">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Every</span>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={interval}
                    onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-10 bg-transparent text-xs text-center font-bold text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div className="relative flex-1 min-w-0">
                  <select
                    value={freq}
                    onChange={(e) => setFreq(e.target.value)}
                    className="w-full appearance-none bg-slate-100 hover:bg-slate-200/80 dark:bg-[#27282e] dark:hover:bg-[#2d2e35] text-xs text-slate-800 dark:text-slate-200 font-medium px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer pr-7"
                  >
                    <option value="DAILY">{interval === 1 ? 'Day' : 'Days'}</option>
                    <option value="WEEKLY">{interval === 1 ? 'Week' : 'Weeks'}</option>
                    <option value="MONTHLY">{interval === 1 ? 'Month' : 'Months'}</option>
                    <option value="YEARLY">{interval === 1 ? 'Year' : 'Years'}</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Row 3: Weekday Pills (M T W T F S S) */}
              {freq === 'WEEKLY' && (
                <div className="flex items-center justify-between pt-1">
                  {WEEKDAYS.map((day) => {
                    const isSelected = byDays.includes(day.code);
                    return (
                      <button
                        key={day.code}
                        type="button"
                        onClick={() => toggleDay(day.code)}
                        className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white font-bold shadow-xs ring-1 ring-blue-500/30'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                        }`}
                        title={day.full}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Footer: Cancel & OK */}
              <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setView('presets')}
                  className="flex-1 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 dark:text-slate-300 dark:hover:text-white dark:bg-[#27282e] dark:hover:bg-[#2e2f38] dark:border-slate-700/70 rounded-xl transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustom}
                  className="flex-1 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer text-center"
                >
                  OK
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
