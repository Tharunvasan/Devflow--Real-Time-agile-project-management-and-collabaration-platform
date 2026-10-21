import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { taskService } from '../services/taskService';
import { commentService } from '../services/commentService';
import { projectService } from '../services/projectService';
import { sprintService } from '../services/sprintService';
import type { Task, Comment, TaskStatus, TaskPriority, Subtask, Project, Sprint } from '../types';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { ActivityTimeline } from '../components/ui/ActivityTimeline';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { useSocket } from '../context/SocketContext';

const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
const PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const TaskDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { socket, joinProject, leaveProject } = useSocket();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [task, setTask] = useState<Task | null>(null);
  const [projectMembers, setProjectMembers] = useState<Project['members']>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit fields
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [assignedTo, setAssignedTo] = useState('');
  const [sprint, setSprint] = useState('');
  const [storyPoints, setStoryPoints] = useState<number | string>('');
  const [dueDate, setDueDate] = useState('');
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState('');
  const [labels, setLabels] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Comment state
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([taskService.getTaskById(id), commentService.getByTask(id)])
      .then(async ([t, c]) => {
        setTask(t);
        setComments(c);

        setTitle(t.title || '');
        setDescription(t.description || '');
        setStatus(t.status);
        setPriority(t.priority);
        setAssignedTo(t.assignedTo ? (typeof t.assignedTo === 'object' ? t.assignedTo._id : t.assignedTo) : '');
        setSprint(t.sprint ? (typeof t.sprint === 'object' ? (t.sprint as any)._id : String(t.sprint)) : '');
        setStoryPoints(t.storyPoints ?? '');
        setDueDate(t.dueDate ? t.dueDate.split('T')[0] : '');
        setIsBlocked(!!t.isBlocked);
        setBlockedReason(t.blockedReason || '');
        setLabels(t.labels?.join(', ') || '');
        setSubtasks(t.subtasks || []);

        const projId = typeof t.project === 'object' && t.project !== null ? t.project._id : String(t.project);
        if (projId) {
          try {
            const [proj, spr] = await Promise.all([
              projectService.getProjectById(projId),
              sprintService.getSprintsByProject(projId).catch(() => ({ sprints: [] })),
            ]);
            setProjectMembers(proj.members || []);
            setSprints(Array.isArray((spr as any)?.sprints) ? (spr as any).sprints : []);
          } catch {}
        }
      })
      .catch((err) => {
        console.error(err);
        toast.error('Failed to load task details');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Join the project room once task is fetched
  useEffect(() => {
    if (!task) return;
    const projId = typeof task.project === 'object' && task.project !== null ? task.project._id : String(task.project);
    if (projId) {
      joinProject(projId);
      return () => leaveProject(projId);
    }
  }, [task?.project, joinProject, leaveProject]);

  // Real-time socket updates
  useEffect(() => {
    if (!socket || !id) return;

    const handleCommentNew = (comment: Comment) => {
      if (comment.task === id) {
        setComments((prev) => (prev.find((c) => c._id === comment._id) ? prev : [...prev, comment]));
      }
    };

    const handleTaskUpdated = (updatedTask: Task) => {
      if (updatedTask._id === id) {
        setTask(updatedTask);
        if (!isEditing) {
          setTitle(updatedTask.title);
          setDescription(updatedTask.description || '');
          setStatus(updatedTask.status);
          setPriority(updatedTask.priority);
          setSubtasks(updatedTask.subtasks || []);
        }
      }
    };

    socket.on('comment:new', handleCommentNew);
    socket.on('task:updated', handleTaskUpdated);

    return () => {
      socket.off('comment:new', handleCommentNew);
      socket.off('task:updated', handleTaskUpdated);
    };
  }, [socket, id, isEditing]);

  const handleSave = async () => {
    if (!task) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        assignedTo: assignedTo || null,
        sprint: sprint || null,
        storyPoints: storyPoints !== '' ? Number(storyPoints) : undefined,
        dueDate: dueDate || undefined,
        isBlocked,
        blockedReason: isBlocked ? blockedReason : '',
        labels: labels.split(',').map((l) => l.trim()).filter(Boolean),
        subtasks,
      };

      const updated = await taskService.updateTask(task._id, payload as any);
      setTask(updated);
      setIsEditing(false);
      toast.success('Task saved successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatusChange = async (newStatus: TaskStatus) => {
    if (!task) return;
    try {
      const updated = await taskService.updateTask(task._id, { status: newStatus } as any);
      setTask(updated);
      setStatus(newStatus);
      toast.success(`Status changed to ${newStatus.replace('_', ' ')}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    if (!task) return;
    const nextSubtasks = subtasks.map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    setSubtasks(nextSubtasks);
    try {
      const updated = await taskService.updateTask(task._id, { subtasks: nextSubtasks } as any);
      setTask(updated);
    } catch {
      toast.error('Failed to update subtask');
    }
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newSubtaskTitle.trim()) return;
    const newSt: Subtask = {
      id: Date.now().toString(),
      title: newSubtaskTitle.trim(),
      completed: false,
    };
    const nextSubtasks = [...subtasks, newSt];
    setSubtasks(nextSubtasks);
    setNewSubtaskTitle('');
    taskService.updateTask(task._id, { subtasks: nextSubtasks } as any)
      .then((updated) => setTask(updated))
      .catch(() => toast.error('Failed to add subtask'));
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !id) return;
    setSubmittingComment(true);
    try {
      const added = await commentService.create({ content: newComment.trim(), taskId: id });
      setComments((prev) => (prev.find((c) => c._id === added._id) ? prev : [...prev, added]));
      setNewComment('');
      toast.success('Comment posted');
    } catch {
      toast.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !task) return;
    const toastId = toast.loading('Uploading attachment...');
    try {
      const updated = await taskService.uploadAttachment(task._id, file);
      setTask(updated);
      toast.success('Attachment uploaded', { id: toastId });
    } catch {
      toast.error('Failed to upload attachment', { id: toastId });
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    if (!window.confirm(`Are you sure you want to delete task "${task.title}"?`)) return;
    try {
      await taskService.deleteTask(task._id);
      toast.success('Task deleted');
      const projId = typeof task.project === 'object' && task.project !== null ? task.project._id : String(task.project);
      navigate(`/projects/${projId}/board`);
    } catch {
      toast.error('Failed to delete task');
    }
  };

  if (loading) return <LoadingSpinner fullPage text="Loading task..." />;
  if (!task) return <div className="text-center py-20 text-slate-500">Task not found</div>;

  const projObj = typeof task.project === 'object' && task.project !== null ? task.project : null;
  const completedSubtasks = subtasks.filter((st) => st.completed).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Navigation Breadcrumb & Actions Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {projObj && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link to={`/projects/${projObj._id}`} className="hover:text-primary-400 font-medium">
              {projObj.name}
            </Link>
            <span>/</span>
            <Link to={`/projects/${projObj._id}/board`} className="hover:text-primary-400 font-medium">
              Kanban Board
            </Link>
            <span>/</span>
            <span className="text-white font-mono font-semibold">{task.taskKey || task._id}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
              Edit Task
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave} isLoading={saving}>
                Save Changes
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={handleDeleteTask} className="text-rose-400 hover:text-rose-300">
            Delete
          </Button>
        </div>
      </div>

      {/* Main Task Header Card */}
      <div className="card p-6 space-y-6">
        <div>
          <div className="flex items-center gap-2.5 mb-2 flex-wrap">
            {task.taskKey && (
              <span className="badge bg-primary-500/20 text-primary-300 font-mono text-xs px-2.5 py-0.5 rounded border border-primary-500/30">
                {task.taskKey}
              </span>
            )}
            <StatusBadge status={task.status} size="sm" />
            <StatusBadge status={task.priority} size="sm" />
            {task.isBlocked && (
              <span className="badge bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs px-2.5 py-0.5 rounded flex items-center gap-1">
                🚫 Blocked: {task.blockedReason || 'Reason unspecified'}
              </span>
            )}
          </div>

          {!isEditing ? (
            <h1 className="text-2xl font-bold text-white tracking-tight leading-snug">{task.title}</h1>
          ) : (
            <input
              type="text"
              className="input text-xl font-bold py-2 mt-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </div>

        {/* Properties Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div>
            <label className="label">Status</label>
            {!isEditing ? (
              <select
                className="input text-xs py-1 px-2 bg-slate-900 w-36"
                value={task.status}
                onChange={(e) => handleQuickStatusChange(e.target.value as TaskStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            ) : (
              <select
                className="input text-xs py-1 px-2 bg-slate-900"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="label">Priority</label>
            {!isEditing ? (
              <div className="pt-1">
                <StatusBadge status={task.priority} size="sm" />
              </div>
            ) : (
              <select
                className="input text-xs py-1 px-2 bg-slate-900"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="label">Assignee</label>
            {!isEditing ? (
              <div className="pt-1">
                {task.assignedTo ? (
                  <div className="flex items-center gap-1.5">
                    <Avatar user={task.assignedTo} size="xs" />
                    <span className="text-xs text-slate-200">{task.assignedTo.name}</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-500">Unassigned</span>
                )}
              </div>
            ) : (
              <select
                className="input text-xs py-1 px-2 bg-slate-900"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
              >
                <option value="">Unassigned</option>
                {projectMembers.map((m) => (
                  <option key={m.user._id} value={m.user._id}>
                    {m.user.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="label">Story Points</label>
            {!isEditing ? (
              <div className="pt-1 font-mono text-sm text-white font-semibold">
                {task.storyPoints !== undefined ? `${task.storyPoints} pts` : '—'}
              </div>
            ) : (
              <input
                type="number"
                min="0"
                className="input text-xs py-1"
                placeholder="e.g. 5"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
              />
            )}
          </div>
        </div>

        {/* Secondary Edit Controls */}
        {isEditing && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-900/30 border border-slate-800">
            <div>
              <label className="label">Sprint</label>
              <select
                className="input text-xs py-1.5 bg-slate-900"
                value={sprint}
                onChange={(e) => setSprint(e.target.value)}
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
              <label className="label">Due Date</label>
              <input
                type="date"
                className="input text-xs py-1.5"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Labels</label>
              <input
                type="text"
                className="input text-xs py-1.5"
                placeholder="frontend, auth, bug"
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
              />
            </div>

            <div className="md:col-span-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBlocked}
                  onChange={(e) => setIsBlocked(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-rose-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-semibold text-rose-400">Mark task as blocked</span>
              </label>
              {isBlocked && (
                <input
                  type="text"
                  className="input text-xs py-1.5 mt-2 bg-slate-900 border-rose-500/40 text-rose-200"
                  placeholder="Explain why this task is blocked..."
                  value={blockedReason}
                  onChange={(e) => setBlockedReason(e.target.value)}
                />
              )}
            </div>
          </div>
        )}

        {/* Description Section */}
        <div>
          <label className="label">Description</label>
          {!isEditing ? (
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800">
              <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                {task.description || <span className="italic text-slate-500">No description provided.</span>}
              </p>
            </div>
          ) : (
            <textarea
              rows={5}
              className="input resize-y text-sm leading-relaxed"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide full requirements, context, and steps..."
            />
          )}
        </div>

        {/* Subtasks Checklist */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">Subtasks Checklist</h4>
            <span className="text-xs text-slate-500 font-medium">
              {completedSubtasks} of {subtasks.length} resolved
            </span>
          </div>

          <div className="space-y-1.5">
            {subtasks.map((st) => (
              <div
                key={st.id}
                onClick={() => handleToggleSubtask(st.id)}
                className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900/50 hover:bg-slate-800/60 border border-slate-800/80 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={st.completed}
                  onChange={() => {}}
                  className="rounded border-slate-700 bg-slate-900 text-primary-500 w-4 h-4 cursor-pointer"
                />
                <span className={`text-sm flex-1 ${st.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                  {st.title}
                </span>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddSubtask} className="flex gap-2 pt-1">
            <input
              type="text"
              className="input text-xs py-1.5"
              placeholder="+ Add a subtask..."
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
            />
            <Button type="submit" variant="secondary" size="sm" disabled={!newSubtaskTitle.trim()}>
              Add
            </Button>
          </form>
        </div>

        {/* Attachments Section */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">Attachments</h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              leftIcon={
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              }
            >
              Upload Attachment
            </Button>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleUploadAttachment} />
          </div>

          {task.attachments && task.attachments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {task.attachments.map((att, idx) => (
                <a
                  key={idx}
                  href={`${import.meta.env.VITE_API_URL?.replace('/api', '')}${att.url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors group"
                >
                  <div className="p-2 rounded bg-slate-800 text-slate-400 group-hover:text-primary-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-200 truncate group-hover:text-primary-300">
                      {att.filename}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {format(new Date(att.uploadedAt), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No attachments uploaded yet.</p>
          )}
        </div>
      </div>

      {/* Two Column Layout: Comments and Live Activity Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Discussion / Comments Stream */}
        <div className="card p-5 space-y-4">
          <h3 className="text-base font-semibold text-white">Discussion ({comments.length})</h3>

          <form onSubmit={handleComment} className="space-y-2">
            <textarea
              rows={3}
              className="input text-xs leading-relaxed"
              placeholder="Leave feedback, updates, or link documentation..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!newComment.trim()}
                isLoading={submittingComment}
              >
                Post Comment
              </Button>
            </div>
          </form>

          <div className="space-y-3 pt-2">
            {comments.map((comment) => (
              <div key={comment._id} className="flex gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <Avatar user={comment.author} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-white">{comment.author.name}</span>
                    <span className="text-[11px] text-slate-500">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{comment.content}</p>
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-6 italic">No comments yet. Start the conversation!</p>
            )}
          </div>
        </div>

        {/* Task Audit & Activity Feed */}
        <div className="card p-5 space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Activity Timeline
          </h3>
          <ActivityTimeline maxItems={8} />
        </div>
      </div>
    </div>
  );
};
