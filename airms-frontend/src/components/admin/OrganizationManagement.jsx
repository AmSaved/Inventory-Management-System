import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner';
import organizationService from '../../services/organizationService';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { 
  Network, 
  Layers, 
  Plus, 
  Trash2, 
  ChevronRight, 
  Building2, 
  MapPin, 
  ShieldCheck,
  Edit3,
  GitMerge,
  Box,
  LayoutGrid,
  Activity,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import Badge from '../ui/Badge';

const OrganizationManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [types, setTypes] = useState([]);
  
  const isSuperAdmin = user?.role?.level >= 100 || user?.role?.name?.toLowerCase().includes('super');
  const isOrgAdmin = user?.role?.level >= 90;

  const [nodeTree, setNodeTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [navigationStack, setNavigationStack] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [typeModalView, setTypeModalView] = useState('list');
  const [editingType, setEditingType] = useState(null);
  const [editingNode, setEditingNode] = useState(null);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [typesData, treeData] = await Promise.all([
        organizationService.getTypes(), 
        organizationService.getNodeTree()
      ]);
      setTypes(typesData);
      setNodeTree(treeData);

      const findNodeInTree = (nodes, id) => {
        for (const n of nodes) {
          if (n.id === id) return n;
          if (n.children?.length) {
            const found = findNodeInTree(n.children, id);
            if (found) return found;
          }
        }
        return null;
      };

      if (navigationStack.length > 0) {
        const updatedStack = [];
        for (const stackItem of navigationStack) {
          const freshNode = findNodeInTree(treeData, stackItem.id);
          if (freshNode) updatedStack.push(freshNode);
          else break;
        }
        setNavigationStack(updatedStack);
      }
    } catch (error) {
      toast.error('Protocol Error: Hierarchy Sync Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDrillDown = (node) => setNavigationStack([...navigationStack, node]);

  const handleBreadcrumbClick = (index) => {
    if (index === -1) setNavigationStack([]);
    else setNavigationStack(navigationStack.slice(0, index + 1));
  };

  const handleOpenNodeModal = (parent = null, node = null) => {
    setEditingNode(node);
    if (node) {
      setFormData(node);
    } else {
      const currentParent = parent || (navigationStack.length > 0 ? navigationStack[navigationStack.length - 1] : null);
      setFormData({
        parent_id: currentParent?.id || (user?.role?.level < 100 ? (user?.org_node_id || null) : null),
        org_type_id: '',
        can_store_inventory: false,
        name: '',
        code: ''
      });
    }
    setModalOpen(true);
  };

  const handleTypeSubmit = async (e) => {
    e?.preventDefault();
    const loadingToast = toast.loading('Calibrating Blueprint...');
    try {
      const payload = {
        ...formData,
        is_storage_allowed: formData.is_storage_allowed || false,
        is_department: formData.is_department || false,
        is_approval_unit: formData.is_approval_unit || false
      };

      if (editingType) {
        await organizationService.updateType(editingType.id, payload);
        toast.success('Blueprint Refined', { id: loadingToast });
      } else {
        await organizationService.createType(payload);
        toast.success('Blueprint Defined', { id: loadingToast });
      }
      
      setTypeModalView('list');
      setEditingType(null);
      fetchData();
    } catch (error) {
      toast.error('Calibration Failed', { id: loadingToast });
    }
  };

  const handleDeleteType = async (id) => {
    if (!window.confirm('Terminate this classification blueprint?')) return;
    try {
      await organizationService.deleteType(id);
      toast.success('Blueprint Expunged');
      fetchData();
    } catch (error) {
      toast.error('Termination Aborted: Node Dependencies Detected');
    }
  };

  const handleNodeSubmit = async () => {
    const loadingToast = toast.loading('Committing Node Geometry...');
    try {
      if (editingNode) {
        await organizationService.updateNode(editingNode.id, formData);
        toast.success(`Node Updated`, { id: loadingToast });
      } else {
        await organizationService.createNode(formData);
        toast.success(`Node Deployed`, { id: loadingToast });
      }
      setModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Protocol Failure', { id: loadingToast });
    }
  };

  const handleDeleteNode = async (id) => {
    if (!window.confirm('Terminate this node? All sub-nodes must be clear.')) return;
    try {
      await organizationService.deleteNode(id);
      toast.success('Node Decommissioned');
      fetchData();
    } catch (error) {
      toast.error('Decommissioning Failure: Active Sub-Nodes Detected');
    }
  };

  const currentNodes = navigationStack.length === 0 
    ? nodeTree 
    : navigationStack[navigationStack.length - 1].children || [];

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      {/* HEADER SECTION */}
      <div className="bg-white/80 backdrop-blur-2xl rounded-[3rem] p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] border border-white/50 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-10">
        <div className="flex items-center gap-8">
           <div className="w-20 h-20 bg-slate-950 rounded-[30px] flex items-center justify-center shadow-2xl rotate-3 group hover:rotate-0 transition-transform duration-500 shrink-0">
              <Network className="text-blue-400 group-hover:scale-110 transition-transform" size={32} />
           </div>
           <div>
              <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
                Hierarchy
              </h1>
           </div>
        </div>
        <div className="flex flex-wrap gap-4">
           {isOrgAdmin && (
             <Button 
               variant="outline"
               onClick={() => setTypeModalOpen(true)}
               className="bg-white/50 backdrop-blur-md border-slate-200 text-slate-900 h-16 px-8 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-slate-950 hover:text-white transition-all shadow-sm"
             >
               <Layers size={18} className="mr-3" /> Node Templates
             </Button>
           )}
           
           {isOrgAdmin && (
             <Button 
               onClick={() => handleOpenNodeModal()}
               className="bg-slate-950 text-white h-16 px-10 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-blue-600 transition-all shadow-2xl shadow-blue-500/20"
             >
               <Plus size={18} className="mr-3" /> 
               {navigationStack.length > 0 ? 'Deploy Child Node' : (isSuperAdmin ? 'Deploy Root Org' : 'Deploy Sub-Unit')}
             </Button>
           )}
        </div>
      </div>

      {/* BREADCRUMB COMMAND BAR */}
      <div className="bg-white/40 backdrop-blur-md p-3 rounded-[2.5rem] border border-white/60 shadow-sm flex items-center overflow-x-auto no-scrollbar gap-2">
        <button 
          onClick={() => handleBreadcrumbClick(-1)}
          className={`flex items-center px-6 py-4 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest ${navigationStack.length === 0 ? 'bg-slate-950 text-white shadow-2xl' : 'text-slate-400 hover:bg-white/60'}`}
        >
          <LayoutGrid size={16} className="mr-3" /> {isSuperAdmin ? 'Institutional Root' : 'Main Level'}
        </button>
        {navigationStack.map((node, i) => (
          <React.Fragment key={node.id}>
            <div className="w-1.5 h-1.5 bg-slate-300 rounded-full flex-shrink-0" />
            <button 
              onClick={() => handleBreadcrumbClick(i)}
              className={`flex items-center px-6 py-4 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest whitespace-nowrap ${i === navigationStack.length - 1 ? 'bg-blue-600 text-white shadow-2xl' : 'text-slate-500 hover:bg-white/60'}`}
            >
              <MapPin size={16} className="mr-3" /> {node.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* NODE INSIGHT GRID */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
             <div className="w-2 h-8 bg-blue-600 rounded-full" />
             <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Hierarchical Sub-Nodes</h3>
          </div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] opacity-60">
            {currentNodes.length} Active Nodes in this Layer
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
           {currentNodes.map((node) => (
             <div 
               key={node.id} 
               className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.03)] hover:shadow-[0_24px_48px_rgba(0,0,0,0.08)] transition-all duration-500 group flex flex-col md:flex-row items-center justify-between gap-8"
             >
                <div className="flex items-center gap-8 w-full md:w-auto">
                   <div className="w-16 h-16 bg-slate-50 rounded-[22px] flex items-center justify-center shadow-inner group-hover:bg-blue-600 transition-colors duration-500 overflow-hidden relative">
                      <Building2 className="text-slate-400 group-hover:text-white transition-colors relative z-10" size={28} />
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                   </div>
                   <div className="flex-1 cursor-pointer group/name" onClick={() => navigate(`/dashboard?unit=${node.id}`)} title={`Switch to ${node.name} Dashboard`}>
                      <div className="flex items-center gap-3">
                         <h4 className="text-2xl font-black text-slate-900 tracking-tighter italic uppercase group-hover/name:text-blue-700 transition-colors border-b-2 border-transparent group-hover/name:border-blue-600/30">{node.name}</h4>
                         <Badge className="bg-blue-50 text-blue-600 border-none text-[8px] font-black uppercase px-2 py-0.5 rounded-lg">{node.type?.name}</Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100/50 px-2 py-1 rounded-md">CODE: {node.code}</span>
                         <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${node.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{node.status}</span>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                   <button 
                     onClick={() => handleDrillDown(node)}
                     className="flex items-center gap-3 px-6 py-4 bg-slate-950 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl group/btn"
                   >
                      Drill Down <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                   </button>
                   <div className="flex gap-2">
                      <button onClick={() => handleOpenNodeModal(node, null)} className="w-12 h-12 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all"><Plus size={20} /></button>
                      <button onClick={() => handleOpenNodeModal(null, node)} className="w-12 h-12 flex items-center justify-center bg-amber-50 text-amber-600 rounded-2xl hover:bg-amber-600 hover:text-white transition-all"><Edit3 size={20} /></button>
                      <button onClick={() => handleDeleteNode(node.id)} className="w-12 h-12 flex items-center justify-center bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-600 hover:text-white transition-all"><Trash2 size={20} /></button>
                   </div>
                </div>
             </div>
           ))}

           {currentNodes.length === 0 && (
             <div className="p-32 bg-white/40 backdrop-blur-md rounded-[4rem] border-2 border-dashed border-slate-200 flex flex-col items-center text-center">
                <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl flex items-center justify-center text-slate-200 mb-8">
                   <GitMerge size={48} />
                </div>
                <h4 className="text-2xl font-black text-slate-900 uppercase italic">Layer Initialized</h4>
                <p className="text-slate-400 font-medium max-w-sm mt-2">This hierarchy layer is currently empty. Ready for node deployment.</p>
                <Button 
                  onClick={() => handleOpenNodeModal()}
                  className="mt-10 bg-slate-950 text-white px-10 py-5 h-auto rounded-3xl font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl"
                >
                  {navigationStack.length > 0 ? 'Deploy First Sub-Node' : (isSuperAdmin ? 'Deploy First Root Org' : 'Deploy First Sub-Unit')}
                </Button>
             </div>
           )}
        </div>
      </div>

      {/* NODE DEPLOYMENT MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingNode ? "RECONFIGURE NODE" : "DEPLOY NODE"}
        onConfirm={handleNodeSubmit}
        confirmText="COMMIT PROTOCOL"
        cancelText="ABORT"
      >
        <div className="space-y-8 p-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input 
                label="Operational Name" 
                placeholder="e.g. Strategic Hub" 
                value={formData.name || ''} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
                className="bg-slate-50 border-none rounded-2xl h-14 font-black placeholder:text-slate-300"
              />
              <Input 
                label="Hierarchy Code" 
                placeholder="STRAT-01" 
                value={formData.code || ''} 
                onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})} 
                className="bg-slate-50 border-none rounded-2xl h-14 font-black placeholder:text-slate-300"
              />
            </div>
            
            <div className="space-y-3">
               <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 italic">Layer Classification</label>
               <select
                 className="w-full h-14 bg-slate-950 text-white rounded-2xl px-6 font-black text-xs uppercase tracking-widest outline-none border-b-4 border-blue-600 shadow-xl cursor-pointer"
                 value={formData.org_type_id || ''}
                 onChange={(e) => setFormData({...formData, org_type_id: e.target.value})}
               >
                 <option value="">Select Level Blueprint</option>
                 {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
               </select>
            </div>

            <label className="flex items-center gap-5 p-6 bg-slate-50 rounded-[2.5rem] cursor-pointer hover:bg-blue-50 transition-all group">
                <input 
                  type="checkbox" 
                  checked={formData.can_store_inventory || false} 
                  onChange={e => setFormData({...formData, can_store_inventory: e.target.checked})} 
                  className="w-6 h-6 accent-blue-600 rounded-full" 
                />
                <div>
                    <span className="block text-sm font-black text-slate-900 uppercase italic group-hover:text-blue-700">Inventory Storage Protocol</span>
                    <span className="block text-[10px] font-bold text-slate-400 mt-1 uppercase opacity-60">Enable physical asset assignment to this node</span>
                </div>
            </label>

            <div className="bg-slate-950 rounded-[2.5rem] p-8 relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-transparent"></div>
               <div className="relative z-10 flex items-center gap-6">
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-blue-400 border border-white/10">
                     <ShieldCheck size={24} />
                  </div>
                  <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest leading-relaxed">
                     Node will be anchored under <span className="text-white italic">{navigationStack.length > 0 ? navigationStack[navigationStack.length-1].name : 'System Root'}</span>
                  </p>
               </div>
            </div>
        </div>
      </Modal>

      {/* TYPES MODAL OVERHAUL */}
      <Modal
        isOpen={typeModalOpen}
        onClose={() => setTypeModalOpen(false)}
        title="LAYER BLUEPRINTS"
        onConfirm={typeModalView === 'list' ? () => { setFormData({}); setTypeModalView('form'); } : handleTypeSubmit}
        confirmText={typeModalView === 'list' ? "CREATE NEW BLUEPRINT" : "SAVE DEFINITION"}
      >
         <div className="space-y-6">
            {typeModalView === 'list' ? (
               <div className="grid grid-cols-1 gap-3">
                  <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100 flex items-start gap-4 mb-4">
                     <ShieldAlert className="text-blue-600 mt-1" size={20} />
                     <p className="text-[11px] text-slate-500 font-medium italic leading-relaxed">
                        Manage the global blueprints that define your hierarchy levels. Editing a type updates all nodes using it.
                     </p>
                  </div>
                  {types.map(t => (
                     <div key={t.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group hover:bg-slate-950 hover:text-white transition-all">
                        <div>
                           <div className="font-black uppercase italic text-xs">{t.name}</div>
                           <div className="text-[9px] font-black text-blue-500 uppercase tracking-widest opacity-60">ID CODE: {t.code_prefix}</div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => { setEditingType(t); setFormData(t); setTypeModalView('form'); }} className="p-2 bg-white/10 rounded-lg hover:bg-blue-600 transition-colors"><Edit3 size={14} /></button>
                           <button onClick={() => handleDeleteType(t.id)} className="p-2 bg-white/10 rounded-lg hover:bg-rose-600 transition-colors"><Trash2 size={14} /></button>
                        </div>
                     </div>
                  ))}
               </div>
            ) : (
               <div className="space-y-6 animate-in slide-in-from-right-4">
                  <div className="grid grid-cols-2 gap-4">
                     <Input label="Blueprint Name" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-slate-50 border-none rounded-xl font-black" />
                     <Input label="ID Prefix" value={formData.code_prefix || ''} onChange={e => setFormData({...formData, code_prefix: e.target.value.toUpperCase()})} className="bg-slate-50 border-none rounded-xl font-black" />
                  </div>
                  
                  <div className="space-y-3 pt-2">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Capabilities</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center gap-3 p-4 border rounded-2xl cursor-pointer hover:bg-slate-50 group">
                            <input type="checkbox" checked={formData.is_storage_allowed || false} onChange={e => setFormData({...formData, is_storage_allowed: e.target.checked})} className="w-4 h-4 accent-blue-600" />
                            <span className="text-xs font-black text-slate-700 uppercase tracking-tighter group-hover:text-blue-600 transition-colors">Storage</span>
                        </label>
                        <label className="flex items-center gap-3 p-4 border rounded-2xl cursor-pointer hover:bg-slate-50 group">
                            <input type="checkbox" checked={formData.is_department || false} onChange={e => setFormData({...formData, is_department: e.target.checked})} className="w-4 h-4 accent-blue-600" />
                            <span className="text-xs font-black text-slate-700 uppercase tracking-tighter group-hover:text-blue-600 transition-colors">Logical Unit</span>
                        </label>
                      </div>
                  </div>
                  
                  <Button onClick={() => setTypeModalView('list')} variant="ghost" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Back to Library</Button>
               </div>
            )}
         </div>
      </Modal>
    </div>
  );
};

export default OrganizationManagement;
