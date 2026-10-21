import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { Project, User, MemberRole } from '../types';
import { Avatar } from '../components/ui/Avatar';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { ActivityTimeline } from '../components/ui/ActivityTimeline';
import { format } from 'date-fns';
import { projectService } from '../services/projectService';
import { userService } from '../services/userService';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

interface OutletCtx {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project | null>>;
}

export const ProjectOverviewPage: React.FC = () => {
  const { project, setProject } = useOutletContext<OutletCtx>();
  const { socket } = useSocket();
  const { user: currentUser } = useAuth();

  const [showAddMember, setShowAddMember] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<MemberRole>('DEVELOPER');
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  // Real-time membership updates
  useEffect(() => {
    if (!socket || !project?._id) return;

    const handleMemberAdded = (data: { project: Project }) => {
      if (data.project._id === project._id) {
        setProject(data.project);
      }
    };

    const handleMemberRemoved = (data: { projectId: string; project: Project }) => {
      if (data.projectId === project._id) {
        setProject(data.project);
      }
    };

    const handleProjectUpdated = (updatedProject: Project) => {
      if (updatedProject._id === project._id) {
        setProject(updatedProject);
      }
    };

    socket.on('member:added', handleMemberAdded);
    socket.on('member:removed', handleMemberRemoved);
    socket.on('project:updated', handleProjectUpdated);

    return () => {
      socket.off('member:added', handleMemberAdded);
      socket.off('member:removed', handleMemberRemoved);
      socket.off('project:updated', handleProjectUpdated);
    };
  }, [socket, project?._id, setProject]);

  useEffect(() => {
    if (showAddMember) {
      userService
        .getUsers()
        .then((data) => setUsers(data.users))
        .catch(() => toast.error('Failed to load users'));
    }
  }, [showAddMember]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setAddingMember(true);
    try {
      const updatedProject = await projectService.addMember(project._id, selectedUserId, selectedRole);
      setProject(updatedProject);
      setShowAddMember(false);
      setSelectedUserId('');
      setSelectedRole('DEVELOPER');
      toast.success('Member added successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${userName} from this project?`)) {
      return;
    }
    setRemovingMemberId(userId);
    try {
      const updatedProject = await projectService.removeMember(project._id, userId);
      setProject(updatedProject);
      toast.success(`${userName} removed from project`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to remove member');
    } finally {
      setRemovingMemberId(null);
    }
  };

  const isOwnerOrAdmin =
    project.createdBy._id === currentUser?._id ||
    project.members.some((m) => m.user._id === currentUser?._id && m.role === 'MANAGER') ||
    currentUser?.role === 'ADMIN';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left 2 Columns: Project Details & Live Activity Timeline */}
      <div className="lg:col-span-2 space-y-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Project Details</h2>
            {project.key && (
              <span className="badge bg-primary-500/20 text-primary-300 font-mono text-xs px-2 py-0.5 rounded border border-primary-500/30">
                KEY: {project.key}
              </span>
            )}
          </div>
          <dl className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-dark-800">
              <dt className="text-sm text-dark-400">Status</dt>
              <dd>
                <StatusBadge status={project.status} />
              </dd>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-dark-800">
              <dt className="text-sm text-dark-400">Created by</dt>
              <dd className="flex items-center gap-2">
                <Avatar user={project.createdBy} size="xs" />
                <span className="text-sm text-dark-200">{project.createdBy.name}</span>
              </dd>
            </div>
            {project.startDate && (
              <div className="flex items-center justify-between py-2 border-b border-dark-800">
                <dt className="text-sm text-dark-400">Start Date</dt>
                <dd className="text-sm text-dark-200">{format(new Date(project.startDate), 'MMM dd, yyyy')}</dd>
              </div>
            )}
            {project.endDate && (
              <div className="flex items-center justify-between py-2 border-b border-dark-800">
                <dt className="text-sm text-dark-400">End Date</dt>
                <dd className="text-sm text-dark-200">{format(new Date(project.endDate), 'MMM dd, yyyy')}</dd>
              </div>
            )}
            <div className="flex items-center justify-between py-2">
              <dt className="text-sm text-dark-400">Created</dt>
              <dd className="text-sm text-dark-200">{format(new Date(project.createdAt), 'MMM dd, yyyy')}</dd>
            </div>
          </dl>
        </div>

        {/* Real-time Project Activity Stream */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Activity Timeline</h2>
            <span className="text-xs text-dark-400">Live Real-Time Stream</span>
          </div>
          <ActivityTimeline projectId={project._id} />
        </div>
      </div>

      {/* Right Column: Team Members */}
      <div className="space-y-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Team ({project.members.length})</h2>
            {isOwnerOrAdmin && (
              <button
                onClick={() => setShowAddMember(true)}
                className="btn-secondary btn-sm"
                id="add-team-member-btn"
              >
                Add Member
              </button>
            )}
          </div>
          <div className="space-y-3">
            {project.members.map((member) => {
              const isProjectCreator = member.user._id === project.createdBy._id;
              return (
                <div key={member._id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-dark-800/50 transition-colors">
                  <Avatar user={member.user} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dark-100 truncate">{member.user.name}</p>
                    <p className="text-xs text-dark-500 truncate">{member.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-blue text-xs">{member.role}</span>
                    {isOwnerOrAdmin && !isProjectCreator && member.user._id !== currentUser?._id && (
                      <button
                        onClick={() => handleRemoveMember(member.user._id, member.user.name)}
                        disabled={removingMemberId === member.user._id}
                        className="text-dark-500 hover:text-red-400 p-1 rounded transition-colors text-xs"
                        title="Remove member"
                        aria-label={`Remove ${member.user.name}`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      <Modal isOpen={showAddMember} onClose={() => setShowAddMember(false)} title="Add Team Member">
        <form onSubmit={handleAddMember} className="space-y-4">
          <div>
            <label className="label">Select User *</label>
            <select
              className="input"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              required
              id="select-user-input"
            >
              <option value="">-- Choose a user --</option>
              {users.map((u) => {
                if (project.members.some((m) => m.user._id === u._id)) return null;
                return (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.email}) - {u.role}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="label">Project Role</label>
            <select
              className="input"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as MemberRole)}
              id="select-role-input"
            >
              <option value="DEVELOPER">Developer</option>
              <option value="MANAGER">Manager</option>
              <option value="TESTER">Tester</option>
              <option value="VIEWER">Viewer</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowAddMember(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={addingMember || !selectedUserId}
              id="submit-add-member-btn"
            >
              {addingMember ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
