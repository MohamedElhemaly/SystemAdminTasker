import React, { useState, useRef, useEffect } from 'react';
import { Search, Tag, Users, User, X, Check, Hash } from 'lucide-react';
import { getAvatarUrl } from '../../lib/avatars';

export const SearchAutocomplete = ({
  searchQuery,
  setSearchQuery,
  allUsers = [],
  tags = [],
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeToken, setActiveToken] = useState(null); // { type: 'user' | 'tag', query: string }
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Detect @ or # token under cursor
  const evaluateToken = () => {
    if (!inputRef.current) return;
    const cursorPos = inputRef.current.selectionStart || 0;
    const textBeforeCursor = searchQuery.slice(0, cursorPos);
    const words = textBeforeCursor.split(/\s+/);
    const currentWord = words[words.length - 1] || '';

    if (currentWord.startsWith('@')) {
      setActiveToken({ type: 'user', query: currentWord.slice(1) });
      setIsOpen(true);
      setSelectedIndex(0);
    } else if (currentWord.startsWith('#')) {
      setActiveToken({ type: 'tag', query: currentWord.slice(1) });
      setIsOpen(true);
      setSelectedIndex(0);
    } else {
      setActiveToken(null);
      setIsOpen(false);
    }
  };

  const handleInputChange = (e) => {
    setSearchQuery(e.target.value);
    setTimeout(evaluateToken, 10);
  };

  const handleKeyUp = (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) return;
    evaluateToken();
  };

  // Filter items based on active token
  let filteredItems = [];
  if (activeToken?.type === 'user') {
    const q = activeToken.query.toLowerCase();
    filteredItems = allUsers.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  } else if (activeToken?.type === 'tag') {
    const q = activeToken.query.toLowerCase();
    filteredItems = tags.filter((t) => t.name?.toLowerCase().includes(q));
  }

  const handleSelect = (item) => {
    if (!activeToken || !inputRef.current) return;

    const cursorPos = inputRef.current.selectionStart || searchQuery.length;
    const textBeforeCursor = searchQuery.slice(0, cursorPos);
    const textAfterCursor = searchQuery.slice(cursorPos);

    const lastSpaceIdx = textBeforeCursor.lastIndexOf(' ');
    const replaceStart = lastSpaceIdx === -1 ? 0 : lastSpaceIdx + 1;

    let insertion = '';
    if (activeToken.type === 'user') {
      const nameClean = (item.full_name || item.email).replace(/\s+/g, '_');
      insertion = `@${nameClean} `;
    } else if (activeToken.type === 'tag') {
      const tagClean = item.name.replace(/\s+/g, '_');
      insertion = `#${tagClean} `;
    }

    const newQuery =
      searchQuery.slice(0, replaceStart) +
      insertion +
      textAfterCursor.trimStart();

    setSearchQuery(newQuery);
    setIsOpen(false);

    // Keep focus on input and set cursor after inserted text
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const nextPos = replaceStart + insertion.length;
        inputRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 15);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || filteredItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(
        (prev) => (prev - 1 + filteredItems.length) % filteredItems.length
      );
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (filteredItems[selectedIndex]) {
        e.preventDefault();
        handleSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search tasks... (type @ or #)"
          value={searchQuery}
          onChange={handleInputChange}
          onKeyUp={handleKeyUp}
          onKeyDown={handleKeyDown}
          onFocus={evaluateToken}
          className="pl-8 pr-7 py-1.5 bg-white dark:bg-[#23242a] border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 w-36 sm:w-56 transition-all shadow-xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Floating Suggestions Popover */}
      {isOpen && activeToken && (
        <div className="absolute left-0 mt-1.5 z-50 w-64 sm:w-72 rounded-2xl p-1.5 shadow-2xl border backdrop-blur-md bg-white/95 dark:bg-[#1c1d22]/95 border-slate-200 dark:border-slate-700/80 animate-in fade-in zoom-in-95 duration-150">
          {/* Header indicator */}
          <div className="px-2.5 py-1 mb-1 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
              {activeToken.type === 'user' ? (
                <>
                  <Users className="w-3.5 h-3.5 text-purple-500" />
                  <span>Select Team Member (@)</span>
                </>
              ) : (
                <>
                  <Hash className="w-3.5 h-3.5 text-blue-500" />
                  <span>Select Hashtag (#)</span>
                </>
              )}
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              Press Enter ↵
            </span>
          </div>

          {/* Items List */}
          <div className="max-h-52 overflow-y-auto space-y-0.5 custom-scrollbar">
            {filteredItems.length > 0 ? (
              filteredItems.map((item, idx) => {
                const isSelected = idx === selectedIndex;

                if (activeToken.type === 'user') {
                  const avatarUrl = getAvatarUrl(
                    item.avatar_id,
                    item.full_name || item.email
                  );
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                        isSelected
                          ? 'bg-blue-50 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#272832]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={avatarUrl}
                          alt=""
                          className="w-5 h-5 rounded-full object-cover shrink-0 ring-1 ring-black/10 dark:ring-white/10"
                        />
                        <div className="truncate">
                          <span className="truncate block leading-tight font-medium">
                            {item.full_name || 'User'}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate">
                            {item.email}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 shrink-0 ml-1">
                        @{item.full_name ? item.full_name.split(' ')[0] : 'user'}
                      </span>
                    </button>
                  );
                }

                // Tag Item
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                      isSelected
                        ? 'bg-blue-50 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#272832]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            item.color_hex || item.color || '#3b82f6',
                        }}
                      />
                      <span className="truncate font-semibold">
                        #{item.name}
                      </span>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs text-slate-400 dark:text-slate-500">
                No matching {activeToken.type === 'user' ? 'members' : 'tags'} found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
