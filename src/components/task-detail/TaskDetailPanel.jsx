import React, { useState, useEffect } from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { SubtasksList } from './SubtasksList';
import { TeamAcknowledgementSection } from './TeamAcknowledgementSection';
import { TaskAttachmentsSection } from './TaskAttachmentsSection';
import ReactMarkdown from 'react-markdown';
import { 
  X, Calendar, Flag, Folder, Users, User, Trash2, 
  FileText, UserCheck, Shield, Tag, RotateCw, LayoutGrid, Bell,
  Check, Lock, Clock
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { ModernDropdown } from '../common/ModernDropdown';
import { RepeatDropdown } from '../common/RepeatDropdown';
import { ReminderDropdown } from '../common/ReminderDropdown';
import { AssignMembersDropdown } from '../common/AssignMembersDropdown';
import { getAvatarUrl } from '../../lib/avatars';

export const TaskDetailPanel = () => {
  const { 
    selectedTask, 
    setSelectedTaskId, 
    updateTask, 
    deleteTask, 
    approveTask,
    rejectTask,
    lists, 
    allUsers,
    dropdownPriorities,
    dropdownStatuses,
    dropdownTaskTypes,
    dropdownTags,
    addTagToTask,
    removeTagFromTask
  } = useTasks();
  const { profile } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [descTab, setDescTab] = useState('write'); // 'write' | 'preview'

  useEffect(() => {
    if (selectedTask) {
      setTitle(selectedTask.title);
      setDescription(selectedTask.description || '');
    }
  }, [selectedTask?.id]);

  if (!selectedTask) {
    return (
      <div className="w-80 lg:w-96 h-screen bg-slate-50 dark:bg-[#1f1f23] text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-slate-800 hidden md:flex flex-col items-center justify-center p-6 text-center select-none shrink-0">
        <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3 opacity-60" />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Task Selected</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Select a task from the list to view and edit details.</p>
      </div>
    );
  }

  const currentUserId = user?.id || 'demo-user-123';
  const currentRole = profile?.role || 'member';
  const isManagerRole = ['manager', 'admin'].includes(currentRole);
  const isSubManagerRole = ['sub_manager', 'deputy_manager'].includes(currentRole);
  const isAdmin = currentRole === 'admin';
  const isManagerOrSub = isManagerRole || isSubManagerRole || isAdmin;
  const isMember = currentRole === 'member';

  const isUnderReview = selectedTask.status === 'under_review' || 
    dropdownStatuses.find(st => st.id === selectedTask.status_id)?.name?.toLowerCase() === 'in review';

  const managerApproved = Boolean(selectedTask.manager_approved);
  const subManagerApproved = Boolean(selectedTask.sub_manager_approved);
  const approvalCount = (managerApproved ? 1 : 0) + (subManagerApproved ? 1 : 0);

  const getApproverName = (userId, fallbackRole) => {
    if (!userId) return fallbackRole;
    if (userId === currentUserId) return `You (${fallbackRole})`;
    const u = allUsers?.find(user => user.id === userId);
    return u?.full_name || u?.email?.split('@')[0] || fallbackRole;
  };

  const handleTitleBlur = () => {
    if (isMember) return;
    if (title.trim() && title !== selectedTask.title) {
      updateTask(selectedTask.id, { title: title.trim() });
    }
  };

  const handleDescriptionBlur = () => {
    if (isMember) return;
    if (description !== selectedTask.description) {
      updateTask(selectedTask.id, { description });
    }
  };

  const handleAssigneeChange = (newAssigneeId) => {
    if (isMember) {
      toast.error('Security Restriction: Members are not allowed to reassign tasks.');
      return;
    }
    updateTask(selectedTask.id, { assigned_to: newAssigneeId });
  };

  const taskTags = selectedTask.tags || [];
  const unattachedTags = dropdownTags.filter(dt => !taskTags.some(tt => tt.id === dt.id));

  return (
    <div className="w-full md:w-80 lg:w-96 h-screen bg-slate-50 dark:bg-[#1f1f23] text-slate-900 dark:text-slate-100 border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 select-none z-30 shadow-xl">
      
      {/* Top Header Bar - 100% Dynamic Database Dropdowns */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-transparent flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          
          {/* Dynamic Priority Dropdown */}
          <ModernDropdown
            value={selectedTask.priority_id || dropdownPriorities[0]?.id || 'p-1'}
            onChange={(val) => !isMember && updateTask(selectedTask.id, { priority_id: val })}
            options={dropdownPriorities.map((p) => ({
              value: p.id,
              label: p.name,
              color: p.color_hex || p.color,
            }))}
            prefix="Priority: "
            disabled={isMember}
          />

          {/* Dynamic Status Dropdown */}
          <ModernDropdown
            value={selectedTask.status_id || dropdownStatuses[0]?.id || 'st-1'}
            onChange={(val) => !isMember && updateTask(selectedTask.id, { status_id: val })}
            options={dropdownStatuses.map((st) => ({
              value: st.id,
              label: st.name,
              color: st.color_hex || st.color,
            }))}
            prefix="Status: "
            disabled={isMember}
          />

          {/* Dynamic Task Type Selector */}
          <ModernDropdown
            value={selectedTask.task_type_id || dropdownTaskTypes[0]?.id || 'tt-1'}
            onChange={(val) => !isMember && updateTask(selectedTask.id, { task_type_id: val })}
            options={dropdownTaskTypes.map((tt) => ({
              value: tt.id,
              label: tt.name,
              color: tt.color_hex || tt.color || '#ec4899',
            }))}
            prefix="Type: "
            disabled={isMember}
            buttonClassName="bg-pink-50/70 text-pink-700 border-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:border-pink-500/40"
          />

        </div>

        <button
          onClick={() => setSelectedTaskId(null)}
          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
          title="Close panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── Dual Governance / Approval Banner ── */}
      {isUnderReview && (
        <div className="p-3.5 bg-gradient-to-r from-purple-50 via-indigo-50/50 to-blue-50/40 dark:from-purple-950/40 dark:via-[#1e1f2b] dark:to-slate-900/60 border-b border-purple-200/80 dark:border-purple-800/60 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-xs font-bold text-purple-900 dark:text-purple-200">
                Dual Approval Required (Manager & Sub-Manager)
              </span>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-200/80 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 border border-purple-300 dark:border-purple-700/60">
              {approvalCount} / 2 Approved
            </span>
          </div>

          {/* Dual Approval Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            {/* 1. Manager Approval Card */}
            <div className={`p-2.5 rounded-xl border transition-all ${
              managerApproved
                ? 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                : 'bg-white/90 dark:bg-[#1a1b22] border-slate-200 dark:border-slate-800'
            }`}>
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  Manager Approval
                </span>
                {managerApproved ? (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                    <Check className="w-3 h-3 stroke-[3]" /> Approved
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                    <Clock className="w-3 h-3" /> Pending
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2 truncate">
                {managerApproved
                  ? `Approved by ${getApproverName(selectedTask.manager_approved_by, 'Manager')}`
                  : 'Awaiting Manager review'}
              </p>
              {!managerApproved && (isManagerRole || isAdmin) && (
                <button
                  type="button"
                  onClick={() => approveTask(selectedTask.id, 'manager')}
                  className="w-full py-1 px-2.5 bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold rounded-lg shadow-xs flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
                >
                  <Check className="w-3 h-3 stroke-[2.5]" />
                  <span>Approve as Manager</span>
                </button>
              )}
            </div>

            {/* 2. Sub-Manager Approval Card */}
            <div className={`p-2.5 rounded-xl border transition-all ${
              subManagerApproved
                ? 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                : 'bg-white/90 dark:bg-[#1a1b22] border-slate-200 dark:border-slate-800'
            }`}>
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  Sub-Manager Approval
                </span>
                {subManagerApproved ? (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                    <Check className="w-3 h-3 stroke-[3]" /> Approved
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                    <Clock className="w-3 h-3" /> Pending
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2 truncate">
                {subManagerApproved
                  ? `Approved by ${getApproverName(selectedTask.sub_manager_approved_by, 'Sub-Manager')}`
                  : 'Awaiting Sub-Manager review'}
              </p>
              {!subManagerApproved && (isSubManagerRole || isAdmin) && (
                <button
                  type="button"
                  onClick={() => approveTask(selectedTask.id, 'sub_manager')}
                  className="w-full py-1 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg shadow-xs flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
                >
                  <Check className="w-3 h-3 stroke-[2.5]" />
                  <span>Approve as Sub-Manager</span>
                </button>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-200/50 dark:border-purple-800/40">
            {isMember ? (
              <p className="text-[11px] text-purple-700 dark:text-purple-300 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Task under review. Manager & Sub-Manager must both approve to complete.
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {approvalCount === 0 && 'Both approvals required before task can be completed.'}
                {approvalCount === 1 && '1 of 2 approvals recorded. One more required.'}
                {approvalCount === 2 && 'Fully approved! Completing task...'}
              </p>
            )}

            {isManagerOrSub && (
              <button
                type="button"
                onClick={() => rejectTask(selectedTask.id)}
                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 dark:text-rose-300 dark:border-rose-500/40 text-[11px] font-semibold rounded-lg shadow-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer ml-auto"
                title="Reject task (Return to To Do)"
              >
                <X className="w-3 h-3 stroke-[2.5]" />
                <span>Reject (Return to To Do)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {!isUnderReview && isMember && (
        <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <Lock className="w-3 h-3 text-slate-400" />
          <span>Read-Only Mode: Members cannot edit task details after creation.</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        
        {/* Title Input */}
        <div>
          <textarea
            rows={2}
            value={title}
            onChange={(e) => !isMember && setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            readOnly={isMember}
            disabled={isMember}
            placeholder="Task Title..."
            className={`w-full bg-transparent text-base font-bold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none resize-none ${
              isMember ? 'cursor-default select-text' : ''
            }`}
          />
        </div>

        {/* Assignee & Due Date Selectors */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <UserCheck className="w-3 h-3 text-blue-500 dark:text-blue-400" /> Assigned Members
            </label>
            <AssignMembersDropdown
              taskType={selectedTask.task_type === 'team' ? 'Team' : 'Personal'}
              selectedUserIds={selectedTask.assigned_users || (selectedTask.assigned_to ? [selectedTask.assigned_to] : [])}
              onChange={(newIds) => !isMember && updateTask(selectedTask.id, { assigned_users: newIds })}
              allUsers={allUsers}
              disabled={isMember}
              buttonClassName="w-full justify-between"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-emerald-500 dark:text-emerald-400" /> Due Date
            </label>
            <input
              type="date"
              disabled={isMember}
              readOnly={isMember}
              value={selectedTask.due_date ? selectedTask.due_date.split('T')[0] : ''}
              onChange={(e) => !isMember && updateTask(selectedTask.id, { due_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
              className={`w-full px-2.5 py-1.5 bg-white dark:bg-[#28292f] border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-800 dark:text-white focus:outline-none shadow-xs ${
                isMember ? 'opacity-60 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
              }`}
            />
          </div>
        </div>

        {/* Task Recurrence & Reminder Controls */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <RotateCw className="w-3 h-3 text-blue-500 dark:text-blue-400" /> Repeat
            </label>
            <RepeatDropdown
              value={selectedTask.recurrence_rule}
              onChange={(rule) => !isMember && updateTask(selectedTask.id, { recurrence_rule: rule })}
              dueDate={selectedTask.due_date}
              disabled={isMember}
              buttonClassName="w-full justify-between"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Bell className="w-3 h-3 text-amber-500 dark:text-amber-400" /> Reminder
            </label>
            <ReminderDropdown
              task={selectedTask}
              onChange={(reminderUpdates) => !isMember && updateTask(selectedTask.id, reminderUpdates)}
              dueDate={selectedTask.due_date}
              disabled={isMember}
              buttonClassName="w-full justify-between"
              align="right"
            />
          </div>
        </div>

        {/* Eisenhower Matrix Quadrant Selector */}
        <div className="p-3 bg-slate-50 dark:bg-[#1a1b20] border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5 text-rose-500" /> Eisenhower Matrix
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border" style={{
              backgroundColor: Boolean(selectedTask.is_urgent) && Boolean(selectedTask.is_important)
                ? '#f43f5e18'
                : !Boolean(selectedTask.is_urgent) && Boolean(selectedTask.is_important)
                ? '#f59e0b18'
                : Boolean(selectedTask.is_urgent) && !Boolean(selectedTask.is_important)
                ? '#3b82f618'
                : '#10b98118',
              color: Boolean(selectedTask.is_urgent) && Boolean(selectedTask.is_important)
                ? '#f43f5e'
                : !Boolean(selectedTask.is_urgent) && Boolean(selectedTask.is_important)
                ? '#d97706'
                : Boolean(selectedTask.is_urgent) && !Boolean(selectedTask.is_important)
                ? '#2563eb'
                : '#059669',
              borderColor: Boolean(selectedTask.is_urgent) && Boolean(selectedTask.is_important)
                ? '#f43f5e30'
                : !Boolean(selectedTask.is_urgent) && Boolean(selectedTask.is_important)
                ? '#f59e0b30'
                : Boolean(selectedTask.is_urgent) && !Boolean(selectedTask.is_important)
                ? '#3b82f630'
                : '#10b98130',
            }}>
              {Boolean(selectedTask.is_urgent) && Boolean(selectedTask.is_important)
                ? 'Q1: Urgent & Important'
                : !Boolean(selectedTask.is_urgent) && Boolean(selectedTask.is_important)
                ? 'Q2: Not Urgent & Important'
                : Boolean(selectedTask.is_urgent) && !Boolean(selectedTask.is_important)
                ? 'Q3: Urgent & Unimportant'
                : 'Q4: Not Urgent & Unimportant'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <label className={`flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#23242a] transition-colors ${
              isMember ? 'opacity-60 cursor-not-allowed pointer-events-none' : 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}>
              <input
                type="checkbox"
                disabled={isMember}
                checked={Boolean(selectedTask.is_urgent)}
                onChange={(e) => !isMember && updateTask(selectedTask.id, { is_urgent: e.target.checked })}
                className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
              />
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">Urgent</span>
            </label>

            <label className={`flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#23242a] transition-colors ${
              isMember ? 'opacity-60 cursor-not-allowed pointer-events-none' : 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}>
              <input
                type="checkbox"
                disabled={isMember}
                checked={Boolean(selectedTask.is_important)}
                onChange={(e) => !isMember && updateTask(selectedTask.id, { is_important: e.target.checked })}
                className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
              />
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Important</span>
            </label>
          </div>
        </div>

        {/* Dynamic Generic Task Tags Section (TickTick Style Many-to-Many) */}
        <div className="space-y-2 pt-1">
          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Tag className="w-3 h-3 text-blue-500 dark:text-blue-400" /> Generic Task Tags (#hashtags)
          </label>

          <div className="flex flex-wrap items-center gap-1.5">
            {taskTags.map((tg) => (
              <span
                key={tg.id}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border shadow-xs"
                style={{
                  backgroundColor: `${tg.color_hex || tg.color || '#3b82f6'}18`,
                  color: tg.color_hex || tg.color || '#3b82f6',
                  borderColor: `${tg.color_hex || tg.color || '#3b82f6'}40`
                }}
              >
                <span>#{tg.name}</span>
                {!isMember && (
                  <button
                    type="button"
                    onClick={() => removeTagFromTask(selectedTask.id, tg.id)}
                    className="hover:opacity-75 focus:outline-none ml-0.5 text-xs font-bold cursor-pointer"
                    title="Remove Tag"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}

            {!isMember && unattachedTags.length > 0 && (
              <ModernDropdown
                value=""
                onChange={(val) => {
                  if (val) addTagToTask(selectedTask.id, val);
                }}
                options={unattachedTags.map((dt) => ({
                  value: dt.id,
                  label: `#${dt.name}`,
                  color: dt.color_hex || dt.color,
                }))}
                placeholder="+ Add Tag"
                buttonClassName="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              />
            )}
          </div>
        </div>

        {/* Markdown-Supported Description Area */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Description (Markdown)</span>
            <div className="flex bg-slate-200/70 dark:bg-[#28292f] p-0.5 rounded-lg border border-slate-300/60 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setDescTab('write')}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition-all cursor-pointer ${
                  descTab === 'write' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Write
              </button>
              <button
                type="button"
                onClick={() => setDescTab('preview')}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition-all cursor-pointer ${
                  descTab === 'preview' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Preview
              </button>
            </div>
          </div>

          {descTab === 'write' ? (
            <textarea
              rows={3}
              value={description}
              onChange={(e) => !isMember && setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              readOnly={isMember}
              disabled={isMember}
              placeholder="Add description... Supports Markdown headers, lists, code blocks"
              className={`w-full p-3 bg-white dark:bg-[#28292f] border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono shadow-xs ${
                isMember ? 'opacity-80 cursor-default select-text' : ''
              }`}
            />
          ) : (
            <div className="p-3 bg-white dark:bg-[#28292f] border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-800 dark:text-slate-200 prose dark:prose-invert max-w-none min-h-[80px] shadow-xs">
              {description.trim() ? (
                <ReactMarkdown>{description}</ReactMarkdown>
              ) : (
                <span className="text-slate-400 dark:text-slate-500 italic">No description provided.</span>
              )}
            </div>
          )}
        </div>

        {/* Sub-tasks Checklist Section */}
        <SubtasksList task={selectedTask} />

        {/* Excel Task Attachments Section */}
        <TaskAttachmentsSection task={selectedTask} />

        {/* Custom Feature: Team Acknowledgement Section */}
        <TeamAcknowledgementSection task={selectedTask} />

      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-transparent flex items-center justify-between">
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          Created: {selectedTask.created_at ? format(parseISO(selectedTask.created_at), 'MMM d, h:mm a') : 'Recently'}
        </span>
        {!isMember && (
          <button
            onClick={() => deleteTask(selectedTask.id)}
            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800/50 dark:hover:text-red-400 rounded-xl transition-colors flex items-center gap-1 text-xs cursor-pointer"
            title="Delete Task"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        )}
      </div>

    </div>
  );
};
