import React, { useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import { Plus, Tag, Users, User, ArrowRight, Check, Flag, FileType, AlertTriangle, ShieldCheck, Calendar } from 'lucide-react';
import { addDays } from 'date-fns';
import toast from 'react-hot-toast';
import { ModernDropdown } from '../common/ModernDropdown';
import { RepeatDropdown } from '../common/RepeatDropdown';
import { AssignMembersDropdown } from '../common/AssignMembersDropdown';
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
  const [recurrenceRule, setRecurrenceRule] = useState(null);
  const [targetListId, setTargetListId] = useState(selectedListId);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isImportant, setIsImportant] = useState(false);

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

  const selectedTypeObj = dropdownTaskTypes.find(t => t.id === taskTypeId);
  const isTeamType = selectedTypeObj?.name?.toLowerCase().includes('team');
  const taskTypeName = isTeamType ? 'Team' : 'Personal';

  const handleTaskTypeChange = (newTypeId) => {
    setTaskTypeId(newTypeId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Strict Enforcement: A Team Task MUST have at least one member selected for acknowledgement
    if (isTeamType && selectedUserIds.length === 0) {
      toast.error('Team Task Error: You must select at least one member for acknowledgement!', { 
        id: 'team-task-req-member',
        duration: 4500 
      });
      return;
    }

    const hasMultipleUsers = selectedUserIds.length > 1;
    const finalTaskType = isTeamType || hasMultipleUsers ? 'team' : 'personal';

    const taskPayload = {
      title: title.trim(),
      priority_id: priorityId,
      status_id: statusId,
      task_type_id: taskTypeId,
      due_date: dueDate,
      recurrence_rule: recurrenceRule,
      task_type: finalTaskType,
      list_id: targetListId,
      // Always save all selected users to assigned_users array:
      assigned_users: selectedUserIds,
      assigned_to: selectedUserIds.length > 0 ? selectedUserIds[0] : null,
      // Always create acknowledgements for all assigned users:
      tagged_user_ids: selectedUserIds,
      is_urgent: isUrgent,
      is_important: isImportant
    };

    const created = await addTask(taskPayload);

    if (created) {
      setTitle('');
      setRecurrenceRule(null);
      setSelectedUserIds([]);
      setIsUrgent(false);
      setIsImportant(false);
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

          {/* Repeat / Recurrence Selector */}
          <RepeatDropdown
            value={recurrenceRule}
            onChange={setRecurrenceRule}
            dueDate={dueDate}
          />

          {/* Dynamic Multi-Select Assignees / Acknowledgement Dropdown */}
          <AssignMembersDropdown
            taskType={taskTypeName}
            selectedUserIds={selectedUserIds}
            onChange={setSelectedUserIds}
            allUsers={allUsers}
          />

          {/* Eisenhower Matrix Urgent & Important Quick Toggles */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsUrgent(prev => !prev)}
              className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                isUrgent
                  ? 'bg-rose-50 text-rose-600 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40 shadow-xs'
                  : 'text-slate-500 border-slate-200 hover:border-slate-300 dark:text-slate-400 dark:border-slate-700/60'
              }`}
              title="Mark as Urgent for Eisenhower Matrix"
            >
              ! Urgent
            </button>

            <button
              type="button"
              onClick={() => setIsImportant(prev => !prev)}
              className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                isImportant
                  ? 'bg-amber-50 text-amber-600 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40 shadow-xs'
                  : 'text-slate-500 border-slate-200 hover:border-slate-300 dark:text-slate-400 dark:border-slate-700/60'
              }`}
              title="Mark as Important for Eisenhower Matrix"
            >
              ★ Important
            </button>
          </div>

        </div>
      </div>
    </form>
  );
};
