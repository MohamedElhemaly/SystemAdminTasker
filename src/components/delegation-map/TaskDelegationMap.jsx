import React, { useMemo } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap, 
  Handle, 
  Position 
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { getAvatarUrl } from '../../lib/avatars';
import { 
  Users, GitFork, Shield, CheckCircle2, Clock, 
  CheckSquare, Check, AlertCircle 
} from 'lucide-react';

// Advanced Custom Node Component with Built-in Avatar & Embedded Task Checklist
const EnterpriseUserNode = ({ data }) => {
  const avatarSrc = getAvatarUrl(data.avatar_id, data.label);

  return (
    <div className="p-4 rounded-2xl bg-[#1f1f23] border-2 border-[#4772fa] text-slate-100 shadow-2xl min-w-[260px] max-w-[320px] select-none">
      <Handle type="target" position={Position.Top} className="!bg-[#4772fa] !w-3.5 !h-3.5" />
      
      {/* User Avatar & Role Info */}
      <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 p-0.5 shadow-md shrink-0">
          <img src={avatarSrc} alt="" className="w-full h-full rounded-full object-cover bg-slate-800" />
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-white leading-tight truncate">{data.label}</h4>
          <span className="text-[10px] text-slate-400 block truncate mt-0.5">{data.email}</span>
          <span className={`inline-block mt-1 px-2 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider ${
            data.role === 'manager' 
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' 
              : data.role === 'sub_manager' || data.role === 'deputy_manager'
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
              : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
          }`}>
            {data.role === 'manager' ? 'Manager (المراجع)' : data.role === 'sub_manager' || data.role === 'deputy_manager' ? 'Sub-Manager' : 'Member'}
          </span>
        </div>
      </div>

      {/* Embedded Assigned Tasks Table / Checklist */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <CheckSquare className="w-3.5 h-3.5 text-blue-400" /> Assigned Tasks
          </span>
          <span className="bg-slate-800 px-2 py-0.2 rounded-full text-slate-300 text-[10px]">
            {data.assignedTasks?.length || 0}
          </span>
        </div>

        {data.assignedTasks && data.assignedTasks.length > 0 ? (
          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
            {data.assignedTasks.map((t) => (
              <div 
                key={t.id} 
                className="flex items-center justify-between gap-1.5 p-1.5 rounded-lg bg-[#28292f] border border-slate-800 text-xs"
              >
                <span className={`truncate ${t.is_completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                  {t.title}
                </span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold shrink-0 ${
                  t.is_completed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {t.is_completed ? 'Done' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 italic py-1 text-center">No assigned tasks</p>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-[#4772fa] !w-3.5 !h-3.5" />
    </div>
  );
};

const nodeTypes = { userNode: EnterpriseUserNode };

export const TaskDelegationMap = () => {
  const { allTasks, teams, allUsers } = useTasks();
  const { user, profile } = useAuth();

  const { nodes, edges } = useMemo(() => {
    const userMap = new Map();

    allUsers.forEach(u => {
      userMap.set(u.id, {
        id: u.id,
        label: u.full_name || u.email?.split('@')[0] || 'User',
        email: u.email || '',
        avatar_id: u.avatar_id || 'avatar-1',
        role: u.role || 'member',
        assignedTasks: allTasks.filter(t => t.assigned_to === u.id)
      });
    });

    const userArray = Array.from(userMap.values());
    const generatedNodes = [];

    // Group by hierarchical role
    const roleGroups = {
      manager: [],
      sub_manager: [],
      member: []
    };

    userArray.forEach(u => {
      if (u.role === 'manager') roleGroups.manager.push(u);
      else if (u.role === 'sub_manager' || u.role === 'deputy_manager') roleGroups.sub_manager.push(u);
      else roleGroups.member.push(u);
    });

    const nodeWidth = 360; // Base width + padding
    const verticalSpacing = 350;

    // Center each row based on the number of nodes in that tier
    const layoutGroup = (group, yPos) => {
      const totalWidth = group.length * nodeWidth;
      const startX = -(totalWidth / 2) + (nodeWidth / 2);
      
      group.forEach((u, idx) => {
        generatedNodes.push({
          id: u.id,
          type: 'userNode',
          position: { x: startX + (idx * nodeWidth), y: yPos },
          data: u
        });
      });
    };

    layoutGroup(roleGroups.manager, 0);
    layoutGroup(roleGroups.sub_manager, verticalSpacing);
    layoutGroup(roleGroups.member, verticalSpacing * 2);

    const generatedEdges = [];

    allTasks.forEach(task => {
      const creatorId = task.created_by;
      const assigneeId = task.assigned_to;

      if (creatorId && assigneeId && creatorId !== assigneeId && userMap.has(creatorId) && userMap.has(assigneeId)) {
        generatedEdges.push({
          id: `edge-${task.id}-${creatorId}-${assigneeId}`,
          source: creatorId,
          target: assigneeId,
          animated: !task.is_completed,
          label: `${task.title.substring(0, 22)}...`,
          style: { 
            stroke: task.is_completed ? '#10b981' : '#4772fa',
            strokeWidth: 2.5 
          },
          labelStyle: { fill: '#ffffff', fontWeight: 600, fontSize: 11 },
          labelBgStyle: { fill: task.is_completed ? '#064e3b' : '#1e3a8a', rx: 8, ry: 8 }
        });
      }
    });

    return { nodes: generatedNodes, edges: generatedEdges };
  }, [allTasks, teams, allUsers, user, profile]);

  return (
    <div className="flex-1 h-screen bg-[#18181c] flex flex-col text-slate-100 select-none pb-16 md:pb-0">
      
      {/* Top Map Header */}
      <div className="p-4 border-b border-slate-800 bg-[#1f1f23] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
            <GitFork className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              React Flow Enterprise Task Delegation Map
            </h2>
            <p className="text-xs text-slate-400">
              Custom user nodes displaying built-in avatars, roles, and embedded assigned task checklists
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Green Edge = Completed Task</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 font-medium">
            <Clock className="w-3.5 h-3.5" />
            <span>Animated Blue Edge = Active Delegation</span>
          </div>
        </div>
      </div>

      {/* ReactFlow Interactive Canvas */}
      <div className="flex-1 w-full h-full bg-[#141418] relative">
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-6 z-20 pointer-events-none">
            <div className="p-6 max-w-sm bg-[#1f1f23]/95 border border-slate-800 rounded-2xl text-center shadow-2xl backdrop-blur-md">
              <GitFork className="w-10 h-10 text-pink-400 mx-auto mb-2 opacity-50" />
              <h3 className="text-sm font-bold text-white">No Users or Task Delegations Found</h3>
              <p className="text-xs text-slate-400 mt-1">
                Create user accounts and assign tasks in the main view or Super-Admin dashboard to visualize delegation edges.
              </p>
            </div>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          className="bg-[#141418]"
        >
          <Background color="#333" gap={20} size={1} />
          <Controls className="!bg-[#1f1f23] !border-slate-800 !text-white" />
          <MiniMap 
            nodeColor="#4772fa" 
            maskColor="rgba(0, 0, 0, 0.7)"
            className="!bg-[#1f1f23] !border-slate-800"
          />
        </ReactFlow>
      </div>

    </div>
  );
};
