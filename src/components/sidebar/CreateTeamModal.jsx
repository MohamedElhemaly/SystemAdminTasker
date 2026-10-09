import React, { useState, useEffect } from 'react';
import { useTasks } from '../../context/TaskContext';
import { Users, X, Plus, Trash2, Shield, User } from 'lucide-react';
import toast from 'react-hot-toast';

export const CreateTeamModal = ({ isOpen, onClose, teamToEdit = null }) => {
  const { createTeam, deleteTeam, teams, allUsers, addTeamMember, removeTeamMember, refreshTasks } = useTasks();
  
  // Use fresh team data from context to ensure real-time UI updates
  const currentTeam = teamToEdit ? teams.find(t => t.id === teamToEdit.id) : null;
  
  const mappedMembers = currentTeam?.team_members?.map(m => {
    const user = allUsers.find(u => u.id === m.user_id);
    return { ...m, email: user?.email, full_name: user?.full_name };
  }) || [];

  const [teamName, setTeamName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  
  // Local state for 'Create Mode'
  const [emails, setEmails] = useState([]);

  useEffect(() => {
    if (isOpen) {
      if (currentTeam) {
        setTeamName(currentTeam.name || '');
      } else {
        setTeamName('');
        setEmails(['sarah.c@ticktick-team.com', 'omar.f@ticktick-team.com']);
      }
      setMemberEmail('');
    }
  }, [isOpen, currentTeam]);

  const handleClose = () => {
    refreshTasks();
    onClose();
  };

  if (!isOpen) return null;

  const handleAddEmail = async (e) => {
    e.preventDefault();
    if (!memberEmail.trim()) return;
    
    if (currentTeam) {
      // Edit Mode: Add directly to Supabase
      await addTeamMember(currentTeam.id, memberEmail.trim());
      setMemberEmail('');
    } else {
      // Create Mode: Add to local state
      if (!emails.includes(memberEmail.trim())) {
        setEmails([...emails, memberEmail.trim()]);
        setMemberEmail('');
      }
    }
  };

  const handleRemoveEmail = async (emailToRemove, userIdToRemove = null) => {
    if (currentTeam && userIdToRemove) {
      // Edit Mode: Remove directly from Supabase
      await removeTeamMember(currentTeam.id, userIdToRemove);
    } else {
      // Create Mode: Remove from local state
      setEmails(emails.filter(e => e !== emailToRemove));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    if (!currentTeam) {
      // Only execute create if it's a new team (Edit mode saves live instantly)
      await createTeam(teamName.trim(), emails);
      setTeamName('');
      setEmails([]);
    }
    
    onClose();
  };

  const handleDeleteTeam = async () => {
    if (currentTeam) {
      if (confirm(`Are you sure you want to permanently delete the team "${currentTeam.name}" and its workspace list?`)) {
        await deleteTeam(currentTeam.id);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1f1f23] text-slate-100 border border-slate-700/60 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-150">
        
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-white">
              {currentTeam ? 'Edit Workspace Team' : 'Create Workspace Team'}
            </h3>
          </div>
          <button type="button" onClick={handleClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Team Name</label>
            <input
              type="text"
              required
              disabled={!!currentTeam}
              placeholder="e.g. SysAdmin Ops Team"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className={`w-full px-3.5 py-2.5 bg-[#28292f] border border-slate-700 rounded-xl text-sm ${currentTeam ? 'text-slate-400 cursor-not-allowed' : 'text-white'} placeholder-slate-500 focus:outline-none focus:border-indigo-500`}
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

          {/* Members List (Dynamic vs Local State) */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            <span className="text-[11px] text-slate-400">
              Team Members ({currentTeam ? mappedMembers.length : emails.length}):
            </span>
            
            {currentTeam ? (
              // Live DB Members rendering
              mappedMembers.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-[#28292f] border border-slate-800 text-xs text-slate-200">
                  <div className="flex items-center gap-2">
                    {m.role === 'owner' ? <Shield className="w-3.5 h-3.5 text-amber-500" /> : <User className="w-3.5 h-3.5 text-indigo-400" />}
                    <div className="flex flex-col">
                      <span className="font-semibold">{m.full_name || 'Member'}</span>
                      <span className="text-[10px] text-slate-500">{m.email}</span>
                    </div>
                  </div>
                  {m.role !== 'owner' && (
                    <button
                      type="button"
                      onClick={() => handleRemoveEmail(m.email, m.user_id)}
                      className="text-slate-500 hover:text-red-400 p-1"
                      title="Remove Member"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              // Local State Members rendering (Creation Mode)
              emails.map((email) => (
                <div key={email} className="flex items-center justify-between p-2 rounded-lg bg-[#28292f] border border-slate-800 text-xs text-slate-200">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{email}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveEmail(email)}
                    className="text-slate-500 hover:text-red-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            {currentTeam ? (
              <button
                type="button"
                onClick={handleDeleteTeam}
                className="px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl text-sm font-medium transition-colors"
              >
                Delete Team
              </button>
            ) : <div />}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white"
              >
                {currentTeam ? 'Done' : 'Cancel'}
              </button>
              {!currentTeam && (
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-indigo-500/20"
                >
                  Create Team Workspace
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
