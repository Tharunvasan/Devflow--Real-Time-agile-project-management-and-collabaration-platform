import React, { useEffect, useState } from 'react';
import type { Activity } from '../../types';
import { Avatar } from './Avatar';
import { formatDistanceToNow } from 'date-fns';
import { useSocket } from '../../context/SocketContext';
import { activityService } from '../../services/activityService';

interface ActivityTimelineProps {
  projectId?: string;
  taskId?: string;
  initialActivities?: Activity[];
  maxItems?: number;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  projectId,
  taskId,
  initialActivities,
  maxItems = 15,
}) => {
  const [activities, setActivities] = useState<Activity[]>(initialActivities || []);
  const [loading, setLoading] = useState(false);
  const { socket } = useSocket();

  useEffect(() => {
    if (initialActivities && initialActivities.length > 0) {
      setActivities(initialActivities);
      return;
    }

    if (projectId) {
      setLoading(true);
      activityService
        .getProjectActivities(projectId, 1, maxItems)
        .then((data) => setActivities(data.activities))
        .catch(console.error)
        .finally(() => setLoading(false));
    } else if (taskId) {
      setLoading(true);
      activityService
        .getTaskActivities(taskId)
        .then((items) => setActivities(items))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [projectId, taskId, maxItems]);

  // Real-time activity updates via socket
  useEffect(() => {
    if (!socket) return;

    const handleNewActivity = (newAct: Activity) => {
      // Filter if scoped to a task
      if (taskId && newAct.resourceId !== taskId) return;
      // Filter if scoped to a project
      const actProjId = typeof newAct.project === 'string' ? newAct.project : newAct.project?._id;
      if (projectId && actProjId && actProjId !== projectId) return;

      setActivities((prev) => {
        if (prev.find((a) => a._id === newAct._id)) return prev;
        return [newAct, ...prev].slice(0, maxItems);
      });
    };

    socket.on('activity:new', handleNewActivity);
    return () => {
      socket.off('activity:new', handleNewActivity);
    };
  }, [socket, projectId, taskId, maxItems]);

  if (loading && activities.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-dark-500 flex items-center justify-center gap-2">
        <span className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></span>
        Loading timeline...
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="py-8 text-center text-dark-500 text-sm">
        <p>No recent activity recorded yet.</p>
      </div>
    );
  }

  const getActionColor = (action: string) => {
    if (action.includes('CREATED') || action.includes('STARTED')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (action.includes('RESOLVED') || action.includes('COMPLETED')) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    if (action.includes('DELETED') || action.includes('REMOVED')) return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    if (action.includes('STATUS')) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-primary-400 bg-primary-500/10 border-primary-500/20';
  };

  return (
    <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-dark-800">
      {activities.map((act) => {
        const timeAgo = act.createdAt
          ? formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })
          : 'recently';

        return (
          <div key={act._id} className="relative group animate-fade-in">
            {/* Timeline dot */}
            <div className="absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full bg-primary-500 ring-4 ring-dark-900 group-hover:scale-125 transition-transform" />

            <div className="flex items-start justify-between gap-3 bg-dark-850/60 hover:bg-dark-800/80 p-3 rounded-lg border border-dark-800/80 transition-all">
              <div className="flex items-start gap-2.5 min-w-0">
                <Avatar user={act.actor} size="xs" />
                <div className="min-w-0">
                  <p className="text-xs text-dark-200 leading-relaxed font-medium">
                    <span className="font-semibold text-white mr-1">{act.actor?.name || 'Someone'}</span>
                    {act.details}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono uppercase tracking-wider ${getActionColor(act.action)}`}>
                      {act.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[11px] text-dark-500">{timeAgo}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
