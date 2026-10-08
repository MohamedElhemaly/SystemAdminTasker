import React, { useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import { Users, X, Plus, Trash2 } from 'lucide-react';

export const CreateTeamModal = ({ isOpen, onClose }) => {
  const { createTeam } = useTasks();
  const [teamName, setTeamName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [emails, setEmails] = useState(['sarah.c@ticktick-team.com', 'omar.f@ticktick-team.com']);

  if (!isOpen) return null;

  const handleAddEmail = (e) => {
    e.preventDefault();
    if (memberEmail.trim() && !emails.includes(memberEmail.trim())) {
      setEmails([...emails, memberEmail.trim()]);
      setMemberEmail('');
    }
  };

  const handleRemoveEmail = (emailToRemove) => {
    setEmails(emails.filter(e => e !== emailToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    await createTeam(teamName.trim(), emails);
    setTeamName('');
    setEmails([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1f1f23] text-slate-100 border border-slate-700/60 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-150">
        
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-white">Create Workspace Team</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Team Name</label>
            <input
              type="text"
              required
              placeholder="e.g. SysAdmin Ops Team"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#28292f] border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Add Team Members</label>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="colleague@team.com"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                className="flex-1 px-3.5 py-2 bg-[#28292f] border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddEmail}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>

          {emails.length > 0 && (
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              <span className="text-[11px] text-slate-400">Team Members List ({emails.length}):</span>
              {emails.map((email) => (
                <div key={email} className="flex items-center justify-between p-2 rounded-lg bg-[#28292f] border border-slate-800 text-xs text-slate-200">
                  <span>{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveEmail(email)}
                    className="text-slate-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-indigo-500/20"
            >
              Create Team Workspace
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
