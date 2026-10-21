import api from './api';
import type { Issue } from '../types';

export interface IssueFilters {
  project?: string;
  status?: string;
  severity?: string;
  priority?: string;
  assignedTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const issueService = {
  getIssues: async (filters?: IssueFilters) => {
    const res = await api.get<{ success: boolean; data: { issues: Issue[]; total: number } }>('/issues', { params: filters });
    return res.data.data!;
  },

  createIssue: async (data: { title: string; description?: string; project: string; assignedTo?: string; severity?: string; priority?: string }) => {
    const res = await api.post<{ success: boolean; data: { issue: Issue } }>('/issues', data);
    return res.data.data!.issue;
  },

  getIssueById: async (id: string) => {
    const res = await api.get<{ success: boolean; data: { issue: Issue } }>(`/issues/${id}`);
    return res.data.data!.issue;
  },

  updateIssue: async (id: string, data: Partial<Issue> & { assignedTo?: string }) => {
    const res = await api.put<{ success: boolean; data: { issue: Issue } }>(`/issues/${id}`, data);
    return res.data.data!.issue;
  },

  deleteIssue: async (id: string) => {
    const res = await api.delete<{ success: boolean; message: string }>(`/issues/${id}`);
    return res.data;
  },

  uploadAttachment: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<{ success: boolean; data: { attachment: any } }>(`/issues/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data.attachment;
  },
};
