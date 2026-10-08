import React, { useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import { Plus, Tag, Users, User, ArrowRight, Check, Flag, FileType } from 'lucide-react';
import { addDays } from 'date-fns';

export const QuickAddTask = () => {
  const { 
    addTask, 
    lists, 
    teams, 
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

  const currentList = lists.find(l => l.id === selectedListId) || lists[0];
  const allAvailableMembers = teams.flatMap(t => t.members || []);

  const toggleUserTag = (uid) => {
    if (selectedUserIds.includes(uid)) {
      setSelectedUserIds(selectedUserIds.filter(id => id !== uid));
    } else {
      setSelectedUserIds([...selectedUserIds, uid]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    await addTask({
      title: title.trim(),
      priority_id: priorityId,
      status_id: statusId,
      task_type_id: taskTypeId,
      due_date: dueDate,
      task_type: selectedUserIds.length > 0 ? 'team' : 'personal',
      list_id: targetListId,
      tagged_user_ids: selectedUserIds
    });

    setTitle('');
    setSelectedUserIds([]);
    setShowMemberPicker(false);
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 bg-[#23242a] border border-slate-800 focus-within:border-blue-500 rounded-2xl p-3 shadow-lg transition-all relative">
      <div className="flex items-center gap-3">
        <Plus className="w-5 h-5 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder={`Add task to "${currentList?.name || 'Inbox'}"... (Press Enter)`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!title.trim()}
          className="px-3 py-1.5 bg-[#4772fa] hover:bg-blue-600 disabled:opacity-30 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all shrink-0 shadow-md shadow-blue-500/20"
        >
          <span>Add</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick Settings Bar - 100% Dynamic Database Dropdowns */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-800/80 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* Dynamic Priority Dropdown */}
          <select
            value={priorityId}
            onChange={(e) => setPriorityId(e.target.value)}
            className="bg-[#1b1c20] text-slate-300 border border-slate-700/70 rounded-lg px-2.5 py-1 text-xs focus:outline-none"
          >
            {dropdownPriorities.map((p) => (
              <option key={p.id} value={p.id}>
                Priority: {p.name}
              </option>
            ))}
          </select>

          {/* Dynamic Status Dropdown */}
          <select
            value={statusId}
            onChange={(e) => setStatusId(e.target.value)}
            className="bg-[#1b1c20] text-slate-300 border border-slate-700/70 rounded-lg px-2.5 py-1 text-xs focus:outline-none"
          >
            {dropdownStatuses.map((st) => (
              <option key={st.id} value={st.id}>
                Status: {st.name}
              </option>
            ))}
          </select>

          {/* Dynamic Task Type Selector */}
          <select
            value={taskTypeId}
            onChange={(e) => setTaskTypeId(e.target.value)}
            className="bg-[#1b1c20] text-pink-300 font-semibold border border-pink-500/40 rounded-lg px-2.5 py-1 text-xs focus:outline-none"
          >
            {dropdownTaskTypes.map((tt) => (
              <option key={tt.id} value={tt.id}>
                Type: {tt.name}
              </option>
            ))}
          </select>

          {/* Date Selector */}
          <select
            value={dueDate ? 'today' : 'none'}
            onChange={(e) => {
              if (e.target.value === 'today') setDueDate(new Date().toISOString());
              else if (e.target.value === 'tomorrow') setDueDate(addDays(new Date(), 1).toISOString());
              else setDueDate(null);
            }}
            className="bg-[#1b1c20] text-slate-300 border border-slate-700/70 rounded-lg px-2.5 py-1 text-xs focus:outline-none"
          >
            <option value="today">Due: Today</option>
            <option value="tomorrow">Due: Tomorrow</option>
            <option value="none">No Due Date</option>
          </select>

          {/* Tagged Members Trigger Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMemberPicker(!showMemberPicker)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                selectedUserIds.length > 0
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-[#1b1c20] text-slate-400 border-slate-700/70 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>
                {selectedUserIds.length > 0 ? `${selectedUserIds.length} Tagged` : 'Tag Members'}
              </span>
            </button>

            {/* Member Multi-select Dropdown Popover */}
            {showMemberPicker && (
              <div className="absolute left-0 mt-2 w-56 p-2 rounded-xl bg-[#1f1f23] border border-slate-700 shadow-2xl z-30 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 block">
                  Select Required Ack Members:
                </span>
                {allAvailableMembers.map((m) => {
                  const uid = m.user_id || m.id;
                  const isSelected = selectedUserIds.includes(uid);
                  return (
                    <button
                      key={uid}
                      type="button"
                      onClick={() => toggleUserTag(uid)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors ${
                        isSelected ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate">{m.full_name || m.email}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </form>
  );
};

