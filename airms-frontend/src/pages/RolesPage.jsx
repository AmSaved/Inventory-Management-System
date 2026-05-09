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
    (r.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (r.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  if (loading) return <LoadingSpinner />;

  const groupedPermissions = allPermissions.reduce((acc, perm) => {
    const group = perm.resource || 'System';
    if (!acc[group]) acc[group] = [];
    acc[group].push(perm);
    return acc;
  }, {});

  return (
    <div className="max-w-[1500px] mx-auto space-y-12 py-12 px-6 animate-fade-in text-slate-900">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 border-b-2 border-slate-50 pb-12">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-slate-950 rounded-[32px] flex items-center justify-center shadow-2xl">
            <Shield className="text-blue-400" size={32} />
          </div>
          <div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic">Access Blueprints</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] ml-1">Registered by Super Admin</p>
          </div>
        </div>
        <Button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 text-white h-16 px-10 rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl"
        >
          <Plus size={18} className="mr-3" /> Define New Role
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-center">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search roles..."
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
                <th className="p-8 text-[10px] font-black text-slate-500 uppercase tracking-widest">Role Name</th>
                <th className="p-8 text-[10px] font-black text-slate-500 uppercase tracking-widest">Role Description</th>
                <th className="p-8 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredRoles.map((role) => (
                <tr key={role.id} className="group hover:bg-slate-50/80 transition-all duration-300">
                  <td className="p-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl border-2 border-slate-100 flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:border-blue-200 transition-all">
                        <Lock className="text-slate-400 group-hover:text-blue-500" size={20} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-sm tracking-tight">{role.name}</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">LVL-{role.level} Access</p>
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-sm tracking-tight">{role.description}</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">LVL-{role.level} Access</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-8 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <Button variant="ghost" onClick={() => handleOpenModal(role)} className="h-12 w-12 p-0 rounded-2xl bg-amber-50 text-amber-600 border-2 border-amber-100"><Edit3 size={18} /></Button>
                      <Button variant="ghost" onClick={() => handleDelete(role.id)} className="h-12 w-12 p-0 rounded-2xl bg-rose-50 text-rose-600 border-2 border-rose-100"><Trash2 size={18} /></Button>
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
        title={editingRole ? "Edit Blueprint" : "Establish New Blueprint"}
        onConfirm={handleSubmit}
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar pr-2">
          <Input label="Protocol Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="bg-slate-50 border-none rounded-2xl h-14" />
          <Input label="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="bg-slate-50 border-none rounded-2xl h-14" />

          <div className="space-y-8 pt-8 border-t-2 border-slate-50">
            <div className="flex items-center justify-between px-2">
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Security Matrix</label>
                  <h3 className="text-xl font-black text-slate-900 italic uppercase tracking-tight leading-none">Permissions Registry</h3>
               </div>
               <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">{formData.permission_ids.length} Active Modules</span>
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
