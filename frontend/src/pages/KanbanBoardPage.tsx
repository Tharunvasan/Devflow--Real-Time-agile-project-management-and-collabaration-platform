import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { taskService } from '../services/taskService';
import { sprintService } from '../services/sprintService';
import type { Task, TaskStatus, Project, Sprint, TaskPriority } from '../types';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Avatar } from '../components/ui/Avatar';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { TaskDrawer } from '../components/kanban/TaskDrawer';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';
import { format, isPast } from 'date-fns';

interface OutletCtx {
  project: Project;
}

const COLUMNS: { id: TaskStatus; label: string; dotColor: string; borderColor: string }[] = [
  { id: 'TODO', label: 'To Do', dotColor: 'bg-slate-400', borderColor: 'border-t-slate-500' },
  { id: 'IN_PROGRESS', label: 'In Progress', dotColor: 'bg-sky-400', borderColor: 'border-t-sky-500' },
  { id: 'IN_REVIEW', label: 'In Review', dotColor: 'bg-violet-400', borderColor: 'border-t-violet-500' },
  { id: 'DONE', label: 'Done', dotColor: 'bg-emerald-400', borderColor: 'border-t-emerald-500' },
];

// Sortable Task Card with keyboard accessibility & quick move
const TaskCard: React.FC<{
  task: Task;
  isDragging?: boolean;
  onClick?: () => void;
  onMoveColumn?: (newStatus: TaskStatus) => void;
}> = ({ task, isDragging, onClick, onMoveColumn }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task._id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isOverdue = task.dueDate && task.status !== 'DONE' && isPast(new Date(task.dueDate));

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpen]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Prevent opening drawer if clicking the move menu button
        if ((e.target as HTMLElement).closest('.quick-move-action')) return;
        onClick?.();
      }}
      className={`task-card group relative select-none ${isDragging ? 'opacity-40 scale-[0.98]' : ''} ${
        task.isBlocked ? 'border-rose-900/50 bg-rose-950/10' : ''
      }`}
    >
      {/* Top Header: Task Key + Priority + Quick Move Menu for keyboard users */}
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {task.taskKey && (
            <span className="font-mono text-[11px] font-semibold text-primary-400 bg-primary-500/10 px-1.5 py-0.5 rounded border border-primary-500/20 shrink-0">
              {task.taskKey}
            </span>
          )}
          <StatusBadge status={task.priority} size="sm" showDot={true} />
        </div>

        {/* Quick status move dropdown (keyboard alternative for drag-and-drop) */}
        {onMoveColumn && (
          <div className="relative quick-move-action" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
              title="Move task to another column"
              aria-label="Move task status"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-6 w-36 bg-[#0e1628] border border-slate-700/80 rounded-lg shadow-xl p-1 z-30">
                <div className="px-2 py-1 text-[10px] uppercase font-semibold text-slate-500">Move to</div>
                {COLUMNS.map((col) => (
                  <button
                    key={col.id}
                    disabled={col.id === task.status}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onMoveColumn(col.id);
                    }}
                    className={`w-full text-left px-2 py-1.5 text-xs rounded flex items-center gap-2 ${
                      col.id === task.status
                        ? 'text-slate-600 cursor-not-allowed'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${col.dotColor}`} />
                    <span>{col.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium text-slate-100 leading-snug group-hover:text-primary-300 transition-colors line-clamp-2">
        {task.title}
      </h4>

      {/* Blocked Alert Banner */}
      {task.isBlocked && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-rose-400 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.332.192 3 1.732 3z" />
          </svg>
          <span className="truncate">{task.blockedReason || 'Blocked'}</span>
        </div>
      )}

      {/* Tags / Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {task.labels.map((label: string) => (
            <span
              key={label}
              className="text-[10px] font-medium bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded border border-slate-700/60"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Bottom Footer: Points + Due Date + Assignee */}
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/60">
        <div className="flex items-center gap-2">
          {task.storyPoints !== undefined && (
            <span className="text-[11px] font-mono font-medium text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
              {task.storyPoints} pts
            </span>
          )}

          {task.dueDate && (
            <span
              className={`text-[11px] flex items-center gap-1 ${
                isOverdue ? 'text-rose-400 font-semibold' : 'text-slate-500'
              }`}
              title={isOverdue ? 'Task is overdue!' : `Due ${format(new Date(task.dueDate), 'MMM dd, yyyy')}`}
            >
              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {format(new Date(task.dueDate), 'MMM dd')}
            </span>
          )}
        </div>

        {task.assignedTo ? (
          <Avatar user={task.assignedTo} size="xs" />
        ) : (
          <div
            className="w-5 h-5 rounded-full border border-dashed border-slate-700 flex items-center justify-center text-[10px] text-slate-600"
            title="Unassigned"
          >
            ?
          </div>
        )}
      </div>
    </div>
  );
};

// Droppable Kanban Column
const DroppableColumn: React.FC<{
  col: (typeof COLUMNS)[0];
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onQuickAdd: (status: TaskStatus) => void;
  onMoveTask: (taskId: string, newStatus: TaskStatus) => void;
}> = ({ col, tasks, onTaskClick, onQuickAdd, onMoveTask }) => {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  const totalPoints = tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);

  return (
    <div
      className={`kanban-column border-t-2 ${col.borderColor} ${
        isOver ? 'ring-2 ring-primary-500/40 bg-slate-900/90' : ''
      }`}
      id={`kanban-col-${col.id}`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">{col.label}</h3>
          <span className="px-1.5 py-0.5 text-[11px] font-mono text-slate-400 bg-slate-800/90 rounded border border-slate-700/60">
            {tasks.length}
          </span>
          {totalPoints > 0 && (
            <span className="text-[10px] text-slate-500 font-mono">
              ({totalPoints} pts)
            </span>
          )}
        </div>

        <button
          onClick={() => onQuickAdd(col.id)}
          className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
          title={`Add task to ${col.label}`}
          aria-label={`Add task to ${col.label}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Sortable Drop Area */}
      <SortableContext items={tasks.map((t) => t._id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="space-y-2 min-h-[400px] flex-1" id={col.id}>
          {tasks.length === 0 && (
            <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-800/80 rounded-xl text-slate-600 text-xs gap-1">
              <span>No tasks in {col.label}</span>
              <button
                onClick={() => onQuickAdd(col.id)}
                className="text-primary-400 hover:underline text-[11px] font-medium"
              >
                + Add a task
              </button>
            </div>
          )}

          {tasks.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              onClick={() => onTaskClick(task)}
              onMoveColumn={(newStatus) => onMoveTask(task._id, newStatus)}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
};

export const KanbanBoardPage: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const { project } = useOutletContext<OutletCtx>();
  const { socket, reconnectEpoch } = useSocket();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Filters
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterSprint, setFilterSprint] = useState('');
  const [filterBlockedOnly, setFilterBlockedOnly] = useState(false);
  const [searchTask, setSearchTask] = useState('');

  // Modals & Drawer
  const [drawerTask, setDrawerTask] = useState<Task | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    status: 'TODO' as TaskStatus,
    priority: 'MEDIUM' as TaskPriority,
    assignedTo: '',
    dueDate: '',
    labels: '',
    storyPoints: '',
    isBlocked: false,
    sprint: '',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const fetchTasks = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const [tasksData, sprintsData] = await Promise.all([
        taskService.getTasks({ project: projectId, limit: 250 }),
        sprintService.getSprintsByProject(projectId).catch(() => ({ sprints: [] })),
      ]);
      setTasks(Array.isArray(tasksData?.tasks) ? tasksData.tasks : []);
      if (sprintsData && 'sprints' in sprintsData && Array.isArray((sprintsData as any).sprints)) {
        setSprints((sprintsData as any).sprints);
      }
    } catch (err) {
      console.error('Failed to load board tasks:', err);
      toast.error('Failed to load board tasks');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks, reconnectEpoch]);

  // Real-time WebSocket updates for Kanban board
  useEffect(() => {
    if (!socket) return;

    const handleTaskUpdate = (updatedTask: Task) => {
      setTasks((prev: Task[]) => prev.map((t) => (t._id === updatedTask._id ? updatedTask : t)));
      setDrawerTask((prev: Task | null) => (prev && prev._id === updatedTask._id ? updatedTask : prev));
    };

    const handleTaskCreate = (newTaskItem: Task) => {
      setTasks((prev: Task[]) => {
        if (prev.find((t) => t._id === newTaskItem._id)) return prev;
        return [newTaskItem, ...prev];
      });
    };

    const handleTaskDelete = ({ taskId }: { taskId: string }) => {
      setTasks((prev: Task[]) => prev.filter((t) => t._id !== taskId));
      setDrawerTask((prev: Task | null) => (prev && prev._id === taskId ? null : prev));
    };

    socket.on('task:updated', handleTaskUpdate);
    socket.on('task:created', handleTaskCreate);
    socket.on('task:deleted', handleTaskDelete);

    return () => {
      socket.off('task:updated', handleTaskUpdate);
      socket.off('task:created', handleTaskCreate);
      socket.off('task:deleted', handleTaskDelete);
    };
  }, [socket]);

  // Filter tasks for column display
  const getColumnTasks = (status: TaskStatus) => {
    return tasks.filter((t) => {
      if (t.status !== status) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterAssignee && (t.assignedTo?._id !== filterAssignee && (t.assignedTo as any) !== filterAssignee))
        return false;
      if (filterBlockedOnly && !t.isBlocked) return false;
      if (filterSprint) {
        const taskSprintId =
          typeof t.sprint === 'object' && t.sprint !== null ? (t.sprint as any)._id : t.sprint;
        if (filterSprint === 'none' && taskSprintId) return false;
        if (filterSprint !== 'none' && taskSprintId !== filterSprint) return false;
      }
      if (
        searchTask &&
        !t.title.toLowerCase().includes(searchTask.toLowerCase()) &&
        !t.taskKey?.toLowerCase().includes(searchTask.toLowerCase())
      )
        return false;
      return true;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t._id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const overId = over.id as string;
    const targetColumn = COLUMNS.find((c) => c.id === overId);
    if (targetColumn) {
      setTasks((prev) =>
        prev.map((t) => (t._id === active.id ? { ...t, status: targetColumn.id } : t))
      );
    } else {
      const overTask = tasks.find((t) => t._id === overId);
      if (overTask && overTask.status !== tasks.find((t) => t._id === active.id)?.status) {
        setTasks((prev) =>
          prev.map((t) => (t._id === active.id ? { ...t, status: overTask.status } : t))
        );
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { over } = event;
    const originalTask = activeTask;
    setActiveTask(null);
    if (!over || !originalTask) return;

    const overId = over.id as string;
    const targetColumn = COLUMNS.find((c) => c.id === overId);
    const overTask = tasks.find((t) => t._id === overId);
    const newStatus: TaskStatus = targetColumn?.id || overTask?.status || originalTask.status;

    if (newStatus !== originalTask.status) {
      // Optimistic update already visible
      try {
        await taskService.updateTask(originalTask._id, { status: newStatus });
        toast.success(`Moved to ${newStatus.replace('_', ' ')}`);
      } catch {
        fetchTasks();
        toast.error('Failed to move task. Reverting change.');
      }
    }
  };

  // Keyboard move action handler
  const handleMoveTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    const originalTask = tasks.find((t) => t._id === taskId);
    if (!originalTask || originalTask.status === newStatus) return;

    // Optimistic UI update
    setTasks((prev) => prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t)));

    try {
      await taskService.updateTask(taskId, { status: newStatus });
      toast.success(`Moved to ${newStatus.replace('_', ' ')}`);
    } catch {
      fetchTasks();
      toast.error('Failed to update task status');
    }
  };

  const handleQuickAdd = (status: TaskStatus) => {
    setNewTask((prev) => ({ ...prev, status }));
    setShowCreate(true);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !newTask.title.trim()) return;
    setCreating(true);
    try {
      const labels = newTask.labels
        ? newTask.labels.split(',').map((l) => l.trim()).filter(Boolean)
        : [];
      const created = await taskService.createTask({
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        project: projectId,
        priority: newTask.priority,
        assignedTo: newTask.assignedTo || undefined,
        sprint: newTask.sprint || undefined,
        dueDate: newTask.dueDate || undefined,
        storyPoints: newTask.storyPoints ? Number(newTask.storyPoints) : undefined,
        isBlocked: newTask.isBlocked,
        labels,
      });

      // If status wasn't TODO, update to selected column status
      if (newTask.status !== 'TODO') {
        const withStatus = await taskService.updateTask(created._id, { status: newTask.status });
        setTasks((prev) => [withStatus, ...prev]);
      } else {
        setTasks((prev) => [created, ...prev]);
      }

      setShowCreate(false);
      setNewTask({
        title: '',
        description: '',
        status: 'TODO',
        priority: 'MEDIUM',
        assignedTo: '',
        dueDate: '',
        labels: '',
        storyPoints: '',
        isBlocked: false,
        sprint: '',
      });
      toast.success('Task created successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage text="Loading Kanban board..." />;

  const activeSprint = sprints.find((s) => s.status === 'ACTIVE');

  return (
    <div className="space-y-4 animate-fade-in max-w-7xl mx-auto">
      {/* Top Filter and Search Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-[#0c1322] p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2.5 flex-wrap flex-1">
          {/* Search */}
          <div className="relative min-w-[180px]">
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              className="input pl-8 text-xs py-1.5"
              placeholder="Search tasks..."
              value={searchTask}
              onChange={(e) => setSearchTask(e.target.value)}
              id="kanban-search"
            />
          </div>

          {/* Priority Filter */}
          <select
            className="input text-xs py-1.5 w-32 bg-slate-900"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            id="kanban-priority-filter"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Assignee Filter */}
          <select
            className="input text-xs py-1.5 w-36 bg-slate-900"
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            id="kanban-assignee-filter"
          >
            <option value="">All Assignees</option>
            {project?.members.map((m: any) => (
              <option key={m.user._id} value={m.user._id}>
                {m.user.name}
              </option>
            ))}
          </select>

          {/* Sprint Filter */}
          <select
            className="input text-xs py-1.5 w-40 bg-slate-900"
            value={filterSprint}
            onChange={(e) => setFilterSprint(e.target.value)}
            id="kanban-sprint-filter"
          >
            <option value="">All Sprints</option>
            <option value="none">Backlog (No sprint)</option>
            {sprints.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.status})
              </option>
            ))}
          </select>

          {/* Filter Blocked Toggle */}
          <button
            onClick={() => setFilterBlockedOnly(!filterBlockedOnly)}
            className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-colors flex items-center gap-1.5 ${
              filterBlockedOnly
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-700/60 hover:text-white'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${filterBlockedOnly ? 'bg-rose-500' : 'bg-slate-500'}`} />
            Blocked Only
          </button>

          {/* Reset Filters button */}
          {(filterPriority || filterAssignee || filterSprint || filterBlockedOnly || searchTask) && (
            <button
              onClick={() => {
                setFilterPriority('');
                setFilterAssignee('');
                setFilterSprint('');
                setFilterBlockedOnly(false);
                setSearchTask('');
              }}
              className="text-xs text-primary-400 hover:underline"
            >
              Reset
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeSprint && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Sprint: {activeSprint.name}</span>
            </span>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => handleQuickAdd('TODO')}
            leftIcon={
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            New Task
          </Button>
        </div>
      </div>

      {/* DnD Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-h-[600px]">
          {COLUMNS.map((col) => (
            <DroppableColumn
              key={col.id}
              col={col}
              tasks={getColumnTasks(col.id)}
              onTaskClick={setDrawerTask}
              onQuickAdd={handleQuickAdd}
              onMoveTask={handleMoveTaskStatus}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} isDragging />}
        </DragOverlay>
      </DndContext>

      {/* Quick Create Task Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title={`Create Task (${newTask.status.replace('_', ' ')})`}>
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input
              className="input font-medium"
              placeholder="e.g. Implement refresh token rotation"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Describe requirements and acceptance criteria..."
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Priority</label>
              <select
                className="input"
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as TaskPriority })}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <div>
              <label className="label">Due Date</label>
              <input
                type="date"
                className="input"
                value={newTask.dueDate}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Story Points</label>
              <input
                type="number"
                min="0"
                className="input"
                placeholder="e.g. 3, 5, 8"
                value={newTask.storyPoints}
                onChange={(e) => setNewTask({ ...newTask, storyPoints: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Assignee</label>
              <select
                className="input"
                value={newTask.assignedTo}
                onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
              >
                <option value="">Unassigned</option>
                {project?.members.map((m: any) => (
                  <option key={m.user._id} value={m.user._id}>
                    {m.user.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Sprint</label>
              <select
                className="input"
                value={newTask.sprint}
                onChange={(e) => setNewTask({ ...newTask, sprint: e.target.value })}
              >
                <option value="">Backlog (No Sprint)</option>
                {sprints.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Labels (comma-separated)</label>
              <input
                className="input"
                placeholder="frontend, auth, api"
                value={newTask.labels}
                onChange={(e) => setNewTask({ ...newTask, labels: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="modal-blocked-toggle"
              checked={newTask.isBlocked}
              onChange={(e) => setNewTask({ ...newTask, isBlocked: e.target.checked })}
              className="rounded border-slate-700 bg-slate-900 text-rose-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="modal-blocked-toggle" className="text-xs text-rose-400 font-medium cursor-pointer">
              Mark as Blocked
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={creating}>
              Create Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* Interactive Slide-over Task Drawer */}
      <TaskDrawer
        task={drawerTask}
        isOpen={!!drawerTask}
        onClose={() => setDrawerTask(null)}
        onTaskUpdated={(updated: Task) => {
          setTasks((prev: Task[]) => prev.map((t) => (t._id === updated._id ? updated : t)));
          setDrawerTask(updated);
        }}
        projectMembers={project?.members}
        sprints={sprints}
      />
    </div>
  );
};
