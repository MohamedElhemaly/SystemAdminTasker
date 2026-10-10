import React, { useState, useEffect, useRef } from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { Users, X, Plus, Trash2, Shield, User, ChevronDown, Search, Check } from 'lucide-react';
import { getAvatarUrl } from '../../lib/avatars';
import toast from 'react-hot-toast';

export const CreateTeamModal = ({ isOpen, onClose, teamToEdit = null }) => {
  const { user } = useAuth();
  const { createTeam, deleteTeam, teams, allUsers, addTeamMember, removeTeamMember, refreshTasks } = useTasks();
  
  // Use fresh team data from context to ensure real-time UI updates
  const currentTeam = teamToEdit ? teams.find(t => t.id === teamToEdit.id) : null;
  
  const mappedMembers = currentTeam?.team_members?.map(m => {
    const user = allUsers.find(u => u.id === m.user_id);
    return { ...m, email: user?.email, full_name: user?.full_name, avatar_id: user?.avatar_id };
  }) || [];

  const [teamName, setTeamName] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Local state for 'Create Mode'
  const [emails, setEmails] = useState([]);

  const comboboxRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    if (isOpen) {
      if (currentTeam) {
        setTeamName(currentTeam.name || '');
      } else {
        setTeamName('');
        setEmails([]);
      }
      setMemberInput('');
      setIsDropdownOpen(false);
    }
  }, [isOpen, currentTeam]);

  const handleClose = () => {
    refreshTasks();
    onClose();
  };

  if (!isOpen) return null;

  // Compute available users that aren't already in the team
  const availableUsers = (allUsers || []).filter(u => {
    // Current user is already the owner / creator
    if (user && (u.id === user.id || (user.email && u.email?.toLowerCase() === user.email?.toLowerCase()))) {
      return false;
    }
    if (currentTeam) {
      return !mappedMembers.some(m => m.user_id === u.id);
    } else {
      const cleanEmails = emails.map(e => String(e).toLowerCase());
      return (
        !cleanEmails.includes(String(u.email || '').toLowerCase()) &&
        !cleanEmails.includes(String(u.full_name || '').toLowerCase()) &&
        !cleanEmails.includes(String(u.id || '').toLowerCase())
      );
    }
  });

  // Filter available users by the typed query (username or email)
  const query = memberInput.trim().toLowerCase();
  const filteredUsers = availableUsers.filter(u => {
    if (!query) return true;
    return (
      (u.full_name && u.full_name.toLowerCase().includes(query)) ||
      (u.email && u.email.toLowerCase().includes(query))
    );
  });

  // Add member by clicking an existing user from dropdown
  const handleSelectUser = async (userToAdd) => {
    if (currentTeam) {
      // Edit Mode: Add directly to team
      await addTeamMember(currentTeam.id, userToAdd.id);
      setMemberInput('');
      setIsDropdownOpen(false);
    } else {
      // Create Mode: Add user email to local state
      const identifier = userToAdd.email || userToAdd.full_name;
      if (!emails.includes(identifier)) {
        setEmails([...emails, identifier]);
        setMemberInput('');
        setIsDropdownOpen(false);
      } else {
        toast.error('User is already added!', { id: 'team-user-duplicate' });
      }
    }
  };

  // Add member by typing and pressing Enter / Add button
  const handleAddMember = async (e) => {
    if (e) e.preventDefault();
    const clean = memberInput.trim();
    if (!clean) return;

    // Check if input matches an existing user in allUsers
    const matchedUser = (allUsers || []).find(u =>
      (u.email && u.email.toLowerCase() === clean.toLowerCase()) ||
      (u.full_name && u.full_name.toLowerCase() === clean.toLowerCase()) ||
      u.id === clean
    );

    if (currentTeam) {
      // Edit Mode: Add via identifier (id, email, or name)
      await addTeamMember(currentTeam.id, matchedUser ? matchedUser.id : clean);
      setMemberInput('');
      setIsDropdownOpen(false);
    } else {
      // Create Mode: Add to local state
      const toAdd = matchedUser ? (matchedUser.email || matchedUser.full_name) : clean;
      if (!emails.includes(toAdd)) {
        setEmails([...emails, toAdd]);
        setMemberInput('');
        setIsDropdownOpen(false);
      } else {
        toast.error('User is already in the list!', { id: 'team-user-duplicate' });
      }
    }
  };

  const handleRemoveMember = async (identifierToRemove, userIdToRemove = null) => {
    if (currentTeam && userIdToRemove) {
      // Edit Mode: Remove directly from Supabase
      await removeTeamMember(currentTeam.id, userIdToRemove);
    } else {
      // Create Mode: Remove from local state
      setEmails(emails.filter(e => e !== identifierToRemove));
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-[#1f1f23] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700/60 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {currentTeam ? 'Edit Workspace Team' : 'Create Workspace Team'}
            </h3>
          </div>
          <button type="button" onClick={handleClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Team Name Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Team Name</label>
            <input
              type="text"
              required
              disabled={!!currentTeam}
              placeholder="e.g. SysAdmin Ops Team"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#28292f] border border-slate-200 dark:border-slate-700 rounded-xl text-sm ${currentTeam ? 'text-slate-500 cursor-not-allowed' : 'text-slate-900 dark:text-white'} placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-xs`}
            />
          </div>

          {/* Add Team Members Combobox Input & Dropdown */}
          <div ref={comboboxRef} className="relative">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Add Team Members
            </label>
            
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Type name or email, or click to choose..."
                  value={memberInput}
                  onChange={(e) => {
                    setMemberInput(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  onClick={() => setIsDropdownOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddMember();
                    } else if (e.key === 'Escape') {
                      setIsDropdownOpen(false);
                    }
                  }}
                  className="w-full pl-3.5 pr-8 py-2 bg-slate-50 dark:bg-[#28292f] border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-xs cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(prev => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                  title="Toggle users list"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddMember}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-xs shrink-0"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            {/* Dropdown Menu of Existing Users */}
            {isDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#23242a] border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl p-2 max-h-56 overflow-y-auto space-y-1 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 mb-1">
                  <span>Available Users ({filteredUsers.length})</span>
                  <span>Click to Add</span>
                </div>

                {filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => {
                    const avatarUrl = getAvatarUrl(u.avatar_id, u.full_name || u.email);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleSelectUser(u)}
                        className="w-full flex items-center justify-between p-2 rounded-xl text-left hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-800 dark:text-slate-200 transition-colors group cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={avatarUrl}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-black/10 dark:ring-white/10"
                          />
                          <div className="truncate">
                            <span className="font-semibold text-xs text-slate-900 dark:text-white block truncate leading-tight">
                              {u.full_name || 'Member'}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                              {u.email}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {u.role && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {u.role}
                            </span>
                          )}
                          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                            <Plus className="w-3.5 h-3.5" /> Add
                          </span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                    {availableUsers.length === 0 ? (
                      <p>All registered users are already in this team!</p>
                    ) : (
                      <p>No registered user matches "{memberInput}". You can still click "+ Add" to add them.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Members List (Live vs Local State) */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Team Members ({currentTeam ? mappedMembers.length : emails.length}):
            </span>
            
            {currentTeam ? (
              // Live DB Members rendering
              mappedMembers.map((m) => {
                const avatarUrl = getAvatarUrl(m.avatar_id, m.full_name || m.email);
                return (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-[#28292f] border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={avatarUrl}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover shrink-0 ring-1 ring-black/10 dark:ring-white/10"
                      />
                      <div className="flex flex-col truncate">
                        <span className="font-semibold text-slate-900 dark:text-white truncate">
                          {m.full_name || 'Member'}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {m.email}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      {m.role === 'owner' ? (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
                          <Shield className="w-3 h-3" /> Owner
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.email, m.user_id)}
                          className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                          title="Remove Member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              // Local State Members rendering (Creation Mode)
              emails.length > 0 ? (
                emails.map((identifier) => {
                  const matched = (allUsers || []).find(u =>
                    (u.email && u.email.toLowerCase() === identifier.toLowerCase()) ||
                    (u.full_name && u.full_name.toLowerCase() === identifier.toLowerCase())
                  );
                  const avatarUrl = getAvatarUrl(matched?.avatar_id, matched?.full_name || identifier);
                  return (
                    <div key={identifier} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-[#28292f] border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={avatarUrl}
                          alt=""
                          className="w-6 h-6 rounded-full object-cover shrink-0 ring-1 ring-black/10 dark:ring-white/10"
                        />
                        <div className="flex flex-col truncate">
                          <span className="font-semibold text-slate-900 dark:text-white truncate">
                            {matched?.full_name || identifier}
                          </span>
                          {matched?.email && matched.email !== identifier && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {matched.email}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(identifier)}
                        className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                        title="Remove Member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="py-3 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-[#23242a]/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  No members added yet. Type a username/email above or pick from the dropdown.
                </div>
              )
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            {currentTeam ? (
              <button
                type="button"
                onClick={handleDeleteTeam}
                className="px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl text-sm font-medium transition-colors cursor-pointer"
              >
                Delete Team
              </button>
            ) : <div />}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer font-medium"
              >
                {currentTeam ? 'Done' : 'Cancel'}
              </button>
              {!currentTeam && (
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-xs cursor-pointer"
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

