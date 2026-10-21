import api from './api';
import type { User } from '../types';

export const userService = {
  getUsers: async (params?: { role?: string; search?: string; page?: number; limit?: number }) => {
    const res = await api.get<{ success: boolean; data: { users: User[]; total: number; page: number; pages: number } }>('/users', { params });
    return res.data.data!;
  },

  getUserById: async (id: string) => {
    const res = await api.get<{ success: boolean; data: { user: User } }>(`/users/${id}`);
    return res.data.data!.user;
  },

  updateUser: async (id: string, data: { name?: string; role?: string; isActive?: boolean }) => {
    const res = await api.put<{ success: boolean; data: { user: User } }>(`/users/${id}`, data);
    return res.data.data!.user;
  },

  deleteUser: async (id: string) => {
    const res = await api.delete<{ success: boolean; message: string }>(`/users/${id}`);
    return res.data;
  },
};
