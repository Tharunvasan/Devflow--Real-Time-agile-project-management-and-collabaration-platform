import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Avatar } from '../components/ui/Avatar';
import { NotificationBell } from '../components/ui/NotificationBell';
import { Breadcrumbs, type BreadcrumbItem } from '../components/ui/Breadcrumbs';
import { CommandPalette } from '../components/ui/CommandPalette';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { projectService } from '../services/projectService';
import { taskService } from '../services/taskService';
import type { Project } from '../types';
import toast from 'react-hot-toast';

const navItems = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    to: '/projects',
    label: 'Projects',
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    to: '/notifications',
    label: 'Notifications',
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    to: '/profile',
    label: 'Settings',
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { isConnected, reconnectEpoch } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  // Layout states
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Projects list for sidebar quick switch
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);

  // Global Quick Create modals
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [projectForm, setProjectForm] = useState({ name: '', description: '', status: 'PLANNING' });
  const [creatingProject, setCreatingProject] = useState(false);

  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    project: '',
    priority: 'MEDIUM',
    storyPoints: '',
  });
  const [creatingTask, setCreatingTask] = useState(false);

  // Fetch recent projects
  useEffect(() => {
    projectService.getProjects()
      .then((data) => setRecentProjects(data.slice(0, 5)))
      .catch(() => {});
  }, [reconnectEpoch]);

  // Global keyboard shortcut for Command Palette: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        const target = e.target as HTMLElement;
        const isInput =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable;
        if (!isInput) {
          e.preventDefault();
          setCommandPaletteOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close menus on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
    setQuickCreateOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Build dynamic breadcrumbs from location pathname
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const parts = location.pathname.split('/').filter(Boolean);
    const crumbs: BreadcrumbItem[] = [];

    if (parts.length === 0 || parts[0] === 'dashboard') {
      return [{ label: 'Dashboard' }];
    }

    if (parts[0] === 'projects') {
      crumbs.push({ label: 'Projects', to: '/projects' });
      if (parts[1]) {
        const activeProj = recentProjects.find((p) => p._id === parts[1]);
        const projName = activeProj?.name || 'Project';
        crumbs.push({ label: projName, to: `/projects/${parts[1]}` });

        if (parts[2]) {
          const tabLabels: Record<string, string> = {
            board: 'Kanban Board',
            sprints: 'Sprints & Backlog',
            issues: 'Issue Tracking',
            code: 'Repository',
          };
          crumbs.push({ label: tabLabels[parts[2]] || parts[2] });
        }
      }
    } else if (parts[0] === 'tasks') {
      crumbs.push({ label: 'Tasks' });
      if (parts[1]) crumbs.push({ label: parts[1].slice(-6).toUpperCase() });
    } else if (parts[0] === 'issues') {
      crumbs.push({ label: 'Issues' });
      if (parts[1]) crumbs.push({ label: parts[1].slice(-6).toUpperCase() });
    } else if (parts[0] === 'notifications') {
      crumbs.push({ label: 'Notifications' });
    } else if (parts[0] === 'profile') {
      crumbs.push({ label: 'Account Settings' });
    } else if (parts[0] === 'admin') {
      crumbs.push({ label: 'Administration', to: '/admin/users' });
      if (parts[1]) crumbs.push({ label: parts[1] });
    }

    return crumbs;
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.name.trim()) return;
    setCreatingProject(true);
    try {
      const created = await projectService.createProject(projectForm);
      setRecentProjects((prev) => [created, ...prev]);
      setShowCreateProject(false);
      setProjectForm({ name: '', description: '', status: 'PLANNING' });
      toast.success('Project created successfully!');
      navigate(`/projects/${created._id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create project');
    } finally {
      setCreatingProject(false);
    }
  };

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim() || !taskForm.project) {
      toast.error('Title and project are required');
      return;
    }
    setCreatingTask(true);
    try {
      await taskService.createTask({
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        project: taskForm.project,
        priority: taskForm.priority as any,
        storyPoints: taskForm.storyPoints ? Number(taskForm.storyPoints) : undefined,
      });
      setShowCreateTask(false);
      setTaskForm({ title: '', description: '', project: '', priority: 'MEDIUM', storyPoints: '' });
      toast.success('Task created successfully!');
      navigate(`/projects/${taskForm.project}/board`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create task');
    } finally {
      setCreatingTask(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#080c15] text-slate-100">
      {/* Sidebar for Desktop */}
      <aside
        className={`${
          sidebarCollapsed ? 'w-18' : 'w-64'
        } hidden md:flex flex-col bg-[#0b101b] border-r border-slate-800/80 transition-all duration-200 select-none shrink-0 z-30`}
      >
        {/* Brand Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-slate-800/80">
          <Link to="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-primary-500/20 shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <span className="font-bold text-white tracking-tight text-base block leading-none">DevFlow</span>
                <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">Agile Platform</span>
              </div>
            )}
          </Link>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle sidebar width"
          >
            <svg
              className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Main Links */}
          <nav className="space-y-1">
            {!sidebarCollapsed && (
              <div className="px-3 pb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Workspace
              </div>
            )}
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? 'sidebar-link-active' : 'sidebar-link'
                }
                title={sidebarCollapsed ? item.label : undefined}
              >
                {item.icon}
                {!sidebarCollapsed && <span>{item.label}</span>}
              </NavLink>
            ))}

            {user?.role === 'ADMIN' && (
              <NavLink
                to="/admin/users"
                className={({ isActive }) =>
                  isActive ? 'sidebar-link-active' : 'sidebar-link'
                }
                title={sidebarCollapsed ? 'Administration' : undefined}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                {!sidebarCollapsed && <span>Admin Users</span>}
              </NavLink>
            )}
          </nav>

          {/* Recent Projects Quick Jump */}
          {!sidebarCollapsed && recentProjects.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-slate-800/60">
              <div className="flex items-center justify-between px-3 pb-1.5">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Active Projects
                </span>
                <Link to="/projects" className="text-[11px] text-primary-400 hover:underline">
                  All
                </Link>
              </div>
              {recentProjects.map((proj) => (
                <Link
                  key={proj._id}
                  to={`/projects/${proj._id}/board`}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors truncate group"
                >
                  <span className="w-2 h-2 rounded-full bg-primary-500/80 group-hover:bg-primary-400 shrink-0" />
                  <span className="truncate">{proj.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* User Profile Card at Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-[#0a0f19]">
          <div className="flex items-center justify-between gap-2">
            <Link to="/profile" className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-90">
              <Avatar user={user || undefined} size="sm" />
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{user?.name}</p>
                  <p className="text-[10px] font-mono text-slate-400 truncate">
                    {user?.role?.replace('_', ' ')}
                  </p>
                </div>
              )}
            </Link>

            {!sidebarCollapsed && (
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                title="Log out"
                aria-label="Log out"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm md:hidden flex"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-72 bg-[#0b101b] border-r border-slate-800 h-full flex flex-col p-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold">
                  D
                </div>
                <span className="font-bold text-white text-base">DevFlow</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 py-4 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link-active' : 'sidebar-link'
                  }
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
              {user?.role === 'ADMIN' && (
                <NavLink
                  to="/admin/users"
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link-active' : 'sidebar-link'
                  }
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span>Admin Users</span>
                </NavLink>
              )}
            </nav>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar user={user || undefined} size="sm" />
                <span className="text-xs text-white font-medium">{user?.name}</span>
              </div>
              <button onClick={handleLogout} className="text-xs text-rose-400 hover:underline">
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main App Body */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-14 bg-[#0a0f1d]/90 backdrop-blur-md border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between gap-4 shrink-0 z-20">
          {/* Left section: mobile hamburger & breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 -ml-1 text-slate-400 hover:text-white rounded-lg md:hidden hover:bg-slate-800"
              aria-label="Open navigation menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <Breadcrumbs items={generateBreadcrumbs()} />
          </div>

          {/* Right section: Command palette search button, quick create, live status, notifications & profile */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Global Search / Command Menu Trigger */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/60 hover:border-slate-600 text-xs text-slate-400 hover:text-slate-200 transition-all shadow-sm"
              title="Search or execute command (Ctrl+K)"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="hidden sm:inline">Search DevFlow...</span>
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800 rounded border border-slate-700 ml-1">
                ⌘K
              </kbd>
            </button>

            {/* Quick Create Dropdown */}
            <div className="relative">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setQuickCreateOpen(!quickCreateOpen)}
                leftIcon={
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                }
              >
                <span className="hidden sm:inline">New</span>
              </Button>

              {quickCreateOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 bg-[#0e1628] border border-slate-700/80 rounded-xl shadow-xl p-1.5 z-50 animate-scale-in"
                  onClick={() => setQuickCreateOpen(false)}
                >
                  <button
                    onClick={() => setShowCreateTask(true)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800/80 transition-colors text-left"
                  >
                    <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    New Task
                  </button>

                  <button
                    onClick={() => setShowCreateProject(true)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800/80 transition-colors text-left"
                  >
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    New Project
                  </button>
                </div>
              )}
            </div>

            {/* Real-Time WebSocket Connection Indicator */}
            <div
              className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-900/60 border border-slate-800 text-[11px] font-mono text-slate-400"
              title={isConnected ? 'Real-time WebSocket connected' : 'Connecting to real-time server...'}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-amber-500 animate-pulse'
                }`}
              />
              <span>{isConnected ? 'LIVE' : 'SYNCING'}</span>
            </div>

            {/* Notification Bell */}
            <NotificationBell />

            {/* User Profile Avatar with mini dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-1 focus:outline-none"
                aria-label="User menu"
              >
                <Avatar user={user || undefined} size="sm" />
              </button>

              {userMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-52 bg-[#0e1628] border border-slate-700/80 rounded-xl shadow-xl p-2 z-50 animate-scale-in"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-slate-800/80 mb-1">
                    <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{user?.email}</p>
                  </div>

                  <Link
                    to="/profile"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    <span>Account Settings</span>
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
                  >
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#080c15]">
          {children}
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onOpenCreateProject={() => setShowCreateProject(true)}
        onOpenCreateTask={() => setShowCreateTask(true)}
      />

      {/* Global Create Project Modal */}
      <Modal
        isOpen={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        title="Create New Project"
      >
        <form onSubmit={handleCreateProjectSubmit} className="space-y-4">
          <Input
            label="Project Name"
            placeholder="e.g. Core Banking Platform"
            value={projectForm.name}
            onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
            required
            autoFocus
          />

          <div>
            <label className="label">Description</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Outline the goals and scope of this project..."
              value={projectForm.description}
              onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Initial Status</label>
            <select
              className="input"
              value={projectForm.status}
              onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}
            >
              <option value="PLANNING">Planning</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="ghost" onClick={() => setShowCreateProject(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={creatingProject}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* Global Create Task Modal */}
      <Modal
        isOpen={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        title="Create New Task"
      >
        <form onSubmit={handleCreateTaskSubmit} className="space-y-4">
          <div>
            <label className="label">Project *</label>
            <select
              className="input"
              value={taskForm.project}
              onChange={(e) => setTaskForm({ ...taskForm, project: e.target.value })}
              required
            >
              <option value="">Select a project</option>
              {recentProjects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} {p.key ? `(${p.key})` : ''}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Task Title"
            placeholder="e.g. Implement multi-tenant authentication"
            value={taskForm.title}
            onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
            required
          />

          <div>
            <label className="label">Description</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Provide context and requirements..."
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Priority</label>
              <select
                className="input"
                value={taskForm.priority}
                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <div>
              <label className="label">Story Points</label>
              <input
                type="number"
                min="0"
                className="input"
                placeholder="e.g. 5"
                value={taskForm.storyPoints}
                onChange={(e) => setTaskForm({ ...taskForm, storyPoints: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="ghost" onClick={() => setShowCreateTask(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={creatingTask}>
              Create Task
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
