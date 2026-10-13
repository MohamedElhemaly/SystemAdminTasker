import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotesStore, STICKY_COLORS } from '../../context/useNotesStore';
import { 
  StickyNote, Plus, Trash2, X, Lock, Check, 
  RefreshCw, Palette, ChevronDown, Sparkles, 
  Clock, Maximize2, Minimize2, GripHorizontal
} from 'lucide-react';

export const StickyNoteWidget = () => {
  const { user, isDemoMode } = useAuth();
  const {
    notes,
    activeNoteId,
    isOpen,
    isSaving,
    lastSavedAt,
    loading,
    setIsOpen,
    toggleOpen,
    setActiveNoteId,
    fetchNotes,
    addNote,
    updateNoteContent,
    updateNoteTitle,
    updateNoteColor,
    deleteNote,
    flushAllPendingSaves
  } = useNotesStore();

  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const textareaRef = useRef(null);

  // Fetch private notes on app load or user change
  useEffect(() => {
    const userId = user?.id || (isDemoMode ? 'demo-user' : null);
    if (userId) {
      fetchNotes(userId, isDemoMode);
    }
  }, [user, isDemoMode]);

  // Current active note
  const activeNote = notes.find(n => n.id === activeNoteId) || notes[0];
  const colorTheme = STICKY_COLORS[activeNote?.color] || STICKY_COLORS.yellow;

  // Handle textarea changes (triggers immediate state update & debounced Supabase sync)
  const handleContentChange = (e) => {
    if (!activeNote) return;
    updateNoteContent(activeNote.id, e.target.value);
  };

  const handleTitleChange = (e) => {
    if (!activeNote) return;
    updateNoteTitle(activeNote.id, e.target.value);
  };

  const handleCreateNew = async () => {
    const newNote = await addNote();
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const handleDelete = (noteId) => {
    if (confirmDeleteId === noteId) {
      deleteNote(noteId);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(noteId);
      setTimeout(() => setConfirmDeleteId(null), 3500);
    }
  };

  return (
    <>
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. Floating Action Trigger Button (Bottom-Right FAB)           */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-20 md:bottom-6 right-5 z-40">
        <button
          type="button"
          onClick={toggleOpen}
          aria-label="Toggle Private Sticky Notes"
          className={`group flex items-center gap-2 px-3.5 py-3 rounded-full shadow-2xl transition-all duration-300 transform active:scale-95 cursor-pointer border ${
            isOpen
              ? 'bg-amber-500 text-white border-amber-400 ring-4 ring-amber-500/30 scale-105'
              : 'bg-gradient-to-tr from-amber-400 to-amber-500 text-amber-950 hover:from-amber-300 hover:to-amber-400 border-amber-300 hover:shadow-amber-500/25 hover:scale-105'
          }`}
          title="Private Sticky Notes (100% Private Scratchpad)"
        >
          <div className="relative">
            <StickyNote className="w-5 h-5 fill-amber-200/50 stroke-[2.2]" />
            {notes.length > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center bg-slate-900 text-white border border-amber-300">
                {notes.length}
              </span>
            )}
          </div>
          <span className="text-xs font-bold tracking-tight hidden sm:inline">
            {isOpen ? 'Close Note' : 'Sticky Notes'}
          </span>
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. Floating Sticky Note Panel                                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isOpen && (
        <div 
          className={`fixed z-50 transition-all duration-200 animate-in zoom-in-95 fade-in ${
            isExpanded
              ? 'inset-4 md:inset-12 flex flex-col'
              : 'bottom-32 md:bottom-20 right-4 md:right-6 w-[340px] sm:w-[380px] max-h-[82vh] flex flex-col'
          }`}
        >
          <div 
            className={`w-full h-full flex flex-col rounded-3xl border-2 shadow-2xl overflow-hidden backdrop-blur-md transition-colors duration-200 ${colorTheme.bgLight} ${colorTheme.bgDark} ${colorTheme.borderLight} ${colorTheme.borderDark} text-slate-800 dark:text-slate-100 ring-1 ring-black/10`}
          >
            {/* Top Tape / Header Bar */}
            <div className={`px-4 py-2.5 flex items-center justify-between border-b ${colorTheme.headerBg} border-black/5 dark:border-white/5 shrink-0 select-none`}>
              
              {/* Privacy Badge & Auto-Save Indicator */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/10 dark:bg-white/10 text-slate-700 dark:text-slate-200">
                  <Lock className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                  <span>Private</span>
                </span>

                {/* Save status */}
                <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  {isSaving ? (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Saving...
                    </span>
                  ) : lastSavedAt ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Check className="w-3 h-3 stroke-[3]" /> Saved
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-1">
                {/* Color Palette Dropdown Trigger */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                    className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                    title="Change note color"
                  >
                    <Palette className="w-4 h-4" />
                  </button>

                  {/* Color Picker Dropdown */}
                  {isColorPickerOpen && (
                    <div className="absolute right-0 top-full mt-1.5 p-2 rounded-2xl bg-white dark:bg-[#1f1f23] shadow-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 z-20 animate-in fade-in zoom-in-95">
                      {Object.values(STICKY_COLORS).map(color => (
                        <button
                          key={color.id}
                          type="button"
                          onClick={() => {
                            if (activeNote) updateNoteColor(activeNote.id, color.id);
                            setIsColorPickerOpen(false);
                          }}
                          className={`w-6 h-6 rounded-full ${color.dot} transition-transform hover:scale-110 cursor-pointer ${
                            activeNote?.color === color.id ? 'ring-2 ring-slate-800 dark:ring-white scale-110' : ''
                          }`}
                          title={color.name}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* New Note Button */}
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title="Create new note"
                >
                  <Plus className="w-4 h-4" />
                </button>

                {/* Expand / Minimize Toggle */}
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer hidden sm:block"
                  title={isExpanded ? 'Minimize' : 'Expand full screen'}
                >
                  {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title="Close and save"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Note Selector Tabs (when multiple notes exist) */}
            {notes.length > 1 && (
              <div className="px-3 pt-2 pb-1.5 flex items-center gap-1.5 overflow-x-auto custom-scrollbar border-b border-black/5 dark:border-white/5 shrink-0">
                {notes.map(note => {
                  const isActive = note.id === activeNote?.id;
                  const noteTheme = STICKY_COLORS[note.color] || STICKY_COLORS.yellow;

                  return (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => setActiveNoteId(note.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        isActive
                          ? 'bg-black/15 dark:bg-white/15 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${noteTheme.dot}`} />
                      <span className="max-w-[100px] truncate">{note.title || 'Untitled'}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Note Body */}
            {activeNote ? (
              <div className="flex-1 flex flex-col p-4 overflow-hidden">
                {/* Note Title Input */}
                <div className="flex items-center justify-between gap-2 pb-2">
                  <input
                    type="text"
                    value={activeNote.title || ''}
                    onChange={handleTitleChange}
                    placeholder="Note title..."
                    className="w-full text-sm font-bold bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder-slate-400/80 font-sans tracking-tight"
                  />

                  {/* Delete Button */}
                  {notes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDelete(activeNote.id)}
                      className={`p-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        confirmDeleteId === activeNote.id
                          ? 'bg-rose-500 text-white px-2 py-0.5 animate-pulse'
                          : 'text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                      title={confirmDeleteId === activeNote.id ? 'Click again to confirm delete' : 'Delete note'}
                    >
                      {confirmDeleteId === activeNote.id ? 'Confirm?' : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                {/* Main Content Area (Autosaving Textarea) */}
                <textarea
                  ref={textareaRef}
                  value={activeNote.content || ''}
                  onChange={handleContentChange}
                  onBlur={flushAllPendingSaves}
                  placeholder="Write a private note, personal to-do, or quick scratchpad idea here... Autosaves as you type!"
                  className="flex-1 w-full bg-transparent resize-none border-none outline-none text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-100 placeholder-slate-400/80 custom-scrollbar font-sans"
                  autoFocus
                />

                {/* Footer Info & Tip */}
                <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 select-none">
                  <span className="truncate">
                    {activeNote.content ? `${activeNote.content.trim().split(/\s+/).filter(Boolean).length} words • ` : ''}
                    {activeNote.content?.length || 0} chars
                  </span>
                  <span className="italic flex items-center gap-1 text-[9.5px]">
                    <Sparkles className="w-3 h-3 text-amber-500/80 shrink-0" />
                    Strictly private to you
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
                <StickyNote className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs">No active notes</p>
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="mt-3 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors cursor-pointer"
                >
                  Create a Note
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
