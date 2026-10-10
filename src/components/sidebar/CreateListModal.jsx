import React, { useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import { FolderPlus, X, Users, Tag } from 'lucide-react';
import { ModernDropdown } from '../common/ModernDropdown';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

export const CreateListModal = ({ isOpen, onClose }) => {
  const { teams, createList } = useTasks();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [selectedTeamId, setSelectedTeamId] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createList(name.trim(), color, selectedTeamId || null);
    setName('');
    setSelectedTeamId('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-[#1f1f23] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700/60 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-150">
        
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Create New List</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">List Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Infrastructure Sprint"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#28292f] border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">List Color</label>
            <div className="flex items-center gap-2.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                    color === c ? 'scale-125 ring-2 ring-blue-500 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-[#1f1f23]' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Assign to Team (Optional)</label>
            <ModernDropdown
              value={selectedTeamId}
              onChange={setSelectedTeamId}
              options={[
                { value: '', label: 'Personal (No Team)' },
                ...teams.map((t) => ({
                  value: t.id,
                  label: t.name,
                  icon: Users,
                })),
              ]}
              fullWidth
              buttonClassName="py-2.5 px-3.5 text-sm rounded-xl"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Assigning a list to a team enables automated Team Acknowledgements for tasks created within it.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium shadow-xs cursor-pointer"
            >
              Create List
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
