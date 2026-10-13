import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const NotificationContext = createContext({});

const STORAGE_KEY = 'tasker_live_notifications';

export const NotificationProvider = ({ children }) => {
  const { user, isDemoMode } = useAuth();
  
  // Real notifications state - starts empty with no mockup data
  const [notifications, setNotifications] = useState(() => {
    if (typeof window !== 'undefined' && (!isSupabaseConfigured() || isDemoMode)) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  
  const [loading, setLoading] = useState(false);
  const channelRef = useRef(null);

  // Sync to localStorage in demo mode or offline
  useEffect(() => {
    if (!isSupabaseConfigured() || isDemoMode) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
      } catch (e) {
        // Storage limit or private mode safe catch
      }
    }
  }, [notifications, isDemoMode]);

  // 1. Fetch user notifications from Supabase
  const fetchNotifications = useCallback(async () => {
    if (!user || isDemoMode || !isSupabaseConfigured()) {
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          actor:actor_id (
            id,
            full_name,
            avatar_id,
            email
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(60);

      if (error) {
        console.warn('[NotificationContext] Fetch notifications notice:', error.message);
        return;
      }

      const formatted = (data || []).map(n => ({
        ...n,
        actor_name: n.actor?.full_name || n.actor?.email?.split('@')[0] || n.message_data?.actor_name || 'Team Member',
        actor_avatar: n.actor?.avatar_id || 'avatar-1'
      }));
      setNotifications(formatted);
    } catch (err) {
      console.warn('[NotificationContext] Exception fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user, isDemoMode]);

  // 2. Real-time Subscription via Supabase Channel
  useEffect(() => {
    if (user && !isDemoMode && isSupabaseConfigured()) {
      fetchNotifications();

      // Clean up previous channel to prevent duplicate triggers
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      // Channel listening to all table changes on public.notifications
      const channel = supabase
        .channel(`realtime-notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications'
          },
          async (payload) => {
            const { eventType, new: newRecord, old: oldRecord } = payload;

            // A) Handle INSERT
            if (eventType === 'INSERT' && newRecord) {
              if (newRecord.user_id === user.id) {
                let actorName = newRecord.message_data?.actor_name || 'Team Member';
                let actorAvatar = 'avatar-1';

                if (newRecord.actor_id) {
                  try {
                    const { data: actorProfile } = await supabase
                      .from('profiles')
                      .select('full_name, avatar_id, email')
                      .eq('id', newRecord.actor_id)
                      .single();
                    if (actorProfile) {
                      actorName = actorProfile.full_name || actorProfile.email?.split('@')[0] || actorName;
                      actorAvatar = actorProfile.avatar_id || actorAvatar;
                    }
                  } catch (e) {
                    // Ignore profile lookup error
                  }
                }

                const formattedItem = {
                  ...newRecord,
                  actor_name: actorName,
                  actor_avatar: actorAvatar
                };

                setNotifications(prev => [formattedItem, ...prev.filter(n => n.id !== formattedItem.id)]);

                // Pop dynamic real-time toast alert
                if (newRecord.type === 'nudge_ack') {
                  toast(`⚡ ${actorName} nudged you: "${newRecord.message_data?.task_title || 'Team Task'}"`, {
                    icon: '🔔',
                    duration: 5000,
                    id: `notif-${newRecord.id}`
                  });
                } else if (newRecord.type === 'task_assigned') {
                  toast(`📋 ${actorName} assigned you: "${newRecord.message_data?.task_title || 'Task'}"`, {
                    duration: 4500,
                    id: `notif-${newRecord.id}`
                  });
                } else {
                  toast(`🔔 ${actorName}: ${newRecord.message_data?.custom_text || newRecord.message_data?.task_title || 'New notification'}`, {
                    duration: 4500,
                    id: `notif-${newRecord.id}`
                  });
                }
              }
            }

            // B) Handle UPDATE
            if (eventType === 'UPDATE' && newRecord) {
              if (newRecord.user_id === user.id) {
                setNotifications(prev => prev.map(n => n.id === newRecord.id ? { ...n, ...newRecord } : n));
              }
            }

            // C) Handle DELETE
            if (eventType === 'DELETE' && oldRecord) {
              setNotifications(prev => prev.filter(n => n.id !== oldRecord.id));
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[NotificationContext] Realtime subscription active for user:', user.id);
          }
        });

      channelRef.current = channel;

      return () => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      };
    } else {
      // In demo mode or offline, clear if user logs out
      if (!user) {
        setNotifications([]);
      }
    }
  }, [user, isDemoMode, fetchNotifications]);

  // 3. Mark single notification as read
  const markAsRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));

    if (isSupabaseConfigured() && !isDemoMode && user) {
      try {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', id)
          .eq('user_id', user.id);
      } catch (err) {
        console.error('[NotificationContext] Error marking as read:', err);
      }
    }
  };

  // 4. Mark all as read
  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

    if (isSupabaseConfigured() && !isDemoMode && user) {
      try {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', user.id)
          .eq('is_read', false);
      } catch (err) {
        console.error('[NotificationContext] Error marking all as read:', err);
      }
    }
    toast.success('All notifications marked as read.');
  };

  // 5. Delete single notification
  const deleteNotification = async (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));

    if (isSupabaseConfigured() && !isDemoMode && user) {
      try {
        await supabase
          .from('notifications')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);
      } catch (err) {
        console.error('[NotificationContext] Error deleting notification:', err);
      }
    }
    toast.success('Notification removed.');
  };

  // 6. Clear / Delete all notifications
  const clearAllNotifications = async () => {
    if (notifications.length === 0) return;
    setNotifications([]);

    if (isSupabaseConfigured() && !isDemoMode && user) {
      try {
        await supabase
          .from('notifications')
          .delete()
          .eq('user_id', user.id);
      } catch (err) {
        console.error('[NotificationContext] Error clearing notifications:', err);
      }
    }
    toast.success('All notifications cleared.');
  };

  // 7. Programmatic notification creator (used for direct frontend triggers)
  const createNotification = async ({ user_id, actor_id, type, entity_id, message_data }) => {
    if (!user_id) return;

    const notifPayload = {
      user_id,
      actor_id: actor_id || user?.id,
      type: type || 'task_assigned',
      entity_id: entity_id || null,
      message_data: message_data || {},
      is_read: false
    };

    if (isSupabaseConfigured() && !isDemoMode) {
      try {
        const { error } = await supabase.from('notifications').insert([notifPayload]);
        if (error) console.warn('[NotificationContext] Direct insert notice:', error.message);
      } catch (e) {
        console.warn('[NotificationContext] Direct insert exception:', e);
      }
    } else {
      // Local demo mode item
      const localItem = {
        id: 'notif-' + Date.now(),
        ...notifPayload,
        created_at: new Date().toISOString(),
        actor_name: message_data?.actor_name || 'Team Member',
        actor_avatar: 'avatar-1'
      };
      setNotifications(prev => [localItem, ...prev]);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      clearAllNotifications,
      createNotification,
      refreshNotifications: fetchNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
