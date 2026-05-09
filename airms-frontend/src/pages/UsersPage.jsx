import React, { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/common/Modal';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import userService from '../services/userService';
import roleService from '../services/roleService';
import organizationService from '../services/organizationService';
import toast from 'react-hot-toast';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Shield, 
  Search, 
  Trash2, 
  Edit3, 
  Building2,
  ShieldCheck
} from 'lucide-react';

const UsersPage = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    employee_id: '',
    phone: '',
    role_id: '',
    org_node_id: '',
    status: 'active'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Let the backend handle scoping based on hierarchy automatically
      const params = {};
      
      const [usersData, rolesData, nodesData] = await Promise.all([
        userService.getAllUsers(params),
        roleService.getAllRoles(params),
        organizationService.getNodes()
      ]);
      setUsers(usersData.data || []);
      setRoles(rolesData.data || []);
      setNodes(nodesData || []);
    } catch (error) {
      toast.error('Failed to load user management data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user = null) => {
    setEditingUser(user);
    if (user) {
      setFormData({
        username: user.username,
        email: user.email,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        employee_id: user.employee_id || '',
        phone: user.phone || '',
        role_id: user.role_id || '',
        org_node_id: user.org_node_id || '',
        status: user.status || 'active'
      });
    } else {
      setFormData({
        username: '',
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        employee_id: '',
        phone: '',
        role_id: '',
        org_node_id: '',
        status: 'active'
      });
    }
    setModalOpen(true);
  };

  const handleRoleChange = (roleId) => {
    const selectedRole = roles?.find(r => r.id === parseInt(roleId));
    const isSuperAdmin = selectedRole?.level >= 100;
    
    setFormData({
      ...formData,
      role_id: roleId,
      org_node_id: isSuperAdmin ? null : formData.org_node_id
    });
  };

  const handleSubmit = async () => {
    try {
      const selectedRole = roles?.find(r => r.id === parseInt(formData.role_id));
      const submissionData = {
        ...formData,
        org_node_id: selectedRole?.level >= 100 ? null : formData.org_node_id
      };

      if (editingUser) {
        await userService.updateUser(editingUser.id, submissionData);
        toast.success('User updated successfully');
      } else {
        await userService.createUser(submissionData);
        toast.success('New employee onboarded');
      }
      setModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Operation failed:', error);
      // The global api.js interceptor automatically handles and displays the error toast
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure?')) return;
    try {
      await userService.deleteUser(id);
      toast.success('User access revoked');
      fetchData();
    } catch (error) {
      toast.error('Failed to remove user');
    }
  };

  const filteredUsers = (users || []).filter(u => 
    (u.first_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
    (u.last_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
    (u.username?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-[1500px] mx-auto space-y-12 py-12 px-6 animate-fade-in text-slate-900">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 border-b-2 border-slate-50 pb-12">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-slate-950 rounded-[32px] flex items-center justify-center shadow-2xl">
            <Users className="text-emerald-400" size={32} />
          </div>
          <div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic">Staff Records</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] ml-1">Registered by Super Admin</p>
          </div>
        </div>
        <Button 
          onClick={() => handleOpenModal()}
          className="bg-emerald-600 text-white h-16 px-10 rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl"
        >
          <UserPlus size={18} className="mr-3" /> Onboard Staff
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-center">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Search users..." 
            className="w-full h-16 pl-14 pr-6 bg-white border-2 border-slate-100 rounded-[28px] font-black text-slate-900 outline-none focus:border-blue-500 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Card className="rounded-[40px] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b-2 border-slate-100">
                <th className="p-8 text-[10px] font-black text-slate-500 uppercase tracking-widest">Employee</th>
                <th className="p-8 text-[10px] font-black text-slate-500 uppercase tracking-widest">Authority</th>
                <th className="p-8 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="group hover:bg-slate-50/80 transition-all duration-300">
                  <td className="p-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-black text-lg group-hover:bg-blue-50 group-hover:text-blue-500 transition-all">
                        {user.first_name?.charAt(0) || user.username?.charAt(0) || '?'}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-sm tracking-tight">{user.first_name} {user.last_name}</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-8">
                    <Badge variant={user.role?.level >= 100 ? 'danger' : 'info'} className="bg-blue-50 text-blue-600 border-blue-100 uppercase text-[9px] font-black tracking-widest px-3 py-1">
                      <Shield size={12} className="mr-1" /> {user.role?.name || 'Unassigned'}
                    </Badge>
                  </td>
                  <td className="p-8 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <Button variant="ghost" onClick={() => handleOpenModal(user)} className="h-12 w-12 p-0 rounded-2xl bg-amber-50 text-amber-600 border-2 border-amber-100"><Edit3 size={18} /></Button>
                      <Button variant="ghost" onClick={() => handleDelete(user.id)} className="h-12 w-12 p-0 rounded-2xl bg-rose-50 text-rose-600 border-2 border-rose-100"><Trash2 size={18} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? "Edit Staff" : "Onboard New Employee"}
        onConfirm={handleSubmit}
      >
        <div className="space-y-6">
          <Input label="First Name" value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} required className="bg-slate-50 border-none rounded-2xl h-14" />
          <Input label="Last Name" value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} required className="bg-slate-50 border-none rounded-2xl h-14" />
          <Input label="Email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required className="bg-slate-50 border-none rounded-2xl h-14" />
          <Input label="Employee ID" value={formData.employee_id} onChange={(e) => setFormData({...formData, employee_id: e.target.value})} required className="bg-slate-50 border-none rounded-2xl h-14" />
          <Input label="Digital Username" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} required className="bg-slate-50 border-none rounded-2xl h-14" placeholder="e.g. j.doe" />
          <Input label="Phone Number" type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="bg-slate-50 border-none rounded-2xl h-14" />
          {!editingUser && <Input label="Password" type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required className="bg-slate-50 border-none rounded-2xl h-14" />}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Assigned Role</label>
            <select
              className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-3xl px-4 font-black"
              value={formData.role_id}
              onChange={(e) => handleRoleChange(e.target.value)}
              required
            >
              <option value="">Select Role</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name} (Level {r.level})</option>)}
            </select>
          </div>
          
          {/* Organization Dropdown: Only show if the selected role is NOT a global Super Admin */}
          {(() => {
            const selectedRole = roles.find(r => r.id === parseInt(formData.role_id));
            if (!selectedRole || selectedRole.level < 100) {
              return (
                <div className="space-y-2 animate-fade-in">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Assigned Organization</label>
                  <select
                    className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-3xl px-4 font-black"
                    value={formData.org_node_id}
                    onChange={(e) => setFormData({...formData, org_node_id: e.target.value})}
                    required
                  >
                    <option value="">Select Organization (Branch/Dept)</option>
                    {nodes.map(n => (
                      <option key={n.id} value={n.id}>{n.name} {n.code ? `(${n.code})` : ''}</option>
                    ))}
                  </select>
                </div>
              );
            }
            return null;
          })()}
        </div>
      </Modal>
    </div>
  );
};

export default UsersPage;
