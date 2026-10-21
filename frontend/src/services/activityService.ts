import api from './api';
import type { Activity, ApiResponse } from '../types';

export const activityService = {
  getProjectActivities: async (projectId: string, page = 1, limit = 30): Promise<{ activities: Activity[]; total: number }> => {
    const response = await api.get<ApiResponse<{ activities: Activity[]; total: number }>>(`/activities/project/${projectId}`, {
      params: { page, limit },
    });
    return response.data.data!;
  },

  getTaskActivities: async (taskId: string): Promise<Activity[]> => {
    const response = await api.get<ApiResponse<{ activities: Activity[] }>>(`/activities/task/${taskId}`);
    return response.data.data!.activities;
  },
};
