import React, { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import roleService from '../services/roleService';
import permissionService from '../services/permissionService';
import organizationService from '../services/organizationService';
import toast from 'react-hot-toast';
import {
  Shield,
  Plus,
  Search,
  Trash2,
  Edit3,
  Lock,
  ShieldCheck
} from 'lucide-react';
import { motion } from 'framer-motion';

const RolesPage = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    level: 0,
    permission_ids: [],
    org_node_id: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Pass parameters as an object, not a string
      const params = { only_mine: 'true' };

      const [rolesData, permsData, nodesData] = await Promise.all([
        roleService.getAllRoles(params),
        permissionService.getAllPermissions(),
        organizationService.getNodes()
      ]);
      setRoles(rolesData.data || []);
      setAllPermissions(Array.isArray(permsData) ? permsData : permsData.data || []);
      setNodes(nodesData || []);
    } catch (error) {
      toast.error('Failed to load role management data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (role = null) => {
    setEditingRole(role);
    if (role) {
      setFormData({
        name: role.name,
        description: role.description || '',
        level: role.level || 0,
        permission_ids: role.permissions?.map(p => p.id) || [],
        org_node_id: role.org_node_id || ''
      });
    } else {
      setFormData({
        name: '',
        description: '',
        level: 0,
        permission_ids: [],
        org_node_id: ''
      });
    }
    setModalOpen(true);
  };

  const togglePermission = (permId) => {
    setFormData(prev => ({
      ...prev,
      permission_ids: prev.permission_ids.includes(permId)
        ? prev.permission_ids.filter(id => id !== permId)
        : [...prev.permission_ids, permId]
    }));
  };

  const handleSubmit = async () => {
    try {
      if (editingRole) {
        await roleService.updateRole(editingRole.id, formData);
        toast.success('Role updated successfully');
      } else {
        await roleService.createRole(formData);
        toast.success('New blueprint established');
      }
      setModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Operation failed: Access registry rejection');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure?')) return;
    try {
      await roleService.deleteRole(id);
      toast.success('Security protocol revoked');
      fetchData();
    } catch (error) {
      toast.error('Failed to remove role');
    }
  };

  const filteredRoles = (roles || []).filter(r =>
    (r.name?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (r.description?.toLowerCase() || '').includes(search.toLowerCase())
  );




  const groupedPermissions = allPermissions.reduce((acc, perm) => {
    const group = perm.resource || 'System';
    if (!acc[group]) acc[group] = [];
    acc[group].push(perm);
    return acc;
  }, {});

  return (
    <div className="max-w-7xl mx-auto space-y-5 py-2 px-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
            <Shield size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-green-700">Roles Management</h1>
          </div>
        </div>
        <Button
          onClick={() => handleOpenModal()}
          className="bg-green-600 text-white h-9 px-4 rounded-lg font-bold text-sm hover:bg-green-700 transition-all shadow-sm"
        >
          + Define New Role
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-full max-w-md">
          <Input
            placeholder="Search roles..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchValue); }}
            className="bg-gray-50 border-none shadow-inner"
          />
        </div>
        <span className="text-sm text-slate-400">{filteredRoles.length} role{filteredRoles.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
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
            {loading ? (
              <tr>
                <td colSpan="4" className="p-12 text-center flex justify-center"><LoadingSpinner /></td>
              </tr>
            ) : filteredRoles.length === 0 ? (
              <tr>
                <td colSpan="4" className="p-12 text-center text-slate-400 text-sm">No roles found.</td>
              </tr>
            ) : (
              filteredRoles.map((role) => (
                <tr key={role.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 text-sm font-medium text-slate-900">{role.name.replace(/_/g, ' ')}</td>
                  <td className="p-4 text-sm text-slate-600">Level {role.level}</td>
                  <td className="p-4 text-sm text-slate-600">{role.description || '—'}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
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

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRole ? "Edit Blueprint" : "Establish New Blueprint"}
        onConfirm={handleSubmit}
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar pr-2">
          <Input label="Protocol Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="bg-slate-50 border-none rounded-2xl h-14" />
          <Input label="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="bg-slate-50 border-none rounded-2xl h-14" />

          <div className="space-y-8 pt-8 border-t-2 border-slate-50">
            <div className="flex items-center justify-between px-2">
               <div className="space-y-1">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Security Matrix</label>
                  <h3 className="text-xl font-black text-slate-900 italic uppercase tracking-tight leading-none">Permissions Registry</h3>
               </div>
               <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">{formData.permission_ids.length} Active Modules</span>
               </div>
            </div>

            <div className="space-y-10">
              {Object.entries(groupedPermissions).map(([resource, perms]) => (
                <div key={resource} className="space-y-5">
                  <div className="flex items-center gap-3 border-b-2 border-slate-50 pb-3">
                     <div className="w-8 h-8 bg-slate-950 rounded-xl flex items-center justify-center shadow-lg">
                        <ShieldCheck size={16} className="text-emerald-400" />
                     </div>
                     <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">
                       {resource} <span className="text-slate-400">Protocol Group</span>
                     </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {perms.map(perm => {
                      const isActive = formData.permission_ids.includes(perm.id);
                      return (
                        <div
                          key={perm.id}
                          onClick={() => togglePermission(perm.id)}
                          className={`group p-5 rounded-[24px] border-2 cursor-pointer transition-all duration-300 relative overflow-hidden ${isActive
                            ? 'bg-emerald-50/50 border-emerald-500 shadow-xl shadow-emerald-100/50 scale-[1.02]'
                            : 'bg-white border-slate-100 hover:border-emerald-200 hover:shadow-md'
                          }`}
                        >
                          {/* Background Glow */}
                          {isActive && <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-100/50 blur-2xl rounded-full" />}
                          
                          <div className="flex items-start gap-4 relative z-10">
                            {/* The "Right Sign" Box */}
                            <div className={`mt-1 w-7 h-7 rounded-[10px] border-2 flex items-center justify-center transition-all duration-500 shrink-0 ${isActive 
                              ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-200 rotate-0' 
                              : 'bg-slate-50 border-slate-200 group-hover:border-emerald-300 rotate-45'
                            }`}>
                              {isActive && (
                                <motion.svg 
                                  initial={{ scale: 0, rotate: -45 }}
                                  animate={{ scale: 1, rotate: 0 }}
                                  className="w-4 h-4 text-white" 
                                  fill="none" 
                                  viewBox="0 0 24 24" 
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                                </motion.svg>
                              )}
                            </div>

                            <div className="space-y-1">
                              <span className={`text-[11px] font-black uppercase tracking-tighter block transition-colors ${isActive ? 'text-emerald-900' : 'text-slate-700'}`}>
                                {perm.name.split(':')[1] || perm.name}
                              </span>
                              <span className={`text-[9px] font-bold leading-relaxed block transition-colors ${isActive ? 'text-emerald-700/70' : 'text-slate-400'}`}>
                                {perm.description || 'Institutional security permission'}
                              </span>
                            </div>
                          </div>

                          {/* Permission Tag */}
                          <div className={`absolute top-4 right-4 text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${isActive ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>
                             {perm.name}
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

export default RolesPage;
