import React, { useState, useEffect } from 'react';
import { RotateCw, X, ChevronDown } from 'lucide-react';
import { WEEKDAYS, parseRRule, buildRRule, getDayCode } from '../../lib/rruleHelper';

export const CustomRepeatModal = ({
  isOpen,
  onClose,
  initialRule,
  dueDate,
  onSave
}) => {
  const [freq, setFreq] = useState('WEEKLY');
  const [interval, setInterval] = useState(1);
  const [byDays, setByDays] = useState(['SU']);
  const [mode, setMode] = useState('due_date');

  useEffect(() => {
    if (isOpen) {
      const parsed = parseRRule(initialRule, dueDate);
      setFreq(parsed.freq || 'WEEKLY');
      setInterval(parsed.interval || 1);
      setByDays(parsed.byDays && parsed.byDays.length > 0 ? parsed.byDays : [getDayCode(dueDate || new Date())]);
      setMode(parsed.mode || 'due_date');
    }
  }, [isOpen, initialRule, dueDate]);

  if (!isOpen) return null;

  const toggleDay = (code) => {
    setByDays(prev => {
      if (prev.includes(code)) {
        if (prev.length === 1) return prev;
        return prev.filter(d => d !== code);
      } else {
        return [...prev, code];
      }
    });
  };

  const handleSave = () => {
    const generated = buildRRule({
      freq,
      interval,
      byDays: freq === 'WEEKLY' ? byDays : [],
      mode
    });
    onSave(generated);
    onClose();
  };

  const getSummaryTitle = () => {
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

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-[290px] bg-white text-slate-800 border-slate-200 dark:bg-[#1e1e22] dark:text-slate-100 dark:border-slate-700/80 rounded-2xl p-4 shadow-2xl border space-y-3.5 select-none animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <RotateCw className="w-4 h-4 text-blue-500 shrink-0" />
            <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400 truncate">
              {getSummaryTitle()}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Row 1: Mode Dropdown */}
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

        {/* Row 3: Weekday selector pills (M T W T F S S) */}
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
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
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

        {/* Actions (Cancel & OK) */}
        <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 dark:text-slate-300 dark:hover:text-white dark:bg-[#27282e] dark:hover:bg-[#2e2f38] dark:border-slate-700/70 rounded-xl transition-colors cursor-pointer text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer text-center"
          >
            OK
          </button>
        </div>

      </div>
    </div>
  );
};
