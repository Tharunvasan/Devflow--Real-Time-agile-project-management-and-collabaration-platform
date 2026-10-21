import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { sprintService } from '../services/sprintService';
import { taskService } from '../services/taskService';
import type { Sprint, Task, BurndownPoint, VelocityMetric, Project } from '../types';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { LoadingSpinner, EmptyState } from '../components/ui/LoadingSpinner';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Avatar } from '../components/ui/Avatar';
import { TaskDrawer } from '../components/kanban/TaskDrawer';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useSocket } from '../context/SocketContext';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export const SprintPage: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const outlet = useOutletContext<{ project?: Project }>() || {};
  const project = outlet.project;
  const { socket, reconnectEpoch } = useSocket();

  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [backlogTasks, setBacklogTasks] = useState<Task[]>([]);
  const [activeSprintDetail, setActiveSprintDetail] = useState<{
    sprint: Sprint;
    burndown: BurndownPoint[];
  } | null>(null);
  const [velocityMetrics, setVelocityMetrics] = useState<{
    velocityHistory: VelocityMetric[];
    averageVelocity: number;
  }>({ velocityHistory: [], averageVelocity: 0 });

  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', goal: '', startDate: '', endDate: '' });
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [drawerTask, setDrawerTask] = useState<Task | null>(null);

  const fetchSprintData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const [sprintRes, tasksRes] = await Promise.all([
        sprintService.getSprintsByProject(projectId),
        taskService.getTasks({ project: projectId, limit: 200 }),
      ]);

      const sprintsList = Array.isArray(sprintRes?.sprints) ? sprintRes.sprints : [];
      setSprints(sprintsList);

      if (sprintRes?.metrics) {
        setVelocityMetrics({
          velocityHistory: Array.isArray(sprintRes.metrics.velocityHistory) ? sprintRes.metrics.velocityHistory : [],
          averageVelocity: typeof sprintRes.metrics.averageVelocity === 'number' ? sprintRes.metrics.averageVelocity : 0,
        });
      }

      const allTasks = Array.isArray(tasksRes?.tasks) ? tasksRes.tasks : [];
      const unassigned = allTasks.filter((t) => !t.sprint);
      setBacklogTasks(unassigned);

      // If there is an active sprint, fetch its detailed burndown
      const active = sprintsList.find((s) => s.status === 'ACTIVE') || sprintsList[0];
      if (active) {
        setSelectedSprintId(active._id);
        try {
          const detail = await sprintService.getSprintById(active._id);
          setActiveSprintDetail({ sprint: detail.sprint, burndown: detail.burndown || [] });
        } catch (detailErr) {
          console.warn('Could not load sprint burndown:', detailErr);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load sprints');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSprintData();
  }, [fetchSprintData, reconnectEpoch]);

  // Real-time socket updates
  useEffect(() => {
    if (!socket || !projectId) return;

    const handleSprintUpdate = (updatedSprint: Sprint) => {
      setSprints((prev) => prev.map((s) => (s._id === updatedSprint._id ? updatedSprint : s)));
      if (selectedSprintId === updatedSprint._id) {
        sprintService.getSprintById(updatedSprint._id).then((d) => {
          setActiveSprintDetail({ sprint: d.sprint, burndown: d.burndown });
        });
      }
    };

    const handleSprintCreated = (newSprint: Sprint) => {
      setSprints((prev) => {
        if (prev.find((s) => s._id === newSprint._id)) return prev;
        return [...prev, newSprint];
      });
    };

    const handleSprintDeleted = ({ sprintId }: { sprintId: string }) => {
      setSprints((prev) => prev.filter((s) => s._id !== sprintId));
      if (selectedSprintId === sprintId) {
        setActiveSprintDetail(null);
      }
    };

    socket.on('sprint:started', handleSprintUpdate);
    socket.on('sprint:completed', handleSprintUpdate);
    socket.on('sprint:updated', handleSprintUpdate);
    socket.on('sprint:created', handleSprintCreated);
    socket.on('sprint:deleted', handleSprintDeleted);

    return () => {
      socket.off('sprint:started', handleSprintUpdate);
      socket.off('sprint:completed', handleSprintUpdate);
      socket.off('sprint:updated', handleSprintUpdate);
      socket.off('sprint:created', handleSprintCreated);
      socket.off('sprint:deleted', handleSprintDeleted);
    };
  }, [socket, projectId, selectedSprintId]);

  const handleSelectSprint = async (sprintId: string) => {
    setSelectedSprintId(sprintId);
    try {
      const detail = await sprintService.getSprintById(sprintId);
      setActiveSprintDetail({ sprint: detail.sprint, burndown: detail.burndown });
    } catch {
      toast.error('Failed to load sprint metrics');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    setCreating(true);
    try {
      const sprint = await sprintService.createSprint({ ...form, project: projectId });
      setSprints((prev) => [...prev, sprint]);
      setShowCreate(false);
      setForm({ name: '', goal: '', startDate: '', endDate: '' });
      toast.success('Sprint created!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create sprint');
    } finally {
      setCreating(false);
    }
  };

  const handleStartSprint = async (sprintId: string) => {
    const hasActive = sprints.some((s) => s.status === 'ACTIVE');
    if (hasActive) return toast.error('Another sprint is already active');
    try {
      await sprintService.updateSprint(sprintId, { status: 'ACTIVE' } as any);
      toast.success('Sprint started!');
      fetchSprintData();
    } catch {
      toast.error('Failed to start sprint');
    }
  };

  const handleCompleteSprint = async (sprintId: string) => {
    try {
      await sprintService.updateSprint(sprintId, { status: 'COMPLETED' } as any);
      toast.success('Sprint completed! Incomplete tasks returned to backlog.');
      fetchSprintData();
    } catch {
      toast.error('Failed to complete sprint');
    }
  };

  const handleAddTaskToSprint = async (sprintId: string, taskId: string) => {
    try {
      await sprintService.addTaskToSprint(sprintId, taskId);
      toast.success('Task moved to sprint');
      fetchSprintData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add task to sprint');
    }
  };

  const handleRemoveTaskFromSprint = async (sprintId: string, taskId: string) => {
    try {
      await sprintService.removeTaskFromSprint(sprintId, taskId);
      toast.success('Task returned to backlog');
      fetchSprintData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to remove task from sprint');
    }
  };

  const getSprintStats = (sprint: Sprint) => {
    if (!sprint || !sprint.tasks) return { total: 0, done: 0, pct: 0, totalPoints: 0, donePoints: 0 };
    const taskList = Array.isArray(sprint.tasks) ? (sprint.tasks as any[]).filter(Boolean) : [];
    const total = taskList.length;
    const done = taskList.filter((t: any) => t && typeof t === 'object' && t.status === 'DONE').length;
    const totalPoints = taskList.reduce((sum, t: any) => sum + (t && typeof t === 'object' && typeof t.storyPoints === 'number' ? t.storyPoints : 0), 0);
    const donePoints = taskList
      .filter((t: any) => t && typeof t === 'object' && t.status === 'DONE')
      .reduce((sum, t: any) => sum + (typeof t.storyPoints === 'number' ? t.storyPoints : 0), 0);
    return {
      total,
      done,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
      totalPoints,
      donePoints,
    };
  };

  if (loading) return <LoadingSpinner fullPage text="Loading agile sprints..." />;

  const activeSprint = sprints.find((s) => s._id === selectedSprintId) || sprints[0];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header and Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Agile Sprint Management</h2>
          <p className="text-xs text-dark-400 mt-0.5">Plan sprints, track burndown velocity and backlog</p>
        </div>
        <Button onClick={() => setShowCreate(true)} variant="primary" id="create-sprint-btn">
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Sprint
        </Button>
      </div>

      {sprints.length === 0 ? (
        <EmptyState
          title="No sprints yet"
          description="Create your first sprint to start organizing tasks and tracking burndown metrics."
          action={
            <Button onClick={() => setShowCreate(true)} variant="primary">
              Create Sprint
            </Button>
          }
        />
      ) : (
        <>
          {/* Velocity & Burndown Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Burndown Chart */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-white text-sm">Sprint Burndown Chart</h3>
                  <p className="text-xs text-dark-400">
                    {activeSprint ? activeSprint.name : 'Select a sprint'}
                  </p>
                </div>
                {activeSprintDetail && (
                  <span className="badge bg-purple-500/20 text-purple-300 text-xs px-2 py-0.5 rounded">
                    {getSprintStats(activeSprint).totalPoints} Story Points Total
                  </span>
                )}
              </div>

              {activeSprintDetail && activeSprintDetail.burndown.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={activeSprintDetail.burndown}
                      margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                      <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          color: '#f8fafc',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Line
                        type="monotone"
                        dataKey="ideal"
                        name="Ideal Burndown"
                        stroke="#94a3b8"
                        strokeDasharray="5 5"
                        dot={false}
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="actual"
                        name="Actual Remaining"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#3b82f6' }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-dark-500 text-sm">
                  No burndown points available for this sprint.
                </div>
              )}
            </div>

            {/* Velocity History Chart */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-white text-sm">Team Velocity</h3>
                  <p className="text-xs text-dark-400">
                    Average: <span className="text-emerald-400 font-bold">{velocityMetrics.averageVelocity} pts</span> / sprint
                  </p>
                </div>
                <span className="badge bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded">
                  {velocityMetrics.velocityHistory.length} Completed Sprints
                </span>
              </div>

              {velocityMetrics.velocityHistory.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={velocityMetrics.velocityHistory}
                      margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          color: '#f8fafc',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="completedPoints" name="Points Delivered" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-dark-500 text-sm">
                  <p>No completed sprints yet.</p>
                  <p className="text-xs text-dark-600 mt-1">Complete a sprint to populate velocity metrics.</p>
                </div>
              )}
            </div>
          </div>

          {/* Sprints & Backlog Planning Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns: Sprint List & Tasks */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="font-semibold text-white text-base">Active & Planned Sprints</h3>

              {sprints.map((sprint) => {
                const { total, done, pct, totalPoints, donePoints } = getSprintStats(sprint);
                const isSelected = sprint._id === selectedSprintId;

                return (
                  <div
                    key={sprint._id}
                    onClick={() => handleSelectSprint(sprint._id)}
                    className={`card overflow-hidden cursor-pointer transition-all border ${
                      isSelected
                        ? 'border-primary-500 ring-1 ring-primary-500/50'
                        : sprint.status === 'ACTIVE'
                        ? 'border-emerald-500/50'
                        : 'border-dark-800 hover:border-dark-700'
                    }`}
                    id={`sprint-${sprint._id}`}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between flex-wrap gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-white">{sprint.name}</h4>
                            <StatusBadge status={sprint.status} />
                          </div>
                          {sprint.goal && <p className="text-xs text-dark-400">{sprint.goal}</p>}
                          <div className="flex gap-4 mt-2 text-xs text-dark-500 flex-wrap">
                            <span>
                              📅 {format(new Date(sprint.startDate), 'MMM dd')} –{' '}
                              {format(new Date(sprint.endDate), 'MMM dd, yyyy')}
                            </span>
                            <span>📋 {total} tasks ({done} done)</span>
                            <span>🎯 {donePoints} / {totalPoints} story pts</span>
                          </div>
                        </div>

                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          {sprint.status === 'PLANNED' && (
                            <button
                              onClick={() => handleStartSprint(sprint._id)}
                              className="btn-primary btn-sm"
                            >
                              Start Sprint
                            </button>
                          )}
                          {sprint.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleCompleteSprint(sprint._id)}
                              className="btn-secondary btn-sm"
                            >
                              Complete Sprint
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-4">
                        <div className="flex justify-between text-xs text-dark-400 mb-1">
                          <span>Sprint Progress</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="w-full bg-dark-800 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              sprint.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-primary-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Tasks in this Sprint */}
                      <div className="mt-4 border-t border-dark-800 pt-3">
                        <h5 className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">
                          Sprint Backlog ({sprint.tasks.length})
                        </h5>
                        {(() => {
                          const validTasks = (sprint.tasks || []).filter((task: any) => task && typeof task === 'object' && task._id);
                          if (validTasks.length === 0) {
                            return (
                              <p className="text-xs text-dark-500 py-2">
                                No tasks in this sprint. Move tasks from Product Backlog on the right.
                              </p>
                            );
                          }
                          return (
                            <div className="space-y-1.5 max-h-56 overflow-y-auto">
                              {validTasks.map((task: any) => (
                                <div
                                  key={task._id}
                                  onClick={() => setDrawerTask(task)}
                                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-dark-900 border border-dark-800 hover:bg-dark-850 hover:border-slate-700 transition-colors cursor-pointer group"
                                  title="Click to view & edit task details"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {task.taskKey && (
                                      <span className="text-xs font-mono text-dark-400 bg-dark-800 px-1.5 py-0.5 rounded group-hover:text-primary-400 transition-colors">
                                        {task.taskKey}
                                      </span>
                                    )}
                                    <span className="text-sm text-dark-200 truncate group-hover:text-white transition-colors">{task.title}</span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {task.storyPoints !== undefined && (
                                      <span className="text-xs text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded font-mono">
                                        {task.storyPoints} pts
                                      </span>
                                    )}
                                    <StatusBadge status={task.status} />
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveTaskFromSprint(sprint._id, task._id);
                                      }}
                                      className="text-dark-500 hover:text-red-400 p-1 text-xs rounded hover:bg-red-500/10 transition-colors"
                                      title="Move back to Product Backlog"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Column: Product Backlog */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white text-base">
                  Product Backlog ({backlogTasks.length})
                </h3>
              </div>

              <div className="card p-4 space-y-2 max-h-[600px] overflow-y-auto">
                {backlogTasks.length === 0 ? (
                  <p className="text-xs text-dark-500 text-center py-6">
                    No unassigned tasks in the backlog.
                  </p>
                ) : (
                  backlogTasks.map((task) => (
                    <div
                      key={task._id}
                      onClick={() => setDrawerTask(task)}
                      className="p-3 rounded-lg bg-dark-900 border border-dark-800 hover:bg-dark-850 hover:border-slate-700 transition-colors cursor-pointer group"
                      title="Click to view & edit task details"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-xs font-mono text-primary-400 group-hover:underline">
                          {task.taskKey || 'TASK'}
                        </span>
                        <StatusBadge status={task.priority} />
                      </div>
                      <p className="text-sm font-medium text-white mb-2 leading-snug group-hover:text-primary-200 transition-colors">{task.title}</p>
                      <div className="flex items-center justify-between pt-2 border-t border-dark-800 text-xs">
                        <div className="flex items-center gap-1.5 text-dark-400">
                          {task.assignedTo && <Avatar user={task.assignedTo} size="xs" />}
                          <span className="font-mono">{task.storyPoints ? `${task.storyPoints} pts` : 'No pts'}</span>
                        </div>
                        {activeSprint && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddTaskToSprint(activeSprint._id, task._id);
                            }}
                            className="btn-secondary text-[11px] py-1 px-2 text-primary-400 hover:text-primary-300"
                          >
                            + To {activeSprint.name}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Create Sprint Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Sprint">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Sprint Name *</label>
            <input
              className="input"
              placeholder="Sprint 1 - Foundation"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              id="sprint-name"
            />
          </div>
          <div>
            <label className="label">Sprint Goal</label>
            <textarea
              className="input"
              rows={2}
              placeholder="What do we want to achieve in this sprint?"
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              id="sprint-goal"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start Date *</label>
              <input
                type="date"
                className="input"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                required
                id="sprint-start"
              />
            </div>
            <div>
              <label className="label">End Date *</label>
              <input
                type="date"
                className="input"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                required
                id="sprint-end"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={creating} id="create-sprint-submit">
              Create Sprint
            </Button>
          </div>
        </form>
      </Modal>

      {/* Slide-over Task Drawer for Backlog & Sprint Tasks */}
      <TaskDrawer
        task={drawerTask}
        isOpen={!!drawerTask}
        onClose={() => setDrawerTask(null)}
        onTaskUpdated={(updated: Task) => {
          setDrawerTask(updated);
          fetchSprintData();
        }}
        projectMembers={project?.members}
        sprints={sprints}
      />
    </div>
  );
};
