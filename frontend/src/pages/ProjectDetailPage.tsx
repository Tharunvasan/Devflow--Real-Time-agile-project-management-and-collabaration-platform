import React, { useEffect, useState } from 'react';
import { useParams, NavLink, Outlet, Link } from 'react-router-dom';
import { projectService } from '../services/projectService';
import type { Project } from '../types';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Avatar } from '../components/ui/Avatar';
import { useSocket } from '../context/SocketContext';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { joinProject, leaveProject, socket } = useSocket();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

  useEffect(() => {
    if (!id || id === '[object Object]') {
      setLoading(false);
      return;
    }
    projectService.getProjectById(id)
      .then(setProject)
      .catch((err) => {
        console.error('Error fetching project:', err);
        setProject(null);
      })
      .finally(() => setLoading(false));

    joinProject(id);
    return () => leaveProject(id);
  }, [id, joinProject, leaveProject]);

  useEffect(() => {
    if (!socket) return;
    const handlePresence = (users: any[]) => {
      setOnlineUsers(users);
    };
    socket.on('presence:update', handlePresence);
    return () => {
      socket.off('presence:update', handlePresence);
    };
  }, [socket]);

  if (loading) return <LoadingSpinner fullPage text="Loading project..." />;

  if (!id || id === '[object Object]') {
    return (
      <div className="card p-12 text-center space-y-4 max-w-lg mx-auto my-12">
        <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 mx-auto flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Invalid Project Reference</h2>
        <p className="text-sm text-dark-400">The requested project could not be found or the link was formatted improperly.</p>
        <Link to="/projects" className="btn-primary inline-flex">
          Browse Projects
        </Link>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="card p-12 text-center space-y-4 max-w-lg mx-auto my-12">
        <div className="w-12 h-12 rounded-full bg-dark-700 text-dark-400 mx-auto flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Project Not Found</h2>
        <p className="text-sm text-dark-400">The project you are looking for does not exist or you do not have permission to view it.</p>
        <Link to="/projects" className="btn-primary inline-flex">
          Back to Projects
        </Link>
      </div>
    );
  }

  const tabs = [
    { to: `/projects/${id}`, label: 'Overview', end: true },
    { to: `/projects/${id}/board`, label: 'Board' },
    { to: `/projects/${id}/sprints`, label: 'Sprints' },
    { to: `/projects/${id}/issues`, label: 'Issues' },
    { to: `/projects/${id}/code`, label: 'Code' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Project Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                {project.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{project.name}</h1>
                <StatusBadge status={project.status} />
              </div>
            </div>
            {project.description && <p className="text-dark-400 text-sm ml-13">{project.description}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1">
              <span className="text-xs text-dark-500 mr-2">Team Members:</span>
              {project.members.slice(0, 5).map((m) => (
                <Avatar key={m._id} user={m.user} size="sm" />
              ))}
              {project.members.length > 5 && (
                <span className="text-xs text-dark-400 ml-1">+{project.members.length - 5}</span>
              )}
            </div>
            {onlineUsers.length > 0 && (
              <div className="flex items-center gap-2 mt-1 bg-dark-800 rounded-full px-3 py-1 border border-dark-700">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs text-dark-300">{onlineUsers.length} online</span>
                <div className="flex -space-x-1 ml-2">
                  {onlineUsers.slice(0, 3).map((u: any) => (
                    <Avatar key={u.id} user={u} size="xs" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-6 border-b border-dark-700 -mx-6 px-6">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                  isActive
                    ? 'border-primary-500 text-primary-400'
                    : 'border-transparent text-dark-400 hover:text-dark-200 hover:border-dark-600'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Tab content via Outlet */}
      <Outlet context={{ project, setProject }} />
    </div>
  );
};
