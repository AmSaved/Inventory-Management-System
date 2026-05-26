import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Modal from '../common/Modal';
import Input from '../ui/Input';
import CascadingUnitSelector from '../common/CascadingUnitSelector';
import userService from '../../services/userService';
import toast from 'react-hot-toast';
import LoadingSpinner from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import QRCode from 'react-qr-code';
import {
  Building2,
  ShieldCheck,
  Users,
  MoreVertical,
  Edit3,
  Trash2,
  Search,
  Fingerprint,
  Activity,
  CheckCircle2,
  XCircle,
  Mail,
  Smartphone,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Eye,
  UserPlus,
  MapPin
} from 'lucide-react';

const UserManagement = ({ orgNodeId, onBack }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [activeAssignments, setActiveAssignments] = useState([]);
  const [checkingAssignments, setCheckingAssignments] = useState(false);
  const [deletedUserIds, setDeletedUserIds] = useState([]);

  const isSuperAdmin = user?.role?.level >= 100;

  // Build dynamic fetch URL based on scope
  const userFetchUrl = useMemo(() => {
    let url = '/users';
    const params = new URLSearchParams();

    if (orgNodeId) {
      params.append('org_node_id', orgNodeId);
    } else if (isSuperAdmin) {
      params.append('only_mine', 'true');
    }

    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
  }, [orgNodeId, isSuperAdmin]);

  const { data: usersData, loading: usersLoading, refetch: refetchUsers } = useFetch(userFetchUrl);
  const users = usersData?.data || usersData || [];
  const { data: roles } = useFetch('/roles');

  const filteredUsers = useMemo(() => {
    let result = users;
    if (search) {
      const term = search.toLowerCase();
      result = users.filter(u =>
        u.first_name?.toLowerCase().includes(term) ||
        u.last_name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.employee_id?.toLowerCase().includes(term)
      );
    }
    return result.filter(u => !deletedUserIds.includes(u.id));
  }, [users, search, deletedUserIds]);

  const handleOpenModal = (item = null) => {
    setEditingItem(item);
    setRoleDropdownOpen(false);
    if (item) {
      setFormData({
        ...item,
        password: '', // Clear password field for new entry
        org_node_id: item.org_node_id || null,
        role_ids: item.roles?.map(r => r.id) || (item.role_id ? [item.role_id] : [])
      });
    } else {
      setFormData({
        is_active: true,
        password: '',
        org_node_id: null,
        role_ids: []
      });
    }
    setModalOpen(true);
  };

  const filteredRoles = useMemo(() => {
    if (!roles) return [];
    return roles.filter(role => {
      // 1. Level check: role level must be less than or equal to current user's level
      const userMaxLevel = user?.role?.level ?? 0;
      const isLevelAllowed = role.level <= userMaxLevel;

      // 2. Node check: role must belong to same branch, sub-branch, or company-wide (null)
      const isNodeAllowed = !role.org_node_id ||
        role.org_node_id === user?.org_node_id ||
        user?.allowedNodes?.includes(role.org_node_id);

      return isLevelAllowed && isNodeAllowed;
    });
  }, [roles, user]);

  const handleRoleToggle = (roleId) => {
    const id = parseInt(roleId);
    if (!id) return;

    let currentRoleIds = [...(formData.role_ids || [])];
    const index = currentRoleIds.indexOf(id);

    if (index > -1) {
      currentRoleIds.splice(index, 1);
    } else {
      currentRoleIds.push(id);
    }

    const selectedRolesObjects = roles?.filter(r => currentRoleIds.includes(r.id)) || [];
    const hasSuperAdmin = selectedRolesObjects.some(r => r.level >= 100);

    setFormData({
      ...formData,
      role_ids: currentRoleIds,
      role_id: currentRoleIds[0] || null,
      org_node_id: hasSuperAdmin ? null : formData.org_node_id
    });
  };


  const handleSubmit = async () => {
    const loadingToast = toast.loading('');
    setSubmitting(true);
    try {
      if (editingItem) {
        await userService.updateUser(editingItem.id, formData);
        toast.success('user updated', { id: loadingToast });
      } else {
        await userService.createUser(formData);
        toast.success('new user added', { id: loadingToast });
      }
      refetchUsers();
      setModalOpen(false);
    } catch (error) {
      toast.error('failed to save user', { id: loadingToast });
    } finally {
      setSubmitting(false);
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
      setActiveAssignments([]);
      setDeleteConfirmOpen(true);
    } finally {
      setCheckingAssignments(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      // Quietly call the backend delete in the background
      userService.deleteUser(userToDelete.id).catch(err => console.error("Quiet delete error:", err));
      
      // Optimistically update the UI instantly
      setDeletedUserIds(prev => [...prev, userToDelete.id]);
      toast.success('user deleted');
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
      setActiveAssignments([]);
      refetchUsers();
    } catch (error) {
      console.error(error);
    }
  };

  const isSuperAdminRole = roles?.filter(r => formData.role_ids?.includes(r.id)).some(r => r.level >= 100);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack || (() => navigate('/dashboard'))}
            className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center hover:bg-green-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-green-700">User Management</h1>
            <p className="text-sm text-slate-500 mt-1">This is the user management of the {user?.organizationNode?.name || 'Organization'}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search..."
              className="pl-10 pr-4 h-11 bg-slate-50 border border-slate-100 rounded-lg text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSearch(searchTerm);
                }
              }}
            />
          </div>

          <Button
            onClick={() => handleOpenModal()}
            className="bg-green-600 text-white h-11 px-6 rounded-lg font-bold text-sm hover:bg-green-700 transition-all shadow-sm flex items-center gap-2"
          >
            <span>+ Add User</span>
          </Button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-green-600 text-white">
              <th className="p-4 text-sm font-bold">Full Name</th>
              <th className="p-4 text-sm font-bold">Email</th>
              <th className="p-4 text-sm font-bold">Phone Number</th>
              <th className="p-4 text-sm font-bold">Role</th>
              <th className="p-4 text-sm font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usersLoading ? (
              <tr>
                <td colSpan="5" className="p-12 text-center flex justify-center"><LoadingSpinner /></td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-12 text-center text-slate-400 text-sm">No users found.</td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 text-sm font-medium text-slate-900">{u.first_name} {u.last_name}</td>
                  <td className="p-4 text-sm text-slate-600">{u.email}</td>
                  <td className="p-4 text-sm text-slate-600">{u.phone || 'N/A'}</td>
                  <td className="p-4 text-sm text-slate-600">
                    {u.roles?.map(r => r.name?.replace('_', ' ')).join(', ') || 'Staff'}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleOpenModal(u)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Edit">
                        <Edit3 size={16} />
                      </button>
                      <button onClick={() => initiateDelete(u)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete" disabled={checkingAssignments}>
                        <Trash2 size={16} />
                      </button>
                      <button className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="View/Toggle">
                        <Eye size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PROVISIONING MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? "Edit User" : "Add User"}
        onConfirm={handleSubmit}
        confirmText="Save"
        cancelText="Cancel"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-10 p-2 overflow-y-auto max-h-[70vh] custom-scrollbar pr-4">
          {/* SECTION 1: IDENTITY */}
          <div className="space-y-6">
            {/* <div className="flex items-center gap-3 px-2">
              <Fingerprint className="text-blue-600" size={20} />

            </div> */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input label="First Name" value={formData.first_name || ''} onChange={e => setFormData({ ...formData, first_name: e.target.value })} className="bg-slate-50 border-none rounded-2xl h-14 font-black" />
              <Input label="Last Name" value={formData.last_name || ''} onChange={e => setFormData({ ...formData, last_name: e.target.value })} className="bg-slate-50 border-none rounded-2xl h-14 font-black" />
              <Input label="Email" type="email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} className="bg-slate-50 border-none rounded-2xl h-14 font-black" placeholder="j.doe@company.com" />
              <Input label="Phone Number" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="bg-slate-50 border-none rounded-2xl h-14 font-black" placeholder="+254 700 000 000" />
            </div>
          </div>

          {/* SECTION 2: SECURITY & ROLE */}
          <div className="space-y-6 pt-6 border-t border-slate-100">
            {/* <div className="flex items-center gap-3 px-2">
              <ShieldAlert className="text-blue-600" size={20} />

            </div> */}

            <Input
              label={editingItem ? "Password" : "Passoword"}
              type="password"
              value={formData.password || ''}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              className="bg-slate-950 text-black border-none rounded-2xl h-14 font-black placeholder:text-slate-700"
              placeholder={editingItem ? "••••••••" : "********"}
            />

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 italic">Assign Roles</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl h-14 px-5 font-bold text-sm text-slate-700 focus:ring-2 focus:ring-green-500 outline-none flex items-center justify-between transition-all cursor-pointer"
                >
                  <span className="truncate">
                    {formData.role_ids && formData.role_ids.length > 0
                      ? roles
                        ?.filter(r => formData.role_ids.includes(r.id))
                        .map(r => r.name.toUpperCase().replace('_', ' '))
                        .join(', ')
                      : 'Select Roles...'}
                  </span>
                  <svg
                    className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${roleDropdownOpen ? 'rotate-180' : ''}`}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {roleDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setRoleDropdownOpen(false)}
                    />

                    <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl z-20 max-h-60 overflow-y-auto custom-scrollbar p-2 space-y-1">
                      {filteredRoles?.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-xs font-bold">
                          No roles available in your scope
                        </div>
                      ) : (
                        filteredRoles.map(role => {
                          const isChecked = formData.role_ids?.includes(role.id);
                          return (
                            <div
                              key={role.id}
                              onClick={() => handleRoleToggle(role.id)}
                              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer select-none transition-all ${isChecked
                                ? 'bg-green-50 text-green-700 font-bold'
                                : 'hover:bg-slate-50 text-slate-700'
                                }`}
                            >
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${isChecked
                                ? 'bg-green-600 border-green-600 text-white'
                                : 'border-slate-300 bg-white'
                                }`}>
                                {isChecked && <CheckCircle2 size={12} className="text-white" />}
                              </div>
                              <div className="flex-1 text-xs">
                                <span className="block font-bold">{role.name.toUpperCase().replace('_', ' ')}</span>
                                <span className="block text-[10px] text-slate-500 font-normal">Level {role.level} • {role.description || 'Access Blueprint'}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 3: DEPLOYMENT */}
          <div className="space-y-6 pt-6 border-t border-slate-100">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className={`space-y-3 transition-all duration-500 ${isSuperAdminRole ? 'opacity-30 grayscale pointer-events-none' : 'opacity-100'}`}>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 italic">Node Assignment</label>
                <CascadingUnitSelector
                  value={formData.org_node_id}
                  onChange={(id) => setFormData({ ...formData, org_node_id: id })}
                  className="bg-slate-50 border-none h-14 rounded-2xl font-black"
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 italic">Account Activation</label>
                <div
                  onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  className={`flex items-center gap-4 p-6 rounded-[2.5rem] border-2 transition-all cursor-pointer ${formData.is_active ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-lg shadow-emerald-100' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                >
                  {formData.is_active ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                  <div>
                    <span className="block text-xs font-black uppercase tracking-widest">ACTIVE STATUS</span>

                  </div>
                </div>
              </div>
            </div>
          </div>
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

export default UserManagement;
