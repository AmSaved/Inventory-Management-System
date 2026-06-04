import React, { useState, useEffect } from 'react';
import Button from '../ui/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import DynamicFieldRenderer from '../common/DynamicFieldRenderer';
import productService from '../../services/productService';
import formService from '../../services/formService';
import toast from 'react-hot-toast';
import { 
  Layers, 
  Save, 
  ChevronLeft,
  Search,
  Box,
  ArrowRight,
  Zap,
  ListOrdered,
  Plus,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BlueprintModal = ({ isOpen, onClose, onCreated, editData, initialTemplate }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedBlueprintTemplate, setSelectedBlueprintTemplate] = useState(null);
  const [formData, setFormData] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  
  // Power Scan State
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkIds, setBulkIds] = useState('');

  // Reset or Sync on Open
  useEffect(() => {
    if (isOpen) {
      if (editData) {
        setFormData(editData.specifications || {});
        setIsBulkMode(false);
        if (editData.blueprint_template_id && templates.length > 0) {
            const selected = templates.find(t => t.id === parseInt(editData.blueprint_template_id));
            setSelectedBlueprintTemplate(selected || null);
        }
      } else if (initialTemplate) {
        // AUTO-DEPLOY LOGIC
        setSelectedBlueprintTemplate(initialTemplate);
        setFormData({});
        setIsBulkMode(false);
        setBulkIds('');
      } else {
        setFormData({});
        setIsBulkMode(false);
        setBulkIds('');
        setSelectedBlueprintTemplate(null);
      }
    }
  }, [isOpen, editData, templates, initialTemplate]);

  // Fetch Templates
  useEffect(() => {
    if (isOpen) {
      const fetchTemplates = async () => {
        try {
          const data = await formService.getAllTemplates();
          const blueprints = data.filter(t => t.module === 'blueprint');
          setTemplates(blueprints || []);
        } catch (err) {
          toast.error('Failed to load blueprints');
        } finally {
          setLoadingData(false);
        }
      };
      fetchTemplates();
    }
  }, [isOpen]);

  const handleTemplateSelect = (template) => {
    setSelectedBlueprintTemplate(template);
    setFormData({});
  };

  const updateField = (key, value) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    const keys = Object.keys(formData);
    if (keys.length === 0 && !isBulkMode) return toast.error('Please fill the asset details');

    // SMART LOGIC for Name/SKU
    const nameKey = keys.find(k => k.toLowerCase().includes('name')) || keys[0];
    const skuKey = keys.find(k => k.toLowerCase().includes('id') || k.toLowerCase().includes('sku')) || keys[1] || keys[0];

    const loadingToast = toast.loading(isBulkMode ? 'Processing Power Scan...' : 'Committing Dynamic Resource...');
    setLoading(true);

    try {
      if (isBulkMode) {
        // BULK LOGIC
        const idList = bulkIds.split('\n').map(id => id.trim()).filter(id => id);
        if (idList.length === 0) throw new Error('Please enter at least one ID for bulk registration');

        const products = idList.map(id => {
          // Clone the form data but replace the ID field with the unique one from the list
          const itemSpecs = { ...formData, [skuKey]: id };
          return {
            name: formData[nameKey] || 'Unnamed Asset',
            sku: id,
            blueprint_template_id: selectedBlueprintTemplate.id,
            specifications: itemSpecs,
            is_active: true,
            category: selectedBlueprintTemplate.name
          };
        });

        await productService.bulkCreateProducts(products);
        toast.success(`Power Scan Successful: ${products.length} Items Registered`, { id: loadingToast });
      } else {
        // SINGLE LOGIC
        const payload = {
          name: formData[nameKey] || 'Unnamed Asset',
          sku: formData[skuKey] || `RES-${Date.now().toString().slice(-6)}`,
          blueprint_template_id: selectedBlueprintTemplate.id,
          specifications: formData,
          is_active: true,
          category: selectedBlueprintTemplate.name
        };

        if (editData) {
          await productService.updateProduct(editData.id, payload);
          toast.success('Architecture Updated', { id: loadingToast });
        } else {
          await productService.createProduct(payload);
          toast.success('Resource Registered', { id: loadingToast });
        }
      }
      
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Registry Error: Check your Blueprint configuration', { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  const filteredBlueprints = templates.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      {/* Sliding Panel */}
      <div className="relative w-full max-w-3xl bg-white h-full shadow-[0_0_100px_rgba(0,0,0,0.2)] flex flex-col animate-in slide-in-from-right duration-500">
        
        {/* Premium Header */}
        <div className="p-8 border-b-2 border-slate-50 bg-slate-950 text-white relative overflow-hidden shrink-0">
           <div className="absolute top-0 right-0 p-4 opacity-10">
              <Layers size={120} className="rotate-12" />
           </div>
           
           <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Layers size={22} />
                 </div>
                 <div>
                    <h2 className="text-xl font-black tracking-tighter uppercase italic">
                      {selectedBlueprintTemplate ? `NEW ${selectedBlueprintTemplate.name.toUpperCase()}` : "SELECT ITEM BLUEPRINT"}
                    </h2>
                    <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase">Global Asset blueprints</p>
                 </div>
              </div>
              <button 
                onClick={onClose}
                className="p-3 bg-white/10 text-white/60 rounded-2xl hover:bg-red-500 hover:text-white transition-all active:scale-90"
              >
                <X size={20} />
              </button>
           </div>
        </div>

        {/* Content Area */}
        {loadingData ? (
           <div className="flex-1 flex flex-col items-center justify-center space-y-4 bg-slate-50">
              <LoadingSpinner size="xl" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading blueprint structures...</p>
           </div>
        ) : (
           <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50">
             <AnimatePresence mode="wait">
               {!selectedBlueprintTemplate ? (
                 <motion.div 
                   key="selector"
                   initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }}
                   className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar"
                 >
                   <div className="flex flex-col items-center text-center space-y-6">
                      <div className="w-16 h-16 bg-indigo-600 rounded-[24px] flex items-center justify-center text-white shadow-2xl shadow-indigo-200">
                         <Layers size={28} />
                      </div>
                      <div className="space-y-2">
                         <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Choose Resource DNA</h2>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Select a blueprint to generate your custom intake form</p>
                      </div>
                      
                      <div className="relative w-full max-w-md pt-2">
                         <input 
                           type="text" 
                           placeholder="SEARCH AVAILABLE BLUEPRINTS..." 
                           value={searchTerm}
                           onChange={(e) => setSearchTerm(e.target.value)}
                           className="w-full h-14 bg-white border-2 border-slate-100 rounded-2xl px-12 text-xs font-black uppercase tracking-widest outline-none focus:border-indigo-500 transition-all shadow-sm"
                         />
                         <Search className="absolute left-4 top-[58%] -translate-y-1/2 text-slate-300" size={16} />
                      </div>
                   </div>

                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {filteredBlueprints.map(t => (
                        <button 
                          key={t.id}
                          onClick={() => handleTemplateSelect(t)}
                          className="group relative p-6 bg-white border border-slate-100 rounded-[30px] hover:border-indigo-600 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 flex flex-col items-center text-center gap-4 overflow-hidden"
                        >
                           <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                           <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform relative z-10">
                              {t.icon || '📦'}
                           </div>
                           <div className="relative z-10">
                              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight italic">{t.name}</h4>
                              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest leading-relaxed opacity-80 line-clamp-2">
                                {t.description || `${t.schema?.length || 0} Dynamic Attributes`}
                              </p>
                           </div>
                           <div className="w-8 h-8 bg-slate-950 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                              <ArrowRight size={14} />
                           </div>
                        </button>
                      ))}
                   </div>

                   {filteredBlueprints.length === 0 && (
                     <div className="py-20 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                         <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
                             <Box size={32} />
                         </div>
                         <div className="space-y-2">
                             <p className="text-xs font-black uppercase tracking-widest text-slate-400">No Architectures Defined</p>
                             <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">You must design your DNA in the manager first</p>
                         </div>
                         <Button 
                             onClick={() => onClose()}
                             className="bg-indigo-600 text-white px-6 h-12 rounded-xl text-[9px] font-black uppercase tracking-widest mx-auto"
                         >
                             Go to Architecture Designer
                         </Button>
                     </div>
                   )}
                 </motion.div>
               ) : (
                 <motion.div 
                   key="form"
                   initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                   className="flex-1 flex flex-col h-full overflow-hidden"
                 >
                   {/* STICKY SUB-HEADER */}
                   <div className="px-8 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
                       <div className="flex items-center gap-4">
                          <button 
                            onClick={() => setSelectedBlueprintTemplate(null)}
                            className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-950 hover:text-white transition-all shadow-sm"
                          >
                             <ChevronLeft size={18} />
                          </button>
                          <div>
                             <div className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.3em] mb-0.5 italic">Active Blueprint</div>
                             <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter italic leading-none">{selectedBlueprintTemplate.name}</h3>
                          </div>
                       </div>
                       
                       {/* POWER SCAN TOGGLE */}
                       <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                           <button 
                             onClick={() => setIsBulkMode(false)}
                             className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${!isBulkMode ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-400'}`}
                           >
                              <Plus size={12} /> Single
                           </button>
                           <button 
                             onClick={() => setIsBulkMode(true)}
                             className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${isBulkMode ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}
                           >
                              <Zap size={12} /> Power Scan
                           </button>
                       </div>
                   </div>

                   {/* DYNAMIC FORM SCROLL AREA */}
                   <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/30">
                     <div className="max-w-3xl mx-auto space-y-8">
                         
                         {isBulkMode && (
                             <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
                                <div className="flex items-center gap-3 px-1">
                                    <div className="w-1 h-3 bg-indigo-600 rounded-full" />
                                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Bulk Identifier List</h4>
                                </div>
                                <div className="relative">
                                    <textarea 
                                      placeholder="Scan or paste Serial Numbers here... (One per line)"
                                      value={bulkIds}
                                      onChange={(e) => setBulkIds(e.target.value)}
                                      className="w-full min-h-[140px] p-6 bg-white border-2 border-slate-100 rounded-2xl font-mono text-xs font-bold text-slate-600 outline-none focus:border-indigo-500 transition-all shadow-sm resize-none"
                                    />
                                    <div className="absolute right-4 bottom-4 flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                                       <ListOrdered size={12} className="text-slate-400" />
                                       <span className="text-[9px] font-black text-slate-600">{bulkIds.split('\n').filter(id => id.trim()).length} Detected</span>
                                    </div>
                                </div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest px-1 italic">
                                    * The system will create one unique asset for every serial number in this list using the shared specs below.
                                </p>
                             </div>
                         )}

                         <div className="space-y-4">
                             <div className="flex items-center gap-3 px-1">
                                 <div className="w-1.5 h-3 bg-slate-950 rounded-full" />
                                 <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">
                                     {isBulkMode ? 'Shared Specifications' : 'Asset Specifications'}
                                 </h4>
                             </div>
                             <DynamicFieldRenderer 
                                 schema={selectedBlueprintTemplate.schema} 
                                 values={formData} 
                                 onChange={updateField}
                             />
                         </div>
                     </div>
                   </div>

                   {/* ACTION FOOTER */}
                   <div className="p-8 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
                       <button 
                         onClick={() => {
                             setFormData({});
                             setBulkIds('');
                         }}
                         className="px-4 h-12 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors"
                       >
                         Clear All Data
                       </button>
                       <div className="flex gap-4">
                           <Button variant="ghost" onClick={onClose} className="px-6 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-200 transition-all">
                             Abort
                           </Button>
                           <Button onClick={handleSubmit} disabled={loading} className={`px-10 h-12 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 ${isBulkMode ? 'bg-indigo-600 text-white shadow-indigo-500/20' : 'bg-slate-950 text-white'}`}>
                              {loading ? <LoadingSpinner size="sm" /> : (
                                 <>
                                    {isBulkMode ? <Zap size={18} /> : <Save size={18} />}
                                    {isBulkMode ? `Execute Scan (${bulkIds.split('\n').filter(id => id.trim()).length})` : 'Register Resource'}
                                 </>
                              )}
                           </Button>
                       </div>
                   </div>
                 </motion.div>
               )}
             </AnimatePresence>
           </div>
        )}
      </div>
    </div>
  );
};

export default BlueprintModal;
