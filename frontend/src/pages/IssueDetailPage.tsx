import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { issueService } from '../services/issueService';
import { commentService } from '../services/commentService';
import { projectService } from '../services/projectService';
import type { Issue, Comment, Project, IssueSeverity, IssuePriority, IssueStatus } from '../types';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { useSocket } from '../context/SocketContext';

const ISSUE_STATUSES: IssueStatus[] = ['OPEN', 'IN_PROGRESS', 'FIXED', 'VERIFIED', 'CLOSED'];
const SEVERITIES: IssueSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const PRIORITIES: IssuePriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const IssueDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { socket, joinProject, leaveProject } = useSocket();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [issue, setIssue] = useState<Issue | null>(null);
  const [projectMembers, setProjectMembers] = useState<Project['members']>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit fields
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reproductionSteps, setReproductionSteps] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [resolutionText, setResolutionText] = useState('');
  const [severity, setSeverity] = useState<IssueSeverity>('MEDIUM');
  const [priority, setPriority] = useState<IssuePriority>('MEDIUM');
  const [assignedTo, setAssignedTo] = useState('');
  const [status, setStatus] = useState<IssueStatus>('OPEN');

  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([issueService.getIssueById(id), commentService.getByIssue(id)])
      .then(async ([i, c]) => {
        setIssue(i);
        setComments(c);

        setTitle(i.title || '');
        setDescription(i.description || '');
        setReproductionSteps(i.reproductionSteps || '');
        setExpectedBehavior(i.expectedBehavior || '');
        setResolutionText(i.resolution || '');
        setSeverity(i.severity);
        setPriority(i.priority);
        setStatus(i.status);
        setAssignedTo(i.assignedTo ? (typeof i.assignedTo === 'object' ? i.assignedTo._id : i.assignedTo) : '');

        const projId = typeof i.project === 'object' && i.project !== null ? i.project._id : String(i.project);
        if (projId) {
          try {
            const proj = await projectService.getProjectById(projId);
            setProjectMembers(proj.members || []);
          } catch {}
        }
      })
      .catch((err) => {
        console.error(err);
        toast.error('Failed to load issue');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Join project room for real-time issue updates
  useEffect(() => {
    if (!issue) return;
    const projId = typeof issue.project === 'object' && issue.project !== null ? issue.project._id : String(issue.project);
    if (projId) {
      joinProject(projId);
      return () => leaveProject(projId);
    }
  }, [issue?.project, joinProject, leaveProject]);

  useEffect(() => {
    if (!socket || !id) return;

    const handleCommentNew = (comment: Comment) => {
      if (comment.issue === id) {
        setComments((prev) => (prev.find((c) => c._id === comment._id) ? prev : [...prev, comment]));
      }
    };

    const handleIssueUpdated = (updatedIssue: Issue) => {
      if (updatedIssue._id === id) {
        setIssue(updatedIssue);
        if (!isEditing) {
          setTitle(updatedIssue.title);
          setDescription(updatedIssue.description || '');
          setReproductionSteps(updatedIssue.reproductionSteps || '');
          setExpectedBehavior(updatedIssue.expectedBehavior || '');
          setResolutionText(updatedIssue.resolution || '');
          setSeverity(updatedIssue.severity);
          setPriority(updatedIssue.priority);
          setStatus(updatedIssue.status);
        }
      }
    };

    socket.on('comment:new', handleCommentNew);
    socket.on('issue:updated', handleIssueUpdated);

    return () => {
      socket.off('comment:new', handleCommentNew);
      socket.off('issue:updated', handleIssueUpdated);
    };
  }, [socket, id, isEditing]);

  const handleStatusChange = async (newStatus: IssueStatus) => {
    if (!issue) return;
    try {
      const updated = await issueService.updateIssue(issue._id, { status: newStatus as any });
      setIssue(updated);
      setStatus(newStatus);
      toast.success(`Issue status changed to ${newStatus}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleSave = async () => {
    if (!issue) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        reproductionSteps: reproductionSteps.trim(),
        expectedBehavior: expectedBehavior.trim(),
        resolution: resolutionText.trim(),
        severity,
        priority,
        status,
        assignedTo: assignedTo || null,
      };

      const updated = await issueService.updateIssue(issue._id, payload as any);
      setIssue(updated);
      setIsEditing(false);
      toast.success('Issue updated successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update issue');
    } finally {
      setSaving(false);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !id) return;
    setSubmittingComment(true);
    try {
      const added = await commentService.create({ content: newComment.trim(), issueId: id });
      setComments((prev) => (prev.find((c) => c._id === added._id) ? prev : [...prev, added]));
      setNewComment('');
      toast.success('Comment added');
    } catch {
      toast.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !issue) return;
    const toastId = toast.loading('Uploading attachment...');
    try {
      const attachment = await issueService.uploadAttachment(issue._id, file);
      setIssue((prev) => (prev ? { ...prev, attachments: [...(prev.attachments || []), attachment] } : null));
      toast.success('Attachment uploaded', { id: toastId });
    } catch {
      toast.error('Failed to upload attachment', { id: toastId });
    }
  };

  const handleDeleteIssue = async () => {
    if (!issue) return;
    if (!window.confirm(`Are you sure you want to delete issue "${issue.title}"?`)) return;
    try {
      await issueService.deleteIssue(issue._id);
      toast.success('Issue deleted');
      const projId = typeof issue.project === 'object' && issue.project !== null ? issue.project._id : String(issue.project);
      navigate(`/projects/${projId}/issues`);
    } catch {
      toast.error('Failed to delete issue');
    }
  };

  if (loading) return <LoadingSpinner fullPage text="Loading issue..." />;
  if (!issue) return <div className="text-center py-20 text-slate-500">Issue not found</div>;

  const projObj = typeof issue.project === 'object' && issue.project !== null ? issue.project : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Navigation Breadcrumb & Top Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {projObj && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link to={`/projects/${projObj._id}`} className="hover:text-primary-400 font-medium">
              {projObj.name}
            </Link>
            <span>/</span>
            <Link to={`/projects/${projObj._id}/issues`} className="hover:text-primary-400 font-medium">
              Issues
            </Link>
            <span>/</span>
            <span className="text-white font-mono font-semibold">{issue.issueKey || issue._id}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
              Edit Issue
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
          <Button variant="ghost" size="sm" onClick={handleDeleteIssue} className="text-rose-400 hover:text-rose-300">
            Delete
          </Button>
        </div>
      </div>

      {/* Main Issue Card */}
      <div className="card p-6 space-y-6">
        <div>
          <div className="flex items-center gap-2.5 mb-2 flex-wrap">
            {issue.issueKey && (
              <span className="badge bg-rose-500/20 text-rose-300 font-mono text-xs px-2.5 py-0.5 rounded border border-rose-500/30">
                {issue.issueKey}
              </span>
            )}
            <StatusBadge status={issue.severity} size="sm" />
            <StatusBadge status={issue.priority} size="sm" />
            <StatusBadge status={issue.status} size="sm" />
          </div>

          {!isEditing ? (
            <h1 className="text-2xl font-bold text-white tracking-tight leading-snug">{issue.title}</h1>
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
                value={issue.status}
                onChange={(e) => handleStatusChange(e.target.value as IssueStatus)}
              >
                {ISSUE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <select
                className="input text-xs py-1 px-2 bg-slate-900"
                value={status}
                onChange={(e) => setStatus(e.target.value as IssueStatus)}
              >
                {ISSUE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="label">Severity</label>
            {!isEditing ? (
              <div className="pt-1">
                <StatusBadge status={issue.severity} size="sm" />
              </div>
            ) : (
              <select
                className="input text-xs py-1 px-2 bg-slate-900"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as IssueSeverity)}
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="label">Priority</label>
            {!isEditing ? (
              <div className="pt-1">
                <StatusBadge status={issue.priority} size="sm" />
              </div>
            ) : (
              <select
                className="input text-xs py-1 px-2 bg-slate-900"
                value={priority}
                onChange={(e) => setPriority(e.target.value as IssuePriority)}
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
                {issue.assignedTo ? (
                  <div className="flex items-center gap-1.5">
                    <Avatar user={issue.assignedTo} size="xs" />
                    <span className="text-xs text-slate-200">{issue.assignedTo.name}</span>
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
                {projectMembers.map((m: any) => (
                  <option key={m.user._id} value={m.user._id}>
                    {m.user.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="label">Description</label>
          {!isEditing ? (
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800">
              <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                {issue.description || <span className="italic text-slate-500">No description provided.</span>}
              </p>
            </div>
          ) : (
            <textarea
              rows={4}
              className="input resize-y text-sm leading-relaxed"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail..."
            />
          )}
        </div>

        {/* Reproduction Steps & Expected Behavior */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Steps to Reproduce</label>
            {!isEditing ? (
              <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 min-h-[90px]">
                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {issue.reproductionSteps || <span className="italic text-slate-500">No reproduction steps recorded.</span>}
                </p>
              </div>
            ) : (
              <textarea
                rows={3}
                className="input resize-y text-xs leading-relaxed"
                value={reproductionSteps}
                onChange={(e) => setReproductionSteps(e.target.value)}
                placeholder="1. Open page&#10;2. Click submit&#10;3. Observe crash"
              />
            )}
          </div>

          <div>
            <label className="label">Expected Behavior</label>
            {!isEditing ? (
              <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 min-h-[90px]">
                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {issue.expectedBehavior || <span className="italic text-slate-500">No expected behavior recorded.</span>}
                </p>
              </div>
            ) : (
              <textarea
                rows={3}
                className="input resize-y text-xs leading-relaxed"
                value={expectedBehavior}
                onChange={(e) => setExpectedBehavior(e.target.value)}
                placeholder="Describe what should have happened instead..."
              />
            )}
          </div>
        </div>

        {/* Resolution Notes Section */}
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
          <label className="label">Resolution & Fix Notes</label>
          {!isEditing ? (
            <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
              {issue.resolution || <span className="italic text-slate-500">No resolution notes logged yet.</span>}
            </p>
          ) : (
            <textarea
              rows={2}
              className="input resize-y text-xs"
              placeholder="Document the solution, commit hash, or verification steps..."
              value={resolutionText}
              onChange={(e) => setResolutionText(e.target.value)}
            />
          )}
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
              Upload Attachment
            </Button>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleUploadAttachment} />
          </div>

          {issue.attachments && issue.attachments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {issue.attachments.map((att, idx) => (
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

      {/* Discussion & Comments */}
      <div className="card p-6 space-y-4">
        <h3 className="text-base font-semibold text-white">Discussion & Comments ({comments.length})</h3>

        <form onSubmit={handleComment} className="space-y-2">
          <textarea
            rows={3}
            className="input text-xs leading-relaxed"
            placeholder="Add comments, debugging notes, or reproduction clues..."
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
            <p className="text-xs text-slate-500 text-center py-6 italic">No comments yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};
