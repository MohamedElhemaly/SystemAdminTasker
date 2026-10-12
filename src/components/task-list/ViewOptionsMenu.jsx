import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowUpDown, ChevronRight, ChevronLeft, Check, 
  Calendar, Flag, Folder, Layers, ArrowDownWideNarrow, Type, Clock, 
  ArrowUp, ArrowDown, Ban
} from 'lucide-react';
import { useTasks } from '../../context/TaskContext';

export const ViewOptionsMenu = () => {
  const { groupBy, setGroupBy, sortBy, setSortBy, order, setOrder } = useTasks();
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState(null); // null | 'group' | 'sort' | 'order'
  const menuRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
        setActiveSubmenu(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Labels helper
  const getGroupLabel = () => {
    switch (groupBy) {
      case 'date': return 'Date';
      case 'priority': return 'Priority';
      case 'list': return 'List';
      case 'none': return 'None';
      default: return 'Date';
    }
  };

  const getSortLabel = () => {
    switch (sortBy) {
      case 'date': return 'Date';
      case 'priority': return 'Priority';
      case 'title': return 'Title';
      case 'created_at': return 'Created Date';
      default: return 'Date';
    }
  };

  const getOrderLabel = () => {
    return order === 'asc' ? 'Oldest First' : 'Newest First';
  };

  const groupOptions = [
    { value: 'date', label: 'Date', icon: Calendar },
    { value: 'priority', label: 'Priority', icon: Flag },
    { value: 'list', label: 'List', icon: Folder },
    { value: 'none', label: 'None', icon: Ban },
  ];

  const sortOptions = [
    { value: 'date', label: 'Date', icon: Calendar },
    { value: 'priority', label: 'Priority', icon: Flag },
    { value: 'title', label: 'Title', icon: Type },
    { value: 'created_at', label: 'Created Date', icon: Clock },
  ];

  const orderOptions = [
    { value: 'asc', label: 'Oldest First', icon: ArrowUp, desc: 'Ascending' },
    { value: 'desc', label: 'Newest First', icon: ArrowDown, desc: 'Descending' },
  ];

  return (
    <div ref={menuRef} className="relative inline-block text-left">
      {/* Trigger Toggle Button (Matching ⇅ in screenshot) */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(prev => !prev);
          setActiveSubmenu(null);
        }}
        className={`p-1.5 rounded-xl border transition-all flex items-center justify-center cursor-pointer shadow-xs ${
          isOpen || groupBy !== 'date' || sortBy !== 'date' || order !== 'asc'
            ? 'bg-blue-50 text-blue-600 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40'
            : 'bg-white hover:bg-slate-100 dark:bg-[#23242a] dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border-slate-200 dark:border-slate-700/60'
        }`}
        title="Display & View Options (Group, Sort, Order)"
      >
        <ArrowUpDown className="w-4 h-4" />
      </button>

      {/* Floating Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 z-50 w-60 rounded-2xl p-1.5 shadow-2xl border backdrop-blur-md bg-white/95 dark:bg-[#1c1d22]/95 border-slate-200 dark:border-slate-700/80 animate-in fade-in zoom-in-95 duration-150">
          
          {/* Main Menu View (Exact match to reference image) */}
          {activeSubmenu === null && (
            <div className="space-y-0.5">
              {/* 1. Group by */}
              <button
                type="button"
                onClick={() => setActiveSubmenu('group')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#272832] transition-colors cursor-pointer text-xs group"
              >
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200 font-medium">
                  <Layers className="w-4 h-4 text-slate-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" />
                  <span>Group by</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400 dark:text-slate-400 font-normal">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">{getGroupLabel()}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </button>

              {/* 2. Sort by */}
              <button
                type="button"
                onClick={() => setActiveSubmenu('sort')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#272832] transition-colors cursor-pointer text-xs group"
              >
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200 font-medium">
                  <ArrowDownWideNarrow className="w-4 h-4 text-slate-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" />
                  <span>Sort by</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400 dark:text-slate-400 font-normal">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">{getSortLabel()}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </button>

              {/* 3. Order */}
              <button
                type="button"
                onClick={() => setActiveSubmenu('order')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#272832] transition-colors cursor-pointer text-xs group"
              >
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200 font-medium">
                  <ArrowUpDown className="w-4 h-4 text-slate-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" />
                  <span>Order</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400 dark:text-slate-400 font-normal">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">{getOrderLabel()}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </button>
            </div>
          )}

          {/* Submenu 1: Group By */}
          {activeSubmenu === 'group' && (
            <div className="space-y-1 animate-in slide-in-from-right-3 duration-150">
              <div className="flex items-center gap-2 px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveSubmenu(null)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 cursor-pointer"
                  title="Back"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-bold text-slate-800 dark:text-white">Group by</span>
              </div>
              <div className="space-y-0.5 pt-1">
                {groupOptions.map(opt => {
                  const Icon = opt.icon;
                  const isSelected = groupBy === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setGroupBy(opt.value);
                        setActiveSubmenu(null);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#272832]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4" />
                        <span>{opt.label}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submenu 2: Sort By */}
          {activeSubmenu === 'sort' && (
            <div className="space-y-1 animate-in slide-in-from-right-3 duration-150">
              <div className="flex items-center gap-2 px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveSubmenu(null)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 cursor-pointer"
                  title="Back"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-bold text-slate-800 dark:text-white">Sort by</span>
              </div>
              <div className="space-y-0.5 pt-1">
                {sortOptions.map(opt => {
                  const Icon = opt.icon;
                  const isSelected = sortBy === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setSortBy(opt.value);
                        setActiveSubmenu(null);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#272832]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4" />
                        <span>{opt.label}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submenu 3: Order */}
          {activeSubmenu === 'order' && (
            <div className="space-y-1 animate-in slide-in-from-right-3 duration-150">
              <div className="flex items-center gap-2 px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveSubmenu(null)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 cursor-pointer"
                  title="Back"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-bold text-slate-800 dark:text-white">Order</span>
              </div>
              <div className="space-y-0.5 pt-1">
                {orderOptions.map(opt => {
                  const Icon = opt.icon;
                  const isSelected = order === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setOrder(opt.value);
                        setActiveSubmenu(null);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#272832]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4" />
                        <span>{opt.label}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
