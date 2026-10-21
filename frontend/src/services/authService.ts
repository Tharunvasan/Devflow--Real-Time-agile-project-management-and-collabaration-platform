import api from './api';
import type { User } from '../types';

interface AuthData {
  user: User;
  token: string;
}

export const authService = {
  register: async (data: { name: string; email: string; password: string; role?: string }) => {
    const res = await api.post<{ success: boolean; data: AuthData }>('/auth/register', data);
    return res.data.data!;
  },

  login: async (data: { email: string; password: string }) => {
    const res = await api.post<{ success: boolean; data: AuthData }>('/auth/login', data);
    return res.data.data!;
  },

  getMe: async () => {
    const res = await api.get<{ success: boolean; data: { user: User } }>('/auth/me');
    return res.data.data!.user;
  },

  updateProfile: async (data: { name?: string; avatar?: string }) => {
    const res = await api.put<{ success: boolean; data: { user: User } }>('/auth/profile', data);
    return res.data.data!.user;
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const res = await api.put<{ success: boolean; message: string }>('/auth/password', data);
    return res.data;
  },
};
