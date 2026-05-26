import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
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
  Plus
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

  if (loadingData && isOpen) return <div className="fixed inset-0 bg-slate-950/20 backdrop-blur-sm z-[9999] flex items-center justify-center"><LoadingSpinner size="xl" /></div>;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={selectedBlueprintTemplate ? `NEW ${selectedBlueprintTemplate.name.toUpperCase()}` : "SELECT ITEM BLUEPRINT"}
      showFooter={false}
      maxWidth="max-w-7xl"
    >
      <div className="flex flex-col h-[85vh] bg-slate-50">
        <AnimatePresence mode="wait">
          {!selectedBlueprintTemplate ? (
            <motion.div 
              key="selector"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }}
              className="flex-1 overflow-y-auto p-16 space-y-12 custom-scrollbar"
            >
              <div className="flex flex-col items-center text-center space-y-8">
                 <div className="w-24 h-24 bg-indigo-600 rounded-[35px] flex items-center justify-center text-white shadow-2xl shadow-indigo-200">
                    <Layers size={40} />
                 </div>
                 <div className="space-y-4">
                    <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter italic">Choose Resource DNA</h2>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em]">Select a blueprint to generate your custom intake form</p>
                 </div>
                 
                 <div className="relative w-full max-w-xl pt-4">
                    <input 
                      type="text" 
                      placeholder="SEARCH AVAILABLE BLUEPRINTS..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full h-20 bg-white border-2 border-slate-100 rounded-[30px] px-14 text-sm font-black uppercase tracking-widest outline-none focus:border-indigo-500 transition-all shadow-sm"
                    />
                    <Search className="absolute left-6 top-[62%] -translate-y-1/2 text-slate-300" size={20} />
                 </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
                 {filteredBlueprints.map(t => (
                   <button 
                     key={t.id}
                     onClick={() => handleTemplateSelect(t)}
                     className="group relative p-12 bg-white border-2 border-slate-50 rounded-[50px] hover:border-indigo-600 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all flex flex-col items-center text-center gap-8 overflow-hidden"
                   >
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="w-24 h-24 bg-indigo-50 rounded-[30px] flex items-center justify-center text-4xl shadow-sm group-hover:scale-110 transition-transform relative z-10">
                         {t.icon || '📦'}
                      </div>
                      <div className="relative z-10">
                         <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">{t.name}</h4>
                         <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 tracking-widest leading-relaxed opacity-80 line-clamp-2">
                           {t.description || `${t.schema?.length || 0} Dynamic Attributes`}
                         </p>
                      </div>
                      <div className="w-12 h-12 bg-slate-950 text-white rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-y-4 group-hover:translate-y-0">
                         <ArrowRight size={20} />
                      </div>
                   </button>
                 ))}
              </div>

              {filteredBlueprints.length === 0 && (
                <div className="py-20 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
                        <Box size={40} />
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm font-black uppercase tracking-widest text-slate-400">No Architectures Defined</p>
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">You must design your DNA in the manager first</p>
                    </div>
                    <Button 
                        onClick={() => onClose()}
                        className="bg-indigo-600 text-white px-8 h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest mx-auto"
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
              <div className="px-12 py-8 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-8">
                     <button 
                       onClick={() => setSelectedBlueprintTemplate(null)}
                       className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-slate-950 hover:text-white transition-all shadow-sm"
                     >
                        <ChevronLeft size={24} />
                     </button>
                     <div>
                        <div className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.4em] mb-1 italic">Active Blueprint</div>
                        <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">{selectedBlueprintTemplate.name}</h3>
                     </div>
                  </div>
                  
                  {/* POWER SCAN TOGGLE */}
                  <div className="flex items-center gap-6 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                      <button 
                        onClick={() => setIsBulkMode(false)}
                        className={`flex items-center gap-2 px-6 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isBulkMode ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-400'}`}
                      >
                         <Plus size={14} /> Single Entry
                      </button>
                      <button 
                        onClick={() => setIsBulkMode(true)}
                        className={`flex items-center gap-2 px-6 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isBulkMode ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}
                      >
                         <Zap size={14} /> Power Scan
                      </button>
                  </div>
              </div>

              {/* DYNAMIC FORM SCROLL AREA */}
              <div className="flex-1 overflow-y-auto p-16 custom-scrollbar bg-slate-50/30">
                <div className="max-w-5xl mx-auto space-y-12">
                    
                    {isBulkMode && (
                        <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                           <div className="flex items-center gap-4 px-2">
                               <div className="w-1.5 h-4 bg-indigo-600 rounded-full" />
                               <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Bulk Identifier List</h4>
                           </div>
                           <div className="relative">
                               <textarea 
                                 placeholder="Scan or paste Serial Numbers here... (One per line)"
                                 value={bulkIds}
                                 onChange={(e) => setBulkIds(e.target.value)}
                                 className="w-full min-h-[160px] p-8 bg-white border-2 border-slate-100 rounded-[30px] font-mono text-xs font-bold text-slate-600 outline-none focus:border-indigo-500 transition-all shadow-sm resize-none"
                               />
                               <div className="absolute right-6 bottom-6 flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                                  <ListOrdered size={14} className="text-slate-400" />
                                  <span className="text-[10px] font-black text-slate-600">{bulkIds.split('\n').filter(id => id.trim()).length} Detected</span>
                               </div>
                           </div>
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2 italic">
                              * The system will create one unique asset for every serial number in this list using the shared specs below.
                           </p>
                        </div>
                    )}

                    <div className="space-y-6">
                        <div className="flex items-center gap-4 px-2">
                            <div className="w-1.5 h-4 bg-slate-950 rounded-full" />
                            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">
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
              <div className="p-12 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
                  <button 
                    onClick={() => {
                        setFormData({});
                        setBulkIds('');
                    }}
                    className="px-10 h-16 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors"
                  >
                    Clear All Data
                  </button>
                  <div className="flex gap-8">
                      <Button variant="ghost" onClick={onClose} className="px-12 h-18 rounded-[25px] text-[11px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-200 transition-all">
                        Abort
                      </Button>
                      <Button onClick={handleSubmit} disabled={loading} className={`px-20 h-18 rounded-[35px] flex items-center gap-6 text-[11px] font-black uppercase tracking-[0.4em] shadow-2xl transition-all active:scale-95 ${isBulkMode ? 'bg-indigo-600 text-white shadow-indigo-500/20' : 'bg-slate-950 text-white'}`}>
                         {loading ? <LoadingSpinner size="sm" /> : (
                            <>
                               {isBulkMode ? <Zap size={24} /> : <Save size={24} />}
                               {isBulkMode ? `Execute Power Scan (${bulkIds.split('\n').filter(id => id.trim()).length})` : 'Register Resource'}
                            </>
                         )}
                      </Button>
                  </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
};

export default BlueprintModal;
