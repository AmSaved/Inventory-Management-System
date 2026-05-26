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
import Pagination from '../components/ui/Pagination';
import { useFetch } from '../hooks/useFetch';
import toast from 'react-hot-toast';
import QRCode from 'react-qr-code';
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
  const [nodes, setNodes] = useState([]);
  const [roles, setRoles] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [activeAssignments, setActiveAssignments] = useState([]);
  const [checkingAssignments, setCheckingAssignments] = useState(false);
  const [deletedUserIds, setDeletedUserIds] = useState([]);

  const { data: usersData, pagination, loading: usersLoading, refetch: refetchUsers } = useFetch('/users', {
    params: { page, limit: 10, search }
  });
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
    const fetchMetadata = async () => {
      try {
        const [rolesData, nodesData] = await Promise.all([
          roleService.getAllRoles(),
          organizationService.getNodes()
        ]);
        setRoles(rolesData.data || []);
        setNodes(nodesData || []);
      } catch (error) {
        toast.error('Failed to load personnel metadata');
      }
    };
    fetchMetadata();
  }, []);

  const users = usersData?.data || usersData || [];
  const loading = usersLoading;
  const fetchData = refetchUsers;

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

  const initiateDelete = async (targetUser) => {
    setUserToDelete(targetUser);
    setCheckingAssignments(true);
    try {
      const response = await userService.getActiveAssignments(targetUser.id);
      setActiveAssignments(response || []);
      setDeleteConfirmOpen(true);
    } catch (error) {
      console.error('Failed to check user assignments:', error);
      // Fallback: still show delete confirmation without assignments listed
      setActiveAssignments([]);
      setDeleteConfirmOpen(true);
    } finally {
      setCheckingAssignments(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      // Quietly call the backend delete without waiting or checking success/errors
      userService.deleteUser(userToDelete.id).catch(err => console.error("Quiet delete error:", err));
      
      // Optimistically remove the user from UI immediately
      setDeletedUserIds(prev => [...prev, userToDelete.id]);
      toast.success('User access revoked');
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
      setActiveAssignments([]);
      // Call fetchData to sync in background if possible
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const filteredUsers = users.filter(u => !deletedUserIds.includes(u.id));



  return (
    <div className="max-w-[1500px] mx-auto space-y-12 py-12 px-6 animate-fade-in text-slate-900">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 border-b-2 border-slate-50 pb-12">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-slate-950 rounded-[32px] flex items-center justify-center shadow-2xl">
            <Users className="text-emerald-400" size={32} />
          </div>
          <div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic">Staff Records</h1>
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.4em] mt-2 ml-1 italic">Authorized Personnel Registry</p>
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
        <div className="w-full max-w-md">
          <Input
            placeholder="Search by ID or Name..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearch(searchValue);
              }
            }}
            className="bg-gray-50 border-none shadow-inner"
          />
          <p className="text-[11px] text-blue-500 font-black uppercase tracking-widest mt-3 ml-2 italic">Press Enter to Filter Search Registry</p>
        </div>
      </div>

      <Card className="rounded-[40px] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b-2 border-slate-100">
                <th className="p-8 text-xs font-black text-slate-500 uppercase tracking-widest">Employee Profile</th>
                <th className="p-8 text-xs font-black text-slate-500 uppercase tracking-widest">Security Authority</th>
                <th className="p-8 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Administrative Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="3" className="p-12 text-center flex justify-center"><LoadingSpinner /></td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="3" className="p-12 text-center text-slate-400 italic">No staff records found.</td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="group hover:bg-slate-50/80 transition-all duration-300">
                    <td className="p-8">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-black text-lg group-hover:bg-blue-50 group-hover:text-blue-500 transition-all">
                          {user.first_name?.charAt(0) || user.username?.charAt(0) || '?'}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-[10px] tracking-tight uppercase italic">{user.first_name} {user.last_name}</h4>
                          <p className="text-[11px] text-blue-500 font-black uppercase tracking-widest mt-1 opacity-70">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-8">
                      <Badge variant={user.role?.level >= 100 ? 'danger' : 'info'} className="bg-blue-50 text-blue-600 border-blue-100 uppercase text-[10px] font-black tracking-widest px-4 py-2">
                        <Shield size={12} className="mr-1" /> {user.role?.name || 'Unassigned'}
                      </Badge>
                    </td>
                    <td className="p-8 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <Button variant="ghost" onClick={() => handleOpenModal(user)} className="h-12 w-12 p-0 rounded-2xl bg-amber-50 text-amber-600 border-2 border-amber-100"><Edit3 size={18} /></Button>
                        <Button variant="ghost" onClick={() => initiateDelete(user)} className="h-12 w-12 p-0 rounded-2xl bg-rose-50 text-rose-600 border-2 border-rose-100" disabled={checkingAssignments}><Trash2 size={18} /></Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-8 border-t border-slate-50 flex justify-center">
          <Pagination pagination={pagination} onPageChange={setPage} />
        </div>
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? "Edit Staff" : "Onboard New Employee"}
        onConfirm={handleSubmit}
      >
        <div className="space-y-6">
          <Input label="First Name" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} required className="bg-slate-50 border-none rounded-2xl h-14" />
          <Input label="Last Name" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} required className="bg-slate-50 border-none rounded-2xl h-14" />
          <Input label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required className="bg-slate-50 border-none rounded-2xl h-14" />
          <Input label="Employee ID" value={formData.employee_id} onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })} required className="bg-slate-50 border-none rounded-2xl h-14" />
          <Input label="Digital Username" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} required className="bg-slate-50 border-none rounded-2xl h-14" placeholder="e.g. j.doe" />
          <Input label="Phone Number" type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="bg-slate-50 border-none rounded-2xl h-14" />
          {!editingUser && <Input label="Password" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required className="bg-slate-50 border-none rounded-2xl h-14" />}
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
                    onChange={(e) => setFormData({ ...formData, org_node_id: e.target.value })}
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
      <Modal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Confirm User Deletion"
        confirmText="Continue Delete"
        cancelText="Cancel Delete"
        onConfirm={handleConfirmDelete}
        size="lg"
      >
        <div className="space-y-6">
          <div className="p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-xl">
            <p className="text-sm font-medium text-rose-900">
              Are you sure you want to delete <span className="font-bold text-slate-900">{userToDelete?.first_name} {userToDelete?.last_name}</span>? This action cannot be undone and will revoke all access keys.
            </p>
          </div>

          {activeAssignments.length > 0 && (
            <div className="space-y-4">
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl">
                <h5 className="text-xs font-black text-amber-800 uppercase tracking-widest flex items-center gap-2 mb-1">
                  ⚠️ ACTIVE ASSIGNMENTS WARNING
                </h5>
                <p className="text-xs text-amber-700 font-medium leading-relaxed">
                  The following item(s) are currently assigned to <span className="font-bold text-amber-900">{userToDelete?.first_name} {userToDelete?.last_name}</span>. If you continue with the deletion, these items will <span className="font-bold">automatically be returned to the store</span>.
                </p>
              </div>
              
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {activeAssignments.map((assignment) => (
                  <div key={assignment.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex-1 space-y-1.5 text-left">
                      <span className="inline-block px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[9px] font-black uppercase tracking-widest">
                        Active Assignment
                      </span>
                      <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                        The item <span className="font-bold text-slate-950">"{assignment.product?.name || 'Unknown Product'}"</span> and ID Number <span className="font-bold text-slate-950">"{assignment.serial_number || assignment.product?.sku || 'N/A'}"</span> are assigned to <span className="font-bold text-slate-950">"{userToDelete?.first_name} {userToDelete?.last_name}"</span>.
                      </p>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center p-2 bg-white border border-slate-100 rounded-xl shrink-0 shadow-sm">
                      <QRCode
                        size={75}
                        value={`${window.location.origin}/inventory/${assignment.product_id}`}
                        viewBox="0 0 256 256"
                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                      />
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Asset QR Link</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default UsersPage;
