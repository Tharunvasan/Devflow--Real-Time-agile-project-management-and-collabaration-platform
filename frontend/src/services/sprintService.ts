import api from './api';
import type { Sprint, SprintStats, BurndownPoint, VelocityMetric } from '../types';

export const sprintService = {
  getSprintsByProject: async (projectId: string): Promise<{ sprints: Sprint[]; metrics: { velocityHistory: VelocityMetric[]; averageVelocity: number; completedSprintCount: number } }> => {
    const res = await api.get<{
      success: boolean;
      data: {
        sprints: Sprint[];
        metrics: {
          velocityHistory: VelocityMetric[];
          averageVelocity: number;
          completedSprintCount: number;
        };
      };
    }>(`/sprints/project/${projectId}`);
    return res.data.data;
  },

  createSprint: async (data: { name: string; goal?: string; project: string; startDate: string; endDate: string }) => {
    const res = await api.post<{ success: boolean; data: { sprint: Sprint } }>('/sprints', data);
    return res.data.data!.sprint;
  },

  getSprintById: async (id: string): Promise<{ sprint: Sprint; stats: SprintStats; burndown: BurndownPoint[] }> => {
    const res = await api.get<{ success: boolean; data: { sprint: Sprint; stats: SprintStats; burndown: BurndownPoint[] } }>(`/sprints/${id}`);
    return res.data.data!;
  },

  updateSprint: async (id: string, data: Partial<Sprint>) => {
    const res = await api.put<{ success: boolean; data: { sprint: Sprint } }>(`/sprints/${id}`, data);
    return res.data.data!.sprint;
  },

  deleteSprint: async (id: string) => {
    const res = await api.delete<{ success: boolean; message: string }>(`/sprints/${id}`);
    return res.data;
  },

  addTaskToSprint: async (sprintId: string, taskId: string) => {
    const res = await api.post<{ success: boolean; data: { sprint: Sprint } }>(`/sprints/${sprintId}/tasks`, { taskId });
    return res.data.data!.sprint;
  },

  removeTaskFromSprint: async (sprintId: string, taskId: string) => {
    const res = await api.delete<{ success: boolean; data: { sprint: Sprint } }>(`/sprints/${sprintId}/tasks/${taskId}`);
    return res.data.data!.sprint;
  },
};
