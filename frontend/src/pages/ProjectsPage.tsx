import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { projectService } from '../services/projectService';
import type { Project } from '../types';
import { Modal } from '../components/ui/Modal';
import { LoadingSpinner, EmptyState } from '../components/ui/LoadingSpinner';
import { StatusBadge } from '../components/ui/StatusBadge';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

const statusOptions = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'];

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', status: 'PLANNING', startDate: '', endDate: '' });

  useEffect(() => {
    fetchProjects();
  }, [search, statusFilter]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const data = await projectService.getProjects({ search: search || undefined, status: statusFilter || undefined });
      setProjects(data);
    } catch {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const project = await projectService.createProject(form);
      setProjects(prev => [project, ...prev]);
      setShowCreate(false);
      setForm({ name: '', description: '', status: 'PLANNING', startDate: '', endDate: '' });
      toast.success('Project created!');
      navigate(`/projects/${project._id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-dark-400 mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button id="create-project-btn" onClick={() => setShowCreate(true)} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          className="input max-w-xs"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          id="project-search"
        />
        <select
          className="input max-w-xs"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          id="project-status-filter"
        >
          <option value="">All Status</option>
          {statusOptions.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <LoadingSpinner fullPage text="Loading projects..." />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
          title="No projects found"
          description="Create your first project to get started with DevFlow"
          action={<button onClick={() => setShowCreate(true)} className="btn-primary">Create Project</button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => (
            <div
              key={project._id}
              onClick={() => navigate(`/projects/${project._id}`)}
              className="card-hover p-5 flex flex-col justify-between gap-4"
              id={`project-card-${project._id}`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate text-base hover:text-primary-300 transition-colors">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{project.description}</p>
                    )}
                  </div>
                  <StatusBadge status={project.status} size="sm" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{project.members.length} member{project.members.length !== 1 ? 's' : ''}</span>
                  </div>
                  <span>{formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}</span>
                </div>

                <div className="flex gap-3 pt-2.5 border-t border-slate-800/80" onClick={(e) => e.stopPropagation()}>
                  <Link
                    to={`/projects/${project._id}/board`}
                    className="text-xs text-primary-400 hover:text-primary-300 font-medium hover:underline"
                  >
                    Board →
                  </Link>
                  <Link
                    to={`/projects/${project._id}/sprints`}
                    className="text-xs text-slate-400 hover:text-primary-300 font-medium hover:underline"
                  >
                    Sprints →
                  </Link>
                  <Link
                    to={`/projects/${project._id}/issues`}
                    className="text-xs text-slate-400 hover:text-primary-300 font-medium hover:underline"
                  >
                    Issues →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Project">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Project Name *</label>
            <input className="input" placeholder="My Awesome Project" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required id="new-project-name" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={3} placeholder="What is this project about?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} id="new-project-desc" />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} id="new-project-status">
              {statusOptions.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start Date</label>
              <input type="date" className="input" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} id="new-project-start" />
            </div>
            <div>
              <label className="label">End Date</label>
              <input type="date" className="input" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} id="new-project-end" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={creating} id="create-project-submit">
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
