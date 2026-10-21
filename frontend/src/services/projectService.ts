import api from './api';
import type { Project } from '../types';

export const projectService = {
  getProjects: async (params?: { status?: string; search?: string }) => {
    const res = await api.get<{ success: boolean; data: { projects: Project[] } }>('/projects', { params });
    return res.data.data!.projects;
  },

  createProject: async (data: { name: string; description?: string; status?: string; startDate?: string; endDate?: string }) => {
    const res = await api.post<{ success: boolean; data: { project: Project } }>('/projects', data);
    return res.data.data!.project;
  },

  getProjectById: async (id: string) => {
    const res = await api.get<{ success: boolean; data: { project: Project } }>(`/projects/${id}`);
    return res.data.data!.project;
  },

  updateProject: async (id: string, data: Partial<Project>) => {
    const res = await api.put<{ success: boolean; data: { project: Project } }>(`/projects/${id}`, data);
    return res.data.data!.project;
  },

  deleteProject: async (id: string) => {
    const res = await api.delete<{ success: boolean; message: string }>(`/projects/${id}`);
    return res.data;
  },

  addMember: async (projectId: string, userId: string, role?: string) => {
    const res = await api.post<{ success: boolean; data: { project: Project } }>(`/projects/${projectId}/members`, { userId, role });
    return res.data.data!.project;
  },

  removeMember: async (projectId: string, userId: string) => {
    const res = await api.delete<{ success: boolean; data: { project: Project } }>(`/projects/${projectId}/members/${userId}`);
    return res.data.data!.project;
  },
};
