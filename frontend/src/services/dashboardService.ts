import api from './api';
import type { DashboardStats } from '../types';

export const dashboardService = {
  getStats: async () => {
    const res = await api.get<{ success: boolean; data: DashboardStats }>('/dashboard/stats');
    return res.data.data!;
  },
};
