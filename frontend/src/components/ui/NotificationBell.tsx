import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { notificationService } from '../../services/notificationService';
import type { Notification } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { useSocket } from '../../context/SocketContext';
import toast from 'react-hot-toast';

export const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { socket } = useSocket();

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleNewNotification = (notif: Notification) => {
      setNotifications(prev => [notif, ...prev]);
      setUnread(prev => prev + 1);
      toast.success(notif.message, { icon: '🔔' });
    };
    socket.on('notification:new', handleNewNotification);
    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await notificationService.getNotifications(1, 10);
      setNotifications(data.notifications);
      setUnread(data.unread);
    } catch {
      // Silently fail for bell
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    await notificationService.markAllAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) fetchNotifications(); }}
        className="relative btn-ghost p-2 rounded-lg"
        id="notification-bell"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-80 card shadow-2xl z-50 animate-fade-in overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
            <h3 className="font-semibold text-white">Notifications</h3>
            {unread > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-primary-400 hover:text-primary-300">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-dark-400 text-sm">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-dark-400 text-sm">No notifications</div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif._id}
                  className={`px-4 py-3 border-b border-dark-800 hover:bg-dark-750 transition-colors ${!notif.read ? 'bg-primary-900/10 border-l-2 border-l-primary-500' : ''}`}
                >
                  <p className="text-sm text-dark-200">{notif.message}</p>
                  <p className="text-xs text-dark-500 mt-1">
                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="px-4 py-2 border-t border-dark-700">
            <Link to="/notifications" onClick={() => setIsOpen(false)} className="text-xs text-primary-400 hover:text-primary-300">
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
