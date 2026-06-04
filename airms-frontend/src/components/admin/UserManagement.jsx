import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Pagination from '../ui/Pagination';
import Modal from '../common/Modal';
import userService from '../../services/userService';
import toast from 'react-hot-toast';
import LoadingSpinner from '../common/LoadingSpinner';
import CascadingUnitSelector from '../common/CascadingUnitSelector';
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
  UserPlus,
  MapPin,
  Power,
  Eye,
  EyeOff,
  X,
  Loader2,
  Box
} from 'lucide-react';

const UserManagement = ({ orgNodeId, onBack }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [activeAssignments, setActiveAssignments] = useState([]);
  const [checkingAssignments, setCheckingAssignments] = useState(false);
  const [deletedUserIds, setDeletedUserIds] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedUserForAssignments, setSelectedUserForAssignments] = useState(null);
  const [assignmentsList, setAssignmentsList] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsPanelOpen, setAssignmentsPanelOpen] = useState(false);

  const handleShowAssignments = async (targetUser) => {
    setSelectedUserForAssignments(targetUser);
    setAssignmentsPanelOpen(true);
    setAssignmentsLoading(true);
    try {
      const response = await userService.getActiveAssignments(targetUser.id);
      setAssignmentsList(response || []);
    } catch (error) {
      console.error('Failed to load assignments:', error);
      toast.error('Failed to load active assignments');
      setAssignmentsList([]);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const handleCloseAssignments = () => {
    setAssignmentsPanelOpen(false);
    setSelectedUserForAssignments(null);
    setAssignmentsList([]);
  };

  const isSuperAdmin = user?.role?.level >= 100;

  // Build dynamic fetch URL based on scope
  const userFetchUrl = useMemo(() => {
    let url = '/users';
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('limit', '10');

    if (search) {
      params.append('search', search);
    }
    if (orgNodeId) {
      params.append('org_node_id', orgNodeId);
    } else if (isSuperAdmin) {
      params.append('only_mine', 'true');
    }

    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
  }, [page, search, orgNodeId, isSuperAdmin]);

  const { data: usersData, pagination, loading: usersLoading, refetch: refetchUsers } = useFetch(userFetchUrl);
  const users = usersData?.data || usersData || [];
  const { data: roles } = useFetch('/roles');
  const { data: nodesData } = useFetch('/organization/nodes');
  const nodes = nodesData || [];

  const filteredUsers = useMemo(() => {
    return users.filter(u => !deletedUserIds.includes(u.id));
  }, [users, deletedUserIds]);

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

  const handleToggleActive = async (targetUser) => {
    const newValue = !targetUser.is_active;
    try {
      await userService.updateUser(targetUser.id, { is_active: newValue });
      toast.success(`User ${newValue ? 'activated' : 'deactivated'}`);
      refetchUsers();
    } catch (error) {
      console.error('Failed to toggle user status:', error);
      toast.error('Failed to update user status');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack || (() => navigate('/dashboard'))}
            className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors"
            title="Go back"
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
                  setPage(1);
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
              <th className="p-4 text-sm font-bold">Branch</th>
              <th className="p-4 text-sm font-bold">Role</th>
              <th className="p-4 text-sm font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usersLoading ? (
              <tr>
                <td colSpan="6" className="p-12 text-center flex justify-center"><LoadingSpinner /></td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-12 text-center text-slate-400 text-sm">No users found.</td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 text-sm font-semibold text-slate-900">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center text-green-600 font-bold text-sm shrink-0">
                        {u.first_name?.charAt(0) || u.username?.charAt(0) || '?'}
                      </div>
                      <span className="font-bold text-slate-800">
                        {u.first_name} {u.last_name}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-slate-600">{u.email}</td>
                  <td className="p-4 text-sm text-slate-600">{u.phone || 'N/A'}</td>
                  <td className="p-4 text-sm text-slate-600">
                    {u.organizationNode?.name || <span className="italic text-slate-300">—</span>}
                  </td>
                  <td className="p-4 text-sm text-slate-600">
                    {u.roles?.map(r => r.name?.replace('_', ' ')).join(', ') || 'Staff'}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleShowAssignments(u)}
                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Assigned Items"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleToggleActive(u)}
                        title={u.is_active ? 'Deactivate User' : 'Activate User'}
                        className={`p-2 rounded-lg transition-colors ${
                          u.is_active
                            ? 'text-emerald-600 hover:bg-emerald-50'
                            : 'text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        <Power size={16} />
                      </button>
                      <button onClick={() => handleOpenModal(u)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Edit">
                        <Edit3 size={16} />
                      </button>
                      <button onClick={() => initiateDelete(u)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete" disabled={checkingAssignments}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {pagination && (
          <div className="p-4 border-t border-slate-100 flex justify-center">
            <Pagination pagination={pagination} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* PROVISIONING MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? "Edit User" : "Add User"}
        onConfirm={handleSubmit}
        confirmText="Save"
        cancelText="Cancel"
        maxWidth="max-w-3xl"
        overflowVisible={true}
      >
        <div className="space-y-3 p-1">
          {/* ROW 1: First Name | Last Name | Phone */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">First Name</label>
              <input className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-300" value={formData.first_name || ''} onChange={e => setFormData({ ...formData, first_name: e.target.value })} placeholder="First name" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Last Name</label>
              <input className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-300" value={formData.last_name || ''} onChange={e => setFormData({ ...formData, last_name: e.target.value })} placeholder="Last name" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Phone</label>
              <input className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-300" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+254 700 000 000" />
            </div>
          </div>

          {/* ROW 2: Email | Password */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Email</label>
              <input type="email" className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-300" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="j.doe@company.com" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 pr-9 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-300"
                  value={formData.password || ''}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingItem ? 'Leave blank to keep' : '••••••••'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* ROW 3: Assign Roles (cols 1 & 2) and Branch / Node (col 3) */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1 col-span-2 relative">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assign Roles</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg h-9 px-3 font-semibold text-sm text-slate-700 focus:ring-2 focus:ring-green-300 outline-none flex items-center justify-between cursor-pointer"
                >
                  <span className="truncate text-sm">
                    {formData.role_ids && formData.role_ids.length > 0
                      ? roles?.filter(r => formData.role_ids.includes(r.id)).map(r => r.name).join(', ')
                      : 'Select Roles...'}
                  </span>
                  <svg className={`h-4 w-4 text-slate-400 transition-transform shrink-0 ml-2 ${roleDropdownOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                {roleDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setRoleDropdownOpen(false)} />
                    {/* Opens UPWARD — bottom-full mb-1 — so it never covers Branch/Node or buttons */}
                    <div className="absolute left-0 right-0 bottom-full mb-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-20 max-h-72 overflow-y-auto p-1.5 space-y-0.5">
                      {filteredRoles?.length === 0 ? (
                        <div className="p-3 text-center text-slate-400 text-xs">No roles available</div>
                      ) : (
                        filteredRoles.map(role => {
                          const isChecked = formData.role_ids?.includes(role.id);
                          return (
                            <div key={role.id} onClick={() => handleRoleToggle(role.id)}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm transition-all ${
                                isChecked ? 'bg-green-50 text-green-700 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-all ${
                                isChecked ? 'bg-green-600 border-green-600' : 'border-slate-300 bg-white'
                              }`}>
                                {isChecked && <CheckCircle2 size={10} className="text-white" />}
                              </div>
                              <span className="flex-1">{role.name}</span>
                              <span className="text-xs text-slate-400 shrink-0">Lv.{role.level}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className={`space-y-1 col-span-1 transition-all duration-300 ${isSuperAdminRole ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Branch / Node</label>
              <CascadingUnitSelector
                value={formData.org_node_id}
                onChange={(nodeId) => setFormData({ ...formData, org_node_id: nodeId ? parseInt(nodeId) : null })}
              />
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

      {/* ACTIVE ASSIGNMENTS SLIDE-OVER PANEL */}
      {assignmentsPanelOpen && createPortal(
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 overflow-hidden">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ease-in-out opacity-100" 
              onClick={handleCloseAssignments}
            />

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <div className="pointer-events-auto w-screen max-w-md transform transition duration-300 ease-in-out translate-x-0">
                <div className="flex h-full flex-col bg-white shadow-2xl overflow-y-auto">
                  {/* Header */}
                  <div className="px-6 py-6 bg-green-700 text-white flex items-center justify-between shrink-0">
                    <div>
                      <h2 className="text-lg font-bold flex items-center gap-2" id="slide-over-title">
                        <Users size={18} /> Active Assignments
                      </h2>
                      {selectedUserForAssignments && (
                        <p className="text-xs text-green-100 mt-1 font-semibold">
                          {selectedUserForAssignments.first_name} {selectedUserForAssignments.last_name} ({selectedUserForAssignments.employee_id || 'System User'})
                        </p>
                      )}
                    </div>
                    <button 
                      onClick={handleCloseAssignments} 
                      className="p-1 rounded-full text-green-100 hover:text-white hover:bg-green-800 transition-colors focus:outline-none"
                    >
                      <X size={22} />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 py-6 px-6 bg-slate-50 overflow-y-auto">
                    {assignmentsLoading ? (
                      <div className="flex flex-col items-center justify-center h-64 text-green-600">
                        <Loader2 className="animate-spin mb-3" size={28} />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading assignments...</p>
                      </div>
                    ) : assignmentsList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-center p-4">
                        <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-3">
                          <Box size={24} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-700">No Assignments</h3>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                          This user does not currently hold any active assigned equipment.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {assignmentsList.map((assignment) => (
                          <div key={assignment.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                            {/* Accent line */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500" />
                            
                            <div className="flex justify-between items-start gap-4">
                              <div className="space-y-2">
                                <div>
                                  <h4 className="font-bold text-slate-800 text-sm leading-tight group-hover:text-green-700 transition-colors">
                                    {assignment.product?.name || 'Unknown Item'}
                                  </h4>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                    {assignment.product?.sku || 'NO SKU'}
                                  </p>
                                </div>

                                <div className="space-y-1.5 text-xs text-slate-600 font-medium">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Serial:</span>
                                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-bold">{assignment.serial_number || 'N/A'}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Assigned:</span>
                                    <span>{assignment.assigned_at ? new Date(assignment.assigned_at).toLocaleDateString() : 'N/A'}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Condition:</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      assignment.condition_at_assignment === 'new' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                      assignment.condition_at_assignment === 'good' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                      assignment.condition_at_assignment === 'fair' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                      'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}>
                                      {assignment.condition_at_assignment || 'good'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col items-center shrink-0 border border-slate-100 rounded-xl p-1.5 bg-slate-50/50 shadow-sm">
                                <QRCode 
                                  size={50} 
                                  value={`${window.location.origin}/inventory/${assignment.product_id}`} 
                                  viewBox="0 0 256 256" 
                                  style={{ height: 'auto', maxWidth: '100%', width: '100%' }} 
                                />
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-wider mt-1">QR Link</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default UserManagement;
