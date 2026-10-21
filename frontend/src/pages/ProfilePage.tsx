import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { Avatar } from '../components/ui/Avatar';
import toast from 'react-hot-toast';

export const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', avatar: user?.avatar || '' });
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updatedUser = await authService.updateProfile(profileForm);
      updateUser(updatedUser);
      toast.success('Profile updated!');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setSavingPwd(true);
    try {
      await authService.changePassword({ currentPassword: pwdForm.currentPassword, newPassword: pwdForm.newPassword });
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password changed!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPwd(false);
    }
  };

  const roleColors: Record<string, string> = {
    ADMIN: 'badge-red',
    PROJECT_MANAGER: 'badge-purple',
    DEVELOPER: 'badge-blue',
    TESTER: 'badge-green',
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Profile</h1>

      {/* Profile Card */}
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-6">
          <Avatar user={user || undefined} size="lg" />
          <div>
            <h2 className="text-lg font-semibold text-white">{user?.name}</h2>
            <p className="text-dark-400 text-sm">{user?.email}</p>
            <span className={`${roleColors[user?.role || ''] || 'badge-gray'} mt-1 inline-flex`}>{user?.role?.replace('_', ' ')}</span>
          </div>
        </div>

        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input className="input" value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} id="profile-name" />
          </div>
          <div>
            <label className="label">Avatar URL</label>
            <input className="input" placeholder="https://..." value={profileForm.avatar} onChange={e => setProfileForm({ ...profileForm, avatar: e.target.value })} id="profile-avatar" />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={savingProfile} id="save-profile-btn">
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Password Card */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-white mb-4">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <input type="password" className="input" value={pwdForm.currentPassword} onChange={e => setPwdForm({ ...pwdForm, currentPassword: e.target.value })} required id="current-pwd" />
          </div>
          <div>
            <label className="label">New Password</label>
            <input type="password" className="input" value={pwdForm.newPassword} onChange={e => setPwdForm({ ...pwdForm, newPassword: e.target.value })} required minLength={6} id="new-pwd" />
          </div>
          <div>
            <label className="label">Confirm Password</label>
            <input type="password" className="input" value={pwdForm.confirmPassword} onChange={e => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })} required id="confirm-pwd" />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={savingPwd} id="change-pwd-btn">
              {savingPwd ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
