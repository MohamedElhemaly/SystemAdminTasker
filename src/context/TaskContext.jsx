import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isToday, isTomorrow, isWithinInterval, addDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

const TaskContext = createContext({});

// ─────────────────────────────────────────────────────
// Static System Smart Lists (never persisted / never change)
// ─────────────────────────────────────────────────────
const SYSTEM_SMART_LISTS = [
  { id: 'list-inbox', name: 'Inbox', color: '#3b82f6', icon: 'inbox', is_smart: true },
  { id: 'list-today', name: 'Today', color: '#10b981', icon: 'today', is_smart: true },
  { id: 'list-next7', name: 'Next 7 Days', color: '#8b5cf6', icon: 'calendar', is_smart: true }
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

// Helper: generate a unique localStorage key per user
const getStoreKey = (userId) => `tasker_store_${userId || 'anonymous'}`;

export const TaskProvider = ({ children }) => {
  const { user, profile, isDemoMode, registerLogoutHandler, isAuthenticated } = useAuth();
  
  const [tasks, setTasks] = useState([]);
  const [lists, setLists] = useState(SYSTEM_SMART_LISTS);
  const [teams, setTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  
  // Dynamic Dropdowns Global State
  const [dropdownPriorities, setDropdownPriorities] = useState(DEFAULT_PRIORITIES);
  const [dropdownStatuses, setDropdownStatuses] = useState(DEFAULT_STATUSES);
  const [dropdownTaskTypes, setDropdownTaskTypes] = useState(DEFAULT_TASK_TYPES);
  const [dropdownTags, setDropdownTags] = useState(DEFAULT_TAGS);

  const [selectedListId, setSelectedListId] = useState('list-inbox');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Gate: prevent auto-persist from overwriting localStorage before initial load completes
  const hasLoadedRef = useRef(false);
  const realtimeChannelRef = useRef(null);

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
    setSelectedListId('list-inbox');
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
            if (Array.isArray(parsed.tasks)) setTasks(parsed.tasks);
            if (Array.isArray(parsed.lists) && parsed.lists.length > 0) setLists(parsed.lists);
            if (Array.isArray(parsed.teams)) setTeams(parsed.teams);
            if (Array.isArray(parsed.allUsers)) setAllUsers(parsed.allUsers);
            if (Array.isArray(parsed.dropdownPriorities) && parsed.dropdownPriorities.length > 0) setDropdownPriorities(parsed.dropdownPriorities);
            if (Array.isArray(parsed.dropdownStatuses) && parsed.dropdownStatuses.length > 0) setDropdownStatuses(parsed.dropdownStatuses);
            if (Array.isArray(parsed.dropdownTaskTypes) && parsed.dropdownTaskTypes.length > 0) setDropdownTaskTypes(parsed.dropdownTaskTypes);
            if (Array.isArray(parsed.dropdownTags) && parsed.dropdownTags.length > 0) setDropdownTags(parsed.dropdownTags);
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

    const channel = supabase
      .channel('public:tasks')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tasks' },
        (payload) => {
          const newTask = payload.new;
          if (newTask.assigned_to === user?.id) {
            toast.success(`📌 New Task Assigned: "${newTask.title}"`);
          } else {
            toast(`✨ New Task Created: "${newTask.title}"`);
          }
          fetchInitialData();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks' },
        (payload) => {
          if (payload.new.is_completed && !payload.old.is_completed) {
            toast.success(`✅ Task Completed: "${payload.new.title}"`);
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
            if (payload.eventType === 'INSERT') toast.success('🎉 You have been added to a new Team Workspace!');
            if (payload.eventType === 'DELETE') toast('You were removed from a Team Workspace.');
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
      // 1. Fetch All Profiles
      const { data: profilesData } = await supabase.from('profiles').select('*');
      if (profilesData) setAllUsers(profilesData);

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
        const formattedTasks = tasksData.map(t => ({
          ...t,
          tags: (t.task_tag_mapping || []).map(m => m.dropdown_tags).filter(Boolean),
          task_acknowledgements: (t.task_acknowledgements || []).map(ack => ({
            ...ack,
            full_name: ack.profiles?.full_name || ack.profiles?.email || 'Team Member'
          }))
        }));
        setTasks(formattedTasks);
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

    let assignedTo = taskData.assigned_to || currentUserId;
    if (currentUserRole === 'member' && assignedTo !== currentUserId) {
      toast.error('Security Restriction: Members can only assign tasks to themselves.');
      assignedTo = currentUserId;
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
    let newAcks = [];

    if (taskData.tagged_user_ids && taskData.tagged_user_ids.length > 0) {
      newAcks = taskData.tagged_user_ids.map(uid => {
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
      subtasks: [],
      task_acknowledgements: newAcks,
      task_attachments: [],
      tags: [],
    };

    if (isDemoMode || !isSupabaseConfigured()) {
      setTasks(prev => [newTaskObj, ...prev]);
      setSelectedTaskId(newTaskObj.id);
      toast.success('Task created successfully!');
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
          assigned_to: assignedTo
        })
        .select()
        .single();

      if (error) throw error;
      await fetchInitialData();
      if (data) setSelectedTaskId(data.id);
      toast.success('Task created successfully!');
      return data;
    } catch (err) {
      toast.error('Error creating task: ' + err.message);
    }
  };

  const updateTask = async (taskId, updates) => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return;

    if (updates.is_completed === true) {
      const pendingAcks = targetTask.task_acknowledgements?.filter(a => !a.is_acknowledged) || [];
      if (targetTask.task_type === 'team' && pendingAcks.length > 0) {
        toast.error(`Cannot complete task! ${pendingAcks.length} pending team member acknowledgement(s) remaining.`);
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

    if (isDemoMode || !isSupabaseConfigured()) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...sanitizedUpdates } : t));
      return true;
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .update(sanitizedUpdates)
        .eq('id', taskId);

      if (error) {
        toast.error(error.message);
        return false;
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
    if (!targetTask) return;
    await updateTask(taskId, { is_completed: !targetTask.is_completed });
  };

  const deleteTask = async (taskId) => {
    if (isDemoMode || !isSupabaseConfigured()) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (selectedTaskId === taskId) setSelectedTaskId(null);
      toast.success('Task deleted');
      return;
    }

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (selectedTaskId === taskId) setSelectedTaskId(null);
      toast.success('Task deleted');
    } catch (err) {
      toast.error('Error deleting task: ' + err.message);
    }
  };

  const toggleAcknowledgement = async (taskId, ackId, targetUserId) => {
    const currentUserId = user?.id || 'demo-user';

    if (targetUserId !== currentUserId) {
      toast.error('Security Restriction: You can only acknowledge your own tag!');
      return;
    }

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedAcks = task.task_acknowledgements.map(ack => {
      if (ack.id === ackId || ack.user_id === targetUserId) {
        return { ...ack, is_acknowledged: !ack.is_acknowledged };
      }
      return ack;
    });

    if (isDemoMode || !isSupabaseConfigured()) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, task_acknowledgements: updatedAcks } : t));
      toast.success('Acknowledgement status updated!');
      return;
    }

    try {
      const targetAck = task.task_acknowledgements.find(a => a.id === ackId || a.user_id === targetUserId);
      const newStatus = !targetAck?.is_acknowledged;

      const { error } = await supabase
        .from('task_acknowledgements')
        .update({ 
          is_acknowledged: newStatus,
          acknowledged_at: newStatus ? new Date().toISOString() : null
        })
        .eq('id', ackId)
        .eq('user_id', currentUserId);

      if (error) throw error;
      await fetchInitialData();
      toast.success('Acknowledgement status updated!');
    } catch (err) {
      toast.error('Failed to update acknowledgement: ' + err.message);
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
  // Attachments (Excel/CSV Only)
  // ─────────────────────────────────────────────────
  const addAttachment = async (taskId, file) => {
    const allowedExtensions = ['xlsx', 'xls', 'csv'];
    const fileExt = file.name.split('.').pop()?.toLowerCase();

    if (!allowedExtensions.includes(fileExt)) {
      toast.error('Security Violation: Only Excel (.xlsx, .xls) and CSV (.csv) files are permitted!');
      return false;
    }

    const currentUserId = user?.id || 'demo-user';

    if (isDemoMode || !isSupabaseConfigured()) {
      const newAtt = {
        id: 'att-' + Date.now(),
        task_id: taskId,
        file_name: file.name,
        file_url: URL.createObjectURL(file),
        file_size: file.size,
        mime_type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, task_attachments: [...(t.task_attachments || []), newAtt] } : t));
      toast.success(`Excel file "${file.name}" attached successfully!`);
      return true;
    }

    try {
      const filePath = `tasks/${taskId}/${Math.random()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from('task_files').upload(filePath, file, {
        contentType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from('task_files').getPublicUrl(filePath);

      const { data, error: dbErr } = await supabase.from('task_attachments').insert({
        task_id: taskId,
        file_name: file.name,
        file_url: publicUrl,
        file_size: file.size,
        mime_type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        uploaded_by: currentUserId
      }).select().single();

      if (dbErr) throw dbErr;

      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, task_attachments: [...(t.task_attachments || []), data] } : t));
      toast.success(`Excel file "${file.name}" attached successfully!`);
      return true;
    } catch (err) {
      toast.error('File upload failed: ' + err.message);
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
      if (selectedListId === listId) setSelectedListId('list-inbox');
      toast.success('List deleted');
      return;
    }
    try {
      const { error } = await supabase.from('lists').delete().eq('id', listId);
      if (error) throw error;
      setLists(prev => prev.filter(l => l.id !== listId));
      if (selectedListId === listId) setSelectedListId('list-inbox');
      toast.success('List deleted');
    } catch (err) {
      toast.error('Error deleting list: ' + err.message);
    }
  };

  // ─────────────────────────────────────────────────
  // Teams CRUD
  // ─────────────────────────────────────────────────
  const createTeam = async (teamName, memberEmails = []) => {
    const newTeamObj = {
      id: 'team-' + Date.now(),
      name: teamName,
      created_by: user?.id || 'demo-user',
      members: [
        { id: 'mem-self', user_id: user?.id || 'demo-user', full_name: profile?.full_name || 'You', email: user?.email || 'you@team.com' },
        ...memberEmails.map((email, idx) => ({
          id: 'mem-' + idx,
          user_id: 'user-invited-' + idx,
          full_name: email.split('@')[0],
          email
        }))
      ]
    };

    const validUserIds = allUsers ? allUsers.filter(u => memberEmails.includes(u.email)).map(u => u.id) : [];

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

  const addTeamMember = async (teamId, email) => {
    const validUser = allUsers.find(u => u.email === email);
    if (!validUser) {
      toast.error('User not found. They must sign up first.');
      return;
    }
    
    if (isDemoMode || !isSupabaseConfigured()) return;

    try {
      const { error } = await supabase.from('team_members').insert({
        team_id: teamId,
        user_id: validUser.id,
        role: 'member'
      });
      if (error && error.code === '23505') {
         toast.error('User is already in the team!');
         return;
      }
      if (error) throw error;
      await fetchInitialData();
      toast.success('Member added successfully!');
    } catch (err) {
      toast.error('Error adding member: ' + err.message);
    }
  };

  const removeTeamMember = async (teamId, userId) => {
    if (isDemoMode || !isSupabaseConfigured()) return;
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
  // RBAC Task Scoping & Filtering
  // ─────────────────────────────────────────────────
  const currentUserId = user?.id || 'demo-user';
  const currentUserRole = profile?.role || 'member';

  const rbacTasks = tasks; // Total transparency: everyone sees everything

  const filteredTasks = rbacTasks.filter(t => {
    if (selectedListId === 'list-inbox') return true;
    if (selectedListId === 'list-today') {
      if (!t.due_date) return false;
      try { return isToday(parseISO(t.due_date)); } catch { return false; }
    }
    if (selectedListId === 'list-next7') {
      if (!t.due_date) return false;
      try {
        const date = parseISO(t.due_date);
        const today = startOfDay(new Date());
        const nextWeek = endOfDay(addDays(today, 7));
        return isWithinInterval(date, { start: today, end: nextWeek });
      } catch { return false; }
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
      deleteTask,
      toggleAcknowledgement,
      addSubtask,
      toggleSubtask,
      deleteSubtask,
      addAttachment,
      createList,
      deleteList,
      createTeam,
      updateTeamMembers,
      addTeamMember,
      removeTeamMember,
      deleteTeam,
      refreshTasks,
    }}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTasks = () => useContext(TaskContext);
