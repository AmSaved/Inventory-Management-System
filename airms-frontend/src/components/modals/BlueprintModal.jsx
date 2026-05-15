import React, { useState } from 'react';
import Modal from '../common/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import productService from '../../services/productService';
import toast from 'react-hot-toast';
import { 
  Package, 
  Tag, 
  Layers, 
  Scale, 
  Hash, 
  Maximize2, 
  Cpu, 
  Save, 
  X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BlueprintModal = ({ isOpen, onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'General',
    unit: 'piece',
    is_active: true,
    sub_category: '',
    brand: '',
    model: '',
    weight: '',
    dimensions: '',
    color: '',
    material: '',
    processor: '',
    ram: '',
    storage: '',
    graphics: '',
    os: '',
    display: ''
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name || !formData.sku) {
      return toast.error('Identity Matrix Failure: Name and SKU are mandatory.');
    }

    const loadingToast = toast.loading('Committing Asset Blueprint...');
    setLoading(true);
    try {
      const newProduct = await productService.createProduct(formData);
      toast.success('Resource Deployed to Registry', { id: loadingToast });
      onCreated(newProduct);
      setFormData({
        name: '',
        sku: '',
        category: 'General',
        unit: 'piece',
        is_active: true
      });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transaction Aborted', { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="RESOURCE SPECIFICATION DECK"
      showFooter={false}
      maxWidth="max-w-5xl"
    >
      <div className="flex flex-col h-[75vh]">
        {/* TECHNICAL NAVIGATION */}
        <div className="flex items-center px-8 bg-slate-950 rounded-t-[2.5rem] border-b border-white/5 shrink-0">
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

        {/* CONTENT AREA */}
        <div className="p-10 overflow-y-auto bg-white flex-1 space-y-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'basic' && (
              <motion.div 
                key="basic"
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
                key="physical"
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
                key="technical"
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
        
        {/* FOOTER ACTIONS */}
        <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between rounded-b-[2.5rem] shrink-0">
           <label className="flex items-center gap-4 cursor-pointer group">
              <input type="checkbox" className="w-6 h-6 accent-blue-600 rounded-xl" checked={formData.is_active !== false} onChange={e => setFormData({...formData, is_active: e.target.checked})} />
              <div>
                 <span className="block text-[11px] font-black text-slate-900 uppercase tracking-widest group-hover:text-blue-600 transition-colors">ACTIVE DEPLOYMENT STATE</span>
                 <span className="block text-[9px] font-bold text-slate-400 uppercase italic opacity-60">Authorize use across institutional inventory</span>
              </div>
           </label>
           <div className="flex gap-4">
              <Button variant="ghost" onClick={onClose} className="px-8 h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-200" disabled={loading}>Abort</Button>
              <Button onClick={handleSubmit} disabled={loading} className="bg-slate-950 text-white px-10 h-14 rounded-2xl flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl">
                 <Save size={18} /> COMMIT TO DATABASE
              </Button>
           </div>
        </div>
      </div>
    </Modal>
  );
};

export default BlueprintModal;
