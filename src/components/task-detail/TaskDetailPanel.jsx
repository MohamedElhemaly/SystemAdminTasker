import React, { useState, useEffect } from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { SubtasksList } from './SubtasksList';
import { TeamAcknowledgementSection } from './TeamAcknowledgementSection';
import { TaskAttachmentsSection } from './TaskAttachmentsSection';
import ReactMarkdown from 'react-markdown';
import { 
  X, Calendar, Flag, Folder, Users, User, Trash2, 
  FileText, UserCheck, Shield, Tag
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

export const TaskDetailPanel = () => {
  const { 
    selectedTask, 
    setSelectedTaskId, 
    updateTask, 
    deleteTask, 
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
      <div className="w-80 lg:w-96 h-screen bg-[#1f1f23] text-slate-400 border-l border-slate-800 hidden md:flex flex-col items-center justify-center p-6 text-center select-none shrink-0">
        <FileText className="w-12 h-12 text-slate-600 mb-3 opacity-40" />
        <h3 className="text-sm font-semibold text-slate-300">No Task Selected</h3>
        <p className="text-xs text-slate-500 mt-1">Select a task from the list to view and edit details.</p>
      </div>
    );
  }

  const handleTitleBlur = () => {
    if (title.trim() && title !== selectedTask.title) {
      updateTask(selectedTask.id, { title: title.trim() });
    }
  };

  const handleDescriptionBlur = () => {
    if (description !== selectedTask.description) {
      updateTask(selectedTask.id, { description });
    }
  };

  const currentRole = profile?.role || 'manager';

  const handleAssigneeChange = (newAssigneeId) => {
    if (currentRole === 'member' && newAssigneeId !== (profile?.id || 'demo-user-123')) {
      toast.error('Security Restriction: Members can only assign tasks to themselves.');
      return;
    }
    updateTask(selectedTask.id, { assigned_to: newAssigneeId });
  };

  const taskTags = selectedTask.tags || [];
  const unattachedTags = dropdownTags.filter(dt => !taskTags.some(tt => tt.id === dt.id));

  return (
    <div className="w-full md:w-80 lg:w-96 h-screen bg-[#1f1f23] text-slate-100 border-l border-slate-800 flex flex-col shrink-0 select-none z-30 shadow-2xl">
      
      {/* Top Header Bar - 100% Dynamic Database Dropdowns */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          
          {/* Dynamic Priority Dropdown */}
          <select
            value={selectedTask.priority_id || dropdownPriorities[0]?.id || 'p-1'}
            onChange={(e) => updateTask(selectedTask.id, { priority_id: e.target.value })}
            className="bg-[#28292f] border border-slate-700/70 rounded-xl px-2 py-1 text-[11px] font-semibold text-slate-200 focus:outline-none max-w-[110px] truncate"
          >
            {dropdownPriorities.map((p) => (
              <option key={p.id} value={p.id}>
                Priority: {p.name}
              </option>
            ))}
          </select>

          {/* Dynamic Status Dropdown */}
          <select
            value={selectedTask.status_id || dropdownStatuses[0]?.id || 'st-1'}
            onChange={(e) => updateTask(selectedTask.id, { status_id: e.target.value })}
            className="bg-[#28292f] border border-slate-700/70 rounded-xl px-2 py-1 text-[11px] font-semibold text-slate-200 focus:outline-none max-w-[110px] truncate"
          >
            {dropdownStatuses.map((st) => (
              <option key={st.id} value={st.id}>
                Status: {st.name}
              </option>
            ))}
          </select>

          {/* Dynamic Task Type Selector */}
          <select
            value={selectedTask.task_type_id || dropdownTaskTypes[0]?.id || 'tt-1'}
            onChange={(e) => updateTask(selectedTask.id, { task_type_id: e.target.value })}
            className="bg-[#28292f] border border-pink-500/40 text-pink-300 rounded-xl px-2 py-1 text-[11px] font-semibold focus:outline-none max-w-[110px] truncate"
          >
            {dropdownTaskTypes.map((tt) => (
              <option key={tt.id} value={tt.id}>
                Type: {tt.name}
              </option>
            ))}
          </select>

        </div>

        <button
          onClick={() => setSelectedTaskId(null)}
          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          title="Close panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        
        {/* Title Input */}
        <div>
          <textarea
            rows={2}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Task Title..."
            className="w-full bg-transparent text-base font-bold text-white placeholder-slate-500 focus:outline-none resize-none"
          />
        </div>

        {/* Assignee & Due Date Selectors */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
              <UserCheck className="w-3 h-3 text-blue-400" /> Assigned To
            </label>
            <select
              value={selectedTask.assigned_to || ''}
              onChange={(e) => handleAssigneeChange(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#28292f] border border-slate-700/80 rounded-xl text-white focus:outline-none truncate"
            >
              <option value="">Unassigned</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-emerald-400" /> Due Date
            </label>
            <input
              type="date"
              value={selectedTask.due_date ? selectedTask.due_date.split('T')[0] : ''}
              onChange={(e) => updateTask(selectedTask.id, { due_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
              className="w-full px-2.5 py-1.5 bg-[#28292f] border border-slate-700/80 rounded-xl text-white focus:outline-none"
            />
          </div>
        </div>

        {/* Dynamic Generic Task Tags Section (TickTick Style Many-to-Many) */}
        <div className="space-y-2 pt-1">
          <label className="block text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <Tag className="w-3 h-3 text-blue-400" /> Generic Task Tags (#hashtags)
          </label>

          <div className="flex flex-wrap items-center gap-1.5">
            {taskTags.map((tg) => (
              <span
                key={tg.id}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border shadow-sm"
                style={{
                  backgroundColor: `${tg.color_hex || tg.color || '#3b82f6'}20`,
                  color: tg.color_hex || tg.color || '#3b82f6',
                  borderColor: `${tg.color_hex || tg.color || '#3b82f6'}40`
                }}
              >
                <span>#{tg.name}</span>
                <button
                  type="button"
                  onClick={() => removeTagFromTask(selectedTask.id, tg.id)}
                  className="hover:opacity-75 focus:outline-none ml-0.5 text-xs font-bold"
                  title="Remove Tag"
                >
                  ×
                </button>
              </span>
            ))}

            {unattachedTags.length > 0 && (
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    addTagToTask(selectedTask.id, e.target.value);
                    e.target.value = '';
                  }
                }}
                className="bg-[#28292f] text-slate-400 hover:text-white border border-slate-700/70 rounded-full px-2 py-0.5 text-[11px] focus:outline-none cursor-pointer"
              >
                <option value="">+ Add Tag</option>
                {unattachedTags.map((dt) => (
                  <option key={dt.id} value={dt.id}>
                    #{dt.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Markdown-Supported Description Area */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Description (Markdown)</span>
            <div className="flex bg-[#28292f] p-0.5 rounded-lg border border-slate-700/60">
              <button
                type="button"
                onClick={() => setDescTab('write')}
                className={`px-2 py-0.5 text-[11px] font-medium rounded ${
                  descTab === 'write' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Write
              </button>
              <button
                type="button"
                onClick={() => setDescTab('preview')}
                className={`px-2 py-0.5 text-[11px] font-medium rounded ${
                  descTab === 'preview' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
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
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Add description... Supports Markdown headers, lists, code blocks"
              className="w-full p-3 bg-[#28292f] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
            />
          ) : (
            <div className="p-3 bg-[#28292f] border border-slate-700/80 rounded-xl text-xs text-slate-200 prose prose-invert max-w-none min-h-[80px]">
              {description.trim() ? (
                <ReactMarkdown>{description}</ReactMarkdown>
              ) : (
                <span className="text-slate-500 italic">No description provided.</span>
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
      <div className="p-3 border-t border-slate-800 flex items-center justify-between">
        <span className="text-[11px] text-slate-500">
          Created: {selectedTask.created_at ? format(parseISO(selectedTask.created_at), 'MMM d, h:mm a') : 'Recently'}
        </span>
        <button
          onClick={() => deleteTask(selectedTask.id)}
          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800/50 rounded-xl transition-colors flex items-center gap-1 text-xs"
          title="Delete Task"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete</span>
        </button>
      </div>

    </div>
  );
};
