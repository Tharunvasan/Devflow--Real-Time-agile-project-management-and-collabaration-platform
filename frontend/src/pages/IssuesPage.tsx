import React, { useEffect, useState, useCallback } from 'react';
import { useOutletContext, useParams, Link } from 'react-router-dom';
import { issueService } from '../services/issueService';
import type { Issue, Project } from '../types';
import { Modal } from '../components/ui/Modal';
import { LoadingSpinner, EmptyState } from '../components/ui/LoadingSpinner';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Avatar } from '../components/ui/Avatar';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { useSocket } from '../context/SocketContext';

interface OutletCtx {
  project: Project;
}

export const IssuesPage: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const { project } = useOutletContext<OutletCtx>();
  const { socket, reconnectEpoch } = useSocket();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    reproductionSteps: '',
    expectedBehavior: '',
    assignedTo: '',
    severity: 'MEDIUM',
    priority: 'MEDIUM',
  });

  const fetchIssues = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const data = await issueService.getIssues({
        project: projectId,
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
      });
      setIssues(data.issues);
    } catch {
      toast.error('Failed to load issues');
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter, severityFilter]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues, reconnectEpoch]);

  useEffect(() => {
    if (!socket) return;
    const handleIssueCreated = (newIssue: Issue) => {
      setIssues((prev) => {
        if (prev.find((i) => i._id === newIssue._id)) return prev;
        return [newIssue, ...prev];
      });
    };
    const handleIssueUpdated = (updatedIssue: Issue) => {
      setIssues((prev) => prev.map((i) => (i._id === updatedIssue._id ? updatedIssue : i)));
    };
    const handleIssueDeleted = ({ issueId }: { issueId: string }) => {
      setIssues((prev) => prev.filter((i) => i._id !== issueId));
    };

    socket.on('issue:created', handleIssueCreated);
    socket.on('issue:updated', handleIssueUpdated);
    socket.on('issue:deleted', handleIssueDeleted);

    return () => {
      socket.off('issue:created', handleIssueCreated);
      socket.off('issue:updated', handleIssueUpdated);
      socket.off('issue:deleted', handleIssueDeleted);
    };
  }, [socket]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    setCreating(true);
    try {
      const issue = await issueService.createIssue({
        ...form,
        project: projectId,
        assignedTo: form.assignedTo || undefined,
      });
      setIssues((prev) => [issue, ...prev]);
      setShowCreate(false);
      setForm({
        title: '',
        description: '',
        reproductionSteps: '',
        expectedBehavior: '',
        assignedTo: '',
        severity: 'MEDIUM',
        priority: 'MEDIUM',
      });
      toast.success('Issue reported!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create issue');
    } finally {
      setCreating(false);
    }
  };

  const filteredIssues = issues.filter(
    (i) =>
      !search ||
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      (i.issueKey && i.issueKey.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <LoadingSpinner fullPage text="Loading issues..." />;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          <input
            className="input max-w-xs"
            placeholder="Search issues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            id="issue-search"
          />
          <select
            className="input w-36"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            id="issue-status-filter"
          >
            <option value="">All Status</option>
            {['OPEN', 'IN_PROGRESS', 'FIXED', 'VERIFIED', 'CLOSED'].map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
          <select
            className="input w-36"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            id="issue-severity-filter"
          >
            <option value="">All Severity</option>
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary" id="report-issue-btn">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Report Issue
        </button>
      </div>

      {filteredIssues.length === 0 ? (
        <EmptyState
          title="No issues found"
          description="Everything looks clear! Report a bug or issue when needed."
          action={
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              Report Issue
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-dark-800 text-dark-400 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Key / Title</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Severity</th>
                <th className="px-4 py-3 text-left">Priority</th>
                <th className="px-4 py-3 text-left">Assignee</th>
                <th className="px-4 py-3 text-left">Reported</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-800">
              {filteredIssues.map((issue) => (
                <tr key={issue._id} className="hover:bg-dark-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      to={`/issues/${issue._id}`}
                      className="font-medium text-white hover:text-primary-400 transition-colors block"
                    >
                      {issue.issueKey && (
                        <span className="text-xs font-mono text-dark-400 mr-2 bg-dark-800 px-1.5 py-0.5 rounded">
                          {issue.issueKey}
                        </span>
                      )}
                      {issue.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={issue.status} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={issue.severity} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={issue.priority} />
                  </td>
                  <td className="px-4 py-3">
                    {issue.assignedTo ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar user={issue.assignedTo} size="xs" />
                        <span className="text-dark-300 text-xs">{issue.assignedTo.name}</span>
                      </div>
                    ) : (
                      <span className="text-dark-500 text-xs">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-dark-500 text-xs">
                    {formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Report Issue">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input
              className="input"
              placeholder="Describe the issue briefly"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              id="issue-title"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Overall summary..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              id="issue-desc"
            />
          </div>
          <div>
            <label className="label">Reproduction Steps</label>
            <textarea
              className="input"
              rows={2}
              placeholder="1. Go to page... 2. Click button... 3. Notice crash..."
              value={form.reproductionSteps}
              onChange={(e) => setForm({ ...form, reproductionSteps: e.target.value })}
              id="issue-repro"
            />
          </div>
          <div>
            <label className="label">Expected Behavior</label>
            <input
              className="input"
              placeholder="What was expected to happen?"
              value={form.expectedBehavior}
              onChange={(e) => setForm({ ...form, expectedBehavior: e.target.value })}
              id="issue-expected"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Severity</label>
              <select
                className="input"
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
                id="issue-severity"
              >
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select
                className="input"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                id="issue-priority"
              >
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Assign To</label>
            <select
              className="input"
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
              id="issue-assignee"
            >
              <option value="">Unassigned</option>
              {project?.members.map((m) => (
                <option key={m.user._id} value={m.user._id}>
                  {m.user.name} ({m.user.email})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-danger" disabled={creating} id="submit-issue-btn">
              {creating ? 'Reporting...' : 'Report Issue'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
