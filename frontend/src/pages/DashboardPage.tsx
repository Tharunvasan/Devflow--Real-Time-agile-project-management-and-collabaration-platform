import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { dashboardService } from '../services/dashboardService';
import { taskService } from '../services/taskService';
import type { DashboardStats, Task } from '../types';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ActivityTimeline } from '../components/ui/ActivityTimeline';
import { TaskDrawer } from '../components/kanban/TaskDrawer';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { formatDistanceToNow, format } from 'date-fns';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
const SEVERITY_COLORS: Record<string, string> = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
};

const StatCard: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  to?: string;
  subtext?: string;
}> = ({ label, value, icon, color, to, subtext }) => {
  const CardContent = (
    <div className="stat-card group">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <div className={`w-8 h-8 ${color} rounded-lg flex items-center justify-center shrink-0`}>
          {icon}
        </div>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        {subtext && <p className="text-[11px] text-slate-500 mt-0.5">{subtext}</p>}
      </div>
    </div>
  );

  if (to) {
    return <Link to={to} className="block transition-transform active:scale-[0.98]">{CardContent}</Link>;
  }
  return CardContent;
};

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { reconnectEpoch, socket } = useSocket();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [statsData, myTasksData] = await Promise.all([
        dashboardService.getStats(),
        user?._id ? taskService.getTasks({ assignedTo: user._id, limit: 6 }).catch(() => ({ tasks: [] })) : Promise.resolve({ tasks: [] }),
      ]);
      setStats(statsData);
      setMyTasks(myTasksData.tasks || []);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }, [user?._id]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData, reconnectEpoch]);

  // Listen to socket task updates to refresh personal tasks
  useEffect(() => {
    if (!socket) return;
    const handleTaskUpdated = (updatedTask: Task) => {
      setMyTasks((prev) =>
        prev.map((t) => (t._id === updatedTask._id ? updatedTask : t))
      );
    };
    socket.on('task:updated', handleTaskUpdated);
    return () => {
      socket.off('task:updated', handleTaskUpdated);
    };
  }, [socket]);

  if (loading) return <LoadingSpinner fullPage text="Loading dashboard analytics..." />;

  const tasksByStatus =
    stats?.charts.tasksByStatus.map((d) => ({
      name: d._id ? d._id.replace('_', ' ') : 'Unknown',
      value: d.count,
    })) || [];

  const tasksByPriority =
    stats?.charts.tasksByPriority.map((d) => ({
      name: d._id || 'Unspecified',
      value: d.count,
    })) || [];

  const workloadByAssignee =
    stats?.charts.workloadByAssignee.map((d: any) => ({
      name: d.name || 'Unassigned',
      count: d.count,
    })) || [];

  const issuesBySeverity =
    stats?.charts.issuesBySeverity.map((d) => ({
      name: d._id || 'Unknown',
      value: d.count,
    })) || [];

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time workspace activity and progress across your software projects.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link to="/tasks" className="btn-secondary text-xs">
            All Tasks
          </Link>
          <Link to="/projects" className="btn-primary text-xs">
            + View Projects
          </Link>
        </div>
      </div>

      {/* Metrics Stat Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard
          label="Total Projects"
          value={stats?.overview.totalProjects || 0}
          color="bg-blue-600/20 text-blue-400"
          to="/projects"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
        />
        <StatCard
          label="Active Projects"
          value={stats?.overview.activeProjects || 0}
          color="bg-emerald-600/20 text-emerald-400"
          to="/projects"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Total Tasks"
          value={stats?.overview.totalTasks || 0}
          color="bg-purple-600/20 text-purple-400"
          to="/tasks"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
        />
        <StatCard
          label="Completed"
          value={stats?.overview.completedTasks || 0}
          color="bg-teal-600/20 text-teal-400"
          to="/tasks"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
        />
        <StatCard
          label="Open Issues"
          value={stats?.overview.openIssues || 0}
          color="bg-rose-600/20 text-rose-400"
          to="/issues"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.999L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.332.193 3 1.732 3z" /></svg>}
        />
        <StatCard
          label="Blocked"
          value={stats?.overview.blockedTasks || 0}
          color="bg-orange-600/20 text-orange-400"
          to="/tasks"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
        />
        <StatCard
          label="Overdue"
          value={stats?.overview.overdueTasks || 0}
          color="bg-pink-600/20 text-pink-400"
          to="/tasks"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Team Size"
          value={stats?.overview.teamMembers || 0}
          color="bg-amber-600/20 text-amber-400"
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
      </div>

      {/* Active Sprint Banner */}
      {stats?.activeSprint && (() => {
        const activeSprintProjectId =
          typeof stats.activeSprint.project === 'object' && stats.activeSprint.project !== null
            ? (stats.activeSprint.project as any)._id || String(stats.activeSprint.project)
            : String(stats.activeSprint.project);

        const taskList = Array.isArray(stats.activeSprint.tasks) ? stats.activeSprint.tasks : [];
        const doneCount = taskList.filter((t: any) => t && (typeof t === 'object' ? t.status === 'DONE' : false)).length;
        const totalCount = taskList.length;
        const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

        return (
          <div className="card p-5 border border-primary-500/30 bg-gradient-to-r from-primary-950/30 via-slate-900 to-[#0e1628]">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="badge-green text-xs font-semibold">ACTIVE SPRINT</span>
                  <h3 className="font-semibold text-white text-lg">{stats.activeSprint.name}</h3>
                </div>
                {stats.activeSprint.goal && (
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl">{stats.activeSprint.goal}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to={`/projects/${activeSprintProjectId}/board`}
                  className="btn-secondary text-xs"
                >
                  Sprint Board →
                </Link>
                <Link
                  to={`/projects/${activeSprintProjectId}/sprints`}
                  className="btn-primary text-xs"
                >
                  Burndown & Velocity →
                </Link>
              </div>
            </div>

            <div className="space-y-2 mt-4 pt-4 border-t border-slate-800/80">
              <div className="flex justify-between text-xs text-slate-400">
                <span>
                  Sprint Task Progress: <strong className="text-white">{doneCount} of {totalCount} tasks resolved</strong>
                </span>
                <span className="font-mono text-primary-400 font-semibold">{percent}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* My Assigned Tasks Section */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">My Work & Deadlines</h3>
            <span className="text-xs text-slate-500 font-medium">({myTasks.length} assigned)</span>
          </div>
          <Link to="/tasks" className="text-xs text-primary-400 hover:text-primary-300 font-medium">
            View all tasks →
          </Link>
        </div>

        {myTasks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {myTasks.map((task) => (
              <div
                key={task._id}
                onClick={() => setSelectedTask(task)}
                className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 cursor-pointer transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs text-primary-400 font-semibold">
                      {task.taskKey || 'TASK'}
                    </span>
                    <StatusBadge status={task.status} size="sm" />
                  </div>
                  <p className="text-sm font-medium text-slate-200 line-clamp-2">{task.title}</p>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/60 text-xs text-slate-500">
                  <StatusBadge status={task.priority} size="sm" showDot={false} />
                  <span>
                    {task.dueDate ? `Due ${format(new Date(task.dueDate), 'MMM dd')}` : 'No deadline'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-500 text-sm italic">
            You have no active assigned tasks. Enjoy your clean backlog!
          </div>
        )}
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tasks by Status */}
        <div className="card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Tasks by Status
          </h3>
          {tasksByStatus.length > 0 ? (
            <div>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={tasksByStatus} cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={4} dataKey="value">
                    {tasksByStatus.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0e1628', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2">
                {tasksByStatus.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="truncate">{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-600 text-xs">No status data recorded</div>
          )}
        </div>

        {/* Tasks by Priority */}
        <div className="card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Tasks by Priority
          </h3>
          {tasksByPriority.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={tasksByPriority} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#0e1628', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px' }} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-600 text-xs">No priority data recorded</div>
          )}
        </div>

        {/* Issues by Severity */}
        <div className="card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Issues by Severity
          </h3>
          {issuesBySeverity.length > 0 ? (
            <div>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={issuesBySeverity} cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={4} dataKey="value">
                    {issuesBySeverity.map((item, index) => (
                      <Cell key={index} fill={SEVERITY_COLORS[item.name] || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0e1628', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2">
                {issuesBySeverity.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SEVERITY_COLORS[item.name] || '#94a3b8' }} />
                    <span className="truncate">{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-600 text-xs">No open issues</div>
          )}
        </div>

        {/* Team Workload */}
        <div className="card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Team Workload
          </h3>
          {workloadByAssignee.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={workloadByAssignee} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={70} />
                <Tooltip contentStyle={{ backgroundColor: '#0e1628', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px' }} />
                <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-600 text-xs">No assigned work</div>
          )}
        </div>
      </div>

      {/* Main Content Grid: Recent Tasks, Recent Issues & Live Audit Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Tasks */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Recent Tasks</h3>
            <Link to="/tasks" className="text-xs text-primary-400 hover:text-primary-300 font-medium">
              View all →
            </Link>
          </div>
          {stats?.recentActivity.recentTasks && stats.recentActivity.recentTasks.length > 0 ? (
            <div className="space-y-2">
              {stats.recentActivity.recentTasks.slice(0, 5).map((task) => (
                <div
                  key={task._id}
                  onClick={() => setSelectedTask(task)}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/70 cursor-pointer transition-colors border border-slate-800/60"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      {task.taskKey && (
                        <span className="text-xs font-mono font-semibold text-primary-400 shrink-0">
                          {task.taskKey}
                        </span>
                      )}
                      <p className="text-xs font-medium text-slate-200 truncate">{task.title}</p>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <StatusBadge status={task.status} size="sm" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-600 text-xs">No recent tasks</div>
          )}
        </div>

        {/* Recent Issues */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Recent Issues</h3>
            <Link to="/issues" className="text-xs text-primary-400 hover:text-primary-300 font-medium">
              View all →
            </Link>
          </div>
          {stats?.recentActivity.recentIssues && stats.recentActivity.recentIssues.length > 0 ? (
            <div className="space-y-2">
              {stats.recentActivity.recentIssues.slice(0, 5).map((issue) => (
                <Link
                  key={issue._id}
                  to={`/issues/${issue._id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/70 transition-colors border border-slate-800/60"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      {issue.issueKey && (
                        <span className="text-xs font-mono font-semibold text-rose-400 shrink-0">
                          {issue.issueKey}
                        </span>
                      )}
                      <p className="text-xs font-medium text-slate-200 truncate">{issue.title}</p>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formatDistanceToNow(new Date(issue.updatedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <StatusBadge status={issue.severity} size="sm" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-600 text-xs">No recent issues</div>
          )}
        </div>

        {/* Live Activity Timeline */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              Live Activity Stream
            </h3>
          </div>
          <ActivityTimeline
            initialActivities={stats?.recentActivity.recentActivities || (stats as any)?.recentActivities || []}
            maxItems={7}
          />
        </div>
      </div>

      {/* Task Drawer Slide-over when clicking a task on dashboard */}
      <TaskDrawer
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={(updated) => {
          setSelectedTask(updated);
          setMyTasks((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
        }}
      />
    </div>
  );
};
