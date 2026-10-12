import React from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { Layers, Calendar, GitFork, ShieldAlert, User, LayoutGrid } from 'lucide-react';

export const MobileBottomNav = ({ activeView, setActiveView, onOpenProfile }) => {
  const { setSelectedListId, selectedListId } = useTasks();
  const { profile } = useAuth();

  const userRole = profile?.role || 'manager';

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-[#1b1c20] border-t border-slate-200 dark:border-slate-800 flex items-center justify-around z-40 px-2 select-none shadow-lg">
      <button
        onClick={() => { setSelectedListId('list-all'); setActiveView('tasks'); }}
        className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors cursor-pointer ${
          (selectedListId === 'list-all' || selectedListId === 'list-inbox') && activeView === 'tasks' ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        <Layers className="w-5 h-5" />
        <span>All</span>
      </button>

      <button
        onClick={() => setActiveView('matrix')}
        className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors cursor-pointer ${
          activeView === 'matrix' ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        <LayoutGrid className="w-5 h-5" />
        <span>Matrix</span>
      </button>

      <button
        onClick={() => setActiveView('calendar')}
        className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors cursor-pointer ${
          activeView === 'calendar' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        <Calendar className="w-5 h-5" />
        <span>Calendar</span>
      </button>

      <button
        onClick={() => setActiveView('map')}
        className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors cursor-pointer ${
          activeView === 'map' ? 'text-pink-600 dark:text-pink-400 font-bold' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        <GitFork className="w-5 h-5" />
        <span>Task Map</span>
      </button>

      {userRole === 'manager' && (
        <button
          onClick={() => setActiveView('admin')}
          className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors cursor-pointer ${
            activeView === 'admin' ? 'text-purple-600 dark:text-purple-400 font-bold' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <ShieldAlert className="w-5 h-5" />
          <span>Admin</span>
        </button>
      )}

      <button
        onClick={onOpenProfile}
        className="flex flex-col items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
      >
        <User className="w-5 h-5" />
        <span>Profile</span>
      </button>
    </div>
  );
};
