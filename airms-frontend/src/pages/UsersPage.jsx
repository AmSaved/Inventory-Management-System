import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
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
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Shield,
  Search,
  Trash2,
  Edit3,
  Building2,
  Power,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  X,
  Loader2,
  Box,
} from 'lucide-react';

const UsersPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
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

  const { data: usersData, pagination, loading: usersLoading, refetch: refetchUsers } = useFetch('/users', {
    params: { page, limit: 10, search, only_mine: true }
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
          roleService.getAllRoles({ only_mine: true }),
          organizationService.getNodes()
        ]);
        setRoles(rolesData.data || []);
        setNodes(nodesData || []);
      } catch (error) {
        toast.error('Failed to load metadata');
      }
    };
    fetchMetadata();
  }, []);

  const users = usersData?.data || usersData || [];

  const filteredUsers = useMemo(() => {
    return (users || []).filter(u => !deletedUserIds.includes(u.id));
  }, [users, deletedUserIds]);

  const handleOpenModal = (targetUser = null) => {
    setEditingUser(targetUser);
    if (targetUser) {
      setFormData({
        username: targetUser.username,
        email: targetUser.email,
        first_name: targetUser.first_name || '',
        last_name: targetUser.last_name || '',
        employee_id: targetUser.employee_id || '',
        phone: targetUser.phone || '',
        role_id: targetUser.role_id || '',
        org_node_id: targetUser.org_node_id || '',
        status: targetUser.status || 'active'
      });
    } else {
      setFormData({
        username: '', email: '', password: '',
        first_name: '', last_name: '', employee_id: '',
        phone: '', role_id: '', org_node_id: '', status: 'active'
      });
    }
    setModalOpen(true);
  };

  const handleRoleChange = (roleId) => {
    const selectedRole = roles?.find(r => r.id === parseInt(roleId));
    const isSuperAdmin = selectedRole?.level >= 100;
    setFormData({ ...formData, role_id: roleId, org_node_id: isSuperAdmin ? null : formData.org_node_id });
  };

  // When the Branch/Node changes, auto-clear the role if it no longer fits the node level.
  // Root org nodes (no parent) require roles >= 90. If the selected role is below that, clear it.
  const handleNodeChange = (nodeId) => {
    const chosenNode = nodes.find(n => n.id === parseInt(nodeId));
    const isRoot = chosenNode && !chosenNode.parent_id;
    const currentRole = roles?.find(r => r.id === parseInt(formData.role_id));
    const roleFitsNode = !isRoot || (currentRole && currentRole.level >= 90);
    setFormData(prev => ({
      ...prev,
      org_node_id: nodeId,
      role_id: roleFitsNode ? prev.role_id : ''
    }));
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
        toast.success('User updated');
      } else {
        await userService.createUser(submissionData);
        toast.success('User created');
      }
      setModalOpen(false);
      refetchUsers();
    } catch (error) {
      console.error('Operation failed:', error);
    }
  };

  const handleToggleStatus = async (targetUser) => {
    try {
      await userService.toggleUserStatus(targetUser.id);
      const nextStatus = !targetUser.is_active ? 'activated' : 'deactivated';
      toast.success(`User ${nextStatus}`);
      refetchUsers();
    } catch (error) {
      console.error('Failed to toggle status:', error);
      toast.error('Failed to update status');
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
      setActiveAssignments([]);
      setDeleteConfirmOpen(true);
    } finally {
      setCheckingAssignments(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      userService.deleteUser(userToDelete.id).catch(err => console.error(err));
      setDeletedUserIds(prev => [...prev, userToDelete.id]);
      toast.success('User deleted');
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
      setActiveAssignments([]);
      refetchUsers();
    } catch (error) {
      console.error(error);
    }
  };

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

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-500">

      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center hover:bg-green-100 transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-green-700">User Management</h1>
            <p className="text-sm text-slate-500 mt-1">System-wide user registry — Super Admin view</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search users..."
              className="pl-10 pr-4 h-11 bg-slate-50 border border-slate-100 rounded-lg text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all w-64"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchValue); } }}
            />
          </div>
          <Button
            onClick={() => handleOpenModal()}
            className="bg-green-600 text-white h-11 px-6 rounded-lg font-bold text-sm hover:bg-green-700 transition-all shadow-sm flex items-center gap-2"
          >
            <UserPlus size={16} /> Add User
          </Button>
        </div>
      </div>      {/* TABLE */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-green-600 text-white">
              <th className="p-4 text-sm font-bold">Full Name</th>
              <th className="p-4 text-sm font-bold">Email</th>
              <th className="p-4 text-sm font-bold">Phone</th>
              <th className="p-4 text-sm font-bold">Branch / Node</th>
              <th className="p-4 text-sm font-bold">Role</th>
              <th className="p-4 text-sm font-bold text-center">Status</th>
              <th className="p-4 text-sm font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usersLoading ? (
              <tr>
                <td colSpan="7" className="p-12 text-center">
                  <div className="flex justify-center"><LoadingSpinner /></div>
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-12 text-center text-slate-400 text-sm italic">No users found.</td>
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
                  <td className="p-4 text-sm text-slate-600">{u.phone || <span className="italic text-slate-300">—</span>}</td>
                  <td className="p-4 text-sm text-slate-600">
                    {u.organizationNode ? (
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-green-500 shrink-0" />
                        <span>{u.organizationNode.name}</span>
                      </div>
                    ) : (
                      <span className="italic text-slate-300">Global</span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-slate-600">
                    {u.roles?.map(r => r.name?.replace('_', ' ')).join(', ') || u.role?.name || 'Unassigned'}
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleToggleStatus(u)}
                      title={u.is_active ? 'Click to deactivate' : 'Click to activate'}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                        u.is_active
                          ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600 shadow-sm shadow-emerald-200'
                          : 'bg-rose-100 text-rose-700 border-rose-300 hover:bg-rose-200'
                      }`}
                    >
                      <Power size={11} />
                      {u.is_active ? 'Active' : 'Inactive'}
                    </button>
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
                        onClick={() => handleOpenModal(u)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => initiateDelete(u)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                        disabled={checkingAssignments}
                      >
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

      {/* CREATE / EDIT MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? 'Edit User' : 'Add User'}
        onConfirm={handleSubmit}
        confirmText="Save"
        cancelText="Cancel"
      >
        <div className="space-y-3 p-1">
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">First Name</label>
              <input className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-300" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} placeholder="First name" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Last Name</label>
              <input className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-300" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} placeholder="Last name" />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Email</label>
              <input type="email" className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-300" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="user@company.com" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Phone</label>
              <input type="tel" className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-300" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+1 000 000 0000" />
            </div>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-3 gap-3">
            {!editingUser ? (
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 pr-9 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-300"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
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
            ) : <div />}
            {(() => {
              // Determine which node is selected and whether it is a root org
              const selectedNode = nodes.find(n => n.id === parseInt(formData.org_node_id));
              const isRootNode = selectedNode && !selectedNode.parent_id;
              // Root org nodes → only roles >= 90 (Admin level); exclude super_admin (level 100) always
              const assignableRoles = isRootNode
                ? roles.filter(r => r.level >= 90 && r.level < 100)
                : roles.filter(r => r.level < 100);
              return (
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assigned Role</label>
                  <select
                    className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-300"
                    value={formData.role_id}
                    onChange={e => handleRoleChange(e.target.value)}
                  >
                    <option value="">Select Role</option>
                    {assignableRoles.map(r => (
                      <option key={r.id} value={r.id}>{r.name} (Lv.{r.level})</option>
                    ))}
                  </select>
                </div>
              );
            })()}
            {(() => {
              const selectedRole = roles.find(r => r.id === parseInt(formData.role_id));
              if (!selectedRole || selectedRole.level < 100) {
                return (
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Branch / Node</label>
                    <select
                      className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-300"
                      value={formData.org_node_id}
                      onChange={e => handleNodeChange(e.target.value)}
                    >
                      <option value="">Select Branch</option>
                      {nodes.filter(n => !n.parent_id).map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>
                  </div>
                );
              }
              return <div />;
            })()}
          </div>
        </div>
      </Modal>

      {/* DELETE CONFIRM MODAL */}
      <Modal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Confirm User Deletion"
        confirmText="Continue Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        size="lg"
      >
        <div className="space-y-6">
          <div className="p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-xl">
            <p className="text-sm font-medium text-rose-900">
              Are you sure you want to delete <span className="font-bold text-slate-900">{userToDelete?.first_name} {userToDelete?.last_name}</span>? This action cannot be undone.
            </p>
          </div>

          {activeAssignments.length > 0 && (
            <div className="space-y-4">
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl">
                <h5 className="text-xs font-black text-amber-800 uppercase tracking-widest mb-1">⚠️ Active Assignments Warning</h5>
                <p className="text-xs text-amber-700 font-medium leading-relaxed">
                  The following items assigned to <span className="font-bold">{userToDelete?.first_name} {userToDelete?.last_name}</span> will be automatically returned to the store.
                </p>
              </div>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {activeAssignments.map((assignment) => (
                  <div key={assignment.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between gap-4">
                    <div>
                      <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[9px] font-black uppercase tracking-widest mb-1">Active Assignment</span>
                      <p className="text-xs font-semibold text-slate-800">
                        "{assignment.product?.name || 'Unknown'}" — {assignment.serial_number || assignment.product?.sku || 'N/A'}
                      </p>
                    </div>
                    <div className="flex flex-col items-center p-2 bg-white border border-slate-100 rounded-xl shrink-0 shadow-sm">
                      <QRCode size={60} value={`${window.location.origin}/inventory/${assignment.product_id}`} viewBox="0 0 256 256" style={{ height: 'auto', maxWidth: '100%', width: '100%' }} />
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1">QR Link</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ACTIVE ASSIGNMENTS SLIDE-OVER PANEL */}
      {assignmentsPanelOpen && (
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
        </div>
      )}
    </div>
  );
};

export default UsersPage;
