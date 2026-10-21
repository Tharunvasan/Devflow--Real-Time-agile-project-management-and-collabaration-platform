import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { taskService } from '../services/taskService';
import type { Task } from '../types';
import { LoadingSpinner, EmptyState } from '../components/ui/LoadingSpinner';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Avatar } from '../components/ui/Avatar';
import { TaskDrawer } from '../components/kanban/TaskDrawer';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export const AllTasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await taskService.getTasks({
        search: search || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        limit: 150,
      });
      setTasks(data.tasks);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleTaskUpdated = (updated: Task) => {
    setTasks((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
    setSelectedTask(updated);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">All Tasks</h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse and manage tasks across all your active projects.
          </p>
        </div>
        <Link to="/projects" className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Go to Project Boards
        </Link>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center gap-3 flex-wrap bg-[#0c1322] p-3 rounded-xl border border-slate-800">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            className="input pl-9 text-xs py-1.5"
            placeholder="Search tasks by title, key, or labels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="input text-xs py-1.5 w-36 bg-slate-900"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="TODO">To Do</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="DONE">Done</option>
        </select>

        <select
          className="input text-xs py-1.5 w-36 bg-slate-900"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>
      </div>

      {/* Tasks Table */}
      {loading ? (
        <LoadingSpinner fullPage text="Loading tasks..." />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-12 h-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
          title="No tasks match the filter"
          description="Try adjusting your search terms or filters above."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th className="w-28">Key</th>
                <th>Title</th>
                <th>Project</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assignee</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const projObj = typeof task.project === 'object' && task.project !== null ? task.project : null;
                return (
                  <tr
                    key={task._id}
                    onClick={() => setSelectedTask(task)}
                    className="cursor-pointer group hover:bg-slate-800/40"
                  >
                    <td className="font-mono text-xs text-primary-400 font-semibold">
                      {task.taskKey || '—'}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-200 group-hover:text-primary-300 transition-colors">
                          {task.title}
                        </span>
                        {task.isBlocked && (
                          <span className="badge-red text-[10px] px-1.5 py-0.2">BLOCKED</span>
                        )}
                        {task.storyPoints !== undefined && (
                          <span className="text-[11px] font-mono text-slate-500">
                            {task.storyPoints}pt
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-xs text-slate-400">
                      {projObj ? (
                        <span className="truncate max-w-[140px] block">{projObj.name}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <StatusBadge status={task.status} size="sm" />
                    </td>
                    <td>
                      <StatusBadge status={task.priority} size="sm" />
                    </td>
                    <td>
                      {task.assignedTo ? (
                        <div className="flex items-center gap-1.5">
                          <Avatar user={task.assignedTo} size="xs" />
                          <span className="text-xs text-slate-300 truncate max-w-[100px]">
                            {task.assignedTo.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600">Unassigned</span>
                      )}
                    </td>
                    <td className="text-xs text-slate-400">
                      {task.dueDate ? format(new Date(task.dueDate), 'MMM dd, yyyy') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Task Drawer Slide-over */}
      <TaskDrawer
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={handleTaskUpdated}
      />
    </div>
  );
};
