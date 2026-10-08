import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { getAvatarUrl } from '../../lib/avatars';
import { 
  Inbox, Calendar, CalendarDays, Folder, Users, Plus, ChevronLeft, 
  ChevronRight, LogOut, User, Sparkles, Shield, GitFork, Settings, 
  CheckSquare, ShieldAlert 
} from 'lucide-react';
import { isToday, isWithinInterval, addDays, startOfDay, endOfDay, parseISO } from 'date-fns';

export const Sidebar = ({ 
  isCollapsed, 
  setIsCollapsed, 
  onOpenAuth, 
  onOpenProfile, 
  activeView, 
  setActiveView 
}) => {
  const { user, profile, isDemoMode, signOut } = useAuth();
  const { lists = [], teams = [], allTasks = [], selectedListId, setSelectedListId } = useTasks();

  // Compute Task Counts for Smart Lists with safe fallback handling
  const countInbox = (allTasks || []).filter(t => !t?.is_completed).length;
  const countToday = (allTasks || []).filter(t => {
    if (t?.is_completed || !t?.due_date) return false;
    try {
      return isToday(parseISO(t.due_date));
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

  const getListTaskCount = (listId) => {
    return (allTasks || []).filter(t => t?.list_id === listId && !t?.is_completed).length;
  };

  const userRole = profile?.role || 'manager';
  const avatarSrc = getAvatarUrl(profile?.avatar_id, profile?.full_name);

  return (
    <aside
      className={`h-screen bg-[#1b1c20] text-slate-300 border-r border-slate-800 flex flex-col transition-all duration-300 shrink-0 select-none z-20 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* 1. Header & User Profile */}
      <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
        {!isCollapsed ? (
          <div 
            onClick={onOpenProfile}
            className="flex items-center gap-2.5 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
            title="Click to open Profile Settings & Built-in Avatar"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 p-0.5 shadow-md shrink-0">
              <img src={avatarSrc} alt="Avatar" className="w-full h-full rounded-full object-cover bg-slate-800" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-white truncate">
                  {profile?.full_name || user?.email?.split('@')[0] || 'Ahmed Hassan'}
                </span>
                <Settings className="w-3 h-3 text-slate-400 shrink-0" />
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded uppercase tracking-wider ${
                  userRole === 'manager'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : userRole === 'sub_manager' || userRole === 'deputy_manager'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}>
                  {userRole === 'manager' ? 'Manager (المراجع)' : userRole === 'sub_manager' || userRole === 'deputy_manager' ? 'Sub-Manager' : 'Member'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div 
            onClick={onOpenProfile}
            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center cursor-pointer p-0.5 border border-blue-500"
          >
            <img src={avatarSrc} alt="Avatar" className="w-full h-full rounded-full object-cover" />
          </div>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* View Mode Switcher (Tasks vs Delegation Map vs Admin) */}
      <div className="p-2 border-b border-slate-800/80">
        <div className="flex bg-[#23242a] p-1 rounded-xl border border-slate-800 gap-1">
          <button
            type="button"
            onClick={() => setActiveView('tasks')}
            className={`flex-1 py-1.5 px-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
              activeView === 'tasks' ? 'bg-[#4772fa] text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 shrink-0" />
            {!isCollapsed && <span>Tasks</span>}
          </button>
          
          <button
            type="button"
            onClick={() => setActiveView('map')}
            className={`flex-1 py-1.5 px-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
              activeView === 'map' ? 'bg-pink-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitFork className="w-3.5 h-3.5 shrink-0" />
            {!isCollapsed && <span>Map</span>}
          </button>

          {userRole === 'manager' && (
            <button
              type="button"
              onClick={() => setActiveView('admin')}
              className={`flex-1 py-1.5 px-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
                activeView === 'admin' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Super-Admin Dashboard (Manager ONLY)"
            >
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              {!isCollapsed && <span>Admin</span>}
            </button>
          )}
        </div>
      </div>

      {/* 2. Navigation Items */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        
        {/* Smart Lists */}
        <div>
          {!isCollapsed && <div className="px-2 mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Smart Views</div>}
          <div className="space-y-0.5">
            <button
              onClick={() => { setSelectedListId('list-inbox'); setActiveView('tasks'); }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all ${
                selectedListId === 'list-inbox' && activeView === 'tasks'
                  ? 'bg-[#4772fa] text-white font-semibold shadow-md shadow-blue-500/20'
                  : 'text-slate-300 hover:bg-[#26272e] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Inbox className="w-4 h-4 text-blue-400 shrink-0" />
                {!isCollapsed && <span className="truncate">Inbox</span>}
              </div>
              {!isCollapsed && countInbox > 0 && (
                <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${selectedListId === 'list-inbox' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {countInbox}
                </span>
              )}
            </button>

            <button
              onClick={() => { setSelectedListId('list-today'); setActiveView('tasks'); }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all ${
                selectedListId === 'list-today' && activeView === 'tasks'
                  ? 'bg-[#4772fa] text-white font-semibold shadow-md shadow-blue-500/20'
                  : 'text-slate-300 hover:bg-[#26272e] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                {!isCollapsed && <span className="truncate">Today</span>}
              </div>
              {!isCollapsed && countToday > 0 && (
                <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${selectedListId === 'list-today' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {countToday}
                </span>
              )}
            </button>

            <button
              onClick={() => { setSelectedListId('list-next7'); setActiveView('tasks'); }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all ${
                selectedListId === 'list-next7' && activeView === 'tasks'
                  ? 'bg-[#4772fa] text-white font-semibold shadow-md shadow-blue-500/20'
                  : 'text-slate-300 hover:bg-[#26272e] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CalendarDays className="w-4 h-4 text-purple-400 shrink-0" />
                {!isCollapsed && <span className="truncate">Next 7 Days</span>}
              </div>
              {!isCollapsed && countNext7 > 0 && (
                <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${selectedListId === 'list-next7' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {countNext7}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Custom Lists (Personal & Teams) */}
        <div>
          {!isCollapsed && (
            <div className="flex items-center justify-between px-2 mb-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lists & Folders</span>
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
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-[#4772fa] text-white font-semibold shadow-md shadow-blue-500/20'
                      : 'text-slate-300 hover:bg-[#26272e] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {list.team_id ? (
                      <Users className="w-4 h-4 text-pink-400 shrink-0" />
                    ) : (
                      <Folder className="w-4 h-4 shrink-0" style={{ color: list.color || '#3b82f6' }} />
                    )}
                    {!isCollapsed && <span className="truncate">{list.name}</span>}
                  </div>

                  {!isCollapsed && count > 0 && (
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
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
          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between px-2 mb-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Teams & Members</span>
            </div>

            <div className="space-y-2">
              {teams.map((t) => (
                <div key={t.id} className="p-2 rounded-xl bg-[#23242a] border border-slate-800/80">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Shield className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-semibold text-slate-200 truncate">{t.name}</span>
                  </div>
                  <div className="pl-2 space-y-1 border-l-2 border-slate-700/60 ml-1">
                    {t.members?.map((m) => (
                      <div key={m.id || m.user_id} className="flex items-center gap-2 text-[11px] text-slate-400">
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
      <div className="p-2 border-t border-slate-800/80 space-y-1">
        {user ? (
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 p-2 rounded-xl text-xs text-slate-400 hover:text-red-400 hover:bg-slate-800/50 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="truncate">Sign Out</span>}
          </button>
        ) : (
          <button
            onClick={onOpenAuth}
            className="w-full flex items-center justify-center gap-2 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20"
          >
            <User className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="truncate">Sign In / Auth</span>}
          </button>
        )}
      </div>
    </aside>
  );
};
