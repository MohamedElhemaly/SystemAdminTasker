import React, { useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import { FolderPlus, X, Users, Tag } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1f1f23] text-slate-100 border border-slate-700/60 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-150">
        
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold text-white">Create New List</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">List Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Q4 Infrastructure Sprint"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#28292f] border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">List Color</label>
            <div className="flex items-center gap-2.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#1f1f23]' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Assign to Team (Optional)</label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#28292f] border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Personal (No Team)</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Assigning a list to a team enables automated Team Acknowledgements for tasks created within it.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20"
            >
              Create List
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
