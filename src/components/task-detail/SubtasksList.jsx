import React, { useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import { Plus, CheckSquare, Trash2, Check } from 'lucide-react';

export const SubtasksList = ({ task }) => {
  const { addSubtask, toggleSubtask, deleteSubtask } = useTasks();
  const [newTitle, setNewTitle] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if (newTitle.trim()) {
      addSubtask(task.id, newTitle.trim());
      setNewTitle('');
    }
  };

  const subtasks = task.subtasks || [];
  const completedCount = subtasks.filter(s => s.is_completed).length;
  const progressPercent = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
          <CheckSquare className="w-4 h-4 text-blue-400" />
          <span>Sub-tasks / Checklist</span>
        </div>
        {subtasks.length > 0 && (
          <span className="text-[11px] font-semibold text-slate-400">
            {completedCount}/{subtasks.length} ({progressPercent}%)
          </span>
        )}
      </div>

      {/* Progress Bar */}
      {subtasks.length > 0 && (
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Subtasks Items */}
      <div className="space-y-1.5">
        {subtasks.map((sub) => (
          <div
            key={sub.id}
            className="group flex items-center justify-between gap-2 p-2 rounded-xl bg-[#23242a] border border-slate-800/80 hover:border-slate-700/60 transition-all"
          >
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => toggleSubtask(task.id, sub.id)}
                className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                  sub.is_completed
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-slate-600 hover:border-blue-400'
                }`}
              >
                {sub.is_completed && <Check className="w-3 h-3" />}
              </button>
              <span className={`text-xs text-slate-200 truncate ${sub.is_completed ? 'line-through text-slate-500' : ''}`}>
                {sub.title}
              </span>
            </div>

            <button
              type="button"
              onClick={() => deleteSubtask(task.id, sub.id)}
              className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add Subtask Input */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          placeholder="Add sub-task..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="flex-1 px-3 py-1.5 bg-[#23242a] border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={!newTitle.trim()}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </form>
    </div>
  );
};
