import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CascadingUnitSelector from '../components/common/CascadingUnitSelector';
import DynamicFieldRenderer from '../components/common/DynamicFieldRenderer';
import inventoryService from '../services/inventoryService';
import productService from '../services/productService';
import formService from '../services/formService';
import toast from 'react-hot-toast';
import {
  Plus, Trash2, ArrowRight, Settings2, Box, 
  Layers, Database, FileSpreadsheet, Layout
} from 'lucide-react';

const EMPTY_ITEM = {
  product_id: '',
  product_data: null, 
  quantity: 1,
  serial_number: '',
  batch_number: '',
  custom_fields: {}
};

const DynamicStorePage = () => {
  const navigate = useNavigate();
  const [selectedNode, setSelectedNode] = useState('');
  const [storeForm, setStoreForm] = useState({ 
    notes: '', 
    global_template_id: '' 
  });
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [products, setProducts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [globalTemplate, setGlobalTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initial Data Fetch
  useEffect(() => {
    const init = async () => {
      try {
        const [prodData, tempData] = await Promise.all([
          productService.getAllProducts({ limit: 1000 }),
          formService.getAllTemplates()
        ]);
        setProducts(prodData || []);
        setTemplates(tempData || []);
        
        // Default Global Template
        const defaultTemp = tempData.find(t => t.template_key === 'stock_intake');
        if (defaultTemp) {
          setGlobalTemplate(defaultTemp);
          setStoreForm(prev => ({ ...prev, global_template_id: defaultTemp.id }));
        }
      } catch (err) {
        toast.error('Failed to initialize dynamic resources');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Update Global Template
  const handleGlobalTemplateChange = (templateId) => {
    const selected = templates.find(t => t.id === parseInt(templateId));
    setGlobalTemplate(selected || null);
    setStoreForm(prev => ({ ...prev, global_template_id: templateId }));
  };

  const updateItem = useCallback((idx, field, value) => {
    setItems(prev => {
      const newItems = [...prev];
      if (field === 'product_id') {
        const product = products.find(p => p.id === parseInt(value));
        newItems[idx].product_id = value;
        newItems[idx].product_data = product;
        newItems[idx].custom_fields = {}; // Reset custom fields on product change
      } else if (field.startsWith('custom_fields.')) {
        const customKey = field.split('.')[1];
        newItems[idx].custom_fields = { 
          ...newItems[idx].custom_fields, 
          [customKey]: value 
        };
      } else {
        newItems[idx][field] = value;
      }
      return newItems;
    });
  }, [products]);

  const addItem = () => setItems([...items, { ...EMPTY_ITEM }]);
  const removeItem = (idx) => items.length > 1 && setItems(items.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedNode) return toast.error('Please select an Arrival Node');
    if (items.some(it => !it.product_id)) return toast.error('All entries must be linked to a Product Blueprint');

    setIsSubmitting(true);
    try {
      const payload = {
        ...storeForm,
        org_node_id: parseInt(selectedNode),
        items: items.map(it => ({
          ...it,
          product_id: parseInt(it.product_id),
          quantity: parseInt(it.quantity)
        }))
      };

      const response = await inventoryService.createStoreForm(payload);
      toast.success(response?.message || 'Registry Arrival Realized');
      navigate('/inventory');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><LoadingSpinner size="xl" /></div>;

  return (
    <div className="max-w-[1600px] mx-auto py-2 px-4 lg:px-6 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Dynamic Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-950 rounded-[24px] flex items-center justify-center shadow-lg rotate-6 hover:rotate-0 transition-transform duration-500">
            <Database className="text-blue-400" size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Total Intake</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1 flex items-center gap-2">
              <Layers size={14} className="text-blue-500" /> Registry Realization Protocol
            </p>
          </div>
        </div>

        <div className="flex gap-3">
           <button type="button" className="group h-11 px-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-2 hover:border-blue-500 transition-all shadow-sm">
              <FileSpreadsheet className="text-slate-400 group-hover:text-blue-500 transition-colors" size={18} />
              <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Import Batch</span>
           </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Dynamic Global Context */}
        <div className="bg-white p-5 md:p-6 rounded-[24px] border border-slate-100 shadow-xl space-y-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/30 rounded-full blur-3xl -mr-32 -mt-32" />
          
          <div className="flex items-center gap-4 relative">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black italic shadow-lg shadow-blue-200">1</div>
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">Batch Intelligence</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Configure the global context for this arrival</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 relative">
            <div className="lg:col-span-5 space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Arrival Destination</label>
              <CascadingUnitSelector value={selectedNode} onChange={setSelectedNode} />
            </div>

            <div className="lg:col-span-4 space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Intake Form Template</label>
              <div className="relative">
                <select
                  value={storeForm.global_template_id}
                  onChange={(e) => handleGlobalTemplateChange(e.target.value)}
                  className="w-full h-10 bg-slate-50 border border-slate-100 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="">Standard (Fixed Fields)</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <Layout className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
              </div>
            </div>

            <div className="lg:col-span-3">
              <Input 
                label="Batch Notes" 
                placeholder="e.g. Q3 Server Rack Deployment"
                value={storeForm.notes} 
                onChange={e => setStoreForm({ ...storeForm, notes: e.target.value })} 
                className="h-10 bg-slate-50 border rounded-xl px-4 text-sm font-bold"
              />
            </div>
          </div>
        </div>

        {/* Step 2: Adaptive Manifest Entries */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-950 rounded-2xl flex items-center justify-center text-white font-black italic shadow-lg shadow-slate-200">2</div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">Asset Manifest</h2>
            </div>
            <button 
              type="button" 
              onClick={addItem} 
              className="h-10 px-4 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2 shadow-sm"
            >
              <Plus size={16} /> Add Entry
            </button>
          </div>

          {items.map((it, idx) => {
            // Determine the schema for this specific row
            // Priority: Product-Specific Template > Global Selected Template
            const rowSchema = it.product_data?.intakeTemplate?.schema || globalTemplate?.schema;
            const templateName = it.product_data?.intakeTemplate?.name || globalTemplate?.name || "Standard";

            return (
              <div key={idx} className="group bg-white p-5 md:p-6 rounded-[28px] border border-slate-100 shadow-lg space-y-5 hover:border-blue-100 transition-all duration-300 relative overflow-hidden">
                <div className="flex justify-between items-start relative z-10 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-lg italic group-hover:scale-105 transition-transform duration-300">{idx + 1}</div>
                    <div>
                       <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Entry Manifest</h3>
                       <div className="flex items-center gap-2 mt-1">
                          <div className={`w-2 h-2 rounded-full ${rowSchema ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
                            Protocol: {templateName}
                          </span>
                       </div>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => removeItem(idx)} 
                    className="w-10 h-10 bg-red-50 text-red-400 rounded-2xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 relative z-10">
                  <div className="lg:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Product Blueprint</label>
                    <div className="relative">
                      <select 
                        value={it.product_id} 
                        onChange={e => updateItem(idx, 'product_id', e.target.value)}
                        className="w-full h-12 bg-slate-50 border border-slate-100 rounded-[20px] px-5 text-sm font-black text-slate-700 outline-none focus:ring-4 ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                      >
                        <option value="">Select from Master Catalog</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                      </select>
                      <Box className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
                    </div>
                  </div>
                  <Input 
                    label="Arrival Quantity" 
                    type="number" 
                    value={it.quantity} 
                    onChange={e => updateItem(idx, 'quantity', e.target.value)} 
                    className="h-12 bg-slate-50 border rounded-[20px] px-5 text-sm font-black"
                  />
                  <Input 
                    label="Primary Serial / ID" 
                    placeholder="SN-XXXX-XXXX"
                    value={it.serial_number} 
                    onChange={e => updateItem(idx, 'serial_number', e.target.value)} 
                    className="h-12 bg-slate-50 border rounded-[20px] px-5 text-sm font-black"
                  />
                </div>

                {/* Dynamic Morphing Section */}
                {rowSchema && (
                  <div className="pt-5 border-t border-slate-100 space-y-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm shadow-emerald-100">
                        <Settings2 size={16} />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.15em]">Adaptive Requirements</h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Fields requested by "{templateName}"</p>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50/50 p-4 rounded-[24px] border border-slate-100">
                      <DynamicFieldRenderer 
                        schema={rowSchema} 
                        values={it.custom_fields} 
                        onChange={(key, val) => updateItem(idx, `custom_fields.${key}`, val)}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-center pt-4">
          <button 
            type="submit" 
            disabled={isSubmitting} 
            className="group relative h-12 px-6 bg-slate-950 text-white font-black rounded-xl overflow-hidden shadow-[0_12px_30px_rgba(0,0,0,0.18)] hover:shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-70"
          >
            <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            <span className="relative flex items-center gap-3 uppercase text-[11px] tracking-[0.2em]">
              {isSubmitting ? <LoadingSpinner size="sm" /> : <>Realize Registry Arrival <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></>}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default DynamicStorePage;
