import api from './api';
import type { Notification } from '../types';

export const notificationService = {
  getNotifications: async (page = 1, limit = 20) => {
    const res = await api.get<{ success: boolean; data: { notifications: Notification[]; total: number; unread: number } }>('/notifications', { params: { page, limit } });
    return res.data.data!;
  },

  markAsRead: async (id: string) => {
    const res = await api.put<{ success: boolean; data: { notification: Notification } }>(`/notifications/${id}/read`);
    return res.data.data!.notification;
  },

  markAllAsRead: async () => {
    const res = await api.put<{ success: boolean; message: string }>('/notifications/read-all');
    return res.data;
  },
};
