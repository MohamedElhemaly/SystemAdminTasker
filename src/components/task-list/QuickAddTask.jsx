import React, { useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import { Plus, Tag, Users, User, ArrowRight, Check, Flag, FileType, AlertTriangle, ShieldCheck, Calendar } from 'lucide-react';
import { addDays } from 'date-fns';
import toast from 'react-hot-toast';
import { ModernDropdown } from '../common/ModernDropdown';
import { getAvatarUrl } from '../../lib/avatars';

export const QuickAddTask = () => {
  const { 
    addTask, 
    lists, 
    allUsers, 
    dropdownPriorities, 
    dropdownStatuses, 
    dropdownTaskTypes, 
    selectedListId 
  } = useTasks();
  
  const [title, setTitle] = useState('');
  const [priorityId, setPriorityId] = useState(dropdownPriorities[0]?.id || 'p-1');
  const [statusId, setStatusId] = useState(dropdownStatuses[0]?.id || 'st-1');
  const [taskTypeId, setTaskTypeId] = useState(dropdownTaskTypes[0]?.id || 'tt-1');
  const [dueDate, setDueDate] = useState(new Date().toISOString());
  const [targetListId, setTargetListId] = useState(selectedListId);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [showMemberPicker, setShowMemberPicker] = useState(false);

  // Sync initial state when Supabase loads the real UUIDs from the database
  React.useEffect(() => {
    if (dropdownPriorities.length > 0 && priorityId.startsWith('p-')) setPriorityId(dropdownPriorities[0].id);
    if (dropdownStatuses.length > 0 && statusId.startsWith('st-')) setStatusId(dropdownStatuses[0].id);
    if (dropdownTaskTypes.length > 0 && taskTypeId.startsWith('tt-')) setTaskTypeId(dropdownTaskTypes[0].id);
  }, [dropdownPriorities, dropdownStatuses, dropdownTaskTypes]);

  React.useEffect(() => {
    setTargetListId(selectedListId);
  }, [selectedListId]);

  const currentList = lists.find(l => l.id === selectedListId) || lists[0];
  const allAvailableMembers = allUsers || [];

  const handleTaskTypeChange = (newTypeId) => {
    setTaskTypeId(newTypeId);
    const selectedObj = dropdownTaskTypes.find(t => t.id === newTypeId);
    const isTeam = selectedObj?.name?.toLowerCase().includes('team');
    if (isTeam && selectedUserIds.length === 0) {
      setShowMemberPicker(true);
    }
  };

  const toggleUserTag = (uid) => {
    let next;
    if (selectedUserIds.includes(uid)) {
      next = selectedUserIds.filter(id => id !== uid);
    } else {
      next = [...selectedUserIds, uid];
    }
    setSelectedUserIds(next);
  };

  const selectedTypeObj = dropdownTaskTypes.find(t => t.id === taskTypeId);
  const isTeamType = selectedTypeObj?.name?.toLowerCase().includes('team');
  const isTeamTask = isTeamType || selectedUserIds.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Strict Enforcement: A Team Task MUST have at least one team member selected
    if (isTeamType && selectedUserIds.length === 0) {
      toast.error('Team Task Error: You must select at least one team member before creating!', { 
        id: 'team-task-req-member',
        duration: 4500 
      });
      setShowMemberPicker(true);
      return;
    }

    const created = await addTask({
      title: title.trim(),
      priority_id: priorityId,
      status_id: statusId,
      task_type_id: taskTypeId,
      due_date: dueDate,
      task_type: isTeamTask ? 'team' : 'personal',
      list_id: targetListId,
      tagged_user_ids: selectedUserIds
    });

    if (created) {
      setTitle('');
      setSelectedUserIds([]);
      setShowMemberPicker(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 bg-white dark:bg-[#23242a] border border-slate-200 dark:border-slate-800/80 focus-within:border-blue-500 rounded-2xl p-3 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all relative">
      <div className="flex items-center gap-3">
        <Plus className="w-5 h-5 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder={`Add task to "${currentList?.name || 'Inbox'}"... (Press Enter)`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!title.trim()}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all shrink-0 shadow-xs cursor-pointer"
        >
          <span>Add</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick Settings Bar - 100% Dynamic Database Modern Dropdowns */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* Dynamic Priority Dropdown */}
          <ModernDropdown
            value={priorityId}
            onChange={setPriorityId}
            options={dropdownPriorities.map((p) => ({
              value: p.id,
              label: p.name,
              color: p.color_hex || p.color,
            }))}
            prefix="Priority: "
          />

          {/* Dynamic Status Dropdown */}
          <ModernDropdown
            value={statusId}
            onChange={setStatusId}
            options={dropdownStatuses.map((st) => ({
              value: st.id,
              label: st.name,
              color: st.color_hex || st.color,
            }))}
            prefix="Status: "
          />

          {/* Single Dynamic Task Type Selector */}
          <ModernDropdown
            value={taskTypeId}
            onChange={handleTaskTypeChange}
            options={dropdownTaskTypes.map((tt) => ({
              value: tt.id,
              label: tt.name,
              color: tt.color_hex || tt.color || '#ec4899',
            }))}
            prefix="Type: "
            buttonClassName="bg-pink-50/70 text-pink-700 border-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:border-pink-500/40"
          />

          {/* Date Selector */}
          <ModernDropdown
            value={(() => {
              if (!dueDate) return 'none';
              const tomorrowStr = addDays(new Date(), 1).toDateString();
              const dueStr = new Date(dueDate).toDateString();
              return dueStr === tomorrowStr ? 'tomorrow' : 'today';
            })()}
            onChange={(val) => {
              if (val === 'today') setDueDate(new Date().toISOString());
              else if (val === 'tomorrow') setDueDate(addDays(new Date(), 1).toISOString());
              else setDueDate(null);
            }}
            options={[
              { value: 'today', label: 'Today', icon: Calendar },
              { value: 'tomorrow', label: 'Tomorrow', icon: Calendar },
              { value: 'none', label: 'No Due Date' },
            ]}
            prefix="Due: "
          />

          {/* Tagged Members Trigger Button (Enforced for Team Tasks) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMemberPicker(!showMemberPicker)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                isTeamType && selectedUserIds.length === 0
                  ? 'bg-red-50 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/50 font-bold animate-pulse'
                  : selectedUserIds.length > 0
                    ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40'
                    : 'bg-white hover:bg-slate-50 dark:bg-[#1f2026] dark:hover:bg-[#25262e] border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>
                {isTeamType && selectedUserIds.length === 0
                  ? '⚠️ Select Members (Required)'
                  : selectedUserIds.length > 0
                    ? `${selectedUserIds.length} Member${selectedUserIds.length > 1 ? 's' : ''} Assigned`
                    : 'Assign Members'}
              </span>
            </button>

            {/* Member Multi-select Dropdown Popover */}
            {showMemberPicker && (
              <div className="absolute left-0 mt-2 w-72 p-2 rounded-2xl bg-white/95 dark:bg-[#1c1d22]/95 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 shadow-2xl z-50 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2 pt-1 pb-1 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Assign Team Members
                  </span>
                  <button 
                    type="button"
                    onClick={() => setShowMemberPicker(false)}
                    className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                  >
                    Done
                  </button>
                </div>
                {isTeamType && selectedUserIds.length === 0 && (
                  <p className="px-2 text-[10px] text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    At least 1 member is required for Team tasks!
                  </p>
                )}

                <div className="max-h-52 overflow-y-auto space-y-1 custom-scrollbar p-1">
                  {allAvailableMembers.map((m) => {
                    const uid = m.user_id || m.id;
                    const isSelected = selectedUserIds.includes(uid);
                    const avatarUrl = getAvatarUrl(m.avatar_id, m.full_name || m.email);
                    return (
                      <button
                        key={uid}
                        type="button"
                        onClick={() => toggleUserTag(uid)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-purple-100/80 text-purple-900 dark:bg-purple-500/25 dark:text-purple-200 font-semibold' 
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#272832]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={avatarUrl}
                            alt=""
                            className="w-5 h-5 rounded-full object-cover shrink-0 ring-1 ring-black/10 dark:ring-white/10"
                          />
                          <div className="truncate text-left">
                            <span className="truncate block leading-tight font-medium">{m.full_name || 'Member'}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate">{m.email}</span>
                          </div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </form>
  );
};
