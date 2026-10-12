import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured, createIsolatedClient } from '../lib/supabase';
import { isToday, isTomorrow, isPast, isWithinInterval, addDays, startOfDay, endOfDay, parseISO, format } from 'date-fns';
import { getNextOccurrence } from '../lib/rruleHelper';
import { calculateNextReminderAt } from '../lib/reminderHelper';
import toast from 'react-hot-toast';

const TaskContext = createContext({});

// ─────────────────────────────────────────────────────
// Static System Smart Lists (never persisted / never change)
// ─────────────────────────────────────────────────────
const SYSTEM_SMART_LISTS = [
  { id: 'list-all', name: 'All', color: '#3b82f6', icon: 'layers', is_smart: true },
  { id: 'list-today', name: 'Today', color: '#10b981', icon: 'today', is_smart: true },
  { id: 'list-next7', name: 'Next 7 Days', color: '#8b5cf6', icon: 'calendar', is_smart: true },
  { id: 'list-assigned-me', name: 'Assigned to me', color: '#f59e0b', icon: 'user', is_smart: true }
];

// ─────────────────────────────────────────────────────
// Default Seed Data (used for initial state & demo mode)
// ─────────────────────────────────────────────────────
const DEFAULT_PRIORITIES = [
  { id: 'p-1', name: 'None', color_hex: '#94a3b8', level_order: 0 },
  { id: 'p-2', name: 'Low', color_hex: '#3b82f6', level_order: 1 },
  { id: 'p-3', name: 'Medium', color_hex: '#eab308', level_order: 2 },
  { id: 'p-4', name: 'High', color_hex: '#ef4444', level_order: 3 }
];

const DEFAULT_STATUSES = [
  { id: 'st-1', name: 'To Do', color_hex: '#3b82f6', is_completed_state: false },
  { id: 'st-2', name: 'In Progress', color_hex: '#eab308', is_completed_state: false },
  { id: 'st-3', name: 'In Review', color_hex: '#8b5cf6', is_completed_state: false },
  { id: 'st-4', name: 'Completed', color_hex: '#10b981', is_completed_state: true }
];

const DEFAULT_TASK_TYPES = [
  { id: 'tt-1', name: 'Personal', color_hex: '#3b82f6', description: 'Standard task' },
  { id: 'tt-2', name: 'Team Task', color_hex: '#ec4899', description: 'Mandatory acknowledgement task' },
  { id: 'tt-3', name: 'Urgent Review', color_hex: '#ef4444', description: 'High-priority management review' },
  { id: 'tt-4', name: 'Deployment', color_hex: '#8b5cf6', description: 'K8s release' }
];

const DEFAULT_TAGS = [
  { id: 'tag-1', name: 'Production', color_hex: '#ef4444' },
  { id: 'tag-2', name: 'Backend', color_hex: '#3b82f6' },
  { id: 'tag-3', name: 'Security', color_hex: '#8b5cf6' }
];

const DEFAULT_USERS = [
  { id: 'usr-1', email: 'manager@ticktick-team.com', full_name: 'Mohamed El-hemaly', avatar_id: 'avatar-11', role: 'manager' },
  { id: 'usr-2', email: 'sarah.c@ticktick-team.com', full_name: 'Sarah Connor', avatar_id: 'avatar-16', role: 'sub_manager' },
  { id: 'usr-3', email: 'omar.f@ticktick-team.com', full_name: 'Omar Farooq', avatar_id: 'avatar-12', role: 'deputy_manager' },
  { id: 'usr-4', email: 'alex.k@ticktick-team.com', full_name: 'Alex Kumar', avatar_id: 'avatar-14', role: 'member' },
  { id: 'usr-5', email: 'elena.r@ticktick-team.com', full_name: 'Elena Rostova', avatar_id: 'avatar-17', role: 'member' },
  { id: 'usr-6', email: 'david.b@ticktick-team.com', full_name: 'David Beckham', avatar_id: 'avatar-15', role: 'member' }
];

// Tracks whether the 'status' and dual approval columns are present on public.tasks in Supabase
let isStatusColumnSupported = null;
let isDualApprovalSupported = null;

// Helper: purge any legacy sample/mockup tasks from localStorage caches
const purgeMockTasksFromStorage = () => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('tasker_store_')) {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          if (Array.isArray(parsed.tasks)) {
            const cleaned = parsed.tasks.filter(t => !t.id?.startsWith('sample-task-'));
            if (cleaned.length !== parsed.tasks.length) {
              localStorage.setItem(key, JSON.stringify({ ...parsed, tasks: cleaned }));
            }
          }
        }
      }
    }
  } catch { }
};
purgeMockTasksFromStorage();

const getDefaultDemoTasks = () => [];

// Helper: generate a unique localStorage key per user
const getStoreKey = (userId) => `tasker_store_${userId || 'anonymous'}`;

// Helper: persistently track deleted user IDs / emails so default users stay deleted
const getDeletedUserIds = () => {
  try {
    return JSON.parse(localStorage.getItem('tasker_deleted_user_ids') || '[]');
  } catch {
    return [];
  }
};

