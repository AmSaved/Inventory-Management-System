import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../hooks/useAuth';
import Button from '../ui/Button';
import Modal from '../common/Modal';
import Input from '../ui/Input';
import roleService from '../../services/roleService';
import toast from 'react-hot-toast';
import LoadingSpinner from '../common/LoadingSpinner';
import { 
  Plus, 
  Users, 
  ShieldCheck, 
  Key, 
  Map, 
  Boxes, 
  Package, 
  ClipboardList, 
  Truck, 
  RotateCcw, 
  ArrowLeftRight, 
  ArrowLeft,
  Eye,
  AlertCircle, 
  BarChart3, 
  LayoutDashboard, 
  Settings, 
  Bell, 
  History, 
  Cpu, 
  Workflow, 
  Warehouse, 
  Layers, 
  Crown,
  Search,
  CheckCircle2,
  Info,
  Trash2,
  Fingerprint,
  Activity,
  Zap,
  ArrowRight,
  Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Badge from '../ui/Badge';

const RoleManagement = ({ onBack }) => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingItem, setViewingItem] = useState(null);

  const { data: roles, loading: rolesLoading, refetch: refetchRoles } = useFetch('/roles');
  const { data: permissions, loading: permsLoading } = useFetch('/permissions');

  const categoryMap = {
    'users': { name: 'User & Access Management', icon: <Users size={16} />, color: 'blue' },
    'user': { name: 'User & Access Management', icon: <Users size={16} />, color: 'blue' },
    'roles': { name: 'User & Access Management', icon: <Users size={16} />, color: 'blue' },
    'role': { name: 'User & Access Management', icon: <Users size={16} />, color: 'blue' },
    'permissions': { name: 'User & Access Management', icon: <Users size={16} />, color: 'blue' },
    'permission': { name: 'User & Access Management', icon: <Users size={16} />, color: 'blue' },
    'branches': { name: 'Organization Branches', icon: <Map size={16} />, color: 'emerald' },
    'branch': { name: 'Organization Branches', icon: <Map size={16} />, color: 'emerald' },
    'products': { name: 'Product Catalog', icon: <Boxes size={16} />, color: 'amber' },
    'product': { name: 'Product Catalog', icon: <Boxes size={16} />, color: 'amber' },
    'inventory': { name: 'Inventory Levels', icon: <Package size={16} />, color: 'orange' },
    'requests': { name: 'Employee Requests', icon: <ClipboardList size={16} />, color: 'cyan' },
    'request': { name: 'Employee Requests', icon: <ClipboardList size={16} />, color: 'cyan' },
    'discharge': { name: 'Discharging Assets', icon: <Truck size={16} />, color: 'rose' },
    'assignments': { name: 'Assigned Items', icon: <Fingerprint size={16} />, color: 'violet' },
    'assignment': { name: 'Assigned Items', icon: <Fingerprint size={16} />, color: 'violet' },
    'returns': { name: 'Item Returns', icon: <RotateCcw size={16} />, color: 'pink' },
    'return': { name: 'Item Returns', icon: <RotateCcw size={16} />, color: 'pink' },
    'transfers': { name: 'Stock Transfers', icon: <ArrowLeftRight size={16} />, color: 'purple' },
    'transfer': { name: 'Stock Transfers', icon: <ArrowLeftRight size={16} />, color: 'purple' },
    'issues': { name: 'Issue Reports', icon: <AlertCircle size={16} />, color: 'red' },
    'issue': { name: 'Issue Reports', icon: <AlertCircle size={16} />, color: 'red' },
    'issue logs': { name: 'Issue Reports', icon: <AlertCircle size={16} />, color: 'red' },
    'issue log': { name: 'Issue Reports', icon: <AlertCircle size={16} />, color: 'red' },
    'reports': { name: 'Reports & Analytics', icon: <BarChart3 size={16} />, color: 'teal' },
    'report': { name: 'Reports & Analytics', icon: <BarChart3 size={16} />, color: 'teal' },
    'analytics': { name: 'Reports & Analytics', icon: <BarChart3 size={16} />, color: 'teal' },
    'dashboard': { name: 'Dashboard Info', icon: <LayoutDashboard size={16} />, color: 'sky' },
    'settings': { name: 'Settings', icon: <Settings size={16} />, color: 'slate' },
    'setting': { name: 'Settings', icon: <Settings size={16} />, color: 'slate' },
    'notifications': { name: 'Communication & Alerts', icon: <Bell size={16} />, color: 'yellow' },
    'notification': { name: 'Communication & Alerts', icon: <Bell size={16} />, color: 'yellow' },
    'audit': { name: 'Audit Trails & Security Logs', icon: <History size={16} />, color: 'neutral' },
    'system': { name: 'System Administration', icon: <Cpu size={16} />, color: 'slate' },
    'workflow': { name: 'Approval Workflows', icon: <Workflow size={16} />, color: 'indigo' },
    'items': { name: 'Store & Stock', icon: <Warehouse size={16} />, color: 'green' },
    'item': { name: 'Store & Stock', icon: <Warehouse size={16} />, color: 'green' },
    'stock': { name: 'Store & Stock', icon: <Warehouse size={16} />, color: 'green' },
    'store': { name: 'Store & Stock', icon: <Warehouse size={16} />, color: 'green' },
    'node': { name: 'Organization Branches', icon: <Map size={16} />, color: 'emerald' },
    'org': { name: 'Organization Settings', icon: <Crown size={16} />, color: 'fuchsia' },
    'assets': { name: 'Assets', icon: <Layers size={16} />, color: 'emerald' },
    'asset': { name: 'Assets', icon: <Layers size={16} />, color: 'emerald' },
    'hierarchy': { name: 'Organization Settings', icon: <Crown size={16} />, color: 'fuchsia' },
    'organization': { name: 'Organization Settings', icon: <Crown size={16} />, color: 'fuchsia' }
  };

  const handleOpenModal = (item = null) => {
    setEditingItem(item);
    setSearchTerm('');
    if (item) {
      setFormData({
        name: item.name,
        description: item.description || '',
        level: item.level ?? 10,
        visibility_scope: item.visibility_scope || 'own_node',
        org_node_id: item.org_node_id,
        permission_ids: item.permissions?.map(p => p.id) || []
      });
    } else {
      setFormData({ 
        name: '', 
        description: '', 
        level: 10, 
        visibility_scope: 'own_node',
        org_node_id: currentUser?.org_node_id || null,
        permission_ids: [] 
      });
    }
    setModalOpen(true);
  };

  const handlePermissionToggle = (permId) => {
    const currentPerms = [...(formData.permission_ids || [])];
    const index = currentPerms.indexOf(permId);
    if (index > -1) {
      currentPerms.splice(index, 1);
    } else {
      currentPerms.push(permId);
    }
    setFormData({ ...formData, permission_ids: currentPerms });
  };

  // Check if the dangerous system:manage permission is currently selected
  const isSystemManageSelected = permissions && formData.permission_ids?.some(id => {
    const perm = permissions.find(p => p.id === id);
    return perm?.name === 'system:manage';
  });

  const handleGroupToggle = (permsInGroup) => {
    const permIds = permsInGroup.map(p => p.id);
    const currentPerms = formData.permission_ids || [];
    const allSelected = permIds.every(id => currentPerms.includes(id));
    
    if (allSelected) {
      setFormData({
        ...formData,
        permission_ids: currentPerms.filter(id => !permIds.includes(id))
      });
    } else {
      setFormData({
        ...formData,
        permission_ids: Array.from(new Set([...currentPerms, ...permIds]))
      });
    }
  };

  const handleSubmit = async () => {
    if (!formData.name) return toast.error('Role Name Required');
    const loadingToast = toast.loading('');
    setSubmitting(true);
    try {
      if (editingItem) {
        await roleService.updateRole(editingItem.id, formData);
        toast.success('role updated', { id: loadingToast });
      } else {
        await roleService.createRole(formData);
        toast.success('new role added', { id: loadingToast });
      }
      refetchRoles();
      setModalOpen(false);
    } catch (error) {
      toast.error('failed to save role', { id: loadingToast });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this role?')) {
      try {
        await roleService.deleteRole(id);
        refetchRoles();
        toast.success('Role deleted');
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to delete role');
      }
    }
  };

  const groupedPermissions = useMemo(() => {
    if (!permissions) return {};
    const filtered = permissions.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.resource?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filtered.reduce((acc, perm) => {
      const fallbackPrefix = perm.name.includes(':') 
        ? perm.name.split(':')[0] 
        : perm.name.includes('-') 
        ? perm.name.split('-')[0] 
        : 'other';
      const resource = (perm.resource || '').toLowerCase();
      const category = categoryMap[resource] || 
                       categoryMap[fallbackPrefix] || 
                       { name: 'General Utilities', icon: <Info size={16} />, color: 'slate' };
      if (!acc[category.name]) {
        acc[category.name] = { config: category, perms: [] };
      }
      acc[category.name].perms.push(perm);
      return acc;
    }, {});
  }, [permissions, searchTerm]);

  const viewGroupedPermissions = useMemo(() => {
    if (!viewingItem?.permissions) return {};
    return viewingItem.permissions.reduce((acc, perm) => {
      const fallbackPrefix = perm.name.includes(':') 
        ? perm.name.split(':')[0] 
        : perm.name.includes('-') 
        ? perm.name.split('-')[0] 
        : 'other';
      const resource = (perm.resource || '').toLowerCase();
      const category = categoryMap[resource] || 
                       categoryMap[fallbackPrefix] || 
                       { name: 'General Utilities' };
      if (!acc[category.name]) {
        acc[category.name] = [];
      }
      acc[category.name].push(perm);
      return acc;
    }, {});
  }, [viewingItem]);

  const filteredRoles = useMemo(() => {
    if (!roles) return [];
    return roles.filter(role => {
      // 1. Level Filter: Only see roles at or below current user's level
      const userMaxLevel = currentUser?.role?.level ?? 0;
      const isLevelAllowed = role.level <= userMaxLevel;

      // 2. Node/Hierarchy Filter: Only see roles in same organization node, its sub-nodes, or company level (null org_node_id)
      // Super Admins (level >= 100) bypass the node check to see all roles.
      const isSuperAdmin = currentUser?.role?.level >= 100;
      const isNodeAllowed = isSuperAdmin || !role.org_node_id || 
                            role.org_node_id === currentUser?.org_node_id || 
                            currentUser?.allowedNodes?.includes(role.org_node_id);

      // 3. Search Term filter (separate from permissions search)
      const matchesSearch = !searchTerm || modalOpen || 
                            role.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (role.description && role.description.toLowerCase().includes(searchTerm.toLowerCase()));

      return isLevelAllowed && isNodeAllowed && matchesSearch;
    });
  }, [roles, currentUser, searchTerm, modalOpen]);


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
            <h1 className="text-2xl font-bold text-green-700">Role Management</h1>
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
            />
          </div>
          
          <Button 
            onClick={() => handleOpenModal()} 
            className="bg-green-600 text-white h-11 px-6 rounded-lg font-bold text-sm hover:bg-green-700 transition-all shadow-sm"
          >
            + Add Role
          </Button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-green-600 text-white">
              <th className="p-4 text-sm font-bold">Role Name</th>
              <th className="p-4 text-sm font-bold">Level</th>
              <th className="p-4 text-sm font-bold">Description</th>
              <th className="p-4 text-sm font-bold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rolesLoading ? (
              <tr>
                <td colSpan="4" className="p-12 text-center flex justify-center"><LoadingSpinner /></td>
              </tr>
            ) : filteredRoles?.length === 0 ? (
              <tr>
                <td colSpan="4" className="p-12 text-center text-slate-400 text-sm">No roles found.</td>
              </tr>
            ) : (
              filteredRoles?.map((role) => (
                <tr key={role.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 text-sm font-medium text-slate-900">{role.name.replace('_', ' ')}</td>
                  <td className="p-4 text-sm text-slate-600 font-bold">{role.level ?? 10}</td>
                  <td className="p-4 text-sm text-slate-600">{role.description || 'N/A'}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setViewingItem(role)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => handleOpenModal(role)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Edit">
                        <Edit3 size={16} />
                      </button>
                      <button onClick={() => handleDelete(role.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* VIEW MODAL */}
      <Modal
        isOpen={!!viewingItem}
        onClose={() => setViewingItem(null)}
        title="Full information of the role"
        maxWidth="max-w-6xl"
      >
        <div className="space-y-6 p-2">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{viewingItem?.name?.replace('_', ' ')}</h2>
            <p className="text-sm text-slate-500 mt-1">{viewingItem?.description}</p>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Permissions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(viewGroupedPermissions).map(([catName, perms]) => (
                <div key={catName} className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                  <h4 className="font-bold text-slate-900 mb-4 border-b pb-2 border-slate-200">{catName}</h4>
                  <ul className="space-y-2">
                    {perms.map(perm => (
                      <li key={perm.id} className="text-sm text-slate-600 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                        {perm.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* EDIT/CREATE MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? "Edit Role" : "Create Role"}
        onConfirm={handleSubmit}
        confirmText="Save"
        cancelText="Cancel"
        maxWidth="max-w-7xl"
        titleExtra={
          <div className="relative w-56">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search permissions..."
              className="w-full h-8 bg-slate-100 rounded-lg pl-8 pr-3 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-green-400 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        }
      >
        <div className="space-y-6 p-2 overflow-y-auto max-h-[78vh] custom-scrollbar pr-3">

          {/* ── ROW 1: Role Name · Authority Level · Description (horizontal) ── */}
          <div className="grid grid-cols-3 gap-4">
            {/* Role Name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-0.5">Role Name</label>
              <input
                type="text"
                placeholder="e.g. branch_admin"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full h-10 bg-slate-50 rounded-xl px-4 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-green-500 transition-all"
              />
            </div>

            {/* Authority Level */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-0.5">
                Authority Level <span className="text-slate-300">(max {currentUser?.role?.level ?? 10})</span>
              </label>
              <input
                type="number"
                min="0"
                max={currentUser?.role?.level ?? 10}
                placeholder="e.g. 10"
                value={formData.level ?? 10}
                onChange={e => {
                  const val = parseInt(e.target.value, 10);
                  const maxLevel = currentUser?.role?.level ?? 10;
                  setFormData({ ...formData, level: isNaN(val) ? '' : Math.min(val, maxLevel) });
                }}
                className="w-full h-10 bg-slate-50 rounded-xl px-4 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-green-500 transition-all"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-0.5">Description</label>
              <input
                type="text"
                placeholder="Define the role's responsibilities..."
                value={formData.description || ''}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full h-10 bg-slate-50 rounded-xl px-4 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-green-500 transition-all"
              />
            </div>
          </div>

          {/* ── ROW 2: Permissions (3-column grid) ── */}
          <div className="space-y-5 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-green-600" size={15} />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Permissions</h4>
            </div>

            {/* ⚠️ system:manage danger warning */}
            {isSystemManageSelected && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-xl p-4">
                <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={18} />
                <div>
                  <p className="text-sm font-bold text-red-700">⚠️ Dangerous Permission Selected: <code className="bg-red-100 px-1 rounded">system:manage</code></p>
                  <p className="text-xs text-red-600 mt-1 leading-relaxed">
                    This is the <strong>Master Key</strong> permission. It bypasses ALL security checks and grants global access to every feature in the system.
                    It should <strong>only</strong> be assigned to a role with Authority Level <strong>100</strong> (Super Admin tier).
                    Assigning it to any other role will be rejected by the server.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {Object.entries(groupedPermissions).map(([catName, { config, perms }]) => (
                <div key={catName} className="space-y-3">
                  {/* Category Header */}
                  <div
                    className="flex items-center gap-3 group/header cursor-pointer select-none"
                    onClick={() => handleGroupToggle(perms)}
                  >
                    <div className="w-7 h-7 bg-green-50 text-green-600 rounded-lg flex items-center justify-center shadow-sm shadow-green-100/50">
                      {config.icon}
                    </div>
                    <span className="text-xs font-bold text-slate-800 group-hover/header:text-green-600 transition-colors">{catName}</span>
                    <div className="flex-1 h-px bg-slate-100 group-hover/header:bg-green-100 transition-colors" />
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover/header:text-green-600 transition-colors">
                        {perms.every(p => formData.permission_ids?.includes(p.id))
                          ? 'Deselect All'
                          : perms.some(p => formData.permission_ids?.includes(p.id))
                          ? 'Select Remaining'
                          : 'Select All'}
                      </span>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                        perms.every(p => formData.permission_ids?.includes(p.id))
                          ? 'bg-green-600 text-white shadow-md shadow-green-200'
                          : perms.some(p => formData.permission_ids?.includes(p.id))
                          ? 'bg-green-100 text-green-600 border border-green-300'
                          : 'bg-slate-50 text-slate-300 border border-slate-200 group-hover/header:border-green-300'
                      }`}>
                        {perms.every(p => formData.permission_ids?.includes(p.id))
                          ? <CheckCircle2 size={12} />
                          : perms.some(p => formData.permission_ids?.includes(p.id))
                          ? <div className="w-1.5 h-1.5 rounded-sm bg-green-600" />
                          : <Plus size={12} className="opacity-0 group-hover/header:opacity-100 text-green-500 transition-opacity" />
                        }
                      </div>
                    </div>
                  </div>

                  {/* Permission Cards — 3 columns */}
                  <div className="grid grid-cols-3 gap-3">
                    {perms.map(perm => {
                      const active = formData.permission_ids?.includes(perm.id);
                      const isDangerous = perm.name === 'system:manage';
                      return (
                        <div
                          key={perm.id}
                          onClick={() => handlePermissionToggle(perm.id)}
                          className={`group p-3 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between ${
                            isDangerous && active
                              ? 'bg-red-50 border-red-400'
                              : isDangerous
                              ? 'bg-white border-red-200 hover:border-red-400'
                              : active
                              ? 'bg-green-50 border-green-400 text-green-700'
                              : 'bg-white border-slate-100 hover:border-green-200'
                          }`}
                        >
                          <div className="flex-1 min-w-0 mr-2">
                            <div className={`text-xs font-bold mb-0.5 truncate ${
                              isDangerous ? 'text-red-700' : active ? 'text-green-700' : 'text-slate-800'
                            }`}>
                              {isDangerous && '⚠️ '}{perm.name}
                            </div>
                            <div className="text-[11px] text-slate-400 leading-snug line-clamp-2">{perm.description || 'System Access Token'}</div>
                          </div>
                          <div className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center transition-all ${
                            isDangerous && active
                              ? 'bg-red-600 text-white'
                              : isDangerous
                              ? 'bg-red-50 text-red-300 group-hover:bg-red-100 group-hover:text-red-600'
                              : active
                              ? 'bg-green-600 text-white'
                              : 'bg-slate-100 text-slate-300 group-hover:bg-green-100 group-hover:text-green-600'
                          }`}>
                            {active ? <CheckCircle2 size={12} /> : <Plus size={12} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RoleManagement;
