import React, { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Badge from '../ui/Badge';
import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner';
import productService from '../../services/productService';
import toast from 'react-hot-toast';
import { 
  Box, 
  Plus, 
  Settings2, 
  Trash2, 
  Edit, 
  Save, 
  Package, 
  Tag, 
  Layers, 
  Cpu, 
  MapPin, 
  Database,
  Zap,
  Activity,
  HardDrive,
  Monitor,
  Maximize2,
  Minimize2,
  LayoutGrid,
  List,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ProductManagement = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [viewMode, setViewMode] = useState('table'); // Forced table view

  const { data: productsData, loading, refetch } = useFetch('/products', { params: { limit: 1000 } });
  const products = productsData?.products || productsData?.data || [];

  const handleOpenModal = (item = null) => {
    setEditingItem(item);
    setFormData(item || { unit: 'piece', is_active: true });
    setActiveTab('basic');
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const loadingToast = toast.loading('Committing Asset Blueprint...');
    setSubmitting(true);
    try {
      if (editingItem) {
        await productService.updateProduct(editingItem.id, formData);
        toast.success('Blueprint Calibrated', { id: loadingToast });
      } else {
        await productService.createProduct(formData);
        toast.success('Resource Deployed to Registry', { id: loadingToast });
      }
      refetch();
      setModalOpen(false);
    } catch (error) {
      toast.error('Transaction Aborted', { id: loadingToast });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Expunge this asset blueprint from the global catalog?')) return;
    try {
      await productService.deleteProduct(id);
      toast.success('Blueprint Wiped');
      refetch();
    } catch (error) {
      toast.error('Deletion Restricted: Active Dependencies');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      {/* CATALOG HEADER */}
      <div className="bg-slate-950 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-transparent"></div>
        <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity duration-700">
           <Database size={160} className="text-blue-400 -rotate-12" />
        </div>
        
        <div className="relative z-10 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-10">
          <div className="space-y-3">
             <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-xl border border-white/20 rounded-[22px] flex items-center justify-center text-blue-400 shadow-2xl">
                   <Layers size={32} />
                </div>
                <div>
                   <div className="text-[11px] font-black text-blue-400 uppercase tracking-[0.4em] mb-1 italic">Resource Catalog</div>
                   <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">Master Registry</h1>
                </div>
             </div>
             <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] ml-20 italic opacity-80">Global Product Blueprints & Technical Specifications</p>
          </div>
          <div className="flex items-center gap-4">
             <Button 
                onClick={() => handleOpenModal()} 
                className="bg-blue-600 text-white h-16 px-10 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-white hover:text-slate-950 transition-all shadow-2xl shadow-blue-500/20"
              >
                <Plus size={18} className="mr-3" /> New Asset Template
              </Button>
          </div>
        </div>
      </div>

      {/* PRODUCT INSIGHT GRID */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-6">
           <div className="flex items-center gap-4">
              <div className="w-2 h-8 bg-blue-600 rounded-full" />
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Blueprint Repository</h3>
           </div>
           <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] opacity-60">
             {products.length} Validated Templates
           </div>
        </div>

        {products.length > 0 ? (
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
             <table className="w-full text-left">
                <thead>
                   <tr className="bg-slate-50/50 border-b-2 border-slate-100">
                      <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Actions</th>
                      <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Blueprint ID</th>
                      <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identity</th>
                      <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Classification</th>
                      <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {products.map(p => (
                      <tr key={p.id} className="group hover:bg-slate-50/80 transition-all">
                         <td className="p-8 text-left">
                            <div className="flex gap-2">
                               <button onClick={() => handleOpenModal(p)} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-950 hover:text-white transition-all shadow-sm"><Edit size={16} /></button>
                               <button onClick={() => handleDelete(p.id)} className="p-2.5 bg-rose-50 text-rose-400 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"><Trash2 size={16} /></button>
                            </div>
                         </td>
                         <td className="p-8 font-mono text-[10px] font-bold text-blue-600">{p.sku}</td>
                         <td className="p-8">
                            <div className="font-black text-slate-900 text-sm uppercase italic">{p.name}</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{p.brand} {p.model}</div>
                         </td>
                         <td className="p-8">
                            <Badge className="bg-blue-50 text-blue-600 border-none text-[8px] font-black uppercase px-2 py-1 rounded-lg">{p.category}</Badge>
                         </td>
                         <td className="p-8 text-xs font-black text-slate-500 uppercase">{p.unit}</td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
        ) : (
          <div className="p-32 bg-white/40 backdrop-blur-md rounded-[4rem] border-2 border-dashed border-slate-200 flex flex-col items-center text-center">
             <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl flex items-center justify-center text-slate-200 mb-8">
                <Layers size={48} />
             </div>
             <h4 className="text-2xl font-black text-slate-900 uppercase italic">Lexicon Initialized</h4>
             <p className="text-slate-400 font-medium max-w-sm mt-2">No asset templates have been defined in the global registry yet.</p>
             <Button 
               onClick={() => handleOpenModal()}
               className="mt-10 bg-slate-950 text-white px-10 py-5 h-auto rounded-3xl font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl"
             >
               Deploy First Blueprint
             </Button>
          </div>
        )}
      </div>

      {/* SPECIFICATION DECK MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="RESOURCE SPECIFICATION DECK"
        onConfirm={handleSubmit}
        confirmText="COMMIT TO DATABASE"
        cancelText="ABORT"
        maxWidth="max-w-5xl"
      >
        <div className="flex flex-col h-[70vh]">
          {/* TECHNICAL NAVIGATION */}
          <div className="flex items-center px-8 bg-slate-950 rounded-t-[2.5rem] border-b border-white/5">
            {[
              { id: 'basic', label: 'IDENTITY MATRIX', icon: <Tag size={16} /> },
              { id: 'physical', label: 'PHYSICAL ENVELOPE', icon: <Maximize2 size={16} /> },
              { id: 'technical', label: 'TECHNICAL ARCHITECTURE', icon: <Cpu size={16} /> }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-3 px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${
                  activeTab === t.id ? 'text-blue-400' : 'text-slate-500 hover:text-white'
                }`}
              >
                {t.icon} {t.label}
                {activeTab === t.id && (
                  <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                )}
              </button>
            ))}
          </div>

          <div className="p-10 overflow-y-auto bg-white flex-1 space-y-8 custom-scrollbar">
            <AnimatePresence mode="wait">
              {activeTab === 'basic' && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-2 gap-8">
                     <Input label="Registry SKU" value={formData.sku || ''} onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })} className="bg-slate-50 border-none h-14 rounded-2xl font-black" placeholder="IT-HW-000" />
                     <Input label="Resource Name" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="bg-slate-50 border-none h-14 rounded-2xl font-black" placeholder="High Performance Workstation" />
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                     <Input label="Category" value={formData.category || ''} onChange={e => setFormData({ ...formData, category: e.target.value })} className="bg-slate-50 border-none h-14 rounded-2xl font-black" />
                     <Input label="Sub-Category" value={formData.sub_category || ''} onChange={e => setFormData({ ...formData, sub_category: e.target.value })} className="bg-slate-50 border-none h-14 rounded-2xl font-black" />
                  </div>
                  <div className="grid grid-cols-3 gap-8">
                     <Input label="Brand" value={formData.brand || ''} onChange={e => setFormData({ ...formData, brand: e.target.value })} className="bg-slate-50 border-none h-14 rounded-2xl font-black" />
                     <Input label="Model Ref" value={formData.model || ''} onChange={e => setFormData({ ...formData, model: e.target.value })} className="bg-slate-50 border-none h-14 rounded-2xl font-black" />
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 italic">UOM</label>
                        <select className="w-full h-14 bg-slate-50 border-none rounded-2xl px-6 font-black text-xs uppercase tracking-widest outline-none cursor-pointer" value={formData.unit || 'piece'} onChange={e => setFormData({ ...formData, unit: e.target.value })}>
                          <option value="piece">Piece (PC)</option>
                          <option value="box">Box (BX)</option>
                          <option value="set">Set (ST)</option>
                          <option value="kg">Kilogram (KG)</option>
                        </select>
                     </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'physical' && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-2 gap-8">
                     <Input label="Mass (Weight)" value={formData.weight || ''} onChange={e => setFormData({ ...formData, weight: e.target.value })} className="bg-slate-50 border-none h-14 rounded-2xl font-black" placeholder="0.00 kg" />
                     <Input label="Dimension Delta" value={formData.dimensions || ''} onChange={e => setFormData({ ...formData, dimensions: e.target.value })} className="bg-slate-50 border-none h-14 rounded-2xl font-black" placeholder="WxHxD cm" />
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                     <Input label="Primary Finish (Color)" value={formData.color || ''} onChange={e => setFormData({ ...formData, color: e.target.value })} className="bg-slate-50 border-none h-14 rounded-2xl font-black" />
                     <Input label="Material Composition" value={formData.material || ''} onChange={e => setFormData({ ...formData, material: e.target.value })} className="bg-slate-50 border-none h-14 rounded-2xl font-black" />
                  </div>
                </motion.div>
              )}

              {activeTab === 'technical' && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-2 gap-8">
                     <Input label="Computation Core (CPU)" value={formData.processor || ''} onChange={e => setFormData({ ...formData, processor: e.target.value })} className="bg-slate-50 border-none h-14 rounded-2xl font-black" />
                     <Input label="Memory Matrix (RAM)" value={formData.ram || ''} onChange={e => setFormData({ ...formData, ram: e.target.value })} className="bg-slate-50 border-none h-14 rounded-2xl font-black" />
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                     <Input label="Storage Array (Disk)" value={formData.storage || ''} onChange={e => setFormData({ ...formData, storage: e.target.value })} className="bg-slate-50 border-none h-14 rounded-2xl font-black" />
                     <Input label="Graphics Engine (GPU)" value={formData.graphics || ''} onChange={e => setFormData({ ...formData, graphics: e.target.value })} className="bg-slate-50 border-none h-14 rounded-2xl font-black" />
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                     <Input label="Operational OS" value={formData.os || ''} onChange={e => setFormData({ ...formData, os: e.target.value })} className="bg-slate-50 border-none h-14 rounded-2xl font-black" />
                     <Input label="Display Interface" value={formData.display || ''} onChange={e => setFormData({ ...formData, display: e.target.value })} className="bg-slate-50 border-none h-14 rounded-2xl font-black" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between rounded-b-[2.5rem]">
             <label className="flex items-center gap-4 cursor-pointer group">
                <input type="checkbox" className="w-6 h-6 accent-blue-600 rounded-xl" checked={formData.is_active !== false} onChange={e => setFormData({...formData, is_active: e.target.checked})} />
                <div>
                   <span className="block text-[11px] font-black text-slate-900 uppercase tracking-widest group-hover:text-blue-600 transition-colors">ACTIVE DEPLOYMENT STATE</span>
                   <span className="block text-[9px] font-bold text-slate-400 uppercase italic opacity-60">Authorize use across institutional inventory</span>
                </div>
             </label>
             <div className="flex gap-4">
                <Button variant="ghost" onClick={() => setModalOpen(false)} className="px-8 h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-200" disabled={submitting}>Abort</Button>
                <Button onClick={handleSubmit} disabled={submitting} className="bg-slate-950 text-white px-10 h-14 rounded-2xl flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl">
                   <Save size={18} /> {editingItem ? 'SYNC BLUEPRINT' : 'DEPLOY TO REGISTRY'}
                </Button>
             </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProductManagement;
