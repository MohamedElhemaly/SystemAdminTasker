import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { getAvatarUrl } from '../../lib/avatars';
import { 
  Inbox, Layers, Calendar, CalendarDays, Folder, Users, Plus, ChevronLeft, 
  ChevronRight, LogOut, User, UserCheck, Sparkles, Shield, GitFork, Settings, 
  CheckSquare, ShieldAlert, MonitorDown, Bell, LayoutGrid 
} from 'lucide-react';
import { isToday, isPast, isWithinInterval, addDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import { ThemeToggle } from '../common/ThemeToggle';
import { SoundToggle } from '../common/SoundToggle';
import { useNotifications } from '../../context/NotificationContext';
import { NotificationPopover } from '../notifications/NotificationPopover';

export const Sidebar = ({ 
  isCollapsed, 
  setIsCollapsed, 
  onOpenAuth, 
  onOpenProfile, 
  activeView, 
  setActiveView,
  onEditTeam,
  deferredPrompt,
  onInstallPWA
}) => {
  const { user, profile, isDemoMode, signOut } = useAuth();
  const { lists = [], teams = [], allTasks = [], selectedListId, setSelectedListId } = useTasks();
  const { unreadCount = 0 } = useNotifications();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Compute Task Counts for Smart Lists with safe fallback handling
  const countAll = (allTasks || []).filter(t => !t?.is_completed).length;
  const countToday = (allTasks || []).filter(t => {
    if (t?.is_completed || !t?.due_date) return false;
    try {
      const d = parseISO(t.due_date);
      return isToday(d) || isPast(d);
    } catch (e) {
      return false;
    }
  }).length;

  const countNext7 = (allTasks || []).filter(t => {
    if (t?.is_completed || !t?.due_date) return false;
    try {
      const date = parseISO(t.due_date);
      return isWithinInterval(date, { start: startOfDay(new Date()), end: endOfDay(addDays(new Date(), 7)) });
    } catch (e) {
      return false;
    }
  }).length;

  const countAssignedMe = (allTasks || []).filter(t => {
    if (t?.is_completed) return false;
    const assignedList = Array.isArray(t?.assigned_users) ? t.assigned_users : [];
    const myId = user?.id || profile?.id;
    return assignedList.includes(myId) || t?.assigned_to === myId;
  }).length;

  const getListTaskCount = (listId) => {
    return (allTasks || []).filter(t => t?.list_id === listId && !t?.is_completed).length;
  };

  const userRole = profile?.role || 'manager';
  const avatarSrc = getAvatarUrl(profile?.avatar_id, profile?.full_name);

  return (
    <aside
      className={`h-screen bg-slate-50 dark:bg-[#1b1c20] text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 shrink-0 select-none z-20 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* 1. Header & User Profile */}
      <div className={`p-3 border-b border-slate-200 dark:border-slate-800/80 flex ${isCollapsed ? 'flex-col gap-3 justify-center items-center' : 'items-center justify-between'}`}>
        {!isCollapsed ? (
          <div 
            onClick={onOpenProfile}
            className="flex items-center gap-2.5 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
            title="Click to open Profile Settings & Built-in Avatar"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 p-0.5 shadow-sm shrink-0">
              <img src={avatarSrc} alt="Avatar" className="w-full h-full rounded-full object-cover bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {profile?.full_name || user?.email?.split('@')[0] || 'Ahmed Hassan'}
                </span>
                <Settings className="w-3 h-3 text-slate-400 shrink-0" />
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded uppercase tracking-wider ${
                  userRole === 'manager'
                    ? 'bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30'
                    : userRole === 'sub_manager' || userRole === 'deputy_manager'
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30'
                    : 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30'
                }`}>
                  {userRole === 'manager' ? 'Manager (المراجع)' : userRole === 'sub_manager' || userRole === 'deputy_manager' ? 'Sub-Manager' : 'Member'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div 
            onClick={onOpenProfile}
            className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center cursor-pointer p-0.5 border border-blue-500"
          >
            <img src={avatarSrc} alt="Avatar" className="w-full h-full rounded-full object-cover" />
          </div>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* View Mode Switcher (Tasks vs Calendar vs Map vs Admin) */}
      <div className="p-2 border-b border-slate-200 dark:border-slate-800/80">
        <div className={`${isCollapsed ? 'flex flex-col gap-1' : 'grid grid-cols-2 gap-1'} bg-slate-200/60 dark:bg-[#23242a] p-1 rounded-xl border border-slate-300/60 dark:border-slate-800`}>
          <button
            type="button"
            onClick={() => setActiveView('tasks')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeView === 'tasks' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-300/40 dark:hover:bg-slate-700/40'
            }`}
            title="Task List"
          >
            <CheckSquare className="w-3.5 h-3.5 shrink-0" />
            {!isCollapsed && <span className="truncate">Tasks</span>}
          </button>

          <button
            type="button"
            onClick={() => setActiveView('matrix')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeView === 'matrix' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-300/40 dark:hover:bg-slate-700/40'
            }`}
            title="Eisenhower Matrix View (Urgent & Important)"
          >
            <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
            {!isCollapsed && <span className="truncate">Matrix</span>}
          </button>

          <button
            type="button"
            onClick={() => setActiveView('calendar')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeView === 'calendar' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-300/40 dark:hover:bg-slate-700/40'
            }`}
            title="Full Month Calendar View & Google 2-Way Sync"
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            {!isCollapsed && <span className="truncate">Calendar</span>}
          </button>
          
          <button
            type="button"
            onClick={() => setActiveView('map')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeView === 'map' ? 'bg-pink-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-300/40 dark:hover:bg-slate-700/40'
            }`}
            title="Task Delegation Map"
          >
            <GitFork className="w-3.5 h-3.5 shrink-0" />
            {!isCollapsed && <span className="truncate">Map</span>}
          </button>

          {userRole === 'manager' && (
            <button
              type="button"
              onClick={() => setActiveView('admin')}
              className={`col-span-2 py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeView === 'admin' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-300/40 dark:hover:bg-slate-700/40'
              }`}
              title="Super-Admin Dashboard (Manager ONLY)"
            >
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              {!isCollapsed && <span className="truncate">Admin</span>}
            </button>
          )}
        </div>
      </div>

      {/* 2. Navigation Items */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        
        {/* Smart Lists */}
        <div>
          {!isCollapsed && <div className="px-2 mb-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Smart Views</div>}
          <div className="space-y-0.5">
            {/* 1. All Tasks */}
            <button
              onClick={() => { setSelectedListId('list-all'); setActiveView('tasks'); }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-2.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                (selectedListId === 'list-all' || selectedListId === 'list-inbox') && activeView === 'tasks'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-[#26272e] dark:hover:text-white'
              }`}
              title="All Tasks"
            >
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
                <Layers className={`w-4 h-4 shrink-0 ${(selectedListId === 'list-all' || selectedListId === 'list-inbox') && activeView === 'tasks' ? 'text-white' : 'text-blue-500 dark:text-blue-400'}`} />
                {!isCollapsed && <span className="truncate">All</span>}
              </div>
              {!isCollapsed && countAll > 0 && (
                <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${(selectedListId === 'list-all' || selectedListId === 'list-inbox') && activeView === 'tasks' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'}`}>
                  {countAll}
                </span>
              )}
            </button>

            {/* 2. Today + Overdue */}
            <button
              onClick={() => { setSelectedListId('list-today'); setActiveView('tasks'); }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-2.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                selectedListId === 'list-today' && activeView === 'tasks'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-[#26272e] dark:hover:text-white'
              }`}
              title="Today & Overdue Tasks"
            >
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
                <Calendar className={`w-4 h-4 shrink-0 ${selectedListId === 'list-today' && activeView === 'tasks' ? 'text-white' : 'text-emerald-500 dark:text-emerald-400'}`} />
                {!isCollapsed && <span className="truncate">Today</span>}
              </div>
              {!isCollapsed && countToday > 0 && (
                <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${selectedListId === 'list-today' && activeView === 'tasks' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'}`}>
                  {countToday}
                </span>
              )}
            </button>

            {/* 3. Next 7 Days */}
            <button
              onClick={() => { setSelectedListId('list-next7'); setActiveView('tasks'); }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-2.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                selectedListId === 'list-next7' && activeView === 'tasks'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-[#26272e] dark:hover:text-white'
              }`}
              title="Next 7 Days"
            >
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
                <CalendarDays className={`w-4 h-4 shrink-0 ${selectedListId === 'list-next7' && activeView === 'tasks' ? 'text-white' : 'text-purple-500 dark:text-purple-400'}`} />
                {!isCollapsed && <span className="truncate">Next 7 Days</span>}
              </div>
              {!isCollapsed && countNext7 > 0 && (
                <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${selectedListId === 'list-next7' && activeView === 'tasks' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'}`}>
                  {countNext7}
                </span>
              )}
            </button>

            {/* 4. Assigned to me */}
            <button
              onClick={() => { setSelectedListId('list-assigned-me'); setActiveView('tasks'); }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-2.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                selectedListId === 'list-assigned-me' && activeView === 'tasks'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-[#26272e] dark:hover:text-white'
              }`}
              title="Assigned to me"
            >
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
                <UserCheck className={`w-4 h-4 shrink-0 ${selectedListId === 'list-assigned-me' && activeView === 'tasks' ? 'text-white' : 'text-amber-500 dark:text-amber-400'}`} />
                {!isCollapsed && <span className="truncate">Assigned to me</span>}
              </div>
              {!isCollapsed && countAssignedMe > 0 && (
                <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${selectedListId === 'list-assigned-me' && activeView === 'tasks' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'}`}>
                  {countAssignedMe}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Custom Lists (Personal & Teams) */}
        <div>
          {!isCollapsed && (
            <div className="flex items-center justify-between px-2 mb-1.5">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lists & Folders</span>
            </div>
          )}

          <div className="space-y-0.5">
            {lists.filter(l => !l.is_smart).map((list) => {
              const count = getListTaskCount(list.id);
              const isSelected = selectedListId === list.id && activeView === 'tasks';

              return (
                <button
                  key={list.id}
                  onClick={() => { setSelectedListId(list.id); setActiveView('tasks'); }}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-2.5 py-2 rounded-xl text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-700 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-[#26272e] dark:hover:text-white'
                  }`}
                >
                  <div className={`flex items-center min-w-0 ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
                    {list.team_id ? (
                      <Users className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-pink-500 dark:text-pink-400'}`} />
                    ) : (
                      <Folder className="w-4 h-4 shrink-0" style={{ color: isSelected ? '#ffffff' : (list.color || '#3b82f6') }} />
                    )}
                    {!isCollapsed && <span className="truncate">{list.name}</span>}
                  </div>

                  {!isCollapsed && count > 0 && (
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Teams & Members Section */}
        {!isCollapsed && teams.length > 0 && (
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center justify-between px-2 mb-1.5">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Teams & Members</span>
            </div>

            <div className="space-y-2">
              {teams.map((t) => (
                <div key={t.id} className="p-2 rounded-xl bg-white dark:bg-[#23242a] border border-slate-200 dark:border-slate-800/80 shadow-xs">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Shield className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{t.name}</span>
                    </div>
                    {(userRole === 'manager' || t.created_by === user?.id) && onEditTeam && (
                      <button 
                        onClick={() => onEditTeam(t)} 
                        className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1 rounded-md transition-colors"
                        title="Edit Team Members"
                      >
                        <Settings className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="pl-2 space-y-1 border-l-2 border-slate-200 dark:border-slate-700/60 ml-1">
                    {t.members?.map((m) => (
                      <div key={m.id || m.user_id} className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="truncate">{m.full_name || m.email}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Footer Profile & Auth Actions */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-800/80 space-y-1.5 relative">
        {/* Notifications & Activity Popover Trigger (TickTick Style) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} p-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isNotificationsOpen 
                ? 'bg-blue-600/15 text-blue-500 border border-blue-500/30' 
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
            }`}
            title="Notifications & Activities"
          >
            <div className="flex items-center gap-2">
              <div className="relative">
                <Bell className="w-4 h-4 shrink-0" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </div>
              {!isCollapsed && <span>Notifications</span>}
            </div>

            {!isCollapsed && unreadCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-red-500/10 text-red-500 border border-red-500/20 font-bold rounded-full">
                {unreadCount} new
              </span>
            )}
          </button>

          <NotificationPopover
            isOpen={isNotificationsOpen}
            onClose={() => setIsNotificationsOpen(false)}
            setActiveView={setActiveView}
          />
        </div>

        <div className={`grid ${isCollapsed ? 'grid-cols-1' : 'grid-cols-2'} gap-1.5`}>
          <ThemeToggle isCollapsed={isCollapsed} />
          <SoundToggle isCollapsed={isCollapsed} />
        </div>
        
        <button
          onClick={() => {
            if (deferredPrompt) {
              onInstallPWA();
            } else {
              import('react-hot-toast').then(m => m.toast.error('Desktop App is already installed or initializing. (Make sure you are on https/localhost)'));
            }
          }}
          className="w-full flex items-center justify-center gap-2 p-2 mb-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <MonitorDown className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span className="truncate">Install Desktop App</span>}
        </button>
        
        {user ? (
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 p-2 rounded-xl text-xs text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="truncate">Sign Out</span>}
          </button>
        ) : (
          <button
            onClick={onOpenAuth}
            className="w-full flex items-center justify-center gap-2 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
          >
            <User className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="truncate">Sign In / Auth</span>}
          </button>
        )}
      </div>
    </aside>
  );
};
