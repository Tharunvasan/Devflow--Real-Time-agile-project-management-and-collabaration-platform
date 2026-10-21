import React, { useEffect, useState } from 'react';
import { notificationService } from '../services/notificationService';
import type { Notification } from '../types';
import { LoadingSpinner, EmptyState } from '../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    notificationService.getNotifications(1, 50)
      .then(data => { setNotifications(data.notifications); setUnread(data.unread); })
      .catch(() => toast.error('Failed to load notifications'))
      .finally(() => setLoading(false));
  }, []);

  const handleMarkAllRead = async () => {
    await notificationService.markAllAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
    toast.success('All marked as read');
  };

  const handleMarkRead = async (id: string) => {
    await notificationService.markAsRead(id);
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  };

  if (loading) return <LoadingSpinner fullPage text="Loading notifications..." />;

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          {unread > 0 && <p className="text-dark-400 mt-1">{unread} unread</p>}
        </div>
        {unread > 0 && (
          <button onClick={handleMarkAllRead} className="btn-secondary btn-sm" id="mark-all-read-btn">
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          title="No notifications"
          description="You're all caught up! Notifications will appear here."
        />
      ) : (
        <div className="card overflow-hidden divide-y divide-dark-800">
          {notifications.map((notif) => (
            <div
              key={notif._id}
              onClick={() => !notif.read && handleMarkRead(notif._id)}
              className={`p-4 transition-colors ${!notif.read ? 'bg-primary-900/10 hover:bg-primary-900/20 cursor-pointer border-l-2 border-l-primary-500' : 'hover:bg-dark-750'}`}
              id={`notif-${notif._id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`text-sm ${notif.read ? 'text-dark-400' : 'text-dark-100'}`}>{notif.message}</p>
                {!notif.read && (
                  <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-1.5" />
                )}
              </div>
              <p className="text-xs text-dark-500 mt-1">
                {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
