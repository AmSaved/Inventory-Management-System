import React, { useState, useMemo } from 'react';
import { useFetch } from '../../hooks/useFetch';
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

const RoleManagement = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: roles, loading: rolesLoading, refetch: refetchRoles } = useFetch('/roles');
  const { data: permissions, loading: permsLoading } = useFetch('/permissions');

  const categoryMap = {
    'users': { name: 'Personnel Administration', icon: <Users size={16} />, color: 'blue' },
    'roles': { name: 'Access Architecture', icon: <ShieldCheck size={16} />, color: 'indigo' },
    'permissions': { name: 'Security Registry', icon: <Key size={16} />, color: 'slate' },
    'branches': { name: 'Institutional Hierarchy', icon: <Map size={16} />, color: 'emerald' },
    'products': { name: 'Global Product Catalog', icon: <Boxes size={16} />, color: 'amber' },
    'inventory': { name: 'Inventory Ledger Control', icon: <Package size={16} />, color: 'orange' },
    'requests': { name: 'Workflow Command Center', icon: <ClipboardList size={16} />, color: 'cyan' },
    'discharge': { name: 'Asset Deployment', icon: <Truck size={16} />, color: 'rose' },
    'assignments': { name: 'Resource Custody Matrix', icon: <Fingerprint size={16} />, color: 'violet' },
    'returns': { name: 'Reverse Logistics Registry', icon: <RotateCcw size={16} />, color: 'pink' },
    'transfers': { name: 'Inter-Unit Asset Movement', icon: <ArrowLeftRight size={16} />, color: 'purple' },
    'issues': { name: 'Incident & Discrepancy Tracking', icon: <AlertCircle size={16} />, color: 'red' },
    'reports': { name: 'Strategic Intelligence Analytics', icon: <BarChart3 size={16} />, color: 'teal' },
    'dashboard': { name: 'Real-Time Visualization', icon: <LayoutDashboard size={16} />, color: 'sky' },
    'settings': { name: 'System Core Settings', icon: <Settings size={16} />, color: 'slate' },
    'notifications': { name: 'Communication & Alerts', icon: <Bell size={16} />, color: 'yellow' },
    'audit': { name: 'Audit Trails & Security Logs', icon: <History size={16} />, color: 'neutral' },
    'system': { name: 'System Infrastructure', icon: <Cpu size={16} />, color: 'slate' },
    'workflow': { name: 'Command Workflow Engineering', icon: <Workflow size={16} />, color: 'indigo' },
    'items': { name: 'Logistics & Store Operations', icon: <Warehouse size={16} />, color: 'green' },
    'stock': { name: 'Logistics & Store Operations', icon: <Warehouse size={16} />, color: 'green' },
    'assets': { name: 'Advanced Asset Management', icon: <Layers size={16} />, color: 'emerald' },
    'hierarchy': { name: 'Master Governance', icon: <Crown size={16} />, color: 'fuchsia' },
    'organization': { name: 'Master Governance', icon: <Crown size={16} />, color: 'fuchsia' }
  };

  const handleOpenModal = (item = null) => {
    setEditingItem(item);
    setSearchTerm('');
    if (item) {
      setFormData({
        ...item,
        permission_ids: item.permissions?.map(p => p.id) || []
      });
    } else {
      setFormData({ name: '', description: '', level: 0, permission_ids: [] });
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

  const handleSubmit = async () => {
    if (!formData.name) return toast.error('Authority Label Required');
    const loadingToast = toast.loading('Engineering Authority Matrix...');
    setSubmitting(true);
    try {
      if (editingItem) {
        await roleService.updateRole(editingItem.id, formData);
        toast.success('Matrix Calibrated', { id: loadingToast });
      } else {
        await roleService.createRole(formData);
        toast.success('Authority Blueprint Deployed', { id: loadingToast });
      }
      refetchRoles();
      setModalOpen(false);
    } catch (error) {
      toast.error('Calibration Failure', { id: loadingToast });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Terminate this role blueprint?')) return;
    try {
      await roleService.deleteRole(id);
      refetchRoles();
      toast.success('Authorityblueprint expunged');
    } catch (error) {
      toast.error('Protocol Failure: Role in use');
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
      const resource = perm.resource || 'other';
      const category = categoryMap[resource] || { name: 'General Utilities', icon: <Info size={16} />, color: 'slate' };
      if (!acc[category.name]) {
        acc[category.name] = { config: category, perms: [] };
      }
      acc[category.name].perms.push(perm);
      return acc;
    }, {});
  }, [permissions, searchTerm]);

  if (rolesLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      {/* COMMAND HEADER */}
      <div className="bg-slate-950 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-transparent"></div>
        <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity duration-700">
           <ShieldCheck size={160} className="text-blue-400 rotate-12" />
        </div>
        
        <div className="relative z-10 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-10">
          <div className="space-y-3">
             <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-xl border border-white/20 rounded-[22px] flex items-center justify-center text-blue-400 shadow-2xl">
                   <ShieldCheck size={32} />
                </div>
                <div>
                   <div className="text-[11px] font-black text-blue-400 uppercase tracking-[0.4em] mb-1 italic">Security Engineering</div>
                   <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">Authority Matrix</h1>
                </div>
             </div>
             <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] ml-20 italic opacity-80">Institutional Permission Orchestration & Role Blueprints</p>
          </div>
          <Button 
            onClick={() => handleOpenModal()} 
            className="bg-blue-600 text-white h-16 px-10 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-white hover:text-slate-950 transition-all shadow-2xl shadow-blue-500/20"
          >
            <Plus size={18} className="mr-3" /> Create Authority Blueprint
          </Button>
        </div>
      </div>

      {/* ROLE INSIGHT GRID */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-6">
           <div className="flex items-center gap-4">
              <div className="w-2 h-8 bg-blue-600 rounded-full" />
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Blueprint Registry</h3>
           </div>
           <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] opacity-60">
             {roles?.length || 0} Calibrated Archetypes
           </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
           {roles?.map((role) => (
             <div 
               key={role.id} 
               className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.03)] hover:shadow-[0_24px_48px_rgba(0,0,0,0.08)] transition-all duration-500 group flex flex-col xl:flex-row items-center justify-between gap-8"
             >
                <div className="flex items-center gap-8 w-full xl:w-auto">
                   <div className="w-16 h-16 bg-slate-50 rounded-[22px] flex items-center justify-center text-slate-400 group-hover:bg-slate-950 group-hover:text-blue-400 transition-all duration-500 shadow-inner relative overflow-hidden">
                      <ShieldCheck className="relative z-10" size={28} />
                      <div className="absolute inset-0 bg-slate-950 opacity-0 group-hover:opacity-100 transition-opacity" />
                   </div>
                   <div>
                      <h4 className="text-lg font-black text-slate-900 tracking-tighter italic uppercase group-hover:text-blue-700 transition-colors">{role.name.replace('_', ' ')}</h4>

                   </div>
                </div>

                <div className="flex-1 max-w-xl">
                   <p className="text-xs font-bold text-slate-500 italic leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">
                      "{role.description || 'System-defined operational boundary for resource management and decision-making flow.'}"
                   </p>
                </div>

                <div className="flex items-center gap-4">
                   <div className="px-5 py-3 bg-slate-100/50 rounded-2xl flex flex-col items-center justify-center">
                      <span className="text-[14px] font-black text-slate-900">{role.permissions?.length || 0}</span>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Capabilities</span>
                   </div>
                   <div className="flex gap-2">
                      <button onClick={() => handleOpenModal(role)} className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-950 hover:text-white transition-all shadow-sm"><Edit3 size={20} /></button>
                      <button onClick={() => handleDelete(role.id)} className="w-12 h-12 flex items-center justify-center bg-rose-50 text-rose-400 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"><Trash2 size={20} /></button>
                   </div>
                </div>
             </div>
           ))}
        </div>
      </div>

      {/* AUTHORITY MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="CALIBRATE AUTHORITY BLUEPRINT"
        onConfirm={handleSubmit}
        confirmText="DEPLOY MATRIX"
        cancelText="ABORT"
        maxWidth="max-w-7xl"
      >
        <div className="space-y-10 p-2 overflow-y-auto max-h-[75vh] custom-scrollbar pr-4">
            {/* CORE SETTINGS */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
               <div className="xl:col-span-1 space-y-6">
                  <div className="flex items-center gap-3 px-1">
                     <Zap className="text-blue-600" size={18} />
                     <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em]">Core Parameters</h4>
                  </div>
                  <Input label="Authority Label" placeholder="e.g. strategic_commander" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-slate-50 border-none h-14 rounded-2xl font-black" />
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 italic">Functional Brief</label>
                     <textarea 
                        className="w-full h-32 bg-slate-50 border-none rounded-2xl p-6 font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all resize-none" 
                        placeholder="Define the operational scope..." 
                        value={formData.description || ''} 
                        onChange={e => setFormData({...formData, description: e.target.value})}
                     />
                  </div>
               </div>

               {/* PERMISSION MATRIX */}
               <div className="xl:col-span-2 space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
                     <div className="flex items-center gap-3">
                        <Activity className="text-blue-600" size={18} />
                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em]">Capability Catalog</h4>
                     </div>
                     <div className="relative group w-full md:w-64">
                        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600" />
                        <input type="text" placeholder="SEARCH CAPABILITIES..." className="w-full h-10 bg-slate-50 rounded-xl pl-10 pr-4 font-black text-[9px] text-slate-900 uppercase tracking-widest outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                     </div>
                  </div>

                  <div className="space-y-12">
                     {Object.entries(groupedPermissions).map(([catName, { config, perms }]) => (
                        <div key={catName} className="space-y-6">
                           <div className="flex items-center gap-4">
                              <div className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center text-xs shadow-xl">{config.icon}</div>
                              <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest italic">{catName} Layer</span>
                              <div className="flex-1 h-px bg-slate-100" />
                           </div>
                           
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {perms.map(perm => {
                                 const active = formData.permission_ids?.includes(perm.id);
                                 return (
                                    <div 
                                       key={perm.id} 
                                       onClick={() => handlePermissionToggle(perm.id)}
                                       className={`group p-5 rounded-[2rem] border-2 transition-all duration-300 cursor-pointer flex items-center justify-between ${active ? 'bg-slate-950 border-slate-950 text-white shadow-2xl' : 'bg-white border-slate-100 hover:border-blue-200'}`}
                                    >
                                       <div className="flex-1">
                                          <div className={`text-[9px] font-black uppercase tracking-widest mb-1 ${active ? 'text-blue-400' : 'text-slate-400'}`}>{perm.name}</div>
                                          <div className="text-xs font-black tracking-tight leading-tight uppercase italic">{perm.description?.split('.')[0] || 'System Access Token'}</div>
                                       </div>
                                       <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-blue-600 text-white rotate-0' : 'bg-slate-50 text-slate-300 rotate-45 group-hover:rotate-0 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                                          {active ? <CheckCircle2 size={18} /> : <Plus size={18} />}
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
        </div>
      </Modal>
    </div>
  );
};

export default RoleManagement;
