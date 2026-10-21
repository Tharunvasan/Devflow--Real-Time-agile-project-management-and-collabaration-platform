import api from './api';
import type { Task } from '../types';

export interface TaskFilters {
  project?: string;
  sprint?: string;
  status?: string;
  priority?: string;
  assignedTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const taskService = {
  getTasks: async (filters?: TaskFilters) => {
    const res = await api.get<{ success: boolean; data: { tasks: Task[]; total: number } }>('/tasks', { params: filters });
    return res.data.data!;
  },

  createTask: async (data: {
    title: string;
    description?: string;
    project: string;
    sprint?: string;
    assignedTo?: string;
    priority?: string;
    dueDate?: string;
    storyPoints?: number;
    isBlocked?: boolean;
    labels?: string[];
  }) => {
    const res = await api.post<{ success: boolean; data: { task: Task } }>('/tasks', data);
    return res.data.data!.task;
  },

  getTaskById: async (id: string) => {
    const res = await api.get<{ success: boolean; data: { task: Task } }>(`/tasks/${id}`);
    return res.data.data!.task;
  },

  updateTask: async (id: string, data: Partial<Task> & { assignedTo?: string; sprint?: string }) => {
    const res = await api.put<{ success: boolean; data: { task: Task } }>(`/tasks/${id}`, data);
    return res.data.data!.task;
  },

  deleteTask: async (id: string) => {
    const res = await api.delete<{ success: boolean; message: string }>(`/tasks/${id}`);
    return res.data;
  },

  uploadAttachment: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    // We override the default content-type header so browser boundary gets set correctly
    const res = await api.post<{ success: boolean; data: { attachment: any } }>(`/tasks/${id}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data.data.attachment;
  },
};
