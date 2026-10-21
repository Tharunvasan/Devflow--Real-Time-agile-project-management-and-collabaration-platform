import api from './api';
import type { Project, Task, Issue, User } from '../types';

export interface SearchResults {
  projects: Project[];
  tasks: Task[];
  issues: Issue[];
  members: User[];
}

export const searchService = {
  search: async (query: string): Promise<SearchResults> => {
    const res = await api.get('/search', { params: { q: query } });
    return res.data.data;
  },
};
