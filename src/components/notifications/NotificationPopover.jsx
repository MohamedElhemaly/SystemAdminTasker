import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { getAvatarUrl } from '../../lib/avatars';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { 
  Bell, Check, Trash2, X, Sparkles, Folder, CheckSquare, Square, BellRing
} from 'lucide-react';

export const NotificationPopover = ({ isOpen, onClose, setActiveView }) => {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification, 
    clearAllNotifications 
  } = useNotifications();
  
  const { user, isDemoMode } = useAuth();
  const { 
    setSelectedTaskId, 
    setSelectedListId,
    allTasks, 
    toggleAcknowledgement, 
    refreshTasks, 
    fetchTasks 
  } = useTasks();
  const [activeTab, setActiveTab] = useState('notifications'); // 'notifications' | 'activities'
  const popoverRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleItemClick = (notif) => {
    markAsRead(notif.id);
    if (notif.entity_id) {
      const target = allTasks?.find((t) => t.id === notif.entity_id);
      if (target?.list_id && setSelectedListId) {
        setSelectedListId(target.list_id);
      } else if (setSelectedListId) {
        setSelectedListId('list-inbox');
      }
      setSelectedTaskId(notif.entity_id);
      if (setActiveView) setActiveView('tasks');
      onClose();
    }
  };

  const handleDelete = (e, notifId) => {
    e.stopPropagation();
    deleteNotification(notifId);
  };

  const handleInlineAck = async (e, notif) => {
    e.stopPropagation();
    const taskId = notif.entity_id || notif.message_data?.task_id;
    if (!taskId) return;
    const currentUserId = user?.id || 'demo-user-123';

    try {
      if (isSupabaseConfigured() && !isDemoMode) {
        // 1. Update task_acknowledgements table in Supabase
        const { error: ackErr } = await supabase
          .from('task_acknowledgements')
          .update({
            is_acknowledged: true,
            acknowledged_at: new Date().toISOString(),
          })
          .eq('task_id', taskId)
          .eq('user_id', currentUserId);

        if (ackErr) {
          console.warn('Direct update error, trying upsert:', ackErr);
          await supabase
            .from('task_acknowledgements')
            .upsert({
              task_id: taskId,
              user_id: currentUserId,
              is_acknowledged: true,
              acknowledged_at: new Date().toISOString(),
            }, { onConflict: 'task_id,user_id' });
        }

        // 2. Mark notification as read
        await markAsRead(notif.id);

        // 3. Trigger global store to fetchTasks() so the main UI updates instantly
        if (typeof fetchTasks === 'function') {
          await fetchTasks();
        } else if (typeof refreshTasks === 'function') {
          await refreshTasks();
        }
      } else {
        // Demo / offline mode
        const targetTask = allTasks?.find((t) => t.id === taskId);
        const myAck = targetTask?.task_acknowledgements?.find((a) => a.user_id === currentUserId);
        if (myAck) {
          if (!myAck.is_acknowledged) {
            await toggleAcknowledgement(taskId, myAck.id, currentUserId);
          }
        } else {
          await toggleAcknowledgement(taskId, null, currentUserId);
        }
        await markAsRead(notif.id);
      }

      // 4. Show success toast
      toast.success('Task acknowledged successfully! 🎉', {
        id: `ack-${taskId}`,
        duration: 3000,
      });
    } catch (err) {
      console.error('Error acknowledging task:', err);
      toast.error('Failed to acknowledge task: ' + err.message);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return format(parseISO(dateStr), 'MM/dd/yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <div 
      ref={popoverRef}
      className="fixed md:absolute bottom-16 left-4 md:left-full md:bottom-0 md:ml-3 w-[380px] max-w-[92vw] bg-white dark:bg-[#1e1f23] text-slate-800 dark:text-slate-100 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 z-50 overflow-hidden flex flex-col max-h-[520px] animate-in fade-in zoom-in-95 duration-150 select-none transition-colors"
    >
      {/* ── Segmented Control Header (Dual-Mode Themed) ── */}
      <div className="p-3 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-[#191a1d] transition-colors">
        
        {/* Centered Segmented Tabs */}
        <div className="flex bg-slate-200/80 dark:bg-[#2a2b30] p-1 rounded-full mx-auto shadow-inner transition-colors">
          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            className={`px-4 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'notifications'
                ? 'bg-white dark:bg-[#3f4148] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-500 text-white font-bold leading-tight">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('activities')}
            className={`px-4 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'activities'
                ? 'bg-white dark:bg-[#3f4148] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Activities
          </button>
        </div>

        {/* Header Right Action: Mark All Read */}
        {unreadCount > 0 && activeTab === 'notifications' && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold px-2 py-1 rounded hover:bg-slate-200/50 dark:hover:bg-white/5 transition-colors absolute right-3 cursor-pointer"
            title="Mark all as read"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* ── Tab Content Area ── */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
        {activeTab === 'notifications' ? (
          notifications.length === 0 ? (
            /* Empty State */
            <div className="p-10 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-3">
                <Bell className="w-6 h-6 text-slate-400 dark:text-slate-500 opacity-60" />
              </div>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No notifications</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs leading-relaxed">
                You're all caught up! When team members assign tasks or make updates, they will appear here in real time.
              </p>
            </div>
          ) : (
            notifications.map((notif) => {
              const isTickTickSystem = notif.actor_name === 'TickTick' || notif.type === 'shared_list';
              const avatarSrc = isTickTickSystem 
                ? null 
                : getAvatarUrl(notif.actor_avatar, notif.actor_name);

              return (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer group relative ${
                    !notif.is_read 
                      ? 'bg-blue-50/60 hover:bg-blue-100/50 dark:bg-blue-500/5 dark:hover:bg-blue-500/10' 
                      : 'hover:bg-slate-50/80 dark:hover:bg-white/5'
                  }`}
                >
                  {/* Left Avatar */}
                  <div className="shrink-0 mt-0.5">
                    {isTickTickSystem ? (
                      <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center p-1.5 shadow-xs border border-slate-200 dark:border-white/20">
                        <div className="w-full h-full rounded-full border-2 border-amber-400 border-t-blue-500 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-blue-500 stroke-[3]" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden ring-1 ring-slate-300 dark:ring-white/10 shadow-xs">
                        <img 
                          src={avatarSrc} 
                          alt={notif.actor_name} 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                    )}
                  </div>

                  {/* Middle Content */}
                  <div className="flex-1 min-w-0 pr-1">
                    {/* Top Row: Actor Name + Date + Delete Button */}
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {notif.actor_name}
                      </span>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {formatDate(notif.created_at)}
                        </span>

                        {/* Individual Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, notif.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                          title="Delete notification"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Message Body */}
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                      {notif.type === 'task_assigned' ? (
                        <>
                          <span className="text-slate-500 dark:text-slate-400">assigned task </span>
                          <span className="text-blue-600 dark:text-[#4e82f7] font-semibold hover:underline">
                            '{notif.message_data?.task_title || 'Task'}'
                          </span>
                          <span className="text-slate-500 dark:text-slate-400"> in list </span>
                          <span className="text-blue-600 dark:text-[#4e82f7] font-semibold">
                            {notif.message_data?.list_name || 'Inbox'}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400"> to you.</span>
                        </>
                      ) : notif.type === 'nudge_ack' ? (
                        <div className="space-y-2 mt-0.5">
                          <p className="leading-snug">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {notif.actor_name}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400"> nudged you to finish your part on </span>
                            <span className="text-blue-600 dark:text-[#4e82f7] font-semibold">
                              '{notif.message_data?.task_title || 'Team Task'}'
                            </span>
                            .
                          </p>

                          {/* Actionable Inline Acknowledgement Button */}
                          <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const currentUserId = user?.id || 'demo-user-123';
                              const targetTaskId = notif.entity_id || notif.message_data?.task_id;
                              const targetTask = allTasks?.find((t) => t.id === targetTaskId);
                              const myAck = targetTask?.task_acknowledgements?.find((a) => a.user_id === currentUserId);
                              const isDone = myAck?.is_acknowledged;

                              if (isDone) {
                                return (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30">
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    <span>Part Finished</span>
                                  </span>
                                );
                              }

                              return (
                                <button
                                  type="button"
                                  onClick={(e) => handleInlineAck(e, notif)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-xs transition-all cursor-pointer ring-1 ring-emerald-500/30 hover:shadow-md"
                                  title="Mark your part as finished"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>Finish My Part</span>
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                      ) : notif.type === 'shared_list' ? (
                        <span>
                          {notif.message_data?.custom_text || 'You\'ve joined a shared list.'}
                        </span>
                      ) : (
                        <span>
                          {notif.message_data?.custom_text || notif.message_data?.task_title || 'New activity notification.'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Unread Indicator Dot */}
                  {!notif.is_read && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-500 shrink-0 mt-2 shadow-xs shadow-blue-500/50" />
                  )}
                </div>
              );
            })
          )
        ) : (
          /* ── Activities Tab ── */
          <div className="p-4 space-y-3">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
              Recent Workspace Activities
            </div>
            {allTasks.slice(0, 8).map((task) => (
              <div 
                key={task.id} 
                onClick={() => {
                  setSelectedTaskId(task.id);
                  if (setActiveView) setActiveView('tasks');
                  onClose();
                }}
                className="p-2.5 rounded-xl hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2.5"
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${task.is_completed ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-slate-800 dark:text-white truncate block">
                    {task.title}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {task.is_completed ? 'Marked complete' : 'Updated recently'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="p-2.5 px-4 bg-slate-50 dark:bg-[#191a1d] border-t border-slate-200 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 transition-colors">
        <span className="font-medium">Real-time Activity Sync</span>
        
        <div className="flex items-center gap-2">
          {notifications.length > 0 && activeTab === 'notifications' && (
            <button
              type="button"
              onClick={clearAllNotifications}
              className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 px-2 py-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer flex items-center gap-1 font-semibold"
              title="Delete all notifications"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear all</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2 py-0.5 rounded hover:bg-slate-200/50 dark:hover:bg-white/5 transition-colors cursor-pointer font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
