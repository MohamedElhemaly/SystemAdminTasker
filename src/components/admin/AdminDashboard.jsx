import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { getAvatarUrl } from '../../lib/avatars';
import { 
  ShieldAlert, Users, Tag, Plus, Trash2, CheckCircle2, 
  ShieldCheck, Lock, UserCheck, Settings, Folder, FileType, Bookmark
} from 'lucide-react';
import toast from 'react-hot-toast';

export const AdminDashboard = () => {
  const { profile, isDemoMode } = useAuth();
  const { 
    allUsers, 
    dropdownPriorities,
    addPriority,
    deletePriority,
    dropdownStatuses,
    addStatus,
    deleteStatus,
    dropdownTaskTypes, 
    addTaskType, 
    deleteTaskType, 
    dropdownTags, 
    addTag, 
    deleteTag,
    lists,
    createList,
    deleteList,
    allTasks,
    refreshTasks
  } = useTasks();

  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'priorities' | 'statuses' | 'task_types' | 'tags' | 'lists' | 'acks'
  
  // Form States
  const [priorityName, setPriorityName] = useState('');
  const [priorityColor, setPriorityColor] = useState('#ef4444');
  const [priorityLevel, setPriorityLevel] = useState(1);

  const [statusName, setStatusName] = useState('');
  const [statusColor, setStatusColor] = useState('#3b82f6');
  const [statusIsCompleted, setStatusIsCompleted] = useState(false);
  const [statusIsMapVisible, setStatusIsMapVisible] = useState(false);

  const [typeName, setTypeName] = useState('');
  const [typeColor, setTypeColor] = useState('#ec4899');
  const [typeDesc, setTypeDesc] = useState('');

  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#3b82f6');
  const [tagIsMapVisible, setTagIsMapVisible] = useState(false);

  const [listName, setListName] = useState('');
  const [listColor, setListColor] = useState('#10b981');

  const [ackTaskId, setAckTaskId] = useState('');
  const [ackUserId, setAckUserId] = useState('');

  const currentRole = profile?.role || 'manager';

  // Security Gate: Protected route for Manager role ONLY
  if (currentRole !== 'manager') {
    return (
      <div className="flex-1 h-screen bg-[#18181c] flex items-center justify-center p-6 text-slate-100 select-none">
        <div className="max-w-md w-full p-6 bg-[#1f1f23] border border-red-500/30 rounded-2xl shadow-2xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/40 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Access Denied: Manager Role Required</h2>
            <p className="text-xs text-slate-400 mt-1">
              The Super-Admin Dashboard is strictly restricted to system <strong>Managers (المراجع)</strong>. You are currently logged in as a <code>{currentRole}</code>.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/80 text-xs text-slate-300">
            Tip: You can change your role in <strong>Profile Settings</strong> to test Manager access.
          </div>
        </div>
      </div>
    );
  }

  const handleRoleChange = async (targetUserId, newRole) => {
    try {
      if (isSupabaseConfigured() && !isDemoMode) {
        const { error } = await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', targetUserId);

        if (error) throw error;
      }
      toast.success(`User role updated to "${newRole}"!`);
    } catch (err) {
      toast.error('Failed to update role: ' + err.message);
    }
  };

  const handleDeleteUser = async (targetUserId) => {
    if (!window.confirm("Are you absolutely sure you want to completely delete this user? This action is irreversible.")) return;
    try {
      if (isSupabaseConfigured() && !isDemoMode) {
        const { error } = await supabase.rpc('delete_user_account', { target_user_id: targetUserId });
        if (error) throw error;
      }
      toast.success("User deleted successfully!");
      if (refreshTasks) refreshTasks();
    } catch (err) {
      toast.error('Failed to delete user: ' + err.message);
    }
  };

  const handleAddAck = async (e) => {
    e.preventDefault();
    if (!ackTaskId || !ackUserId) return;
    try {
      if (isSupabaseConfigured() && !isDemoMode) {
        const { error } = await supabase.from('task_acknowledgements').insert({
          task_id: ackTaskId,
          user_id: ackUserId,
          is_acknowledged: false
        });
        if (error) throw error;
      }
      toast.success("Member requirement added!");
      setAckTaskId('');
      setAckUserId('');
      if (refreshTasks) refreshTasks();
    } catch (err) {
      toast.error('Failed to add requirement: ' + err.message);
    }
  };

  const handleDeleteAck = async (ackId) => {
    try {
      if (isSupabaseConfigured() && !isDemoMode) {
        const { error } = await supabase.from('task_acknowledgements').delete().eq('id', ackId);
        if (error) throw error;
      }
      toast.success("Requirement deleted!");
      if (refreshTasks) refreshTasks();
    } catch (err) {
      toast.error('Failed to delete requirement: ' + err.message);
    }
  };

  const handleToggleAckStatus = async (ackId, currentStatus) => {
    try {
      if (isSupabaseConfigured() && !isDemoMode) {
        const { error } = await supabase.from('task_acknowledgements').update({
          is_acknowledged: !currentStatus,
          acknowledged_at: !currentStatus ? new Date().toISOString() : null
        }).eq('id', ackId);
        if (error) throw error;
      }
      toast.success("Status updated!");
      if (refreshTasks) refreshTasks();
    } catch (err) {
      toast.error('Failed to update status: ' + err.message);
    }
  };


  const handleCreatePriority = async (e) => {
    e.preventDefault();
    if (!priorityName.trim()) return;
    await addPriority(priorityName.trim(), priorityColor, parseInt(priorityLevel, 10));
    setPriorityName('');
  };

  const handleCreateStatus = async (e) => {
    e.preventDefault();
    if (!statusName.trim()) return;
    await addStatus(statusName.trim(), statusColor, statusIsCompleted, statusIsMapVisible);
    setStatusName('');
    setStatusIsCompleted(false);
    setStatusIsMapVisible(false);
  };

  const handleCreateTaskType = async (e) => {
    e.preventDefault();
    if (!typeName.trim()) return;
    await addTaskType(typeName.trim(), typeColor, typeDesc.trim());
    setTypeName('');
    setTypeDesc('');
  };

  const handleCreateTag = async (e) => {
    e.preventDefault();
    if (!tagName.trim()) return;
    await addTag(tagName.trim(), tagColor, tagIsMapVisible);
    setTagName('');
    setTagIsMapVisible(false);
  };

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (!listName.trim()) return;
    await createList(listName.trim(), listColor);
    setListName('');
  };

  return (
    <div className="flex-1 h-screen bg-[#18181c] text-slate-100 flex flex-col min-w-0 select-none pb-16 md:pb-0 overflow-y-auto">
      
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800 bg-[#1f1f23] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              Super-Admin Dashboard
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/40">
                المراجع ONLY
              </span>
            </h1>
            <p className="text-xs text-slate-400">Manage database-driven dynamic dropdowns & user roles</p>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="p-6 max-w-6xl w-full mx-auto space-y-6">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 gap-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'users' ? 'border-purple-500 text-purple-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users & Roles ({allUsers.length})</span>
          </button>
          
          <button
            onClick={() => setActiveTab('priorities')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'priorities' ? 'border-red-500 text-red-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Priorities ({dropdownPriorities.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('statuses')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'statuses' ? 'border-yellow-500 text-yellow-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Statuses ({dropdownStatuses.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('task_types')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'task_types' ? 'border-pink-500 text-pink-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileType className="w-4 h-4" />
            <span>Task Types ({dropdownTaskTypes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tags')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'tags' ? 'border-blue-500 text-blue-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Tags ({dropdownTags.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('lists')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'lists' ? 'border-emerald-500 text-emerald-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Folder className="w-4 h-4" />
            <span>System Lists ({lists.filter(l => !l.is_smart).length})</span>
          </button>

          <button
            onClick={() => setActiveTab('acks')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'acks' ? 'border-indigo-500 text-indigo-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>Member Tags</span>
          </button>
        </div>

        {/* Tab 1: Users & RBAC Roles */}
        {activeTab === 'users' && (
          <div className="p-4 rounded-2xl bg-[#1f1f23] border border-slate-800 shadow-xl space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-purple-400" />
              <span>User Accounts Control & Role Assignment</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="text-[11px] uppercase bg-[#28292f] text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="p-3">User</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Current Role</th>
                    <th className="p-3 text-right">Change Role</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {allUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-[#25262e] transition-colors">
                      <td className="p-3 flex items-center gap-2.5">
                        <img 
                          src={getAvatarUrl(u.avatar_id, u.full_name)} 
                          alt="" 
                          className="w-7 h-7 rounded-full bg-slate-800 object-cover" 
                        />
                        <span className="font-semibold text-white">{u.full_name || 'User'}</span>
                      </td>
                      <td className="p-3 font-mono text-slate-400">{u.email}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          u.role === 'manager'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                            : u.role === 'sub_manager' || u.role === 'deputy_manager'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        }`}>
                          {u.role === 'manager' ? 'Manager (المراجع)' : u.role === 'sub_manager' || u.role === 'deputy_manager' ? 'Sub-Manager (نائب المدير)' : 'Member (عضو)'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <select
                          value={u.role === 'deputy_manager' ? 'sub_manager' : (u.role || 'member')}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="bg-[#28292f] border border-slate-700 text-xs text-white rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                        >
                          <option value="manager">Manager (المراجع)</option>
                          <option value="sub_manager">Sub-Manager (نائب المدير)</option>
                          <option value="member">Member (عضو)</option>
                        </select>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-lg border border-red-500/30 transition-all"
                          title="Delete Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Dynamic Priorities CRUD */}
        {activeTab === 'priorities' && (
          <div className="space-y-5">
            <form onSubmit={handleCreatePriority} className="p-4 rounded-2xl bg-[#1f1f23] border border-slate-800 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-red-400" />
                <span>Create Dynamic Priority Option</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Priority Name (e.g. Critical)"
                  value={priorityName}
                  onChange={(e) => setPriorityName(e.target.value)}
                  className="px-3 py-2 bg-[#28292f] border border-slate-700 rounded-xl text-xs text-white"
                />
                <input
                  type="number"
                  required
                  min="0"
                  max="10"
                  placeholder="Order Level (0-10)"
                  value={priorityLevel}
                  onChange={(e) => setPriorityLevel(e.target.value)}
                  className="px-3 py-2 bg-[#28292f] border border-slate-700 rounded-xl text-xs text-white"
                />
                <input
                  type="color"
                  value={priorityColor}
                  onChange={(e) => setPriorityColor(e.target.value)}
                  className="w-full h-9 p-1 bg-[#28292f] border border-slate-700 rounded-xl cursor-pointer"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold"
                >
                  Add Priority
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {dropdownPriorities.length > 0 ? (
                dropdownPriorities.map((item) => (
                  <div key={item.id} className="p-3 rounded-2xl bg-[#1f1f23] border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: item.color_hex || '#ef4444' }} />
                      <div>
                        <span className="text-xs font-semibold text-white">{item.name}</span>
                        <p className="text-[10px] text-slate-400">Order: {item.level_order ?? 0}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => deletePriority(item.id)}
                      className="text-slate-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="col-span-full p-6 text-center text-slate-500 bg-[#1f1f23] border border-slate-800 rounded-2xl text-xs">
                  No custom priorities created yet. Use the form above to add your first priority option.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Dynamic Statuses CRUD */}
        {activeTab === 'statuses' && (
          <div className="space-y-5">
            <form onSubmit={handleCreateStatus} className="p-4 rounded-2xl bg-[#1f1f23] border border-slate-800 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-yellow-400" />
                <span>Create Dynamic Status Option</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                <input
                  type="text"
                  required
                  placeholder="Status Name (e.g. In QA)"
                  value={statusName}
                  onChange={(e) => setStatusName(e.target.value)}
                  className="px-3 py-2 bg-[#28292f] border border-slate-700 rounded-xl text-xs text-white"
                />
                <input
                  type="color"
                  value={statusColor}
                  onChange={(e) => setStatusColor(e.target.value)}
                  className="w-full h-9 p-1 bg-[#28292f] border border-slate-700 rounded-xl cursor-pointer"
                />
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={statusIsCompleted}
                      onChange={(e) => setStatusIsCompleted(e.target.checked)}
                      className="rounded border-slate-700 text-yellow-500 focus:ring-0 bg-[#28292f]"
                    />
                    <span>Is Completed State</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={statusIsMapVisible}
                      onChange={(e) => setStatusIsMapVisible(e.target.checked)}
                      className="rounded border-slate-700 text-blue-500 focus:ring-0 bg-[#28292f]"
                    />
                    <span>Show in Task Map</span>
                  </label>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl text-xs font-semibold"
                >
                  Add Status
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {dropdownStatuses.length > 0 ? (
                dropdownStatuses.map((item) => (
                  <div key={item.id} className="p-3 rounded-2xl bg-[#1f1f23] border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: item.color_hex || '#3b82f6' }} />
                      <div>
                        <span className="text-xs font-semibold text-white">{item.name}</span>
                        {item.is_completed_state && (
                          <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Completed State
                          </span>
                        )}
                        {item.is_map_visible && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[9px] uppercase font-bold tracking-wider">
                            Map Enabled
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteStatus(item.id)}
                      className="text-slate-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="col-span-full p-6 text-center text-slate-500 bg-[#1f1f23] border border-slate-800 rounded-2xl text-xs">
                  No custom statuses created yet. Use the form above to add your first status option.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Dynamic Task Types CRUD */}
        {activeTab === 'task_types' && (
          <div className="space-y-5">
            <form onSubmit={handleCreateTaskType} className="p-4 rounded-2xl bg-[#1f1f23] border border-slate-800 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-pink-400" />
                <span>Create Dynamic Task Type</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Task Type Name"
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                  className="px-3 py-2 bg-[#28292f] border border-slate-700 rounded-xl text-xs text-white"
                />
                <input
                  type="color"
                  value={typeColor}
                  onChange={(e) => setTypeColor(e.target.value)}
                  className="w-full h-9 p-1 bg-[#28292f] border border-slate-700 rounded-xl cursor-pointer"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={typeDesc}
                  onChange={(e) => setTypeDesc(e.target.value)}
                  className="px-3 py-2 bg-[#28292f] border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
              <button type="submit" className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-semibold">
                Create Task Type
              </button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {dropdownTaskTypes.length > 0 ? (
                dropdownTaskTypes.map((tt) => (
                  <div key={tt.id} className="p-3.5 rounded-2xl bg-[#1f1f23] border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: tt.color_hex || tt.color }} />
                      <div>
                        <h4 className="text-xs font-bold text-white">{tt.name}</h4>
                        <p className="text-[10px] text-slate-400">{tt.description || 'Custom Type'}</p>
                      </div>
                    </div>
                    <button onClick={() => deleteTaskType(tt.id)} className="text-slate-500 hover:text-red-400 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="col-span-full p-6 text-center text-slate-500 bg-[#1f1f23] border border-slate-800 rounded-2xl text-xs">
                  No custom task types created yet. Use the form above to create your first task type option.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Dynamic Tags CRUD */}
        {activeTab === 'tags' && (
          <div className="space-y-5">
            <form onSubmit={handleCreateTag} className="p-4 rounded-2xl bg-[#1f1f23] border border-slate-800 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-400" />
                <span>Create Dynamic Tag</span>
              </h3>
              <div className="flex flex-col sm:flex-row gap-3 items-center">
                <input
                  type="text"
                  required
                  placeholder="Tag Name (e.g. Critical Bug)"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  className="w-full sm:flex-1 px-3 py-2 bg-[#28292f] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
                />
                <input
                  type="color"
                  value={tagColor}
                  onChange={(e) => setTagColor(e.target.value)}
                  className="w-full sm:w-10 h-9 p-1 bg-[#28292f] border border-slate-700 rounded-xl cursor-pointer"
                />
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer w-full sm:w-auto">
                  <input
                    type="checkbox"
                    checked={tagIsMapVisible}
                    onChange={(e) => setTagIsMapVisible(e.target.checked)}
                    className="rounded border-slate-700 text-blue-500 focus:ring-0 bg-[#28292f]"
                  />
                  <span>Show in Task Map</span>
                </label>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
                >
                  Add Tag
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {dropdownTags.length > 0 ? (
                dropdownTags.map((tag) => (
                  <div key={tag.id} className="p-3 rounded-2xl bg-[#1f1f23] border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: tag.color_hex || tag.color || '#3b82f6' }} />
                      <span className="text-xs font-semibold text-white">{tag.name}</span>
                      {tag.is_map_visible && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[9px] uppercase font-bold tracking-wider">
                          Map Enabled
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => deleteTag(tag.id)}
                      className="text-slate-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="col-span-full p-6 text-center text-slate-500 bg-[#1f1f23] border border-slate-800 rounded-2xl text-xs">
                  No custom tags created yet. Use the form above to add your first tag.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 6: System Lists CRUD */}
        {activeTab === 'lists' && (
          <div className="space-y-5">
            <form onSubmit={handleCreateList} className="p-4 rounded-2xl bg-[#1f1f23] border border-slate-800 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Create System List / Folder</span>
              </h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  required
                  placeholder="List Name"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  className="flex-1 px-3 py-2 bg-[#28292f] border border-slate-700 rounded-xl text-xs text-white"
                />
                <input
                  type="color"
                  value={listColor}
                  onChange={(e) => setListColor(e.target.value)}
                  className="w-10 h-9 p-1 bg-[#28292f] border border-slate-700 rounded-xl cursor-pointer"
                />
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold">
                  Create List
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {lists.filter(l => !l.is_smart).length > 0 ? (
                lists.filter(l => !l.is_smart).map((list) => (
                  <div key={list.id} className="p-3 rounded-2xl bg-[#1f1f23] border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Folder className="w-4 h-4" style={{ color: list.color || '#3b82f6' }} />
                      <span className="text-xs font-semibold text-white">{list.name}</span>
                    </div>
                    <button onClick={() => deleteList(list.id)} className="text-slate-500 hover:text-red-400 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="col-span-full p-6 text-center text-slate-500 bg-[#1f1f23] border border-slate-800 rounded-2xl text-xs">
                  No custom lists created yet. Use the form above to add your first folder or list.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 7: Member Tags (Acknowledgements) */}
        {activeTab === 'acks' && (
          <div className="space-y-5">
            <form onSubmit={handleAddAck} className="p-4 rounded-2xl bg-[#1f1f23] border border-slate-800 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                <span>Assign Member Tag Requirement</span>
              </h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  required
                  value={ackTaskId}
                  onChange={(e) => setAckTaskId(e.target.value)}
                  className="flex-1 px-3 py-2 bg-[#28292f] border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                >
                  <option value="">-- Select Task --</option>
                  {allTasks?.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
                <select
                  required
                  value={ackUserId}
                  onChange={(e) => setAckUserId(e.target.value)}
                  className="flex-1 px-3 py-2 bg-[#28292f] border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                >
                  <option value="">-- Select User --</option>
                  {allUsers?.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-500/20">
                  Assign Tag
                </button>
              </div>
            </form>

            <div className="p-4 rounded-2xl bg-[#1f1f23] border border-slate-800 shadow-xl overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="text-[11px] uppercase bg-[#28292f] text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="p-3">Task</th>
                    <th className="p-3">Required Member</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {allTasks?.flatMap(t => 
                    (t.task_acknowledgements || []).map(ack => (
                      <tr key={ack.id} className="hover:bg-[#25262e] transition-colors">
                        <td className="p-3 font-medium text-white max-w-xs truncate" title={t.title}>{t.title}</td>
                        <td className="p-3">{ack.full_name || 'Member'}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                            ack.is_acknowledged ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {ack.is_acknowledged ? 'Acknowledged' : 'Pending'}
                          </span>
                        </td>
                        <td className="p-3 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleAckStatus(ack.id, ack.is_acknowledged)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-all"
                            title="Toggle Status"
                          >
                            <CheckCircle2 className={`w-3.5 h-3.5 ${ack.is_acknowledged ? 'text-emerald-400' : 'text-slate-400'}`} />
                          </button>
                          <button
                            onClick={() => handleDeleteAck(ack.id)}
                            className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg border border-red-500/30 transition-all"
                            title="Remove Requirement"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};

