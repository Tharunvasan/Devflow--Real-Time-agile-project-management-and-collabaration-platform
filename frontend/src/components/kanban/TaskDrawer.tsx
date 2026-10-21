import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { taskService } from '../../services/taskService';
import { commentService } from '../../services/commentService';
import type { Task, Comment, Subtask, Project, Sprint, TaskStatus, TaskPriority } from '../../types';
import { useSocket } from '../../context/SocketContext';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';

interface TaskDrawerProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: (updatedTask: Task) => void;
  projectMembers?: Project['members'];
  sprints?: Sprint[];
}

export const TaskDrawer: React.FC<TaskDrawerProps> = ({
  task,
  isOpen,
  onClose,
  onTaskUpdated,
  projectMembers = [],
  sprints = [],
}) => {
  const { socket, joinProject, leaveProject } = useSocket();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
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

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [saving, setSaving] = useState(false);

  // Synchronize form when task prop changes
  useEffect(() => {
    if (!task) return;
    setTitle(task.title || '');
    setDescription(task.description || '');
    setStatus(task.status);
    setPriority(task.priority);
    setAssignedTo(task.assignedTo ? (typeof task.assignedTo === 'object' ? task.assignedTo._id : task.assignedTo) : '');
    setSprint(task.sprint ? (typeof task.sprint === 'object' ? (task.sprint as any)._id : String(task.sprint)) : '');
    setStoryPoints(task.storyPoints ?? '');
    setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
    setIsBlocked(!!task.isBlocked);
    setBlockedReason(task.blockedReason || '');
    setLabels(task.labels?.join(', ') || '');
    setSubtasks(task.subtasks || []);

    // Load comments
    commentService.getByTask(task._id).then(setComments).catch(() => setComments([]));

    // Join project room for real-time updates
    const projId = typeof task.project === 'object' && task.project !== null ? task.project._id : String(task.project);
    if (projId) {
      joinProject(projId);
      return () => leaveProject(projId);
    }
  }, [task, joinProject, leaveProject]);

  // Real-time comments and updates
  useEffect(() => {
    if (!socket || !task) return;

    const handleCommentNew = (comment: Comment) => {
      if (comment.task === task._id) {
        setComments((prev) => (prev.find((c) => c._id === comment._id) ? prev : [...prev, comment]));
      }
    };

    socket.on('comment:new', handleCommentNew);
    return () => {
      socket.off('comment:new', handleCommentNew);
    };
  }, [socket, task]);

  if (!task) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Partial<Task> = {
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        assignedTo: (assignedTo || null) as any,
        sprint: (sprint || null) as any,
        storyPoints: storyPoints !== '' ? Number(storyPoints) : undefined,
        dueDate: dueDate || undefined,
        isBlocked,
        blockedReason: isBlocked ? blockedReason : '',
        labels: labels.split(',').map((l) => l.trim()).filter(Boolean),
        subtasks,
      };

      const updated = await taskService.updateTask(task._id, payload as any);
      onTaskUpdated(updated);
      toast.success('Task updated');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    const nextSubtasks = subtasks.map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    setSubtasks(nextSubtasks);
    try {
      const updated = await taskService.updateTask(task._id, { subtasks: nextSubtasks } as any);
      onTaskUpdated(updated);
    } catch {
      toast.error('Failed to update subtask');
    }
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    const newSt: Subtask = {
      id: Date.now().toString(),
      title: newSubtaskTitle.trim(),
      completed: false,
    };
    const nextSubtasks = [...subtasks, newSt];
    setSubtasks(nextSubtasks);
    setNewSubtaskTitle('');
    taskService.updateTask(task._id, { subtasks: nextSubtasks } as any)
      .then(onTaskUpdated)
      .catch(() => toast.error('Failed to save subtask'));
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const added = await commentService.create({ content: newComment.trim(), taskId: task._id });
      setComments((prev) => (prev.find((c) => c._id === added._id) ? prev : [...prev, added]));
      setNewComment('');
      toast.success('Comment added');
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const toastId = toast.loading('Uploading attachment...');
    try {
      const updated = await taskService.uploadAttachment(task._id, file);
      onTaskUpdated(updated);
      toast.success('Attachment uploaded', { id: toastId });
    } catch {
      toast.error('Failed to upload attachment', { id: toastId });
    }
  };

  const completedSubtasksCount = subtasks.filter((st) => st.completed).length;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      width="max-w-2xl"
      title={
        <div className="flex items-center gap-2.5 flex-wrap">
          {task.taskKey && (
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-primary-500/20 text-primary-300 border border-primary-500/30">
              {task.taskKey}
            </span>
          )}
          <span className="text-white text-base font-semibold truncate max-w-sm">{title || 'Task Details'}</span>
        </div>
      }
      subtitle={
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>Created by {task.createdBy?.name || 'Team member'}</span>
          <span>•</span>
          <Link
            to={`/tasks/${task._id}`}
            className="text-primary-400 hover:text-primary-300 hover:underline flex items-center gap-1 font-medium"
          >
            <span>Full Task Page</span>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </Link>
        </div>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} isLoading={saving}>
            Save Changes
          </Button>
        </>
      }
    >
      {/* Title input */}
      <div>
        <label className="label">Task Title</label>
        <input
          type="text"
          className="input text-base font-medium py-2.5"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter task title"
        />
      </div>

      {/* Primary Properties Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div>
          <label className="label">Status</label>
          <select
            className="input text-xs py-1.5 px-2 bg-slate-900"
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
          >
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="DONE">Done</option>
          </select>
        </div>

        <div>
          <label className="label">Priority</label>
          <select
            className="input text-xs py-1.5 px-2 bg-slate-900"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>

        <div>
          <label className="label">Assignee</label>
          <select
            className="input text-xs py-1.5 px-2 bg-slate-900"
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
        </div>

        <div>
          <label className="label">Sprint</label>
          <select
            className="input text-xs py-1.5 px-2 bg-slate-900"
            value={sprint}
            onChange={(e) => setSprint(e.target.value)}
          >
            <option value="">Backlog</option>
            {sprints.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Secondary Properties */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="label">Story Points</label>
          <input
            type="number"
            min="0"
            max="100"
            className="input text-xs py-1.5"
            placeholder="e.g. 3, 5, 8"
            value={storyPoints}
            onChange={(e) => setStoryPoints(e.target.value)}
          />
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
            placeholder="api, ui, frontend"
            value={labels}
            onChange={(e) => setLabels(e.target.value)}
          />
        </div>
      </div>

      {/* Blocked State Toggle */}
      <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isBlocked}
            onChange={(e) => setIsBlocked(e.target.checked)}
            className="rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-rose-500/40 w-4 h-4"
          />
          <span className="text-sm font-medium text-rose-400 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.332.192 3 1.732 3z" />
            </svg>
            Mark as Blocked
          </span>
        </label>
        {isBlocked && (
          <input
            type="text"
            className="input text-xs py-1.5 bg-slate-900 border-rose-500/40 focus:border-rose-500 text-rose-200"
            placeholder="State why this task is blocked (e.g. Waiting on API credentials)"
            value={blockedReason}
            onChange={(e) => setBlockedReason(e.target.value)}
          />
        )}
      </div>

      {/* Description */}
      <div>
        <label className="label">Description</label>
        <textarea
          rows={4}
          className="input resize-y text-sm leading-relaxed"
          placeholder="Add detailed task requirements, context, or acceptance criteria..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Subtasks Checklist */}
      <div className="space-y-3 pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-white">Subtasks</h4>
            <span className="text-xs text-slate-500 font-medium">
              {completedSubtasksCount} of {subtasks.length} completed
            </span>
          </div>
          {subtasks.length > 0 && (
            <div className="w-24 bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-primary-500 h-1.5 transition-all"
                style={{ width: `${Math.round((completedSubtasksCount / subtasks.length) * 100)}%` }}
              />
            </div>
          )}
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

      {/* Attachments */}
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
            Upload
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
          <p className="text-xs text-slate-500 italic">No attachments uploaded.</p>
        )}
      </div>

      {/* Comments Section */}
      <div className="space-y-4 pt-2 border-t border-slate-800">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <span>Discussion & Comments</span>
          <span className="text-xs font-normal text-slate-500">({comments.length})</span>
        </h4>

        {/* New comment input */}
        <form onSubmit={handlePostComment} className="space-y-2">
          <textarea
            rows={2}
            className="input text-xs"
            placeholder="Write a comment or update... (Enter to submit)"
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

        {/* Comments stream */}
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment._id} className="flex gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <Avatar user={comment.author} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-white">{comment.author.name}</span>
                  <span className="text-[11px] text-slate-500">
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{comment.content}</p>
              </div>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-4 italic">No comments yet. Start the conversation!</p>
          )}
        </div>
      </div>
    </Drawer>
  );
};
