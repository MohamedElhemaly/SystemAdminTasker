import React, { useState, useRef, useEffect } from 'react';
import { Users, User, Check, AlertTriangle, Search, X } from 'lucide-react';
import { getAvatarUrl } from '../../lib/avatars';

export const AssignMembersDropdown = ({
  taskType = 'Personal', // 'Personal' | 'Team'
  selectedUserIds = [],
  onChange,
  allUsers = [],
  buttonClassName = '',
  align = 'left',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  const isTeam = typeof taskType === 'string' && taskType.toLowerCase().includes('team');

  // Handle outside click to dismiss
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleUser = (userId) => {
    if (!onChange) return;
    if (selectedUserIds.includes(userId)) {
      onChange(selectedUserIds.filter(id => id !== userId));
    } else {
      onChange([...selectedUserIds, userId]);
    }
  };

  const handleSelectAll = () => {
    if (!onChange) return;
    const allIds = allUsers.map(u => u.id || u.user_id);
    onChange(allIds);
  };

  const handleClearAll = () => {
    if (!onChange) return;
    onChange([]);
  };

  // Filter members by search query
  const filteredUsers = allUsers.filter(u => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = (u.full_name || '').toLowerCase().includes(q);
    const emailMatch = (u.email || '').toLowerCase().includes(q);
    return nameMatch || emailMatch;
  });

  // Dynamic Trigger Button Label
  const getButtonLabel = () => {
    const count = selectedUserIds.length;
    if (isTeam) {
      if (count === 0) return '⚠️ Select for Acknowledgement (Required)';
      if (count === 1) return '1 for Acknowledgement';
      return `${count} for Acknowledgement`;
    } else {
      if (count === 0) return 'Assign Members';
      if (count === 1) {
        const single = allUsers.find(u => (u.id || u.user_id) === selectedUserIds[0]);
        return single ? `Assigned: ${single.full_name?.split(' ')[0] || single.email?.split('@')[0]}` : '1 Member Assigned';
      }
      return `${count} Members Assigned`;
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* ── Trigger Button ── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-xs ${
          disabled ? 'opacity-60 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
        } ${
          isTeam && selectedUserIds.length === 0
            ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/50 font-bold animate-pulse'
            : selectedUserIds.length > 0
            ? isTeam
              ? 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/40'
              : 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40'
            : 'bg-white hover:bg-slate-50 dark:bg-[#1f2026] dark:hover:bg-[#25262e] border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300'
        } ${buttonClassName}`}
        title={isTeam ? 'Select members who must acknowledge this team task' : 'Assign members to this personal task'}
      >
        <Users className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate max-w-[200px]">{getButtonLabel()}</span>
      </button>

      {/* ── Multi-Select Popover Dropdown ── */}
      {isOpen && (
        <div 
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 w-80 p-2.5 rounded-2xl bg-white dark:bg-[#1c1d22] backdrop-blur-md border border-slate-200 dark:border-slate-700/80 shadow-2xl z-50 space-y-2.5 animate-in fade-in zoom-in-95 duration-150 select-none`}
        >
          {/* Header Row: Title & Done button */}
          <div className="px-1 pt-0.5 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                {isTeam ? 'Select for Acknowledgement' : 'Assign Team Members'}
              </span>
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                isTeam 
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' 
                  : 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
              }`}>
                {isTeam ? 'Team' : 'Personal'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
            >
              Done
            </button>
          </div>

          {/* Context Explainer / Team Warning */}
          {isTeam ? (
            <div className={`p-2 rounded-xl text-[11px] leading-relaxed ${
              selectedUserIds.length === 0
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
                : 'bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50'
            }`}>
              {selectedUserIds.length === 0 ? (
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>At least 1 member is required for Team tasks!</span>
                </div>
              ) : (
                <span>Tagged members will be required to acknowledge and complete this task before it can be closed.</span>
              )}
            </div>
          ) : (
            <p className="px-1 text-[11px] text-slate-500 dark:text-slate-400">
              Select one or multiple members to assign this personal task to.
            </p>
          )}

          {/* Search Filter Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter members..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 dark:bg-[#25262e] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Quick Selection Shortcuts */}
          <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span>{selectedUserIds.length} of {allUsers.length} selected</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="hover:text-blue-600 dark:hover:text-blue-400 font-medium cursor-pointer"
              >
                Select all
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="hover:text-rose-600 dark:hover:text-rose-400 font-medium cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Members List with Checkboxes */}
          <div className="max-h-56 overflow-y-auto space-y-1 p-0.5 custom-scrollbar">
            {filteredUsers.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No matching members found
              </div>
            ) : (
              filteredUsers.map((m) => {
                const uid = m.id || m.user_id;
                const isSelected = selectedUserIds.includes(uid);
                const avatarUrl = getAvatarUrl(m.avatar_id, m.full_name || m.email);

                return (
                  <div
                    key={uid}
                    onClick={() => toggleUser(uid)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer group ${
                      isSelected
                        ? isTeam
                          ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-900 dark:text-indigo-200 font-medium'
                          : 'bg-purple-50 dark:bg-purple-500/20 text-purple-900 dark:text-purple-200 font-medium'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#25262e]'
                    }`}
                  >
                    {/* Left: Avatar + Details */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <img
                        src={avatarUrl}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover shrink-0 ring-1 ring-black/10 dark:ring-white/10"
                      />
                      <div className="truncate text-left flex-1 min-w-0">
                        <span className="truncate block leading-tight font-medium">
                          {m.full_name || 'Member'}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate">
                          {m.email}
                        </span>
                      </div>
                    </div>

                    {/* Right: Multi-Select Checkbox */}
                    <div className="shrink-0 ml-2">
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                        isSelected
                          ? isTeam
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-purple-600 border-purple-600 text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-[#23242a] group-hover:border-slate-400'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
