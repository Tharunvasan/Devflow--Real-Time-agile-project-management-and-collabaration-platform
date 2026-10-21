import api from './api';

export interface Repository {
  _id: string;
  name: string;
  project: string;
  source: 'LOCAL' | 'GITHUB';
  url?: string;
  path?: string;
  defaultBranch: string;
  createdBy: any;
  createdAt: string;
  updatedAt: string;
}

export interface Commit {
  hash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  message: string;
}

export interface GitTreeItem {
  name: string;
  type: 'blob' | 'tree';
  mode: string;
}

export const repositoryService = {
  linkRepository: async (data: { name: string; projectId: string; source: 'LOCAL' | 'GITHUB'; path?: string; url?: string }) => {
    const res = await api.post('/repositories', data);
    return res.data.data.repository as Repository;
  },

  getRepositories: async (projectId: string) => {
    const res = await api.get(`/repositories/project/${projectId}`);
    return res.data.data.repositories as Repository[];
  },

  getBranches: async (id: string) => {
    const res = await api.get(`/repositories/${id}/branches`);
    return res.data.data.branches as string[];
  },

  getCommits: async (id: string, branch?: string, skip = 0, limit = 50) => {
    const res = await api.get(`/repositories/${id}/commits`, { params: { branch, skip, limit } });
    return res.data.data.commits as Commit[];
  },

  getTree: async (id: string, ref = 'HEAD', path = '') => {
    const res = await api.get(`/repositories/${id}/tree`, { params: { ref, path } });
    return res.data.data.tree as GitTreeItem[];
  }
};
