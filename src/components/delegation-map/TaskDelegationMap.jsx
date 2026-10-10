import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap, 
  Handle, 
  Position,
  useNodesState,
  useEdgesState,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { getAvatarUrl } from '../../lib/avatars';
import { TaskDetailPanel } from '../task-detail/TaskDetailPanel';
import { 
  Users, GitFork, Shield, CheckCircle2, Clock, 
  CheckSquare, Check, AlertCircle, Plus, Search, 
  X, Layers, Grid, Network, Filter, Sparkles, 
  SlidersHorizontal, CheckCheck, RefreshCw, UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────
// Custom Clickable Delegation Edge with Task Pill
// ─────────────────────────────────────────────────
const DelegationEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const { setSelectedTaskId } = useTasks();

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {data?.title && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan z-10"
          >
            <button
              type="button"
              onClick={() => setSelectedTaskId(data.taskId)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md border ${
                data.is_completed
                  ? 'bg-emerald-50/95 dark:bg-[#1b2b22]/95 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-600/50'
                  : 'bg-white/95 dark:bg-[#1a2233]/95 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600/50'
              }`}
              title={`Click to inspect task: "${data.title}"`}
            >
              {data.is_completed ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
              ) : (
                <Clock className="w-3 h-3 text-blue-500 shrink-0" />
              )}
              <span className="max-w-[130px] truncate">{data.title}</span>
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

// ─────────────────────────────────────────────────
// Interactive User Node with Inline Task Creator & Checklists
// ─────────────────────────────────────────────────
const EnterpriseUserNode = ({ data }) => {
  const { toggleTaskCompletion, setSelectedTaskId, addTask, dropdownPriorities } = useTasks();
  const { user } = useAuth();
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickPriority, setQuickPriority] = useState('');

  const avatarSrc = getAvatarUrl(data.avatar_id, data.label);
  const tasks = data.assignedTasks || [];
  const completedCount = tasks.filter(t => t.is_completed).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleQuickCreate = async (e) => {
    e?.preventDefault();
    if (!quickTitle.trim()) return;

    try {
      await addTask({
        title: quickTitle.trim(),
        assigned_to: data.userId,
        priority_id: quickPriority || (dropdownPriorities?.[0]?.id || null),
      });
      setQuickTitle('');
      setIsAddingTask(false);
      toast.success(`Task delegated to ${data.label}!`, {
        id: `delegated-${data.userId}`,
        duration: 2500,
      });
    } catch (err) {
      toast.error('Failed to assign task: ' + err.message);
    }
  };

  const isHighlighted = data.isSearchMatch;
  const isDimmed = data.isSearchActive && !data.isSearchMatch;

  return (
    <div 
      className={`p-4 rounded-2xl bg-white dark:bg-[#1f1f23] border-2 text-slate-900 dark:text-slate-100 shadow-xl min-w-[280px] max-w-[340px] select-none transition-all duration-200 ${
        isHighlighted 
          ? 'border-blue-500 ring-4 ring-blue-500/20 scale-[1.02] shadow-2xl' 
          : 'border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500'
      } ${isDimmed ? 'opacity-35 grayscale-[0.3]' : 'opacity-100'}`}
    >
      {/* Multi-directional connection handles */}
      <Handle type="target" position={Position.Top} className="!bg-blue-500 dark:!bg-[#4772fa] !w-3.5 !h-3.5" />
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 dark:!bg-[#4772fa] !w-3.5 !h-3.5" />
      <Handle type="target" id="left" position={Position.Left} className="!bg-blue-500 dark:!bg-[#4772fa] !w-2.5 !h-2.5" />
      <Handle type="source" id="right" position={Position.Right} className="!bg-blue-500 dark:!bg-[#4772fa] !w-2.5 !h-2.5" />

      {/* User Header */}
      <div className="flex items-start gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="relative shrink-0">
          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 p-0.5 shadow-sm">
            <img src={avatarSrc} alt="" className="w-full h-full rounded-full object-cover bg-slate-100 dark:bg-slate-800" />
          </div>
          {totalCount > 0 && (
            <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white border-2 border-white dark:border-[#1f1f23] ${
              progressPercent === 100 ? 'bg-emerald-500' : 'bg-blue-500'
            }`}>
              {totalCount}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate" title={data.label}>
              {data.label}
            </h4>
            <span className={`px-1.5 py-0.2 rounded-md text-[8.5px] font-bold uppercase tracking-wider shrink-0 border ${
              data.role === 'manager' 
                ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40' 
                : data.role === 'sub_manager' || data.role === 'deputy_manager'
                ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/40'
                : 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40'
            }`}>
              {data.role === 'manager' ? 'Manager' : data.role === 'sub_manager' || data.role === 'deputy_manager' ? 'Sub-Mgr' : 'Member'}
            </span>
          </div>

          <span className="text-[10.5px] text-slate-400 dark:text-slate-400 block truncate mt-0.5">
            {data.email}
          </span>

          {/* Workload Progress Bar */}
          {totalCount > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                <span>{completedCount}/{totalCount} Completed</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    progressPercent === 100 
                      ? 'bg-emerald-500' 
                      : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Add / Delegate Action Button */}
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1">
          <CheckSquare className="w-3 h-3 text-blue-500" /> Tasks ({totalCount})
        </span>

        <button
          type="button"
          onClick={() => setIsAddingTask(!isAddingTask)}
          className="nodrag flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-0.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>{isAddingTask ? 'Close' : 'Delegate'}</span>
        </button>
      </div>

      {/* Inline Quick Task Creator Form */}
      {isAddingTask && (
        <form onSubmit={handleQuickCreate} className="nodrag mt-2 p-2 rounded-xl bg-blue-50/70 dark:bg-blue-900/15 border border-blue-200/80 dark:border-blue-500/30 space-y-2 animate-in fade-in duration-150">
          <input
            type="text"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder={`Task title for ${data.label.split(' ')[0]}...`}
            autoFocus
            className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#18181c] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          <div className="flex items-center justify-between gap-1">
            <select
              value={quickPriority}
              onChange={(e) => setQuickPriority(e.target.value)}
              className="text-[10px] px-1.5 py-1 rounded bg-white dark:bg-[#18181c] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="">Priority: Normal</option>
              {dropdownPriorities?.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsAddingTask(false)}
                className="px-2 py-1 text-[10px] rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!quickTitle.trim()}
                className="px-2.5 py-1 text-[10px] font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors cursor-pointer"
              >
                Assign
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Embedded Assigned Tasks Checklist */}
      <div className="mt-2 space-y-1.5">
        {tasks.length > 0 ? (
          <div className="space-y-1 max-h-44 overflow-y-auto pr-1 custom-scrollbar nodrag">
            {tasks.map((t) => (
              <div 
                key={t.id} 
                className="group flex items-center gap-2 p-1.5 rounded-xl bg-slate-50/90 dark:bg-[#25262c] hover:bg-slate-100 dark:hover:bg-[#2c2d35] border border-slate-200/70 dark:border-slate-800 transition-all text-xs"
              >
                {/* Interactive Checkbox */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTaskCompletion(t.id);
                  }}
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                    t.is_completed 
                      ? 'bg-emerald-600 border-emerald-600 text-white' 
                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1b1c20] hover:border-blue-500'
                  }`}
                  title={t.is_completed ? 'Mark Active' : 'Mark Done'}
                >
                  {t.is_completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </button>

                {/* Clickable Task Title -> Opens Detail Drawer */}
                <div 
                  onClick={() => setSelectedTaskId(t.id)}
                  className="flex-1 min-w-0 cursor-pointer"
                  title="Click to view full details"
                >
                  <span className={`block truncate ${
                    t.is_completed 
                      ? 'line-through text-slate-400 dark:text-slate-500' 
                      : 'text-slate-800 dark:text-slate-200 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400'
                  }`}>
                    {t.title}
                  </span>
                </div>

                {/* Status Badge */}
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold shrink-0 ${
                  t.is_completed 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300' 
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                }`}>
                  {t.is_completed ? 'Done' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div 
            onClick={() => setIsAddingTask(true)}
            className="p-3 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl hover:border-blue-300 dark:hover:border-blue-500/40 cursor-pointer transition-colors group"
          >
            <p className="text-[11px] text-slate-400 dark:text-slate-500 group-hover:text-blue-500">
              No tasks • Click to delegate
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const nodeTypes = { userNode: EnterpriseUserNode };
const edgeTypes = { delegationEdge: DelegationEdge };

// ─────────────────────────────────────────────────
// Main Task Delegation Map Canvas Component
// ─────────────────────────────────────────────────
const TaskDelegationMapCanvas = () => {
  const { allTasks, allUsers, dropdownStatuses, selectedTask, setSelectedTaskId, addTask } = useTasks();
  const { user } = useAuth();
  const reactFlowInstance = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Filter & Layout States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterScope, setFilterScope] = useState('all-delegated'); // 'all-delegated' | 'map-flagged' | 'all-tasks'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'completed'
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'manager' | 'sub_manager' | 'member'
  const [activeLayout, setActiveLayout] = useState('hierarchy'); // 'hierarchy' | 'roles' | 'grid'

  // Quick Drag-to-Delegate Connection Modal
  const [connectModal, setConnectModal] = useState({
    isOpen: false,
    sourceUser: null,
    targetUser: null,
    taskTitle: '',
  });

  // Calculate Map-Visible Tasks according to active filter
  const visibleTasks = useMemo(() => {
    return allTasks.filter(task => {
      // 1. Scope filter
      if (filterScope === 'map-flagged') {
        const hasVisibleTag = task.tags && task.tags.some(tag => tag.is_map_visible === true);
        const taskStatus = dropdownStatuses.find(s => s.id === task.status_id);
        const hasVisibleStatus = taskStatus && taskStatus.is_map_visible === true;
        if (!hasVisibleTag && !hasVisibleStatus) return false;
      } else if (filterScope === 'all-delegated') {
        // Must have an assignee
        if (!task.assigned_to) return false;
      }

      // 2. Status filter
      if (statusFilter === 'active' && task.is_completed) return false;
      if (statusFilter === 'completed' && !task.is_completed) return false;

      return true;
    });
  }, [allTasks, filterScope, statusFilter, dropdownStatuses]);

  // Compute Layout Positions (Dagre, Role Tiers, or Grid)
  const computePositions = useCallback((rawNodes, rawEdges, layoutType) => {
    if (layoutType === 'hierarchy') {
      const g = new dagre.graphlib.Graph();
      g.setDefaultEdgeLabel(() => ({}));
      g.setGraph({
        rankdir: 'TB',
        nodesep: 60,
        ranksep: 90,
        marginx: 50,
        marginy: 50,
      });

      rawNodes.forEach(node => {
        g.setNode(node.id, { width: 320, height: 260 });
      });

      rawEdges.forEach(edge => {
        g.setEdge(edge.source, edge.target);
      });

      dagre.layout(g);

      return rawNodes.map(node => {
        const pos = g.node(node.id);
        return {
          ...node,
          position: {
            x: (pos?.x || 160) - 160,
            y: (pos?.y || 130) - 130,
          },
        };
      });
    }

    if (layoutType === 'roles') {
      const managers = rawNodes.filter(n => n.data.role === 'manager');
      const subManagers = rawNodes.filter(n => n.data.role === 'sub_manager' || n.data.role === 'deputy_manager');
      const members = rawNodes.filter(n => n.data.role !== 'manager' && n.data.role !== 'sub_manager' && n.data.role !== 'deputy_manager');

      const tiers = [managers, subManagers, members].filter(t => t.length > 0);
      const maxCol = Math.max(...tiers.map(t => t.length), 1);
      const nodeSpacingX = 360;
      const tierSpacingY = 320;
      const totalWidth = maxCol * nodeSpacingX;

      const layouted = [];
      tiers.forEach((tier, tierIdx) => {
        const tierWidth = tier.length * nodeSpacingX;
        const startX = Math.max(50, (totalWidth - tierWidth) / 2 + 50);
        const y = tierIdx * tierSpacingY + 60;

        tier.forEach((node, colIdx) => {
          layouted.push({
            ...node,
            position: {
              x: startX + colIdx * nodeSpacingX,
              y: y,
            },
          });
        });
      });

      return layouted;
    }

    // Default Grid
    return rawNodes.map((node, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      return {
        ...node,
        position: {
          x: col * 360 + 60,
          y: row * 300 + 60,
        },
      };
    });
  }, []);

  // Synchronize Nodes and Edges
  const applyLayout = useCallback((layoutType = activeLayout, keepExistingPositions = false) => {
    let activeUsers = allUsers || [];
    if (roleFilter !== 'all') {
      activeUsers = activeUsers.filter(u => u.role === roleFilter);
    }
    if (activeUsers.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const query = searchQuery.trim().toLowerCase();

    // 1. Construct Nodes
    const rawNodes = activeUsers.map((u) => {
      const userTasks = visibleTasks.filter(t => t.assigned_to === u.id);

      // Search matching logic
      const nameMatch = (u.full_name || u.email || '').toLowerCase().includes(query);
      const emailMatch = (u.email || '').toLowerCase().includes(query);
      const taskMatch = userTasks.some(t => (t.title || '').toLowerCase().includes(query));
      const isSearchMatch = query.length > 0 && (nameMatch || emailMatch || taskMatch);

      return {
        id: u.id,
        type: 'userNode',
        position: { x: 0, y: 0 },
        data: {
          userId: u.id,
          label: u.full_name || u.email,
          email: u.email,
          role: u.role || 'member',
          avatar_id: u.avatar_id,
          assignedTasks: userTasks,
          isSearchMatch,
          isSearchActive: query.length > 0,
        },
      };
    });

    // 2. Construct Edges (from creator to assignee)
    const rawEdges = [];
    visibleTasks.forEach((task) => {
      if (task.created_by && task.assigned_to && task.created_by !== task.assigned_to) {
        // Ensure both users exist in our active graph
        const hasSource = activeUsers.some(u => u.id === task.created_by);
        const hasTarget = activeUsers.some(u => u.id === task.assigned_to);

        if (hasSource && hasTarget) {
          const edgeId = `edge-${task.created_by}-${task.assigned_to}-${task.id}`;
          rawEdges.push({
            id: edgeId,
            source: task.created_by,
            target: task.assigned_to,
            type: 'delegationEdge',
            animated: !task.is_completed,
            data: {
              taskId: task.id,
              title: task.title,
              is_completed: task.is_completed,
            },
            style: {
              stroke: task.is_completed ? '#10b981' : '#3b82f6',
              strokeWidth: 2.2,
            },
          });
        }
      }
    });

    // 3. Position nodes
    setNodes(prevNodes => {
      if (keepExistingPositions && prevNodes && prevNodes.length > 0) {
        return rawNodes.map(newNode => {
          const existing = prevNodes.find(p => p.id === newNode.id);
          if (existing?.position) {
            return { ...newNode, position: existing.position };
          }
          return newNode;
        });
      }
      return computePositions(rawNodes, rawEdges, layoutType);
    });

    setEdges(rawEdges);
  }, [allUsers, visibleTasks, roleFilter, searchQuery, activeLayout, computePositions, setNodes, setEdges]);

  // Initial and data change layout update
  useEffect(() => {
    applyLayout(activeLayout, true);
  }, [visibleTasks, allUsers, roleFilter, searchQuery]);

  // Layout change button handler
  const handleSwitchLayout = (newLayout) => {
    setActiveLayout(newLayout);
    applyLayout(newLayout, false);
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2, duration: 400 });
    }, 50);
  };

  // Connection Handler (Drag handle from User A to User B)
  const onConnect = useCallback((connection) => {
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) {
      toast.error('Task is already assigned to this user!');
      return;
    }

    const source = allUsers.find(u => u.id === connection.source);
    const target = allUsers.find(u => u.id === connection.target);

    if (source && target) {
      setConnectModal({
        isOpen: true,
        sourceUser: source,
        targetUser: target,
        taskTitle: '',
      });
    }
  }, [allUsers]);

  const handleConfirmConnectDelegation = async (e) => {
    e.preventDefault();
    const { sourceUser, targetUser, taskTitle } = connectModal;
    if (!taskTitle.trim() || !targetUser) return;

    try {
      await addTask({
        title: taskTitle.trim(),
        assigned_to: targetUser.id,
        created_by: sourceUser?.id || user?.id,
      });
      toast.success(`Delegated "${taskTitle.trim()}" to ${targetUser.full_name || targetUser.email}!`);
      setConnectModal({ isOpen: false, sourceUser: null, targetUser: null, taskTitle: '' });
    } catch (err) {
      toast.error('Failed to delegate task: ' + err.message);
    }
  };

  // KPI Metrics
  const activeDelegationsCount = visibleTasks.filter(t => !t.is_completed && t.created_by !== t.assigned_to).length;
  const completedDelegationsCount = visibleTasks.filter(t => t.is_completed && t.created_by !== t.assigned_to).length;
  const totalDelegations = activeDelegationsCount + completedDelegationsCount;
  const teamCompletionRate = totalDelegations > 0 ? Math.round((completedDelegationsCount / totalDelegations) * 100) : 0;

  return (
    <div className="flex-1 h-screen bg-slate-100 dark:bg-[#141418] flex flex-col text-slate-900 dark:text-slate-100 select-none pb-16 md:pb-0 overflow-hidden relative">
      
      {/* ───────────────────────────────────────────────── */}
      {/* Top Header Bar with Metrics, Search & Controls    */}
      {/* ───────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1a1a1f] flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0 shadow-xs z-20">
        
        {/* Left: Title & Quick Metrics */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-sm shrink-0">
            <GitFork className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-white leading-tight">
                Enterprise Task Delegation Map
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                Live Interactive
              </span>
            </div>
            
            {/* Quick Metrics Bar */}
            <div className="flex items-center gap-2.5 mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
              <span className="flex items-center gap-1 font-medium">
                <Users className="w-3.5 h-3.5 text-blue-500" /> {allUsers.length} Members
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
                <Clock className="w-3.5 h-3.5" /> {activeDelegationsCount} Active
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> {completedDelegationsCount} Done
              </span>
              <span>•</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {teamCompletionRate}% Complete
              </span>
            </div>
          </div>
        </div>

        {/* Right: Search, Filter, Layout Switches */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          
          {/* Live Search Input */}
          <div className="relative min-w-[150px] sm:min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search member or task..."
              className="w-full text-xs pl-8 pr-7 py-1.5 rounded-xl bg-slate-50 dark:bg-[#25252b] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Scope Filter */}
          <select
            value={filterScope}
            onChange={(e) => setFilterScope(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#25252b] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="all-delegated">All Assigned Tasks</option>
            <option value="map-flagged">Map-Flagged Only</option>
            <option value="all-tasks">All System Tasks</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#25252b] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="all">Status: All</option>
            <option value="active">Active Only</option>
            <option value="completed">Done Only</option>
          </select>

          {/* Smart Layout Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-[#25252b] p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => handleSwitchLayout('hierarchy')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeLayout === 'hierarchy'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
              title="Organize as top-down tree hierarchy following task delegations"
            >
              <Network className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hierarchy</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchLayout('roles')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeLayout === 'roles'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
              title="Organize in role tiers: Managers -> Sub-Managers -> Members"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Roles</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchLayout('grid')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeLayout === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
              title="Clean multi-column grid layout"
            >
              <Grid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Grid</span>
            </button>
          </div>

          {/* Reset / Center View Button */}
          <button
            type="button"
            onClick={() => reactFlowInstance.fitView({ padding: 0.2, duration: 400 })}
            className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#25252b] dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors shadow-xs cursor-pointer"
            title="Center and fit canvas"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────── */}
      {/* ReactFlow Interactive Canvas                      */}
      {/* ───────────────────────────────────────────────── */}
      <div className="flex-1 w-full h-full relative">
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-6 z-20 pointer-events-none">
            <div className="p-6 max-w-sm bg-white/95 dark:bg-[#1f1f23]/95 border border-slate-200 dark:border-slate-800 rounded-2xl text-center shadow-xl backdrop-blur-md">
              <GitFork className="w-10 h-10 text-blue-500 mx-auto mb-2 opacity-60" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Matching Members Found</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Try clearing your search query or switching the filter scope to "All Assigned Tasks".
              </p>
            </div>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onConnect={onConnect}
          nodesDraggable={true}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          className="bg-slate-100 dark:bg-[#141418]"
        >
          <Background color="#94a3b8" gap={20} size={1} opacity={0.25} />
          <Controls className="!bg-white dark:!bg-[#1f1f23] !border-slate-200 dark:!border-slate-800 !text-slate-800 dark:!text-white shadow-md !rounded-xl" />
          <MiniMap 
            nodeColor={(n) => n.data?.role === 'manager' ? '#a855f7' : n.data?.role === 'sub_manager' ? '#6366f1' : '#3b82f6'}
            maskColor="rgba(0, 0, 0, 0.2)"
            className="!bg-white dark:!bg-[#1f1f23] !border-slate-200 dark:!border-slate-800 shadow-md !rounded-xl hidden sm:block"
          />
        </ReactFlow>

        {/* ───────────────────────────────────────────────── */}
        {/* Slide-over Task Detail Panel (when task is clicked) */}
        {/* ───────────────────────────────────────────────── */}
        {selectedTask && (
          <div className="absolute top-0 right-0 h-full z-40 shadow-2xl animate-in slide-in-from-right duration-200 flex">
            <TaskDetailPanel />
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────── */}
      {/* Quick Connect & Delegate Modal                    */}
      {/* ───────────────────────────────────────────────── */}
      {connectModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-[#1f1f23] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 animate-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Delegate New Task
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Connect {connectModal.sourceUser?.full_name} → {connectModal.targetUser?.full_name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConnectModal({ isOpen: false, sourceUser: null, targetUser: null, taskTitle: '' })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmConnectDelegation} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Task Title
                </label>
                <input
                  type="text"
                  value={connectModal.taskTitle}
                  onChange={(e) => setConnectModal(prev => ({ ...prev, taskTitle: e.target.value }))}
                  placeholder={`What task are you delegating to ${connectModal.targetUser?.full_name}?`}
                  autoFocus
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#18181c] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#18181c] border border-slate-100 dark:border-slate-800/80 text-xs flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Assigned To</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {connectModal.targetUser?.full_name || connectModal.targetUser?.email}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConnectModal({ isOpen: false, sourceUser: null, targetUser: null, taskTitle: '' })}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!connectModal.taskTitle.trim()}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                >
                  Delegate & Connect
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};

// Wrap with ReactFlowProvider to enable useReactFlow hooks
export const TaskDelegationMap = () => {
  return (
    <ReactFlowProvider>
      <TaskDelegationMapCanvas />
    </ReactFlowProvider>
  );
};
