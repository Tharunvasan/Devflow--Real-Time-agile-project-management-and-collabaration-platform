import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { issueService } from '../services/issueService';
import type { Issue } from '../types';
import { LoadingSpinner, EmptyState } from '../components/ui/LoadingSpinner';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Avatar } from '../components/ui/Avatar';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

export const AllIssuesPage: React.FC = () => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  const fetchIssues = useCallback(async () => {
    try {
      setLoading(true);
      const data = await issueService.getIssues({
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        limit: 100,
      });
      setIssues(data.issues);
    } catch {
      toast.error('Failed to load issues');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const filteredIssues = issues.filter((i) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      i.title.toLowerCase().includes(q) ||
      i.issueKey?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Issue Tracking</h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor defects, bugs, and blockers across all your projects.
          </p>
        </div>
        <Link to="/projects" className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Go to Projects
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
            placeholder="Search issues by title, key, or description..."
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
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="FIXED">Fixed</option>
          <option value="VERIFIED">Verified</option>
          <option value="CLOSED">Closed</option>
        </select>

        <select
          className="input text-xs py-1.5 w-36 bg-slate-900"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
        >
          <option value="">All Severities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>
      </div>

      {/* Issues Table */}
      {loading ? (
        <LoadingSpinner fullPage text="Loading issues..." />
      ) : filteredIssues.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-12 h-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.332.192 3 1.732 3z" />
            </svg>
          }
          title="No issues found"
          description="Great job! There are no outstanding issues matching your criteria."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th className="w-32">Key</th>
                <th>Title</th>
                <th>Project</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Assignee</th>
                <th>Reported</th>
              </tr>
            </thead>
            <tbody>
              {filteredIssues.map((issue) => {
                const projObj = typeof issue.project === 'object' && issue.project !== null ? issue.project : null;
                return (
                  <tr key={issue._id} className="hover:bg-slate-800/40">
                    <td className="font-mono text-xs text-rose-400 font-semibold">
                      <Link to={`/issues/${issue._id}`} className="hover:underline">
                        {issue.issueKey || '—'}
                      </Link>
                    </td>
                    <td>
                      <Link
                        to={`/issues/${issue._id}`}
                        className="font-medium text-slate-200 hover:text-primary-300 transition-colors block"
                      >
                        {issue.title}
                      </Link>
                    </td>
                    <td className="text-xs text-slate-400">
                      {projObj ? projObj.name : '—'}
                    </td>
                    <td>
                      <StatusBadge status={issue.severity} size="sm" />
                    </td>
                    <td>
                      <StatusBadge status={issue.status} size="sm" />
                    </td>
                    <td>
                      {issue.assignedTo ? (
                        <div className="flex items-center gap-1.5">
                          <Avatar user={issue.assignedTo} size="xs" />
                          <span className="text-xs text-slate-300 truncate max-w-[100px]">
                            {issue.assignedTo.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600">Unassigned</span>
                      )}
                    </td>
                    <td className="text-xs text-slate-500">
                      {formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
