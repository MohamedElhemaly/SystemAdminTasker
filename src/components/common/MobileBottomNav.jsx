import React from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { Inbox, Calendar, GitFork, ShieldAlert, User } from 'lucide-react';

export const MobileBottomNav = ({ activeView, setActiveView, onOpenProfile }) => {
  const { setSelectedListId, selectedListId } = useTasks();
  const { profile } = useAuth();

  const userRole = profile?.role || 'manager';

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#1b1c20] border-t border-slate-800 flex items-center justify-around z-40 px-2 select-none shadow-2xl">
      <button
        onClick={() => { setSelectedListId('list-inbox'); setActiveView('tasks'); }}
        className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
          selectedListId === 'list-inbox' && activeView === 'tasks' ? 'text-blue-400 font-bold' : 'text-slate-400'
        }`}
      >
        <Inbox className="w-5 h-5" />
        <span>Inbox</span>
      </button>

      <button
        onClick={() => { setSelectedListId('list-today'); setActiveView('tasks'); }}
        className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
          selectedListId === 'list-today' && activeView === 'tasks' ? 'text-emerald-400 font-bold' : 'text-slate-400'
        }`}
      >
        <Calendar className="w-5 h-5" />
        <span>Today</span>
      </button>

      <button
        onClick={() => setActiveView('map')}
        className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
          activeView === 'map' ? 'text-pink-400 font-bold' : 'text-slate-400'
        }`}
      >
        <GitFork className="w-5 h-5" />
        <span>Task Map</span>
      </button>

      {userRole === 'manager' && (
        <button
          onClick={() => setActiveView('admin')}
          className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
            activeView === 'admin' ? 'text-purple-400 font-bold' : 'text-slate-400'
          }`}
        >
          <ShieldAlert className="w-5 h-5" />
          <span>Admin</span>
        </button>
      )}

      <button
        onClick={onOpenProfile}
        className="flex flex-col items-center gap-1 text-[10px] font-medium text-slate-400"
      >
        <User className="w-5 h-5" />
        <span>Profile</span>
      </button>
    </div>
  );
};
