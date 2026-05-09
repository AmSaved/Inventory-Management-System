import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Card, { CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import userService from '../services/userService';
import toast from 'react-hot-toast';

const ProfilePage = () => {
  const { user, changePassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await changePassword(passwordData.current_password, passwordData.new_password);
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      console.error('Password change failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="h-20 w-20 rounded-full bg-primary-600 flex items-center justify-center text-2xl font-bold text-white">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
              <div>
                <h3 className="text-xl font-semibold">{user?.first_name} {user?.last_name}</h3>
                <p className="text-gray-500 capitalize">{user?.role?.name}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Employee ID</label>
                <p className="mt-1 text-gray-900">{user?.employee_id}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-gray-900">{user?.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <p className="mt-1 text-gray-900">{user?.phone || 'Not set'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 uppercase tracking-widest text-[10px] font-black">Organizational Anchor</label>
                <div className="mt-1 flex items-center gap-2">
                   <p className="text-gray-900 font-bold">{user?.organizationNode?.name || 'Root Access'}</p>
                   {user?.organizationNode?.type && (
                     <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter">
                        {user.organizationNode.type.name}
                     </span>
                   )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 uppercase tracking-widest text-[10px] font-black">Security Scope</label>
                <div className="mt-1">
                   <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border-2 ${
                      user?.role?.visibility_scope === 'global' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      user?.role?.visibility_scope === 'sub_units' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      'bg-slate-50 text-slate-600 border-slate-100'
                   }`}>
                      {user?.role?.visibility_scope?.replace('_', ' ') || 'Own Node'}
                   </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              placeholder="Enter current password"
              value={passwordData.current_password}
              onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
              required
            />
            <Input
              label="New Password"
              type="password"
              placeholder="Enter new password"
              value={passwordData.new_password}
              onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
              required
            />
            <Input
              label="Confirm New Password"
              type="password"
              placeholder="Confirm new password"
              value={passwordData.confirm_password}
              onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
              required
            />
            <Button type="submit" loading={loading}>
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;