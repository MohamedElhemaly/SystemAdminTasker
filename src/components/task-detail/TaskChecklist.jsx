import React, { useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { CheckSquare, Plus, Trash2, Check, Edit2, Lock, Sparkles, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const TaskChecklist = ({ task }) => {
  const { 
    addChecklistItem, 
    toggleChecklistItem, 
    deleteChecklistItem, 
    updateChecklistItemTitle 
  } = useTasks();
  const { user, profile } = useAuth();

  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');

  const currentRole = profile?.role || 'member';
  const isManagerOrSub = ['manager', 'sub_manager', 'deputy_manager', 'admin'].includes(currentRole);
  const isMember = currentRole === 'member';

  // Support both task_checklists and subtasks
  const checklist = task?.task_checklists || task?.subtasks || [];
  const completedCount = checklist.filter(item => item.is_completed).length;
  const totalCount = checklist.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isAllCompleted = totalCount > 0 && completedCount === totalCount;

  // Add Item Handler (Managers/Sub-Managers Only)
  const handleAdd = async (e) => {
    e.preventDefault();
    if (isMember) {
      toast.error('Security Restriction: Only Managers can add checklist items.');
      return;
    }
    if (!newTitle.trim()) return;

    await addChecklistItem(task.id, newTitle.trim());
    setNewTitle('');
  };

  // Start Inline Edit (Managers Only)
  const handleStartEdit = (item) => {
    if (!isManagerOrSub) return;
    setEditingId(item.id);
    setEditingText(item.title);
  };

  // Submit Inline Edit
  const handleSaveEdit = async (itemId) => {
    if (editingText.trim()) {
      await updateChecklistItemTitle(task.id, itemId, editingText.trim());
    }
    setEditingId(null);
    setEditingText('');
  };

  const handleEditKeyDown = (e, itemId) => {
    if (e.key === 'Enter') {
      handleSaveEdit(itemId);
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditingText('');
    }
  };

  return (
    <div className="space-y-3.5 select-none">
      {/* ── 1. Header & Progress Text Indicator ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Checklist
          </span>
          {isMember && (
            <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-medium">
              <Lock className="w-2.5 h-2.5" /> Read-Only
            </span>
          )}
        </div>

        {totalCount > 0 && (
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border transition-all ${
              isAllCompleted
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
                : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
            }`}>
              {completedCount}/{totalCount} Completed ({progressPercent}%)
            </span>
          </div>
        )}
      </div>

      {/* ── 2. Sleek Progress Bar ── */}
      {totalCount > 0 && (
        <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner border border-slate-200/60 dark:border-slate-700/60">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isAllCompleted
                ? 'bg-emerald-500'
                : 'bg-gradient-to-r from-blue-600 to-indigo-500 dark:from-blue-500 dark:to-indigo-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* ── 3. Checklist Items List ── */}
      <div className="space-y-1.5">
        {checklist.map((item) => {
          const isItemCompleted = Boolean(item.is_completed);
          const isCurrentlyEditing = editingId === item.id;

          return (
            <div
              key={item.id}
              className={`group flex items-center justify-between gap-2.5 p-2 px-2.5 rounded-xl border transition-all shadow-2xs ${
                isItemCompleted
                  ? 'bg-slate-50/80 dark:bg-[#1f2025]/60 border-slate-200/70 dark:border-slate-800/60 opacity-85'
                  : 'bg-white dark:bg-[#23242a] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700/80'
              }`}
            >
              {/* Left: TickTick Custom Checkbox + Item Title */}
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => toggleChecklistItem(task.id, item.id)}
                  className={`w-4 h-4 rounded-xs border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                    isItemCompleted
                      ? 'bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500 text-white shadow-xs'
                      : 'border-slate-400 dark:border-slate-500 bg-white dark:bg-transparent hover:border-blue-500 dark:hover:border-blue-400'
                  }`}
                  title={isItemCompleted ? 'Mark as incomplete' : 'Mark as completed'}
                >
                  {isItemCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                </button>

                {isCurrentlyEditing ? (
                  <input
                    type="text"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={() => handleSaveEdit(item.id)}
                    onKeyDown={(e) => handleEditKeyDown(e, item.id)}
                    autoFocus
                    className="flex-1 px-2 py-0.5 text-xs bg-slate-100 dark:bg-[#1a1b20] border border-blue-500 rounded text-slate-900 dark:text-white focus:outline-none"
                  />
                ) : (
                  <span
                    onDoubleClick={() => handleStartEdit(item)}
                    className={`flex-1 text-xs truncate transition-colors ${
                      isItemCompleted
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-slate-800 dark:text-slate-200'
                    } ${isManagerOrSub ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400' : ''}`}
                    title={isManagerOrSub ? 'Double-click to edit title' : item.title}
                  >
                    {item.title}
                  </span>
                )}
              </div>

              {/* Right: Actions (Trash + Edit for Managers) */}
              {isManagerOrSub && !isCurrentlyEditing && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(item)}
                    className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors cursor-pointer"
                    title="Edit title"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteChecklistItem(task.id, item.id)}
                    className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors cursor-pointer"
                    title="Delete item"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 4. Input Area (Quick Add with Enter / Add Button) ── */}
      <form onSubmit={handleAdd} className="flex items-center gap-2 pt-1">
        <input
          type="text"
          value={newTitle}
          disabled={isMember}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder={isMember ? 'Only managers can add checklist items' : 'Add checklist item...'}
          className={`flex-1 px-3 py-1.5 text-xs rounded-xl border transition-all shadow-xs ${
            isMember
              ? 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 placeholder-slate-400 cursor-not-allowed'
              : 'bg-white dark:bg-[#23242a] border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500'
          }`}
        />
        {!isMember && (
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all shadow-xs active:scale-95 cursor-pointer disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        )}
      </form>
    </div>
  );
};
