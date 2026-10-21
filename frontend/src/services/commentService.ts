import api from './api';
import type { Comment } from '../types';

export const commentService = {
  getByTask: async (taskId: string) => {
    const res = await api.get<{ success: boolean; data: { comments: Comment[] } }>(`/comments/task/${taskId}`);
    return res.data.data!.comments;
  },

  getByIssue: async (issueId: string) => {
    const res = await api.get<{ success: boolean; data: { comments: Comment[] } }>(`/comments/issue/${issueId}`);
    return res.data.data!.comments;
  },

  create: async (data: { content: string; taskId?: string; issueId?: string }) => {
    const res = await api.post<{ success: boolean; data: { comment: Comment } }>('/comments', data);
    return res.data.data!.comment;
  },

  update: async (id: string, content: string) => {
    const res = await api.put<{ success: boolean; data: { comment: Comment } }>(`/comments/${id}`, { content });
    return res.data.data!.comment;
  },

  delete: async (id: string) => {
    const res = await api.delete<{ success: boolean; message: string }>(`/comments/${id}`);
    return res.data;
  },
};
