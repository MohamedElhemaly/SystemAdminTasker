import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

/**
 * ModernDropdown - Ultra-modern, responsive custom select dropdown
 * Supports light and dark modes, color dots, avatars, icons, subtexts, and smooth animations.
 */
export const ModernDropdown = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  prefix = '',
  icon: Icon,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  labelClassName = '',
  align = 'left', // 'left' | 'right'
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Search...',
  fullWidth = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close when clicking outside
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

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen, searchable]);

  const selectedOption = options.find((opt) => {
    if (value === null || value === undefined || value === '') {
      return opt.value === null || opt.value === undefined || opt.value === '';
    }
    return String(opt.value) === String(value);
  });

  const filteredOptions = searchable && searchTerm.trim()
    ? options.filter((opt) => opt.label?.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  const handleSelect = (optValue) => {
    onChange(optValue);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${fullWidth ? 'w-full' : 'inline-block'} text-left ${className}`}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none outline-none ${
          fullWidth ? 'w-full' : ''
        } ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-slate-50 dark:bg-[#25262f] shadow-xs'
            : 'bg-white hover:bg-slate-50 dark:bg-[#1f2026] dark:hover:bg-[#25262e] border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 shadow-xs'
        } ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Leading Icon or Color Dot or Avatar */}
          {selectedOption?.avatarUrl ? (
            <img
              src={selectedOption.avatarUrl}
              alt=""
              className="w-4 h-4 rounded-full object-cover shrink-0 ring-1 ring-black/10 dark:ring-white/10"
            />
          ) : selectedOption?.color ? (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-black/5 dark:ring-white/10 shadow-xs"
              style={{ backgroundColor: selectedOption.color }}
            />
          ) : selectedOption?.icon ? (
            <selectedOption.icon className="w-3.5 h-3.5 shrink-0 text-slate-500 dark:text-slate-400 group-hover:text-blue-500" />
          ) : Icon ? (
            <Icon className="w-3.5 h-3.5 shrink-0 text-slate-500 dark:text-slate-400 group-hover:text-blue-500" />
          ) : null}

          {/* Text Label */}
          <span className={`truncate text-slate-800 dark:text-slate-200 ${labelClassName || 'max-w-[130px]'}`}>
            {prefix && <span className="text-slate-400 dark:text-slate-500 font-normal mr-1">{prefix}</span>}
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        {/* Chevron Indicator */}
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ml-1 ${
            isOpen
              ? 'rotate-180 text-blue-600 dark:text-blue-400'
              : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
          }`}
        />
      </button>

      {/* Floating Menu Popover */}
      {isOpen && (
        <div
          className={`absolute mt-1.5 z-50 ${
            fullWidth ? 'w-full min-w-[200px]' : 'min-w-[180px] max-w-[280px]'
          } rounded-2xl p-1.5 shadow-xl border backdrop-blur-md bg-white/95 dark:bg-[#1c1d22]/95 border-slate-200 dark:border-slate-700/80 animate-in fade-in zoom-in-95 duration-150 ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${menuClassName}`}
        >
          {/* Optional Search Input */}
          {searchable && (
            <div className="p-1 mb-1 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 dark:bg-[#25262f] rounded-lg border border-slate-200/80 dark:border-slate-700/70">
                <Search className="w-3 h-3 text-slate-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full bg-transparent text-[11px] text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 font-bold shadow-xs'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#272832] hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Avatar */}
                      {opt.avatarUrl ? (
                        <img
                          src={opt.avatarUrl}
                          alt=""
                          className="w-4 h-4 rounded-full object-cover shrink-0 ring-1 ring-black/10 dark:ring-white/10"
                        />
                      ) : opt.color ? (
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-black/5 dark:ring-white/10"
                          style={{ backgroundColor: opt.color }}
                        />
                      ) : opt.icon ? (
                        <opt.icon
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
                          }`}
                        />
                      ) : null}

                      <div className="truncate min-w-0">
                        <span className="truncate block leading-tight">{opt.label}</span>
                        {opt.subtext && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate">
                            {opt.subtext}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {opt.badge && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 stroke-[2.5]" />
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-3 text-center text-[11px] text-slate-400">
                No matching options
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
