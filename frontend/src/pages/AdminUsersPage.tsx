import React, { useEffect, useState } from 'react';
import { userService } from '../services/userService';
import type { User } from '../types';
import { LoadingSpinner, EmptyState } from '../components/ui/LoadingSpinner';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

export const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: '', role: '', isActive: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await userService.getUsers({ search: search || undefined, role: roleFilter || undefined });
      setUsers(data.users);
      setTotal(data.total);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditUser(user);
    setEditForm({ name: user.name, role: user.role, isActive: user.isActive });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    try {
      const updated = await userService.updateUser(editUser._id, editForm);
      setUsers(prev => prev.map(u => u._id === editUser._id ? updated : u));
      setEditUser(null);
      toast.success('User updated!');
    } catch {
      toast.error('Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try {
      await userService.deleteUser(id);
      setUsers(prev => prev.filter(u => u._id !== id));
      toast.success('User deleted');
    } catch {
      toast.error('Failed to delete user');
    }
  };

  const roleColors: Record<string, string> = {
    ADMIN: 'badge-red', PROJECT_MANAGER: 'badge-purple', DEVELOPER: 'badge-blue', TESTER: 'badge-green',
  };

  if (loading && !search && !roleFilter) return <LoadingSpinner fullPage text="Loading users..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-dark-400 mt-1">{total} total users</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input className="input max-w-xs" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} id="user-search" />
        <select className="input w-44" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} id="user-role-filter">
          <option value="">All Roles</option>
          {['ADMIN', 'PROJECT_MANAGER', 'DEVELOPER', 'TESTER'].map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
        </select>
      </div>

      {/* Table */}
      {users.length === 0 ? (
        <EmptyState title="No users found" description="No users match your filters." />
      ) : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} id={`user-row-${user._id}`}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar user={user} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-dark-100">{user.name}</p>
                        <p className="text-xs text-dark-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td><span className={roleColors[user.role] || 'badge-gray'}>{user.role.replace('_', ' ')}</span></td>
                  <td>
                    <span className={user.isActive ? 'badge-green' : 'badge-red'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="text-xs text-dark-500">
                    {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(user)} className="btn-secondary btn-sm" id={`edit-user-${user._id}`}>Edit</button>
                      <button onClick={() => handleDelete(user._id, user.name)} className="btn-danger btn-sm" id={`delete-user-${user._id}`}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Edit User">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} id="edit-user-name" />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} id="edit-user-role">
              {['ADMIN', 'PROJECT_MANAGER', 'DEVELOPER', 'TESTER'].map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="edit-user-active" checked={editForm.isActive} onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })} className="w-4 h-4 accent-primary-500" />
            <label htmlFor="edit-user-active" className="text-sm text-dark-300">Account Active</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditUser(null)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving} id="save-user-btn">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