export const TaskProvider = ({ children }) => {
  const { user, profile, isDemoMode, registerLogoutHandler, isAuthenticated } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [lists, setLists] = useState(SYSTEM_SMART_LISTS);
  const [teams, setTeams] = useState([]);
  const [allUsers, setAllUsers] = useState(() => {
    const deleted = getDeletedUserIds();
    return DEFAULT_USERS.filter(u => !deleted.includes(u.id) && !deleted.includes(u.email?.toLowerCase()));
  });

  // Dynamic Dropdowns Global State
  const [dropdownPriorities, setDropdownPriorities] = useState(DEFAULT_PRIORITIES);
  const [dropdownStatuses, setDropdownStatuses] = useState(DEFAULT_STATUSES);
  const [dropdownTaskTypes, setDropdownTaskTypes] = useState(DEFAULT_TASK_TYPES);
  const [dropdownTags, setDropdownTags] = useState(DEFAULT_TAGS);

  const [selectedListId, setSelectedListId] = useState('list-all');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [loading, setLoading] = useState(false);

  // View Options Preferences (Group by, Sort by, Order)
  const [groupBy, setGroupBy] = useState(() => {
    try {
      return localStorage.getItem('tasker_view_groupBy') || 'date';
    } catch {
      return 'date';
    }
  });

  const [sortBy, setSortBy] = useState(() => {
    try {
      return localStorage.getItem('tasker_view_sortBy') || 'date';
    } catch {
      return 'date';
    }
  });

  const [order, setOrder] = useState(() => {
    try {
      return localStorage.getItem('tasker_view_order') || 'asc';
    } catch {
      return 'asc';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('tasker_view_groupBy', groupBy);
      localStorage.setItem('tasker_view_sortBy', sortBy);
      localStorage.setItem('tasker_view_order', order);
    } catch (e) {
      // ignore
    }
  }, [groupBy, sortBy, order]);

  // Gate: prevent auto-persist from overwriting localStorage before initial load completes
  const hasLoadedRef = useRef(false);
  const realtimeChannelRef = useRef(null);
  const tasksRef = useRef(tasks);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // ─────────────────────────────────────────────────
  // Complete State Reset (registered with AuthContext)
  // ─────────────────────────────────────────────────
  const resetAllTaskState = useCallback(() => {
    hasLoadedRef.current = false;
    setTasks([]);
    setLists(SYSTEM_SMART_LISTS);
    setTeams([]);
    setAllUsers([]);
    setDropdownPriorities(DEFAULT_PRIORITIES);
    setDropdownStatuses(DEFAULT_STATUSES);
    setDropdownTaskTypes(DEFAULT_TASK_TYPES);
    setDropdownTags(DEFAULT_TAGS);
    setSelectedListId('list-all');
    setSelectedTaskId(null);
    setLoading(false);

    // Unsubscribe realtime channel
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
  }, []);

  // Register logout handler once on mount
  useEffect(() => {
    if (registerLogoutHandler) {
      const unregister = registerLogoutHandler(resetAllTaskState);
      return unregister;
    }
  }, [registerLogoutHandler, resetAllTaskState]);

  // ─────────────────────────────────────────────────
  // Load Data: Supabase or per-user localStorage
  // ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      hasLoadedRef.current = false;
      return;
    }

    const initData = async () => {
      setLoading(true);

      if (isDemoMode || !isSupabaseConfigured()) {
        // Demo mode: load from per-user localStorage
        const storeKey = getStoreKey(user.id);
        try {
          const cached = localStorage.getItem(storeKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed.tasks)) {
              const realTasks = parsed.tasks.filter(t => !t.id?.startsWith('sample-task-'));
              setTasks(realTasks);
            } else {
              setTasks([]);
            }
            if (Array.isArray(parsed.lists) && parsed.lists.length > 0) setLists(parsed.lists);
            if (Array.isArray(parsed.teams)) setTeams(parsed.teams);
            const deleted = getDeletedUserIds();
            if (Array.isArray(parsed.allUsers) && parsed.allUsers.length > 0) {
              setAllUsers(parsed.allUsers.filter(u => !deleted.includes(u.id) && !deleted.includes(u.email?.toLowerCase())));
            } else {
              setAllUsers(DEFAULT_USERS.filter(u => !deleted.includes(u.id) && !deleted.includes(u.email?.toLowerCase())));
            }
            if (Array.isArray(parsed.dropdownPriorities) && parsed.dropdownPriorities.length > 0) setDropdownPriorities(parsed.dropdownPriorities);
            if (Array.isArray(parsed.dropdownStatuses) && parsed.dropdownStatuses.length > 0) setDropdownStatuses(parsed.dropdownStatuses);
            if (Array.isArray(parsed.dropdownTaskTypes) && parsed.dropdownTaskTypes.length > 0) setDropdownTaskTypes(parsed.dropdownTaskTypes);
            if (Array.isArray(parsed.dropdownTags) && parsed.dropdownTags.length > 0) setDropdownTags(parsed.dropdownTags);
          } else {
            setTasks([]);
          }
        } catch (e) {
          console.error('[TaskContext] Failed to parse localStorage cache:', e);
        }
        hasLoadedRef.current = true;
        setLoading(false);
        return;
      }

      // Supabase mode: fetch from database
      await fetchInitialData();
      subscribeRealtime();
      hasLoadedRef.current = true;
      setLoading(false);
    };

    initData();

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isDemoMode]);

  // ─────────────────────────────────────────────────
  // Auto-Persist (per-user localStorage in demo mode)
  // ─────────────────────────────────────────────────
  useEffect(() => {
    if (!hasLoadedRef.current || !user || (!isDemoMode && isSupabaseConfigured())) return;

    const storeKey = getStoreKey(user.id);
    localStorage.setItem(storeKey, JSON.stringify({
      tasks,
      lists,
      teams,
      allUsers,
      dropdownPriorities,
      dropdownStatuses,
      dropdownTaskTypes,
      dropdownTags,
    }));
  }, [user, isDemoMode, tasks, lists, teams, allUsers, dropdownPriorities, dropdownStatuses, dropdownTaskTypes, dropdownTags]);

  // ─────────────────────────────────────────────────
  // Supabase Realtime Subscriptions
  // ─────────────────────────────────────────────────
  const subscribeRealtime = () => {
    if (!isSupabaseConfigured() || isDemoMode) return;

    // Clean up existing channel before re-subscribing to prevent stacked listeners
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const channel = supabase
      .channel('public:tasks')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tasks' },
        (payload) => {
          const newTask = payload.new;
          // Avoid notification spam to the creator themselves (already notified locally)
          if (newTask.created_by !== user?.id) {
            if (newTask.assigned_to === user?.id) {
              toast.success(`📌 New Task Assigned: "${newTask.title}"`, {
                id: `task-assigned-${newTask.id}`,
                duration: 3500,
              });
            } else {
              toast(`✨ Team Task Added: "${newTask.title}"`, {
                id: `task-created-${newTask.id}`,
                duration: 2500,
              });
            }
          }
          fetchInitialData();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks' },
        (payload) => {
          // Compare against current memory state: only fire if genuinely transitioning from incomplete to complete
          const prevTask = tasksRef.current?.find(t => t.id === payload.new.id);
          const wasCompleted = prevTask ? prevTask.is_completed : false;

          if (payload.new.is_completed && !wasCompleted) {
            toast.success(`✅ Task Completed: "${payload.new.title}"`, {
              id: `task-complete-${payload.new.id}`,
              duration: 2500,
            });
          }
          fetchInitialData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lists' },
        () => { fetchInitialData(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_members' },
        (payload) => {
          // Check if the current user is the one being added or removed
          const isTargetUser =
            (payload.eventType === 'INSERT' && payload.new.user_id === user?.id) ||
            (payload.eventType === 'DELETE' && payload.old?.user_id === user?.id);

          if (isTargetUser) {
            if (payload.eventType === 'INSERT') {
              toast.success('🎉 You have been added to a new Team Workspace!', {
                id: 'team-member-add',
                duration: 3500,
              });
            }
            if (payload.eventType === 'DELETE') {
              toast('You were removed from a Team Workspace.', {
                id: 'team-member-remove',
                duration: 3500,
              });
            }
            fetchInitialData();
          } else if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
            // Still refresh if someone else was modified (e.g. manager updating UI)
            fetchInitialData();
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;
  };

  // ─────────────────────────────────────────────────
  // Fetch ALL initial data from Supabase
  // ─────────────────────────────────────────────────
  const fetchInitialData = async () => {
    try {
      // 1. Fetch All Profiles (merge with default team members so candidates are always available)
      const { data: profilesData } = await supabase.from('profiles').select('*');
      const baseProfiles = (profilesData && profilesData.length > 0) ? profilesData : [];
      const combined = [...baseProfiles];
      const deleted = getDeletedUserIds();
      DEFAULT_USERS.forEach(defU => {
        if (!deleted.includes(defU.id) && !deleted.includes(defU.email?.toLowerCase()) && !combined.some(u =>
          u.id === defU.id ||
          (u.email && defU.email && u.email.toLowerCase() === defU.email.toLowerCase())
        )) {
          combined.push(defU);
        }
      });
      setAllUsers(combined.filter(u => !deleted.includes(u.id) && !deleted.includes(u.email?.toLowerCase())));

      // 2. Fetch Teams & Members
      const { data: teamsData } = await supabase.from('teams').select('*, team_members(*)');
      if (teamsData) setTeams(teamsData);

      // 3. Fetch Lists
      const { data: listsData } = await supabase.from('lists').select('*');
      setLists([...SYSTEM_SMART_LISTS, ...(listsData || [])]);

      // 4. Fetch 100% Dynamic Dropdown Lookup Tables
      const { data: prioritiesData } = await supabase.from('dropdown_priorities').select('*').order('level_order');
      if (prioritiesData && prioritiesData.length > 0) setDropdownPriorities(prioritiesData);

      const { data: statusesData } = await supabase.from('dropdown_statuses').select('*');
      if (statusesData && statusesData.length > 0) setDropdownStatuses(statusesData);

      const { data: taskTypesData } = await supabase.from('dropdown_task_types').select('*');
      if (taskTypesData && taskTypesData.length > 0) setDropdownTaskTypes(taskTypesData);

      const { data: tagsData } = await supabase.from('dropdown_tags').select('*');
      if (tagsData && tagsData.length > 0) setDropdownTags(tagsData);

      // 5. Fetch Scoped Tasks with Many-to-Many Generic Tags (RLS Enforced)
      const { data: tasksData, error: tasksErr } = await supabase
        .from('tasks')
        .select(`
          *,
          subtasks(*),
          task_attachments(*),
          task_acknowledgements(*, profiles:user_id(full_name, email, avatar_id)),
          task_tag_mapping(*, dropdown_tags(*))
        `)
        .order('created_at', { ascending: false });

      if (tasksErr) throw tasksErr;

      if (tasksData) {
        if (tasksData.length > 0) {
          isStatusColumnSupported = 'status' in tasksData[0];
          isDualApprovalSupported = 'manager_approved' in tasksData[0];
        }
        let localApprovals = {};
        try {
          localApprovals = JSON.parse(localStorage.getItem('tasker_dual_approvals') || '{}');
        } catch (e) {}

        const formattedTasks = tasksData.map(t => {
          const statusObj = dropdownStatuses.find(st => st.id === t.status_id);
          const computedStatus = t.status || (
            t.is_completed ? 'completed' :
            statusObj?.name?.toLowerCase().includes('review') ? 'under_review' :
            'to_do'
          );

          const localAppr = localApprovals[t.id] || {};
          const managerApproved = t.manager_approved !== undefined ? Boolean(t.manager_approved) : (t.is_completed ? true : Boolean(localAppr.manager_approved));
          const subManagerApproved = t.sub_manager_approved !== undefined ? Boolean(t.sub_manager_approved) : (t.is_completed ? true : Boolean(localAppr.sub_manager_approved));

          return {
            ...t,
            status: computedStatus,
            manager_approved: managerApproved,
            sub_manager_approved: subManagerApproved,
            manager_approved_by: t.manager_approved_by || localAppr.manager_approved_by || null,
            sub_manager_approved_by: t.sub_manager_approved_by || localAppr.sub_manager_approved_by || null,
            manager_approved_at: t.manager_approved_at || localAppr.manager_approved_at || null,
            sub_manager_approved_at: t.sub_manager_approved_at || localAppr.sub_manager_approved_at || null,
            assigned_users: Array.isArray(t.assigned_users) && t.assigned_users.length > 0
              ? t.assigned_users
              : (t.assigned_to ? [t.assigned_to] : []),
            tags: (t.task_tag_mapping || []).map(m => m.dropdown_tags).filter(Boolean),
            task_acknowledgements: (t.task_acknowledgements || []).map(ack => ({
              ...ack,
              full_name: ack.profiles?.full_name || ack.profiles?.email || 'Team Member'
            }))
          };
        });
        setTasks(formattedTasks);
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error('[TaskContext] Error fetching Supabase data:', err);
    }
  };

  const refreshTasks = async () => {
    setLoading(true);
    if (!isDemoMode && isSupabaseConfigured()) {
      await fetchInitialData();
    }
    setLoading(false);
  };

  // ─────────────────────────────────────────────────
  // Many-to-Many Task Tag Mapping Handlers
  // ─────────────────────────────────────────────────
  const addTagToTask = async (taskId, tagId) => {
    if (isDemoMode || !isSupabaseConfigured()) {
      const tagObj = dropdownTags.find(t => t.id === tagId);
      if (!tagObj) return;
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          const existingTags = t.tags || [];
          if (!existingTags.some(tg => tg.id === tagId)) {
            return { ...t, tags: [...existingTags, tagObj] };
          }
        }
        return t;
      }));
      toast.success(`Tag #${tagObj.name} attached!`);
      return;
    }
    try {
      const { error } = await supabase.from('task_tag_mapping').insert({ task_id: taskId, tag_id: tagId });
      if (error) throw error;
      await fetchInitialData();
      toast.success('Tag attached!');
    } catch (err) {
      toast.error('Failed to attach tag: ' + err.message);
    }
  };

  const removeTagFromTask = async (taskId, tagId) => {
    if (isDemoMode || !isSupabaseConfigured()) {
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return { ...t, tags: (t.tags || []).filter(tg => tg.id !== tagId) };
        }
        return t;
      }));
      toast.success('Tag removed!');
      return;
    }
    try {
      const { error } = await supabase.from('task_tag_mapping').delete().eq('task_id', taskId).eq('tag_id', tagId);
      if (error) throw error;
      await fetchInitialData();
      toast.success('Tag removed!');
    } catch (err) {
      toast.error('Failed to remove tag: ' + err.message);
    }
  };

  // ─────────────────────────────────────────────────
  // CRUD: Dynamic Dropdown Priorities
  // ─────────────────────────────────────────────────
  const addPriority = async (name, color_hex = '#ef4444', level_order = 1) => {
    const newItem = { id: 'p-' + Date.now(), name, color_hex, level_order, created_by: user?.id };
    if (isDemoMode || !isSupabaseConfigured()) {
      setDropdownPriorities(prev => [...prev, newItem]);
      toast.success(`Priority "${name}" created!`);
      return newItem;
    }
    try {
      const { data, error } = await supabase.from('dropdown_priorities').insert({ name, color_hex, level_order, created_by: user.id }).select().single();
      if (error) throw error;
      setDropdownPriorities(prev => [...prev, data]);
      toast.success(`Priority "${name}" created!`);
      return data;
    } catch (err) {
      toast.error('Error creating priority: ' + err.message);
    }
  };

  const deletePriority = async (id) => {
    if (isDemoMode || !isSupabaseConfigured()) {
      setDropdownPriorities(prev => prev.filter(i => i.id !== id));
      toast.success('Priority deleted');
      return;
    }
    try {
      const { error } = await supabase.from('dropdown_priorities').delete().eq('id', id);
      if (error) throw error;
      setDropdownPriorities(prev => prev.filter(i => i.id !== id));
      toast.success('Priority deleted');
    } catch (err) {
      toast.error('Error deleting priority: ' + err.message);
    }
  };

  // ─────────────────────────────────────────────────
  // CRUD: Dynamic Dropdown Statuses
  // ─────────────────────────────────────────────────
  const addStatus = async (name, color_hex = '#3b82f6', is_completed_state = false, is_map_visible = false) => {
    const newItem = { id: 'st-' + Date.now(), name, color_hex, is_completed_state, is_map_visible, created_by: user?.id };
    if (isDemoMode || !isSupabaseConfigured()) {
      setDropdownStatuses(prev => [...prev, newItem]);
      toast.success(`Status "${name}" created!`);
      return newItem;
    }
    try {
      const { data, error } = await supabase.from('dropdown_statuses').insert({ name, color_hex, is_completed_state, is_map_visible, created_by: user.id }).select().single();
      if (error) throw error;
      setDropdownStatuses(prev => [...prev, data]);
      toast.success(`Status "${name}" created!`);
      return data;
    } catch (err) {
      toast.error('Error creating status: ' + err.message);
    }
  };

  const deleteStatus = async (id) => {
    if (isDemoMode || !isSupabaseConfigured()) {
      setDropdownStatuses(prev => prev.filter(i => i.id !== id));
      toast.success('Status deleted');
      return;
    }
    try {
      const { error } = await supabase.from('dropdown_statuses').delete().eq('id', id);
      if (error) throw error;
      setDropdownStatuses(prev => prev.filter(i => i.id !== id));
      toast.success('Status deleted');
    } catch (err) {
      toast.error('Error deleting status: ' + err.message);
    }
  };

  // ─────────────────────────────────────────────────
  // CRUD: Dynamic Dropdown Task Types
  // ─────────────────────────────────────────────────
  const addTaskType = async (name, color_hex = '#ec4899', description = '') => {
    const newItem = { id: 'tt-' + Date.now(), name, color_hex, description, created_by: user?.id };
    if (isDemoMode || !isSupabaseConfigured()) {
      setDropdownTaskTypes(prev => [...prev, newItem]);
      toast.success(`Task Type "${name}" created!`);
      return newItem;
    }
    try {
      const { data, error } = await supabase.from('dropdown_task_types').insert({ name, color_hex, description, created_by: user.id }).select().single();
      if (error) throw error;
      setDropdownTaskTypes(prev => [...prev, data]);
      toast.success(`Task Type "${name}" created!`);
      return data;
    } catch (err) {
      toast.error('Error creating task type: ' + err.message);
    }
  };

  const deleteTaskType = async (id) => {
    if (isDemoMode || !isSupabaseConfigured()) {
      setDropdownTaskTypes(prev => prev.filter(i => i.id !== id));
      toast.success('Task Type deleted');
      return;
    }
    try {
      const { error } = await supabase.from('dropdown_task_types').delete().eq('id', id);
      if (error) throw error;
      setDropdownTaskTypes(prev => prev.filter(i => i.id !== id));
      toast.success('Task Type deleted');
    } catch (err) {
      toast.error('Error deleting task type: ' + err.message);
    }
  };

  // ─────────────────────────────────────────────────
  // CRUD: Dynamic Dropdown Tags
  // ─────────────────────────────────────────────────
  const addTag = async (name, color_hex = '#3b82f6', is_map_visible = false) => {
    const newItem = { id: 'tag-' + Date.now(), name, color_hex, is_map_visible, created_by: user?.id };
    if (isDemoMode || !isSupabaseConfigured()) {
      setDropdownTags(prev => [...prev, newItem]);
      toast.success(`Tag "${name}" created!`);
      return newItem;
    }
    try {
      const { data, error } = await supabase.from('dropdown_tags').insert({ name, color_hex, is_map_visible, created_by: user.id }).select().single();
      if (error) throw error;
      setDropdownTags(prev => [...prev, data]);
      toast.success(`Tag "${name}" created!`);
      return data;
    } catch (err) {
      toast.error('Error creating tag: ' + err.message);
    }
  };

  const deleteTag = async (id) => {
    if (isDemoMode || !isSupabaseConfigured()) {
      setDropdownTags(prev => prev.filter(i => i.id !== id));
      toast.success('Tag deleted');
      return;
    }
    try {
      const { error } = await supabase.from('dropdown_tags').delete().eq('id', id);
      if (error) throw error;
      setDropdownTags(prev => prev.filter(i => i.id !== id));
      toast.success('Tag deleted');
    } catch (err) {
      toast.error('Error deleting tag: ' + err.message);
    }
  };

  // ─────────────────────────────────────────────────
  // Tasks CRUD
  // ─────────────────────────────────────────────────
  const addTask = async (taskData) => {
    const currentUserId = user?.id || 'demo-user';
    const currentUserRole = profile?.role || 'member';

    let assignedUsers = Array.isArray(taskData.assigned_users)
      ? taskData.assigned_users
      : (taskData.assigned_to ? [taskData.assigned_to] : []);

    let assignedTo = assignedUsers[0] || taskData.assigned_to || currentUserId;
    if (currentUserRole === 'member' && assignedTo !== currentUserId) {
      toast.error('Security Restriction: Members can only assign tasks to themselves.');
      assignedTo = currentUserId;
      assignedUsers = [currentUserId];
    }

    const defaultList = lists.find(l => !l.is_smart);

    let rawTargetId = taskData.list_id || selectedListId;
    let targetListId = rawTargetId;

    // If the target is a smart list (e.g. 'list-inbox'), try to fall back to the first user-created list, otherwise use null
    if (rawTargetId.startsWith('list-') && lists.find(l => l.id === rawTargetId)?.is_smart) {
      targetListId = defaultList ? defaultList.id : null;
    }

    // Final safety check: no string starting with 'list-' should be passed to Supabase UUID column
    if (targetListId && targetListId.startsWith('list-')) {
      targetListId = null;
    }

    const targetList = targetListId ? lists.find(l => l.id === targetListId) : null;

    const isTeamTask = taskData.task_type === 'team' || Boolean(taskData.tagged_user_ids?.length);

    // Strict Requirement: Team tasks MUST have at least one team member selected
    if (taskData.task_type === 'team' && (!taskData.tagged_user_ids || taskData.tagged_user_ids.length === 0)) {
      toast.error('Team Task Error: You must select at least one team member!');
      return null;
    }

    // Collect all assigned / tagged users for mandatory acknowledgement
    const allAssignedIds = Array.from(new Set([
      ...(Array.isArray(taskData.assigned_users) ? taskData.assigned_users : []),
      ...(Array.isArray(taskData.tagged_user_ids) ? taskData.tagged_user_ids : []),
      ...(taskData.assigned_to ? [taskData.assigned_to] : [])
    ]));

    let newAcks = [];

    if (allAssignedIds.length > 0) {
      newAcks = allAssignedIds.map(uid => {
        const uInfo = allUsers.find(u => u.id === uid);
        return {
          id: 'ack-' + Math.random().toString(36).substr(2, 9),
          user_id: uid,
          full_name: uInfo?.full_name || uInfo?.email || 'Team Member',
          is_acknowledged: false
        };
      });
    } else if (isTeamTask && targetList?.team_id) {
      const team = teams.find(t => t.id === targetList.team_id);
      if (team?.members) {
        newAcks = team.members.map(m => ({
          id: 'ack-' + Math.random().toString(36).substr(2, 9),
          user_id: m.user_id || m.id,
          full_name: m.full_name || m.email,
          is_acknowledged: false
        }));
      }
    }

    const sanitizeUuid = (val) => (val && typeof val === 'string' && val.includes('-') && val.length > 10) ? val : null;

    const newTaskObj = {
      id: 'task-' + Date.now(),
      title: taskData.title,
      description: taskData.description || '',
      is_completed: false,
      due_date: taskData.due_date || new Date().toISOString(),
      priority_id: sanitizeUuid(taskData.priority_id) || sanitizeUuid(dropdownPriorities[0]?.id),
      status_id: sanitizeUuid(taskData.status_id) || sanitizeUuid(dropdownStatuses[0]?.id),
      task_type_id: sanitizeUuid(taskData.task_type_id) || sanitizeUuid(dropdownTaskTypes[0]?.id),
      list_id: targetListId,
      task_type: isTeamTask ? 'team' : 'personal',
      created_by: currentUserId,
      assigned_to: assignedTo,
      assigned_users: assignedUsers,
      recurrence_rule: taskData.recurrence_rule || null,
      google_event_id: taskData.google_event_id || null,
      is_urgent: taskData.is_urgent ?? false,
      is_important: taskData.is_important ?? false,
      reminder_offset_days: taskData.reminder_offset_days !== undefined ? taskData.reminder_offset_days : null,
      reminder_time: taskData.reminder_time || (taskData.reminder_offset_days !== null && taskData.reminder_offset_days !== undefined ? '09:00:00' : null),
      next_reminder_at: taskData.next_reminder_at || (taskData.reminder_offset_days !== null && taskData.reminder_offset_days !== undefined
        ? calculateNextReminderAt(taskData.due_date, taskData.reminder_offset_days, taskData.reminder_time)
        : null),
      is_reminder_sent: false,
      is_constant_reminder: Boolean(taskData.is_constant_reminder),
      subtasks: [],
      task_acknowledgements: newAcks,
      task_attachments: [],
      tags: [],
    };

    if (isDemoMode || !isSupabaseConfigured()) {
      setTasks(prev => [newTaskObj, ...prev]);
      setSelectedTaskId(newTaskObj.id);
      toast.success(isTeamTask ? `Team task created with ${newAcks.length} assigned member(s)!` : 'Task created successfully!');
      return newTaskObj;
    }

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: newTaskObj.title,
          description: newTaskObj.description,
          due_date: newTaskObj.due_date,
          priority_id: newTaskObj.priority_id,
          status_id: newTaskObj.status_id,
          task_type_id: newTaskObj.task_type_id,
          list_id: newTaskObj.list_id,
          created_by: currentUserId,
          assigned_to: assignedTo,
          assigned_users: assignedUsers,
          recurrence_rule: newTaskObj.recurrence_rule,
          google_event_id: newTaskObj.google_event_id,
          is_urgent: newTaskObj.is_urgent,
          is_important: newTaskObj.is_important,
          reminder_offset_days: newTaskObj.reminder_offset_days,
          reminder_time: newTaskObj.reminder_time,
          next_reminder_at: newTaskObj.next_reminder_at,
          is_reminder_sent: newTaskObj.is_reminder_sent,
          is_constant_reminder: newTaskObj.is_constant_reminder
        })
        .select()
        .single();

      if (error) throw error;

      // Insert member acknowledgements for all assigned / tagged users
      if (data && allAssignedIds.length > 0) {
        const acksToInsert = allAssignedIds.map(uid => ({
          task_id: data.id,
          user_id: uid,
          is_acknowledged: false
        }));
        await supabase.from('task_acknowledgements').upsert(acksToInsert, { onConflict: 'task_id,user_id' });
      }

      // Ensure notification is recorded for real-time delivery
      const usersToNotify = isTeamTask
        ? (taskData.tagged_user_ids || [])
        : assignedUsers;

      if (data && usersToNotify.length > 0) {
        try {
          const listObj = lists.find(l => l.id === newTaskObj.list_id);
          const notifs = usersToNotify
            .filter(uid => uid !== currentUserId)
            .map(uid => ({
              user_id: uid,
              actor_id: currentUserId,
              type: 'task_assigned',
              entity_id: data.id,
              message_data: {
                task_title: newTaskObj.title,
                list_name: listObj?.name || 'Inbox',
                actor_name: profile?.full_name || user?.email?.split('@')[0] || 'Team Member'
              },
              is_read: false
            }));
          if (notifs.length > 0) {
            await supabase.from('notifications').insert(notifs);
          }
        } catch (notifErr) {
          // Non-blocking if table or trigger handled it
        }
      }

      await fetchInitialData();
      if (data) setSelectedTaskId(data.id);
      toast.success(isTeamTask ? `Team task created with ${taskData.tagged_user_ids.length} member(s)!` : 'Task created successfully!');
      return data;
    } catch (err) {
      toast.error('Error creating task: ' + err.message);
    }
  };

  const updateTask = async (taskId, updates) => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return false;

    // Strict Rule: A task cannot be marked complete if ANY assigned member is still working
    const isCompletedStatus = updates.status_id && dropdownStatuses.find(st => st.id === updates.status_id)?.is_completed_state;
    const willBeCompleted = updates.is_completed === true || isCompletedStatus;

    if (willBeCompleted && !targetTask.is_completed) {
      const acks = targetTask.task_acknowledgements || [];
      const hasMultipleAssignees = Array.isArray(targetTask.assigned_users) && targetTask.assigned_users.length > 1;
      const isTeam = targetTask.task_type === 'team' || acks.length > 0 || hasMultipleAssignees;

      if (isTeam) {
        const pendingMembers = acks.filter(a => !a.is_acknowledged);
        if (pendingMembers.length > 0) {
          const names = pendingMembers.map(a => a.full_name || 'Team Member').join(', ');
          toast.error(`🔒 Task Locked! ${pendingMembers.length} member(s) still working (${names}). All assigned members must mark their part done first.`, {
            id: `task-locked-${taskId}`,
            duration: 6000
          });
          return false;
        }
      }
    }

    // Strict Member Governance Check:
    const userRole = profile?.role || 'member';
    const isManagerOrSub = ['manager', 'sub_manager', 'deputy_manager', 'admin'].includes(userRole);

    if (!isManagerOrSub) {
      // Members are ONLY permitted to transition status to 'under_review' (e.g. via Done button)
      const allowedKeys = ['status', 'status_id', 'is_completed', 'updated_at'];
      const forbiddenEditedKeys = Object.keys(updates).filter(k => !allowedKeys.includes(k));
      if (forbiddenEditedKeys.length > 0) {
        toast.error('Members are not allowed to edit task details');
        return false;
      }
      if (updates.status && updates.status !== 'under_review') {
        toast.error('Members can only submit tasks for manager review');
        return false;
      }
    }

    const sanitizeUuid = (val) => (val && typeof val === 'string' && val.includes('-') && val.length > 10) ? val : undefined;

    // Sanitize any incoming dropdown updates to prevent Postgres UUID crash
    const sanitizedUpdates = { ...updates };
    if (sanitizedUpdates.priority_id !== undefined) sanitizedUpdates.priority_id = sanitizeUuid(sanitizedUpdates.priority_id) || null;
    if (sanitizedUpdates.status_id !== undefined) sanitizedUpdates.status_id = sanitizeUuid(sanitizedUpdates.status_id) || null;
    if (sanitizedUpdates.task_type_id !== undefined) sanitizedUpdates.task_type_id = sanitizeUuid(sanitizedUpdates.task_type_id) || null;
    if (sanitizedUpdates.list_id !== undefined) {
      if (sanitizedUpdates.list_id && sanitizedUpdates.list_id.startsWith('list-')) {
        sanitizedUpdates.list_id = null;
      }
    }
    if (sanitizedUpdates.recurrence_rule !== undefined) {
      sanitizedUpdates.recurrence_rule = sanitizedUpdates.recurrence_rule || null;
    }

    // Auto-sync status, status_id, and is_completed
    if (sanitizedUpdates.status === 'under_review') {
      const reviewStatus = dropdownStatuses.find(st => st.name.toLowerCase().includes('review'));
      if (reviewStatus) sanitizedUpdates.status_id = reviewStatus.id;
      sanitizedUpdates.is_completed = false;
    } else if (sanitizedUpdates.status === 'completed') {
      const compStatus = dropdownStatuses.find(st => st.is_completed_state || st.name.toLowerCase().includes('complete'));
      if (compStatus) sanitizedUpdates.status_id = compStatus.id;
      sanitizedUpdates.is_completed = true;
    } else if (sanitizedUpdates.status === 'to_do') {
      const todoStatus = dropdownStatuses.find(st => st.name.toLowerCase().includes('to do'));
      if (todoStatus) sanitizedUpdates.status_id = todoStatus.id;
      sanitizedUpdates.is_completed = false;
    }

    if (sanitizedUpdates.assigned_users !== undefined) {
      if (Array.isArray(sanitizedUpdates.assigned_users)) {
        sanitizedUpdates.assigned_users = sanitizedUpdates.assigned_users.filter(u => typeof u === 'string');
        sanitizedUpdates.assigned_to = sanitizedUpdates.assigned_users[0] || null;

        // Auto-sync acknowledgements for newly assigned users
        const currentAcks = targetTask.task_acknowledgements || [];
        const currentAckUserIds = currentAcks.map(a => a.user_id);
        const addedUserIds = sanitizedUpdates.assigned_users.filter(uid => !currentAckUserIds.includes(uid));

        if (addedUserIds.length > 0) {
          if (!isDemoMode && isSupabaseConfigured()) {
            const acksToInsert = addedUserIds.map(uid => ({
              task_id: taskId,
              user_id: uid,
              is_acknowledged: false
            }));
            supabase.from('task_acknowledgements').upsert(acksToInsert, { onConflict: 'task_id,user_id' }).then(() => { });
          } else {
            const newLocalAcks = addedUserIds.map(uid => {
              const uInfo = allUsers.find(u => u.id === uid);
              return {
                id: 'ack-' + Math.random().toString(36).substr(2, 9),
                user_id: uid,
                full_name: uInfo?.full_name || uInfo?.email || 'Member',
                is_acknowledged: false
              };
            });
            sanitizedUpdates.task_acknowledgements = [...currentAcks, ...newLocalAcks];
          }
        }
      }
    }

    // Handle Reminder Properties & Recalculate next_reminder_at
    if (sanitizedUpdates.reminder_offset_days !== undefined) {
      if (sanitizedUpdates.reminder_offset_days === null) {
        sanitizedUpdates.reminder_offset_days = null;
        sanitizedUpdates.reminder_time = null;
        sanitizedUpdates.next_reminder_at = null;
        sanitizedUpdates.is_reminder_sent = false;
        sanitizedUpdates.is_constant_reminder = false;
      } else {
        const effectiveDueDate = sanitizedUpdates.due_date !== undefined ? sanitizedUpdates.due_date : targetTask.due_date;
        const effectiveTime = sanitizedUpdates.reminder_time !== undefined ? sanitizedUpdates.reminder_time : (targetTask.reminder_time || '09:00:00');
        sanitizedUpdates.reminder_time = effectiveTime;
        if (sanitizedUpdates.next_reminder_at === undefined) {
          sanitizedUpdates.next_reminder_at = calculateNextReminderAt(effectiveDueDate, sanitizedUpdates.reminder_offset_days, effectiveTime);
        }
        sanitizedUpdates.is_reminder_sent = false;
      }
    } else if (sanitizedUpdates.due_date !== undefined && sanitizedUpdates.next_reminder_at === undefined) {
      if (targetTask.reminder_offset_days !== null && targetTask.reminder_offset_days !== undefined) {
        const effectiveTime = sanitizedUpdates.reminder_time !== undefined ? sanitizedUpdates.reminder_time : (targetTask.reminder_time || '09:00:00');
        sanitizedUpdates.next_reminder_at = calculateNextReminderAt(sanitizedUpdates.due_date, targetTask.reminder_offset_days, effectiveTime);
        sanitizedUpdates.is_reminder_sent = false;
      }
    }

    if (isDemoMode || !isSupabaseConfigured()) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...sanitizedUpdates } : t));
      return true;
    }

    try {
      let dbPayload = { ...sanitizedUpdates };
      delete dbPayload.tags;
      delete dbPayload.subtasks;
      delete dbPayload.task_attachments;
      delete dbPayload.task_acknowledgements;
      delete dbPayload.profiles;
      delete dbPayload.creator;
      delete dbPayload.assignee;
      delete dbPayload.task_tag_mapping;

      if (isStatusColumnSupported === false) {
        delete dbPayload.status;
      }
      if (isDualApprovalSupported === false) {
        delete dbPayload.manager_approved;
        delete dbPayload.sub_manager_approved;
        delete dbPayload.manager_approved_by;
        delete dbPayload.sub_manager_approved_by;
        delete dbPayload.manager_approved_at;
        delete dbPayload.sub_manager_approved_at;
      }

      let { error } = await supabase
        .from('tasks')
        .update(dbPayload)
        .eq('id', taskId);

      // If the remote table doesn't have the new 'status' or dual approval columns in schema cache, retry without them
      if (error && (
        error.message?.includes("'status'") ||
        error.message?.includes("'manager_approved'") ||
        error.message?.includes("'sub_manager_approved'") ||
        error.message?.includes('schema cache') ||
        error.code === 'PGRST204'
      )) {
        console.warn("Table 'tasks' schema cache missing newly added columns. Falling back to core columns.");
        if (error.message?.includes("'status'")) {
          isStatusColumnSupported = false;
        }
        if (error.message?.includes('manager_approved') || error.message?.includes('sub_manager_approved')) {
          isDualApprovalSupported = false;
        }
        delete dbPayload.status;
        delete dbPayload.manager_approved;
        delete dbPayload.sub_manager_approved;
        delete dbPayload.manager_approved_by;
        delete dbPayload.sub_manager_approved_by;
        delete dbPayload.manager_approved_at;
        delete dbPayload.sub_manager_approved_at;

        const retry = await supabase
          .from('tasks')
          .update(dbPayload)
          .eq('id', taskId);
        error = retry.error;
      }

      if (error) {
        toast.error(error.message);
        return false;
      }

      // If assigned members changed and new members were assigned, trigger notification
      const prevAssignees = Array.isArray(targetTask.assigned_users) ? targetTask.assigned_users : [targetTask.assigned_to].filter(Boolean);
      const nextAssignees = Array.isArray(sanitizedUpdates.assigned_users) ? sanitizedUpdates.assigned_users : (sanitizedUpdates.assigned_to ? [sanitizedUpdates.assigned_to] : []);
      const newAssignees = nextAssignees.filter(uid => !prevAssignees.includes(uid) && uid !== currentUserId);

      if (newAssignees.length > 0) {
        try {
          const listObj = lists.find(l => l.id === (sanitizedUpdates.list_id || targetTask.list_id));
          const notifs = newAssignees.map(uid => ({
            user_id: uid,
            actor_id: currentUserId,
            type: 'task_assigned',
            entity_id: taskId,
            message_data: {
              task_title: sanitizedUpdates.title || targetTask.title,
              list_name: listObj?.name || 'Inbox',
              actor_name: profile?.full_name || user?.email?.split('@')[0] || 'Team Member'
            },
            is_read: false
          }));
          await supabase.from('notifications').insert(notifs);
        } catch (notifErr) {
          // Handled safely
        }
      }

      await fetchInitialData();
      return true;
    } catch (err) {
      toast.error('Failed to update task: ' + err.message);
      return false;
    }
  };

  const toggleTaskCompletion = async (taskId) => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return false;

    const userRole = profile?.role || 'member';
    const isManagerRole = ['manager', 'admin'].includes(userRole);
    const isSubManagerRole = ['sub_manager', 'deputy_manager'].includes(userRole);
    const isAdmin = userRole === 'admin';
    const isManagerOrSub = isManagerRole || isSubManagerRole || isAdmin;

    // If currently completed, toggling un-completes back to To Do
    if (targetTask.is_completed) {
      const todoStatus = dropdownStatuses.find(st => st.name.toLowerCase().includes('to do')) || dropdownStatuses[0];
      toast(`Task returned to active: "${targetTask.title}"`, {
        id: `task-active-${taskId}`,
        duration: 2000
      });

      // Clear localStorage dual approval
      try {
        const stored = JSON.parse(localStorage.getItem('tasker_dual_approvals') || '{}');
        delete stored[taskId];
        localStorage.setItem('tasker_dual_approvals', JSON.stringify(stored));
      } catch (e) {}

      return await updateTask(taskId, {
        is_completed: false,
        status: 'to_do',
        status_id: todoStatus?.id,
        manager_approved: false,
        sub_manager_approved: false,
        manager_approved_by: null,
        sub_manager_approved_by: null,
        manager_approved_at: null,
        sub_manager_approved_at: null
      });
    }

    // Strict Business Logic Check (Only when marking AS DONE)
    const acks = targetTask.task_acknowledgements || [];
    const hasMultipleAssignees = Array.isArray(targetTask.assigned_users) && targetTask.assigned_users.length > 1;
    const isTeam = targetTask.task_type === 'team' || acks.length > 0 || hasMultipleAssignees;

    if (isTeam) {
      const pendingMembers = acks.filter(a => !a.is_acknowledged);
      if (pendingMembers.length > 0) {
        const names = pendingMembers.map(a => a.full_name || 'Team Member').join(', ');
        toast.error(`🔒 Cannot complete task! ${pendingMembers.length} assigned member(s) still working: ${names}. All assigned members must mark their part done first.`, {
          id: `task-locked-${taskId}`,
          duration: 6000
        });
        return false;
      }
    }

    const isUnderReview = targetTask.status === 'under_review' || 
      dropdownStatuses.find(st => st.id === targetTask.status_id)?.name?.toLowerCase() === 'in review';

    // If task is under review
    if (isUnderReview) {
      if (!isManagerOrSub) {
        toast('Pending Dual Approval — Both Manager and Sub-Manager must approve.', {
          id: `task-review-${taskId}`,
          icon: '🔒'
        });
        return false;
      }
      return await approveTask(taskId);
    }

    // If task is currently active (To Do / In Progress):
    // Regular Member: submits for review
    if (!isManagerOrSub) {
      const reviewStatus = dropdownStatuses.find(st => st.name.toLowerCase().includes('review')) || dropdownStatuses[2];
      toast.success(`📤 Task submitted for Manager & Sub-Manager Approval!`, {
        id: `task-submitted-${taskId}`,
        duration: 3500
      });
      return await updateTask(taskId, {
        status: 'under_review',
        status_id: reviewStatus?.id,
        is_completed: false,
        manager_approved: false,
        sub_manager_approved: false
      });
    }

    // If Manager or Sub-Manager clicks completion on an active task:
    // They cannot unilaterally complete it! They grant their approval and submit to review!
    return await approveTask(taskId);
  };

  const approveTask = async (taskId, roleOverride = null) => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return false;

    const userRole = profile?.role || 'member';
    const isManagerRole = ['manager', 'admin'].includes(userRole);
    const isSubManagerRole = ['sub_manager', 'deputy_manager'].includes(userRole);
    const isAdmin = userRole === 'admin';

    // Determine which approval this user is granting
    let actingRole = roleOverride;
    if (!actingRole) {
      if (isAdmin) {
        if (!targetTask.manager_approved) actingRole = 'manager';
        else if (!targetTask.sub_manager_approved) actingRole = 'sub_manager';
        else actingRole = 'manager';
      } else if (isManagerRole) {
        actingRole = 'manager';
      } else if (isSubManagerRole) {
        actingRole = 'sub_manager';
      }
    }

    if (!actingRole || (!isManagerRole && !isSubManagerRole && !isAdmin)) {
      toast.error('🔒 Only Managers and Sub-Managers can approve tasks.', { id: `ack-perm-${taskId}` });
      return false;
    }

    if (actingRole === 'manager' && !isManagerRole && !isAdmin) {
      toast.error('🔒 Only a Manager can grant Manager Approval.');
      return false;
    }

    if (actingRole === 'sub_manager' && !isSubManagerRole && !isAdmin) {
      toast.error('🔒 Only a Sub-Manager can grant Sub-Manager Approval.');
      return false;
    }

    if (actingRole === 'manager' && targetTask.manager_approved) {
      toast('Manager has already approved this task. Awaiting Sub-Manager approval.', {
        icon: '⏳',
        id: `mgr-already-${taskId}`,
        duration: 3500
      });
      return false;
    }

    if (actingRole === 'sub_manager' && targetTask.sub_manager_approved) {
      toast('Sub-Manager has already approved this task. Awaiting Manager approval.', {
        icon: '⏳',
        id: `sub-already-${taskId}`,
        duration: 3500
      });
      return false;
    }

    const newManagerApproved = actingRole === 'manager' ? true : Boolean(targetTask.manager_approved);
    const newSubManagerApproved = actingRole === 'sub_manager' ? true : Boolean(targetTask.sub_manager_approved);
    const isBothApproved = newManagerApproved && newSubManagerApproved;

    // Save to localStorage dual approvals fallback
    try {
      const existingLocal = JSON.parse(localStorage.getItem('tasker_dual_approvals') || '{}');
      existingLocal[taskId] = {
        manager_approved: newManagerApproved,
        sub_manager_approved: newSubManagerApproved,
        manager_approved_by: actingRole === 'manager' ? currentUserId : targetTask.manager_approved_by,
        sub_manager_approved_by: actingRole === 'sub_manager' ? currentUserId : targetTask.sub_manager_approved_by,
        manager_approved_at: actingRole === 'manager' ? new Date().toISOString() : targetTask.manager_approved_at,
        sub_manager_approved_at: actingRole === 'sub_manager' ? new Date().toISOString() : targetTask.sub_manager_approved_at,
      };
      localStorage.setItem('tasker_dual_approvals', JSON.stringify(existingLocal));
    } catch (e) {}

    if (isBothApproved) {
      // Both Manager and Sub-Manager have approved! Task is completed!
      // Handle recurring rollover if applicable
      if (targetTask.recurrence_rule) {
        const nextOccurrence = getNextOccurrence(targetTask.recurrence_rule, targetTask.due_date, new Date());
        if (nextOccurrence) {
          const formattedNext = format(nextOccurrence, 'MMM d, yyyy');
          toast.success(`🎉 Fully Approved by Both! Next occurrence: ${formattedNext}`, {
            id: `task-repeat-${taskId}`,
            duration: 4000
          });

          let newNextReminderAt = null;
          if (targetTask.reminder_offset_days !== null && targetTask.reminder_offset_days !== undefined) {
            newNextReminderAt = calculateNextReminderAt(
              nextOccurrence.toISOString(),
              targetTask.reminder_offset_days,
              targetTask.reminder_time || '09:00:00'
            );
          }

          return await updateTask(taskId, {
            due_date: nextOccurrence.toISOString(),
            is_completed: false,
            status: 'to_do',
            manager_approved: false,
            sub_manager_approved: false,
            manager_approved_by: null,
            sub_manager_approved_by: null,
            next_reminder_at: newNextReminderAt,
            is_reminder_sent: false
          });
        }
      }

      const completedStatus = dropdownStatuses.find(st => st.is_completed_state || st.name.toLowerCase().includes('complete')) || dropdownStatuses[3];
      toast.success(`🎉 Task Fully Approved & Completed! (Manager & Sub-Manager approved)`, {
        id: `task-both-approved-${taskId}`,
        duration: 4000
      });

      return await updateTask(taskId, {
        status: 'completed',
        status_id: completedStatus?.id,
        is_completed: true,
        manager_approved: true,
        sub_manager_approved: true,
        manager_approved_by: actingRole === 'manager' ? currentUserId : targetTask.manager_approved_by,
        sub_manager_approved_by: actingRole === 'sub_manager' ? currentUserId : targetTask.sub_manager_approved_by,
        manager_approved_at: actingRole === 'manager' ? new Date().toISOString() : targetTask.manager_approved_at,
        sub_manager_approved_at: actingRole === 'sub_manager' ? new Date().toISOString() : targetTask.sub_manager_approved_at
      });
    } else {
      // Only one has approved so far! Stays under review!
      const roleLabel = actingRole === 'manager' ? 'Manager' : 'Sub-Manager';
      const neededRole = actingRole === 'manager' ? 'Sub-Manager' : 'Manager';
      const reviewStatus = dropdownStatuses.find(st => st.name.toLowerCase().includes('review')) || dropdownStatuses[2];

      toast.success(`👍 ${roleLabel} Approved (1/2)! Awaiting ${neededRole} approval.`, {
        id: `task-half-approved-${taskId}`,
        duration: 4000
      });

      return await updateTask(taskId, {
        status: 'under_review',
        status_id: reviewStatus?.id,
        is_completed: false,
        manager_approved: newManagerApproved,
        sub_manager_approved: newSubManagerApproved,
        manager_approved_by: actingRole === 'manager' ? currentUserId : targetTask.manager_approved_by,
        sub_manager_approved_by: actingRole === 'sub_manager' ? currentUserId : targetTask.sub_manager_approved_by,
        manager_approved_at: actingRole === 'manager' ? new Date().toISOString() : targetTask.manager_approved_at,
        sub_manager_approved_at: actingRole === 'sub_manager' ? new Date().toISOString() : targetTask.sub_manager_approved_at
      });
    }
  };

  const rejectTask = async (taskId) => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return false;
    const todoStatus = dropdownStatuses.find(st => st.name.toLowerCase().includes('to do')) || dropdownStatuses[0];

    const userRole = profile?.role || 'member';
    const actingRole = ['manager', 'admin'].includes(userRole) ? 'Manager' : 'Sub-Manager';

    // Clear localStorage dual approvals
    try {
      const existingLocal = JSON.parse(localStorage.getItem('tasker_dual_approvals') || '{}');
      delete existingLocal[taskId];
      localStorage.setItem('tasker_dual_approvals', JSON.stringify(existingLocal));
    } catch (e) {}

    toast.error(`❌ Task Rejected by ${actingRole}: "${targetTask.title}" returned to To Do`, {
      id: `task-reject-${taskId}`,
      duration: 3500
    });

    return await updateTask(taskId, {
      status: 'to_do',
      status_id: todoStatus?.id,
      is_completed: false,
      manager_approved: false,
      sub_manager_approved: false,
      manager_approved_by: null,
      sub_manager_approved_by: null,
      manager_approved_at: null,
      sub_manager_approved_at: null
    });
  };

  const deleteTask = async (taskId) => {
    if (isDemoMode || !isSupabaseConfigured()) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (selectedTaskId === taskId) setSelectedTaskId(null);
      toast.success('Task deleted', { id: `task-delete-${taskId}`, duration: 2500 });
      return;
    }

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (selectedTaskId === taskId) setSelectedTaskId(null);
      toast.success('Task deleted', { id: `task-delete-${taskId}`, duration: 2500 });
    } catch (err) {
      toast.error('Error deleting task: ' + err.message, { id: 'task-delete-error' });
    }
  };

  const toggleAcknowledgement = async (taskId, ackId, targetUserId) => {
    const currentUserId = user?.id || 'demo-user';
    const currentUserRole = profile?.role || 'member';

    // Allow the assigned member to toggle their own, OR allow admin/manager to manage
    if (targetUserId !== currentUserId && currentUserRole !== 'manager') {
      toast.error('Security Restriction: You can only complete your own assigned work!');
      return;
    }

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const targetAck = (task.task_acknowledgements || []).find(a => a.id === ackId || a.user_id === targetUserId);
    const newStatus = !targetAck?.is_acknowledged;
    const memberName = targetAck?.full_name || 'Team Member';

    const updatedAcks = (task.task_acknowledgements || []).map(ack => {
      if (ack.id === ackId || ack.user_id === targetUserId) {
        return {
          ...ack,
          is_acknowledged: newStatus,
          acknowledged_at: newStatus ? new Date().toISOString() : null
        };
      }
      return ack;
    });

    const finishedCount = updatedAcks.filter(a => a.is_acknowledged).length;
    const totalCount = updatedAcks.length;

    if (isDemoMode || !isSupabaseConfigured()) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, task_acknowledgements: updatedAcks } : t));
      if (newStatus) {
        if (finishedCount === totalCount) {
          toast.success(`🎉 All ${totalCount} team members have finished! Task is now unlocked for completion.`, {
            id: `ack-complete-${taskId}`,
            duration: 4000,
          });
        } else {
          toast.success(`✓ ${memberName} finished work! (${finishedCount}/${totalCount} completed)`, {
            id: `ack-status-${taskId}`,
            duration: 2500,
          });
        }
      } else {
        toast(`Marked ${memberName} as still working on task.`, {
          id: `ack-status-${taskId}`,
          duration: 2000,
        });
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('task_acknowledgements')
        .update({
          is_acknowledged: newStatus,
          acknowledged_at: newStatus ? new Date().toISOString() : null
        })
        .eq('id', ackId);

      if (error) throw error;
      await fetchInitialData();

      if (newStatus) {
        if (finishedCount === totalCount) {
          toast.success(`🎉 All ${totalCount} team members have finished! Task is now unlocked for completion.`, {
            id: `ack-complete-${taskId}`,
            duration: 4000,
          });
        } else {
          toast.success(`✓ ${memberName} finished work! (${finishedCount}/${totalCount} completed)`, {
            id: `ack-status-${taskId}`,
            duration: 2500,
          });
        }
      } else {
        toast(`Marked ${memberName} as still working on task.`, {
          id: `ack-status-${taskId}`,
          duration: 2000,
        });
      }
    } catch (err) {
      toast.error('Failed to update status: ' + err.message);
    }
  };

  // ─────────────────────────────────────────────────
  // Subtasks CRUD
  // ─────────────────────────────────────────────────
  const addSubtask = async (taskId, title) => {
    if (!title.trim()) return;
    const newSub = { id: 'sub-' + Date.now(), task_id: taskId, title, is_completed: false };

    if (isDemoMode || !isSupabaseConfigured()) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: [...(t.subtasks || []), newSub] } : t));
      return;
    }

    try {
      const { data, error } = await supabase.from('subtasks').insert({ task_id: taskId, title }).select().single();
      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: [...(t.subtasks || []), data] } : t));
    } catch (err) {
      toast.error('Failed to add subtask: ' + err.message);
    }
  };

  const toggleSubtask = async (taskId, subtaskId) => {
    const task = tasks.find(t => t.id === taskId);
    const subtask = task?.subtasks?.find(s => s.id === subtaskId);
    if (!subtask) return;

    const newStatus = !subtask.is_completed;

    if (isDemoMode || !isSupabaseConfigured()) {
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return { ...t, subtasks: t.subtasks.map(s => s.id === subtaskId ? { ...s, is_completed: newStatus } : s) };
        }
        return t;
      }));
      return;
    }

    try {
      const { error } = await supabase.from('subtasks').update({ is_completed: newStatus }).eq('id', subtaskId);
      if (error) throw error;
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return { ...t, subtasks: t.subtasks.map(s => s.id === subtaskId ? { ...s, is_completed: newStatus } : s) };
        }
        return t;
      }));
    } catch (err) {
      toast.error('Error updating subtask: ' + err.message);
    }
  };

  const deleteSubtask = async (taskId, subtaskId) => {
    if (isDemoMode || !isSupabaseConfigured()) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: t.subtasks.filter(s => s.id !== subtaskId) } : t));
      return;
    }

    try {
      await supabase.from('subtasks').delete().eq('id', subtaskId);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: t.subtasks.filter(s => s.id !== subtaskId) } : t));
    } catch (err) {
      toast.error('Error deleting subtask: ' + err.message);
    }
  };

  // ─────────────────────────────────────────────────
  // ─────────────────────────────────────────────────
  // Attachments (Photos & Excel/CSV)
  // ─────────────────────────────────────────────────
  const addAttachment = async (taskId, file) => {
    const photoExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'];
    const spreadsheetExtensions = ['xlsx', 'xls', 'csv'];
    const fileExt = file.name.split('.').pop()?.toLowerCase();

    const isImage = file.type?.startsWith('image/') || photoExtensions.includes(fileExt);
    const isSpreadsheet = spreadsheetExtensions.includes(fileExt) || file.type?.includes('spreadsheet') || file.type?.includes('csv');

    if (!isImage && !isSpreadsheet) {
      toast.error('Only photos (PNG, JPG, WebP, GIF) and Excel/CSV files are permitted!', {
        id: 'file-type-restriction',
        duration: 3500,
      });
      return false;
    }

    const currentUserId = user?.id || 'demo-user';
    const fallbackMime = isImage ? 'image/png' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    if (isDemoMode || !isSupabaseConfigured()) {
      const newAtt = {
        id: 'att-' + Date.now() + Math.random().toString(36).substring(2, 6),
        task_id: taskId,
        file_name: file.name,
        file_url: URL.createObjectURL(file),
        file_size: file.size,
        mime_type: file.type || fallbackMime,
        created_at: new Date().toISOString()
      };
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, task_attachments: [...(t.task_attachments || []), newAtt] } : t));
      toast.success(`${isImage ? 'Photo' : 'File'} "${file.name}" attached successfully!`, {
        id: `att-uploaded-${taskId}`,
        duration: 2500,
      });
      return true;
    }

    try {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      // Photos upload to public 'avatars' bucket (supports all image MIME types and fast CDN delivery)
      // Spreadsheets upload to 'task_files' bucket (dedicated Excel/CSV storage)
      const targetBucket = isImage ? 'avatars' : 'task_files';
      const filePath = `tasks/${taskId}/${Date.now()}_${sanitizedName}`;

      const { error: uploadErr } = await supabase.storage.from(targetBucket).upload(filePath, file, {
        contentType: file.type || fallbackMime,
        upsert: true
      });

      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from(targetBucket).getPublicUrl(filePath);

      const { data, error: dbErr } = await supabase.from('task_attachments').insert({
        task_id: taskId,
        file_name: file.name,
        file_url: publicUrl,
        file_size: file.size,
        mime_type: file.type || fallbackMime,
        uploaded_by: currentUserId
      }).select().single();

      if (dbErr) throw dbErr;

      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, task_attachments: [...(t.task_attachments || []), data] } : t));
      toast.success(`${isImage ? 'Photo' : 'File'} "${file.name}" attached successfully!`, {
        id: `att-uploaded-${taskId}`,
        duration: 2500,
      });
      return true;
    } catch (err) {
      toast.error('File upload failed: ' + err.message, {
        id: 'att-upload-error',
        duration: 4000,
      });
      return false;
    }
  };

  const deleteAttachment = async (taskId, attachmentId) => {
    const task = tasks.find(t => t.id === taskId);
    const targetAtt = task?.task_attachments?.find(a => a.id === attachmentId);

    if (isDemoMode || !isSupabaseConfigured()) {
      setTasks(prev => prev.map(t => t.id === taskId ? {
        ...t,
        task_attachments: (t.task_attachments || []).filter(a => a.id !== attachmentId)
      } : t));
      toast.success('Attachment removed', { id: `att-deleted-${attachmentId}`, duration: 2000 });
      return true;
    }

    try {
      if (targetAtt?.file_url) {
        try {
          const isAvatars = targetAtt.file_url.includes('/avatars/');
          const bucket = isAvatars ? 'avatars' : 'task_files';
          const parts = targetAtt.file_url.split(`/${bucket}/`);
          if (parts[1]) {
            await supabase.storage.from(bucket).remove([decodeURIComponent(parts[1])]);
          }
        } catch (_) {
          // Non-critical if storage file was already deleted
        }
      }

      const { error } = await supabase.from('task_attachments').delete().eq('id', attachmentId);
      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === taskId ? {
        ...t,
        task_attachments: (t.task_attachments || []).filter(a => a.id !== attachmentId)
      } : t));
      toast.success('Attachment removed', { id: `att-deleted-${attachmentId}`, duration: 2000 });
      return true;
    } catch (err) {
      toast.error('Failed to remove attachment: ' + err.message, {
        id: 'att-delete-error',
        duration: 3500,
      });
      return false;
    }
  };

  // ─────────────────────────────────────────────────
  // Lists CRUD
  // ─────────────────────────────────────────────────
  const createList = async (name, color, teamId = null) => {
    const newListObj = {
      id: 'list-' + Date.now(),
      name,
      color: color || '#3b82f6',
      icon: teamId ? 'users' : 'folder',
      user_id: user?.id || 'demo-user',
      team_id: teamId
    };

    if (isDemoMode || !isSupabaseConfigured()) {
      setLists(prev => [...prev, newListObj]);
      setSelectedListId(newListObj.id);
      toast.success(`List "${name}" created!`);
      return newListObj;
    }

    try {
      const { data, error } = await supabase.from('lists').insert({
        name,
        color: newListObj.color,
        icon: newListObj.icon,
        user_id: user.id,
        team_id: teamId
      }).select().single();

      if (error) throw error;
      setLists(prev => [...prev, data]);
      setSelectedListId(data.id);
      toast.success(`List "${name}" created!`);
      return data;
    } catch (err) {
      toast.error('Error creating list: ' + err.message);
    }
  };

  const deleteList = async (listId) => {
    if (isDemoMode || !isSupabaseConfigured()) {
      setLists(prev => prev.filter(l => l.id !== listId));
      if (selectedListId === listId) setSelectedListId('list-all');
      toast.success('List deleted');
      return;
    }
    try {
      const { error } = await supabase.from('lists').delete().eq('id', listId);
      if (error) throw error;
      setLists(prev => prev.filter(l => l.id !== listId));
      if (selectedListId === listId) setSelectedListId('list-all');
      toast.success('List deleted');
    } catch (err) {
      toast.error('Error deleting list: ' + err.message);
    }
  };

  // ─────────────────────────────────────────────────
  // Teams CRUD
  // ─────────────────────────────────────────────────
  const createTeam = async (teamName, memberEmails = []) => {
    const newTeamId = 'team-' + Date.now();
    const cleanIdentifiers = memberEmails.map(e => String(e).trim().toLowerCase());
    const validUsers = allUsers ? allUsers.filter(u =>
      cleanIdentifiers.includes(String(u.email || '').toLowerCase()) ||
      cleanIdentifiers.includes(String(u.full_name || '').toLowerCase()) ||
      cleanIdentifiers.includes(String(u.id || '').toLowerCase())
    ) : [];

    const newTeamObj = {
      id: newTeamId,
      name: teamName,
      created_by: user?.id || 'demo-user',
      team_members: [
        { id: 'mem-self', team_id: newTeamId, user_id: user?.id || 'demo-user', role: 'owner' },
        ...validUsers.filter(u => u.id !== (user?.id || 'demo-user')).map((u, idx) => ({
          id: 'mem-' + idx + '-' + Date.now(),
          team_id: newTeamId,
          user_id: u.id,
          role: 'member'
        }))
      ]
    };

    if (isDemoMode || !isSupabaseConfigured()) {
      setTeams(prev => [...prev, newTeamObj]);
      createList(`🚀 ${teamName} Workspace`, '#ec4899', newTeamObj.id);
      toast.success(`Team Workspace "${teamName}" created!`);
      return newTeamObj;
    }

    try {
      const { data: teamData, error: teamErr } = await supabase.from('teams').insert({
        name: teamName,
        created_by: user.id
      }).select().single();

      if (teamErr) throw teamErr;

      const inserts = [
        { team_id: teamData.id, user_id: user.id, role: 'owner' },
        ...validUserIds.filter(id => id !== user.id).map(id => ({ team_id: teamData.id, user_id: id, role: 'member' }))
      ];

      await supabase.from('team_members').insert(inserts);

      await fetchInitialData();
      createList(`🚀 ${teamName} Workspace`, '#ec4899', teamData.id);
      toast.success(`Team Workspace "${teamName}" created!`);
      return teamData;
    } catch (err) {
      toast.error('Error creating team: ' + err.message);
    }
  };

  const updateTeamMembers = async (teamId, memberEmails = []) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    if (isDemoMode || !isSupabaseConfigured()) {
      toast.success('Team members updated (Demo Mode)!');
      return;
    }

    try {
      const ownerId = team.created_by;
      const validUserIds = allUsers.filter(u => memberEmails.includes(u.email)).map(u => u.id);

      // Remove existing members except the owner
      await supabase.from('team_members').delete().eq('team_id', teamId).neq('user_id', ownerId);

      // Insert new members
      const inserts = validUserIds.filter(id => id !== ownerId).map(id => ({
        team_id: teamId,
        user_id: id,
        role: 'member'
      }));

      if (inserts.length > 0) {
        await supabase.from('team_members').insert(inserts);
      }

      await fetchInitialData();
      toast.success('Team members updated successfully!');
    } catch (err) {
      toast.error('Error updating team members: ' + err.message);
    }
  };

  const addTeamMember = async (teamId, identifier) => {
    const cleanId = String(identifier || '').trim().toLowerCase();
    const validUser = allUsers.find(u =>
      u.id === identifier ||
      (u.email && u.email.toLowerCase() === cleanId) ||
      (u.full_name && u.full_name.toLowerCase() === cleanId)
    );
    if (!validUser) {
      toast.error('User not found. They must sign up first.', { id: 'team-user-not-found' });
      return;
    }

    if (isDemoMode || !isSupabaseConfigured()) {
      setTeams(prev => prev.map(t => {
        if (t.id === teamId) {
          const members = t.team_members || [];
          if (members.some(m => m.user_id === validUser.id)) {
            toast.error('User is already in the team!', { id: 'team-user-duplicate' });
            return t;
          }
          return {
            ...t,
            team_members: [...members, { id: 'tm-' + Date.now(), team_id: teamId, user_id: validUser.id, role: 'member' }]
          };
        }
        return t;
      }));
      toast.success(`${validUser.full_name || validUser.email} added to team!`, { id: 'team-user-added' });
      return;
    }

    try {
      const { error } = await supabase.from('team_members').insert({
        team_id: teamId,
        user_id: validUser.id,
        role: 'member'
      });
      if (error && error.code === '23505') {
        toast.error('User is already in the team!', { id: 'team-user-duplicate' });
        return;
      }
      if (error && error.code === '23503') {
        // Foreign key constraint (user exists in candidates list but not in remote auth.users)
        setTeams(prev => prev.map(t => {
          if (t.id === teamId) {
            const members = t.team_members || [];
            if (members.some(m => m.user_id === validUser.id)) return t;
            return {
              ...t,
              team_members: [...members, { id: 'tm-' + Date.now(), team_id: teamId, user_id: validUser.id, role: 'member' }]
            };
          }
          return t;
        }));
        toast.success(`${validUser.full_name || validUser.email} added to team!`, { id: 'team-user-added' });
        return;
      }
      if (error) throw error;
      await fetchInitialData();
      toast.success(`${validUser.full_name || validUser.email} added to team!`, { id: 'team-user-added' });
    } catch (err) {
      toast.error('Error adding member: ' + err.message, { id: 'team-add-error' });
    }
  };

  const removeTeamMember = async (teamId, userId) => {
    if (isDemoMode || !isSupabaseConfigured()) {
      setTeams(prev => prev.map(t => {
        if (t.id === teamId) {
          return {
            ...t,
            team_members: (t.team_members || []).filter(m => m.user_id !== userId)
          };
        }
        return t;
      }));
      toast.success('Member removed successfully!', { id: 'team-member-removed' });
      return;
    }
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .match({ team_id: teamId, user_id: userId });

      if (error) throw error;
      await fetchInitialData();
      toast.success('Member removed successfully!');
    } catch (err) {
      toast.error('Error removing member: ' + err.message);
    }
  };

  const deleteTeam = async (teamId) => {
    if (isDemoMode || !isSupabaseConfigured()) {
      setTeams(prev => prev.filter(t => t.id !== teamId));
      toast.success('Team deleted (Demo Mode)');
      return;
    }
    try {
      await supabase.from('teams').delete().eq('id', teamId);
      await fetchInitialData();
      toast.success('Team deleted successfully');
    } catch (err) {
      toast.error('Error deleting team: ' + err.message);
    }
  };
  // ─────────────────────────────────────────────────
  // User Management CRUD (for Admin & Team Control)
  // ─────────────────────────────────────────────────
  const createUser = async ({ email, fullName, role, password, avatar_id }) => {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) {
      toast.error('Email is required');
      return null;
    }
    const cleanName = String(fullName || '').trim() || cleanEmail.split('@')[0];
    const userRole = role || 'member';
    const chosenAvatar = avatar_id || `avatar-${Math.floor(Math.random() * 20 + 1)}`;
    const userPassword = password || 'Password123!';

    // If previously marked as deleted, remove from deleted IDs
    const deleted = getDeletedUserIds();
    if (deleted.includes(cleanEmail)) {
      const updated = deleted.filter(id => id !== cleanEmail);
      localStorage.setItem('tasker_deleted_user_ids', JSON.stringify(updated));
    }

    const newUserObj = {
      id: 'usr-' + Date.now(),
      email: cleanEmail,
      full_name: cleanName,
      role: userRole,
      avatar_id: chosenAvatar,
      created_at: new Date().toISOString()
    };

    if (isDemoMode || !isSupabaseConfigured()) {
      setAllUsers(prev => [newUserObj, ...prev.filter(u => u.email?.toLowerCase() !== cleanEmail)]);
      toast.success(`User "${cleanName}" created successfully!`);
      return newUserObj;
    }

    try {
      // 1. Attempt Supabase Auth Sign Up using isolated client (never touches active session)
      try {
        const isolated = createIsolatedClient();
        const { data: authData, error: authError } = await isolated.auth.signUp({
          email: cleanEmail,
          password: userPassword,
          options: {
            data: {
              full_name: cleanName,
              role: userRole,
              avatar_id: chosenAvatar
            }
          }
        });
        if (authError) {
          console.warn('[createUser] Isolated signUp message:', authError.message);
        } else if (authData?.user?.id) {
          newUserObj.id = authData.user.id;
        }
      } catch (authErr) {
        console.warn('[createUser] Auth signUp skipped:', authErr);
      }

      // 2. Upsert profile into public.profiles if UUID
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(newUserObj.id);
      if (isUuid) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: newUserObj.id,
          email: newUserObj.email,
          full_name: newUserObj.full_name,
          role: newUserObj.role,
          avatar_id: newUserObj.avatar_id
        });

        if (profileError) {
          console.warn('[createUser] Profile upsert note:', profileError.message);
        }
      }

      setAllUsers(prev => [newUserObj, ...prev.filter(u => u.id !== newUserObj.id && u.email?.toLowerCase() !== cleanEmail)]);
      toast.success(`User "${cleanName}" created successfully!`);
      return newUserObj;
    } catch (err) {
      setAllUsers(prev => [newUserObj, ...prev.filter(u => u.email?.toLowerCase() !== cleanEmail)]);
      toast.success(`User "${cleanName}" created locally!`);
      return newUserObj;
    }
  };

  const deleteUser = async (targetUserId) => {
    if (!targetUserId) return;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId);

    // Track in deleted user IDs to prevent default users from resurrecting
    const userToDelete = allUsers.find(u => u.id === targetUserId);
    const deleted = getDeletedUserIds();
    if (!deleted.includes(targetUserId)) {
      deleted.push(targetUserId);
    }
    if (userToDelete?.email && !deleted.includes(userToDelete.email.toLowerCase())) {
      deleted.push(userToDelete.email.toLowerCase());
    }
    localStorage.setItem('tasker_deleted_user_ids', JSON.stringify(deleted));

    if (isSupabaseConfigured() && !isDemoMode && isUuid) {
      try {
        const { error } = await supabase.rpc('delete_user_account', { target_user_id: targetUserId });
        if (error) {
          await supabase.from('profiles').delete().eq('id', targetUserId);
        }
      } catch (err) {
        try {
          await supabase.from('profiles').delete().eq('id', targetUserId);
        } catch (e) {
          console.warn('Could not delete from Supabase profiles:', e);
        }
      }
    }

    // Always remove from local allUsers state
    setAllUsers(prev => prev.filter(u => u.id !== targetUserId && u.email?.toLowerCase() !== userToDelete?.email?.toLowerCase()));
    toast.success("User deleted successfully!");
  };

  // ─────────────────────────────────────────────────
  // RBAC Task Scoping & Filtering
  // ─────────────────────────────────────────────────
  const currentUserId = user?.id || 'demo-user';
  const currentUserRole = profile?.role || 'member';

  const rbacTasks = tasks; // Total transparency: everyone sees everything

  const filteredTasks = rbacTasks.filter(t => {
    // 1. "All" Smart View (or legacy list-inbox): Show all tasks across all folders and lists
    if (selectedListId === 'list-all' || selectedListId === 'list-inbox') {
      return true;
    }

    // 2. "Today" Smart View: Incomplete tasks where due_date <= today (Today + Overdue)
    if (selectedListId === 'list-today') {
      if (!t.due_date) return false;
      try {
        const d = parseISO(t.due_date);
        return isToday(d) || isPast(d);
      } catch {
        return false;
      }
    }

    // 3. "Next 7 Days" Smart View
    if (selectedListId === 'list-next7') {
      if (!t.due_date) return false;
      try {
        const date = parseISO(t.due_date);
        const today = startOfDay(new Date());
        const nextWeek = endOfDay(addDays(today, 7));
        return isWithinInterval(date, { start: today, end: nextWeek });
      } catch {
        return false;
      }
    }

    // 4. "Assigned to me" Smart View: Tasks assigned to current authenticated user
    if (selectedListId === 'list-assigned-me') {
      const assignedUsers = Array.isArray(t.assigned_users) ? t.assigned_users : [];
      const myId = user?.id || currentUserId;
      return assignedUsers.includes(myId) || 
             t.assigned_to === myId ||
             (profile?.id && (assignedUsers.includes(profile.id) || t.assigned_to === profile.id));
    }

    return t.list_id === selectedListId;
  });

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  return (
    <TaskContext.Provider value={{
      tasks: filteredTasks,
      allTasks: tasks,
      allUsers,
      lists,
      teams,
      dropdownPriorities,
      dropdownStatuses,
      dropdownTaskTypes,
      dropdownTags,
      selectedListId,
      setSelectedListId,
      selectedTaskId,
      setSelectedTaskId,
      selectedTask,
      loading,
      addPriority,
      deletePriority,
      addStatus,
      deleteStatus,
      addTaskType,
      deleteTaskType,
      addTag,
      deleteTag,
      addTagToTask,
      removeTagFromTask,
      addTask,
      updateTask,
      toggleTaskCompletion,
      approveTask,
      rejectTask,
      deleteTask,
      toggleAcknowledgement,
      addSubtask,
      toggleSubtask,
      deleteSubtask,
      addAttachment,
      deleteAttachment,
      createList,
      deleteList,
      createTeam,
      updateTeamMembers,
      addTeamMember,
      removeTeamMember,
      deleteTeam,
      createUser,
      deleteUser,
      groupBy,
      setGroupBy,
      sortBy,
      setSortBy,
      order,
      setOrder,
      refreshTasks,
      fetchTasks: refreshTasks,
    }}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTasks = () => useContext(TaskContext);
