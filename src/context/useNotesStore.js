import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Helper: safe local storage retrieval
const getLocalStorageNotes = (userId) => {
  try {
    const raw = localStorage.getItem(`tasker_private_notes_${userId || 'demo'}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// Helper: safe local storage write
const setLocalStorageNotes = (userId, notes) => {
  try {
    localStorage.setItem(`tasker_private_notes_${userId || 'demo'}`, JSON.stringify(notes));
  } catch {}
};

// Available sticky note color presets
export const STICKY_COLORS = {
  yellow: {
    id: 'yellow',
    name: 'Classic Yellow',
    bgLight: 'bg-amber-100',
    bgDark: 'dark:bg-[#2c2616]',
    borderLight: 'border-amber-300',
    borderDark: 'dark:border-amber-700/60',
    headerBg: 'bg-amber-200/80 dark:bg-amber-900/40',
    dot: 'bg-amber-400',
    accentText: 'text-amber-800 dark:text-amber-300'
  },
  mint: {
    id: 'mint',
    name: 'Pastel Mint',
    bgLight: 'bg-emerald-100',
    bgDark: 'dark:bg-[#15291e]',
    borderLight: 'border-emerald-300',
    borderDark: 'dark:border-emerald-700/60',
    headerBg: 'bg-emerald-200/80 dark:bg-emerald-900/40',
    dot: 'bg-emerald-400',
    accentText: 'text-emerald-800 dark:text-emerald-300'
  },
  sky: {
    id: 'sky',
    name: 'Sky Blue',
    bgLight: 'bg-sky-100',
    bgDark: 'dark:bg-[#162536]',
    borderLight: 'border-sky-300',
    borderDark: 'dark:border-sky-700/60',
    headerBg: 'bg-sky-200/80 dark:bg-sky-900/40',
    dot: 'bg-sky-400',
    accentText: 'text-sky-800 dark:text-sky-300'
  },
  peach: {
    id: 'peach',
    name: 'Soft Peach',
    bgLight: 'bg-rose-100',
    bgDark: 'dark:bg-[#2d1a20]',
    borderLight: 'border-rose-300',
    borderDark: 'dark:border-rose-700/60',
    headerBg: 'bg-rose-200/80 dark:bg-rose-900/40',
    dot: 'bg-rose-400',
    accentText: 'text-rose-800 dark:text-rose-300'
  },
  lavender: {
    id: 'lavender',
    name: 'Lavender',
    bgLight: 'bg-purple-100',
    bgDark: 'dark:bg-[#261933]',
    borderLight: 'border-purple-300',
    borderDark: 'dark:border-purple-700/60',
    headerBg: 'bg-purple-200/80 dark:bg-purple-900/40',
    dot: 'bg-purple-400',
    accentText: 'text-purple-800 dark:text-purple-300'
  }
};

// Debounce map for in-flight updates
const debounceTimers = new Map();

export const useNotesStore = create((set, get) => ({
  notes: [],
  activeNoteId: null,
  isOpen: false,
  isSaving: false,
  lastSavedAt: null,
  loading: false,
  currentUserId: null,

  // UI state toggles
  setIsOpen: (isOpen) => {
    // If closing, flush any pending saves
    if (!isOpen) {
      get().flushAllPendingSaves();
    }
    set({ isOpen });
  },
  
  toggleOpen: () => {
    const current = get().isOpen;
    if (current) {
      get().flushAllPendingSaves();
    }
    set({ isOpen: !current });
  },

  setActiveNoteId: (id) => {
    get().flushAllPendingSaves();
    set({ activeNoteId: id });
  },

  // Initial Fetch: Load user's private notes from Supabase or fallback to LocalStorage
  fetchNotes: async (userId, isDemoMode = false) => {
    if (!userId) return;
    set({ loading: true, currentUserId: userId });

    const localNotes = getLocalStorageNotes(userId);

    // 1. If in Demo Mode or Supabase is not configured, load from localStorage
    if (isDemoMode || !isSupabaseConfigured()) {
      if (localNotes && localNotes.length > 0) {
        set({ 
          notes: localNotes, 
          activeNoteId: localNotes[0]?.id || null, 
          loading: false 
        });
      } else {
        // Create initial default note
        const welcomeNote = {
          id: 'note-' + Math.random().toString(36).substr(2, 9),
          user_id: userId,
          title: 'Quick Scratchpad',
          content: '📌 Welcome to your strictly private Sticky Notes!\n\n• Notes here are 100% private to your account (managers cannot see them).\n• Autosaves as you type.\n• Create multiple notes or pick colors!',
          color: 'yellow',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        const initial = [welcomeNote];
        setLocalStorageNotes(userId, initial);
        set({ notes: initial, activeNoteId: welcomeNote.id, loading: false });
      }
      return;
    }

    // 2. Fetch from Supabase
    try {
      const { data, error } = await supabase
        .from('private_notes')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.warn('Could not query private_notes from Supabase (falling back to local storage):', error.message);
        // Fallback to local storage
        if (localNotes && localNotes.length > 0) {
          set({ notes: localNotes, activeNoteId: localNotes[0]?.id || null, loading: false });
        } else {
          const welcomeNote = {
            id: 'note-' + Math.random().toString(36).substr(2, 9),
            user_id: userId,
            title: 'Quick Scratchpad',
            content: '📌 Welcome to your strictly private Sticky Notes!\n\n• Notes here are 100% private to your account (managers cannot see them).\n• Autosaves as you type.\n• Pick colors and jot down quick thoughts!',
            color: 'yellow',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          set({ notes: [welcomeNote], activeNoteId: welcomeNote.id, loading: false });
          setLocalStorageNotes(userId, [welcomeNote]);
        }
        return;
      }

      if (data && data.length > 0) {
        set({ 
          notes: data, 
          activeNoteId: data[0].id, 
          loading: false 
        });
        setLocalStorageNotes(userId, data);
      } else {
        // No notes in DB: create an initial note in Supabase
        const newNotePayload = {
          user_id: userId,
          title: 'Quick Scratchpad',
          content: '📌 Welcome to your strictly private Sticky Notes!\n\n• Notes here are 100% private to your account (managers cannot see them).\n• Autosaves as you type.\n• Pick colors and jot down quick thoughts!',
          color: 'yellow'
        };

        const { data: inserted, error: insertErr } = await supabase
          .from('private_notes')
          .insert(newNotePayload)
          .select()
          .single();

        if (!insertErr && inserted) {
          set({ notes: [inserted], activeNoteId: inserted.id, loading: false });
          setLocalStorageNotes(userId, [inserted]);
        } else {
          // If insert fails (e.g. table not yet run), use fallback
          const localFallback = {
            id: 'note-' + Math.random().toString(36).substr(2, 9),
            user_id: userId,
            ...newNotePayload,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          set({ notes: [localFallback], activeNoteId: localFallback.id, loading: false });
          setLocalStorageNotes(userId, [localFallback]);
        }
      }
    } catch (err) {
      console.warn('private_notes error:', err);
      set({ notes: localNotes || [], activeNoteId: localNotes?.[0]?.id || null, loading: false });
    }
  },

  // Create a new note
  addNote: async (customData = {}) => {
    const { notes, currentUserId } = get();
    const newNote = {
      id: 'note-' + Math.random().toString(36).substr(2, 9),
      user_id: currentUserId || 'demo',
      title: customData.title || `Note #${notes.length + 1}`,
      content: customData.content || '',
      color: customData.color || 'yellow',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Optimistically prepend note
    const updatedNotes = [newNote, ...notes];
    set({ notes: updatedNotes, activeNoteId: newNote.id, isOpen: true });
    setLocalStorageNotes(currentUserId, updatedNotes);

    if (isSupabaseConfigured() && currentUserId && currentUserId !== 'demo') {
      try {
        const { data, error } = await supabase
          .from('private_notes')
          .insert({
            user_id: currentUserId,
            title: newNote.title,
            content: newNote.content,
            color: newNote.color
          })
          .select()
          .single();

        if (!error && data) {
          // Replace temporary id with real Supabase uuid
          set(state => ({
            notes: state.notes.map(n => n.id === newNote.id ? data : n),
            activeNoteId: data.id
          }));
          setLocalStorageNotes(currentUserId, get().notes);
        }
      } catch (err) {
        console.warn('Error inserting private_note to Supabase:', err);
      }
    }

    return newNote;
  },

  // Debounced Auto-Save for Note Content & Title
  updateNoteContent: (noteId, newContent) => {
    const { notes, currentUserId } = get();
    const updatedTime = new Date().toISOString();

    // 1. Immediately update local state & localStorage (zero UI lag)
    const updatedNotes = notes.map(n => 
      n.id === noteId ? { ...n, content: newContent, updated_at: updatedTime } : n
    );
    set({ notes: updatedNotes, isSaving: true });
    setLocalStorageNotes(currentUserId, updatedNotes);

    // 2. Debounce sync to Supabase (750ms)
    if (debounceTimers.has(`content_${noteId}`)) {
      clearTimeout(debounceTimers.get(`content_${noteId}`));
    }

    const timer = setTimeout(async () => {
      debounceTimers.delete(`content_${noteId}`);
      if (isSupabaseConfigured() && currentUserId && currentUserId !== 'demo' && !noteId.startsWith('note-')) {
        try {
          const { error } = await supabase
            .from('private_notes')
            .update({ content: newContent, updated_at: new Date().toISOString() })
            .eq('id', noteId);

          if (error) throw error;
        } catch (err) {
          console.warn('Debounced save error:', err);
        }
      }
      set({ isSaving: false, lastSavedAt: new Date() });
    }, 750);

    debounceTimers.set(`content_${noteId}`, timer);
  },

  updateNoteTitle: (noteId, newTitle) => {
    const { notes, currentUserId } = get();
    const updatedTime = new Date().toISOString();

    const updatedNotes = notes.map(n => 
      n.id === noteId ? { ...n, title: newTitle, updated_at: updatedTime } : n
    );
    set({ notes: updatedNotes, isSaving: true });
    setLocalStorageNotes(currentUserId, updatedNotes);

    if (debounceTimers.has(`title_${noteId}`)) {
      clearTimeout(debounceTimers.get(`title_${noteId}`));
    }

    const timer = setTimeout(async () => {
      debounceTimers.delete(`title_${noteId}`);
      if (isSupabaseConfigured() && currentUserId && currentUserId !== 'demo' && !noteId.startsWith('note-')) {
        try {
          await supabase
            .from('private_notes')
            .update({ title: newTitle, updated_at: new Date().toISOString() })
            .eq('id', noteId);
        } catch (err) {
          console.warn('Title update error:', err);
        }
      }
      set({ isSaving: false, lastSavedAt: new Date() });
    }, 750);

    debounceTimers.set(`title_${noteId}`, timer);
  },

  updateNoteColor: async (noteId, newColor) => {
    const { notes, currentUserId } = get();
    const updatedNotes = notes.map(n => 
      n.id === noteId ? { ...n, color: newColor, updated_at: new Date().toISOString() } : n
    );
    set({ notes: updatedNotes });
    setLocalStorageNotes(currentUserId, updatedNotes);

    if (isSupabaseConfigured() && currentUserId && !noteId.startsWith('note-')) {
      try {
        await supabase
          .from('private_notes')
          .update({ color: newColor, updated_at: new Date().toISOString() })
          .eq('id', noteId);
      } catch (err) {
        console.warn('Color update error:', err);
      }
    }
  },

  // Delete note
  deleteNote: async (noteId) => {
    const { notes, activeNoteId, currentUserId } = get();
    const remaining = notes.filter(n => n.id !== noteId);
    
    // Choose next active note
    let nextActiveId = activeNoteId;
    if (activeNoteId === noteId) {
      nextActiveId = remaining.length > 0 ? remaining[0].id : null;
    }

    set({ notes: remaining, activeNoteId: nextActiveId });
    setLocalStorageNotes(currentUserId, remaining);

    if (isSupabaseConfigured() && currentUserId && !noteId.startsWith('note-')) {
      try {
        await supabase
          .from('private_notes')
          .delete()
          .eq('id', noteId);
      } catch (err) {
        console.warn('Error deleting note from Supabase:', err);
      }
    }
  },

  // Flush any in-flight timers immediately (on blur or closing)
  flushAllPendingSaves: async () => {
    if (debounceTimers.size === 0) return;
    
    debounceTimers.forEach((timer) => clearTimeout(timer));
    debounceTimers.clear();

    const { notes, currentUserId, activeNoteId } = get();
    const activeNote = notes.find(n => n.id === activeNoteId);
    
    if (activeNote && isSupabaseConfigured() && currentUserId && !activeNote.id.startsWith('note-')) {
      try {
        await supabase
          .from('private_notes')
          .update({ 
            content: activeNote.content, 
            title: activeNote.title, 
            color: activeNote.color,
            updated_at: new Date().toISOString() 
          })
          .eq('id', activeNote.id);
      } catch (err) {
        console.warn('Flush error:', err);
      }
    }
    set({ isSaving: false, lastSavedAt: new Date() });
  }
}));
