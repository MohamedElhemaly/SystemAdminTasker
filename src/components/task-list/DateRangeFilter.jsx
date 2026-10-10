import React, { useState, useRef, useEffect } from 'react';
import { 
  CalendarRange, Calendar, X, ArrowRight, Check, RotateCcw, ChevronDown, Filter 
} from 'lucide-react';
import { format, addDays, startOfMonth, endOfMonth, parseISO } from 'date-fns';

export const DateRangeFilter = ({
  startDate,
  endDate,
  onDateChange,
  dateField = 'due_date',
  onDateFieldChange,
  activeMatchesCount = null,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const hasActiveFilter = Boolean(startDate || endDate);

  const handleClear = () => {
    onDateChange({ start: '', end: '' });
  };

  const setPreset = (preset) => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');

    if (preset === 'today') {
      onDateChange({ start: todayStr, end: todayStr });
    } else if (preset === 'tomorrow') {
      const tomStr = format(addDays(now, 1), 'yyyy-MM-dd');
      onDateChange({ start: tomStr, end: tomStr });
    } else if (preset === 'next7') {
      const endStr = format(addDays(now, 7), 'yyyy-MM-dd');
      onDateChange({ start: todayStr, end: endStr });
    } else if (preset === 'thisMonth') {
      const startStr = format(startOfMonth(now), 'yyyy-MM-dd');
      const endStr = format(endOfMonth(now), 'yyyy-MM-dd');
      onDateChange({ start: startStr, end: endStr });
    } else if (preset === 'clear') {
      handleClear();
    }
  };

  const formatButtonLabel = () => {
    if (!startDate && !endDate) {
      return 'Date Filter';
    }

    const formatShort = (dateStr) => {
      try {
        return format(parseISO(dateStr), 'MMM d');
      } catch {
        return dateStr;
      }
    };

    if (startDate && endDate) {
      if (startDate === endDate) return formatShort(startDate);
      return `${formatShort(startDate)} → ${formatShort(endDate)}`;
    }
    if (startDate) return `From ${formatShort(startDate)}`;
    return `Until ${formatShort(endDate)}`;
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      {/* Trigger Button */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none shadow-xs outline-none ${
            hasActiveFilter
              ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40 shadow-xs'
              : 'bg-white hover:bg-slate-50 dark:bg-[#23242a] dark:hover:bg-[#2a2b33] border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300'
          }`}
          title="Filter tasks by date range"
        >
          <CalendarRange className={`w-3.5 h-3.5 shrink-0 ${hasActiveFilter ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
          
          <span className="truncate max-w-[130px] sm:max-w-[180px]">
            {formatButtonLabel()}
          </span>

          {hasActiveFilter && activeMatchesCount !== null && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-blue-600 text-white dark:bg-blue-500">
              {activeMatchesCount}
            </span>
          )}

          <ChevronDown
            className={`w-3 h-3 shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
            }`}
          />
        </button>

        {/* Quick Clear 'X' on button when active */}
        {hasActiveFilter && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="ml-1 p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Clear date filter"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Floating Date Range Popover */}
      {isOpen && (
        <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 z-50 w-72 sm:w-80 rounded-2xl p-3.5 shadow-2xl border backdrop-blur-md bg-white/95 dark:bg-[#1c1d22]/95 border-slate-200 dark:border-slate-700/80 animate-in fade-in zoom-in-95 duration-150 space-y-3">
          
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-white">
              <Calendar className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              <span>Filter by Date Range</span>
            </div>
            
            {hasActiveFilter && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-red-500 dark:text-red-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Target Date Field Switcher (Due Date vs Created Date) */}
          <div className="flex items-center justify-between text-xs p-1 bg-slate-100 dark:bg-[#25262f] rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => onDateFieldChange?.('due_date')}
              className={`flex-1 py-1 rounded-lg font-semibold text-[11px] transition-all cursor-pointer ${
                dateField === 'due_date'
                  ? 'bg-white dark:bg-[#1c1d22] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Due Date
            </button>
            <button
              type="button"
              onClick={() => onDateFieldChange?.('created_at')}
              className={`flex-1 py-1 rounded-lg font-semibold text-[11px] transition-all cursor-pointer ${
                dateField === 'created_at'
                  ? 'bg-white dark:bg-[#1c1d22] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Created Date
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
              Quick Presets
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setPreset('today')}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-[#25262f] dark:hover:bg-[#2e2f3a] text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setPreset('tomorrow')}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-[#25262f] dark:hover:bg-[#2e2f3a] text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setPreset('next7')}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-[#25262f] dark:hover:bg-[#2e2f3a] text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
              >
                Next 7d
              </button>
              <button
                type="button"
                onClick={() => setPreset('thisMonth')}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-[#25262f] dark:hover:bg-[#2e2f3a] text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
              >
                Month
              </button>
            </div>
          </div>

          {/* Start and End Date Inputs */}
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate || ''}
                  onChange={(e) => onDateChange({ start: e.target.value, end: endDate })}
                  className="w-full px-2 py-1.5 bg-slate-50 dark:bg-[#25262f] border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 shadow-xs cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate || ''}
                  onChange={(e) => onDateChange({ start: startDate, end: e.target.value })}
                  className="w-full px-2 py-1.5 bg-slate-50 dark:bg-[#25262f] border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 shadow-xs cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Summary / Done Footer */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {hasActiveFilter ? 'Filter actively applied' : 'Choose date range'}
            </span>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              Done
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
