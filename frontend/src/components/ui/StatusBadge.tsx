import React from 'react';
import type { TaskStatus, TaskPriority, IssueSeverity, IssueStatus, SprintStatus, ProjectStatus } from '../../types';

interface BadgeProps {
  status: TaskStatus | TaskPriority | IssueSeverity | IssueStatus | SprintStatus | ProjectStatus | string;
  size?: 'sm' | 'md';
  showDot?: boolean;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string; dotColor: string }> = {
  // Task Status
  TODO: { label: 'To Do', className: 'badge-gray', dotColor: 'bg-slate-400' },
  IN_PROGRESS: { label: 'In Progress', className: 'badge-blue', dotColor: 'bg-sky-400' },
  IN_REVIEW: { label: 'In Review', className: 'badge-purple', dotColor: 'bg-violet-400' },
  DONE: { label: 'Done', className: 'badge-green', dotColor: 'bg-emerald-400' },

  // Priority
  LOW: { label: 'Low', className: 'badge-green', dotColor: 'bg-emerald-400' },
  MEDIUM: { label: 'Medium', className: 'badge-yellow', dotColor: 'bg-amber-400' },
  HIGH: { label: 'High', className: 'badge-yellow', dotColor: 'bg-orange-400' },
  CRITICAL: { label: 'Critical', className: 'badge-red', dotColor: 'bg-rose-500' },

  // Issue Status
  OPEN: { label: 'Open', className: 'badge-yellow', dotColor: 'bg-amber-400' },
  FIXED: { label: 'Fixed', className: 'badge-blue', dotColor: 'bg-sky-400' },
  VERIFIED: { label: 'Verified', className: 'badge-green', dotColor: 'bg-emerald-400' },
  CLOSED: { label: 'Closed', className: 'badge-gray', dotColor: 'bg-slate-400' },

  // Sprint Status
  PLANNED: { label: 'Planned', className: 'badge-gray', dotColor: 'bg-slate-400' },
  ACTIVE: { label: 'Active', className: 'badge-green', dotColor: 'bg-emerald-400' },
  COMPLETED: { label: 'Completed', className: 'badge-blue', dotColor: 'bg-sky-400' },

  // Project Status
  PLANNING: { label: 'Planning', className: 'badge-gray', dotColor: 'bg-slate-400' },
  ON_HOLD: { label: 'On Hold', className: 'badge-yellow', dotColor: 'bg-amber-400' },
  ARCHIVED: { label: 'Archived', className: 'badge-gray', dotColor: 'bg-slate-500' },
};

export const StatusBadge: React.FC<BadgeProps> = ({ status, size = 'sm', showDot = true, className = '' }) => {
  const config = statusConfig[status] || {
    label: typeof status === 'string' ? status.replace(/_/g, ' ') : status,
    className: 'badge-gray',
    dotColor: 'bg-slate-400',
  };

  const sizeClass = size === 'sm' ? 'text-[11px] py-0.5 px-2' : 'text-xs py-1 px-2.5';

  return (
    <span className={`${config.className} ${sizeClass} ${className} inline-flex items-center gap-1.5 font-medium rounded-md`}>
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor} shrink-0`} />}
      <span>{config.label}</span>
    </span>
  );
};
