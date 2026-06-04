import React, { useState, useEffect } from 'react';
import { useFetch } from '../../hooks/useFetch';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Input from '../ui/Input';
import LoadingSpinner from '../common/LoadingSpinner';
import BlueprintModal from '../modals/BlueprintModal';
import productService from '../../services/productService';
import formService from '../../services/formService';
import toast from 'react-hot-toast';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Layers, 
  Database,
  Settings2,
  ArrowLeft,
  Layout,
  PlusCircle,
  X,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const ProductManagement = () => {
  const location = useLocation();
  const [view, setView] = useState(location.state?.view || 'catalog'); // 'catalog' or 'manager'
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [lastDeployedBlueprint, setLastDeployedBlueprint] = useState(null);

  const { data: productsData, loading, refetch: refetchProducts } = useFetch('/products', { params: { limit: 1000 } });
  const { data: templatesData, loading: loadingTemplates, refetch: refetchTemplates } = useFetch('/form-templates');
  
  const products = productsData || [];
  const blueprints = (templatesData?.data || templatesData || []).filter(t => t.module === 'blueprint');

  // Auto-switch to manager if no blueprints exist
  useEffect(() => {
    if (!loadingTemplates && blueprints.length === 0 && view === 'catalog') {
      setView('manager');
    }
  }, [blueprints.length, loadingTemplates, view]);

  const handleOpenModal = (item = null) => {
    if (blueprints.length === 0 && !item) {
        return toast.error('You must create an Architecture (Blueprint) before deploying an asset.');
    }
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleEditTemplate = (template = null) => {
    setLastDeployedBlueprint(null); // Clear success banner when starting a new edit
    if (template) {
        setEditingTemplate({ ...template, schema: template.schema || [] });
    } else {
        setEditingTemplate({
            name: '',
            template_key: 'blueprint_' + Date.now(),
            module: 'blueprint',
            icon: '📦',
            description: '',
            schema: [
                { key: 'asset_name', label: 'Asset Name', type: 'text', section: 'Identity', required: true },
                { key: 'asset_id', label: 'Serial Number / ID', type: 'text', section: 'Identity', required: true }
            ]
        });
    }
  };

  useEffect(() => {
    if (location.state?.action === 'create') {
      handleEditTemplate();
    }
  }, [location.state]);

  const generateCSVTemplate = (blueprint) => {
    const headers = [];
    blueprint.schema.forEach(field => {
        let headerName = field.label;
        if (field.unit) headerName += ` (${field.unit})`;
        headers.push(headerName);
    });

    const csvContent = [
        headers.join(','),
        [...blueprint.schema.map(f => f.type === 'number' ? '0' : 'Sample Value')].join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${blueprint.name.replace(/\s+/g, '_')}_Bulk_Template.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`${blueprint.name} Template Downloaded!`);
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate.name) return toast.error('Blueprint Name is mandatory');
    const loadingToast = toast.loading('Synchronizing Architecture...');
    try {
        let savedTemplate;
        if (editingTemplate.id) {
            const response = await formService.updateTemplate(editingTemplate.id, editingTemplate);
            savedTemplate = response;
        } else {
            const response = await formService.createTemplate(editingTemplate);
            savedTemplate = response;
        }
        
        toast.success('Architecture Optimized', { id: loadingToast });
        await refetchTemplates();
        
        const latestTemplate = savedTemplate || editingTemplate;
        
        try {
            await productService.createProduct({
                name: latestTemplate.name,
                sku: `RES-${Math.random().toString(36).substring(7).toUpperCase()}`,
                blueprint_template_id: latestTemplate.id,
                specifications: {}, 
                is_active: true,
                category: latestTemplate.name
            });
            refetchProducts();
        } catch (err) {
            console.error('Auto-deploy failed', err);
        }

        setLastDeployedBlueprint(latestTemplate); // Trigger the Success Banner
        generateCSVTemplate(latestTemplate);
        setEditingTemplate(null);
    } catch (err) {
        toast.error('Architecture Failure', { id: loadingToast });
    }
  };

  const addField = () => {
    setEditingTemplate(prev => ({
        ...prev,
        schema: [...prev.schema, { 
            key: 'field_' + Date.now(), 
            label: 'New Attribute', 
            type: 'text', 
            section: 'General', 
            unit: '',
            options: [],
            required: false 
        }]
    }));
  };

  const updateField = (index, updates) => {
    const newSchema = [...editingTemplate.schema];
    
    if (updates.type) {
        if (updates.type === 'kg') { updates.type = 'number'; updates.unit = 'KG'; }
        else if (updates.type === 'litre') { updates.type = 'number'; updates.unit = 'L'; }
        else if (updates.type === 'metre') { updates.type = 'number'; updates.unit = 'M'; }
        else if (updates.type === 'percent') { updates.type = 'number'; updates.unit = '%'; }
        else if (updates.type === 'currency') { updates.type = 'number'; updates.unit = '$'; }
        else if (['text', 'number', 'date', 'select', 'textarea', 'checkbox'].includes(updates.type)) {
            if (updates.type !== 'number') updates.unit = '';
        }
    }

    newSchema[index] = { ...newSchema[index], ...updates };
    setEditingTemplate({ ...editingTemplate, schema: newSchema });
  };

  const removeField = (index) => {
    const newSchema = editingTemplate.schema.filter((_, i) => i !== index);
    setEditingTemplate({ ...editingTemplate, schema: newSchema });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Expunge this asset blueprint from the global catalog?')) return;
    try {
      await productService.deleteProduct(id);
      toast.success('Blueprint Wiped');
      refetchProducts();
    } catch (error) {
      toast.error('Deletion Restricted: Active Dependencies');
    }
  };

  return (
    <div className="space-y-1 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="flex justify-end pb-2 border-b border-slate-100">
          <div className="flex items-center gap-4">
             {view === 'catalog' && (
                <button 
                   onClick={() => setView('manager')} 
                   className="bg-white border-2 border-slate-200 text-slate-800 h-14 px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:border-slate-800 hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center"
                >
                   <Settings2 size={16} className="mr-2" /> Form Builder
                </button>
             )}

             {view === 'manager' && (
                <button 
                    onClick={() => handleEditTemplate()} 
                    className="bg-emerald-600 text-white h-14 px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-950 transition-all shadow-lg flex items-center justify-center"
                >
                    <PlusCircle size={16} className="mr-2" /> New Form
                </button>
             )}
          </div>
      </div>

      {/* SUCCESS BANNER FOR CONTROLLED DOWNLOAD */}
      <AnimatePresence>
        {lastDeployedBlueprint && (
            <motion.div 
                initial={{ opacity: 0, height: 0, y: -20 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -20 }}
                className="bg-emerald-50 border-2 border-emerald-100 rounded-[2.5rem] p-8 flex flex-col md:flex-row items-center justify-between gap-8 overflow-hidden shadow-xl"
            >
                <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg">
                        <CheckCircle2 size={32} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">Blueprint Successfully Deployed!</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                            {lastDeployedBlueprint.name} is now live. Ready for bulk inventory preparation.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => generateCSVTemplate(lastDeployedBlueprint)}
                        className="h-14 px-10 bg-slate-950 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-3 hover:bg-emerald-600 transition-all shadow-2xl"
                    >
                        <FileSpreadsheet size={18} /> Download Bulk Template
                    </button>
                    <button 
                        onClick={() => setLastDeployedBlueprint(null)}
                        className="p-4 text-slate-400 hover:text-slate-900 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {view === 'catalog' ? (
          <motion.div 
            key="catalog"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="flex items-center justify-between px-6">
                <div className="flex items-center gap-4">
                    <div className="w-2 h-8 bg-blue-600 rounded-full" />
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Blueprint Repository</h3>
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] opacity-60">
                    {products.length} Validated Templates
                </div>
            </div>

            {loading ? (
                <div className="p-12 text-center flex justify-center"><LoadingSpinner /></div>
            ) : products.length > 0 ? (
                <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b-2 border-slate-100">
                                <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Template Name</th>
                                <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit</th>
                                <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                                {products.map(p => (
                                    <tr key={p.id} className="group hover:bg-slate-50/80 transition-all">
                                        <td className="p-8">
                                            <Badge className="bg-blue-50 text-blue-600 border-none text-[8px] font-black uppercase px-2 py-1 rounded-lg">
                                                {p.blueprintTemplate?.name || 'Legacy IT Architecture'}
                                            </Badge>
                                        </td>
                                        <td className="p-8 text-xs font-black text-slate-500 uppercase">{p.unit}</td>
                                        <td className="p-8 text-left">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        if (p.blueprintTemplate) {
                                                            handleEditTemplate(p.blueprintTemplate);
                                                            setView('manager');
                                                        } else {
                                                            handleEditTemplate({
                                                                name: p.name,
                                                                template_key: 'blueprint_' + Date.now(),
                                                                module: 'blueprint',
                                                                icon: '📦',
                                                                description: '',
                                                                schema: [
                                                                    { key: 'asset_name', label: 'Asset Name', type: 'text', section: 'Identity', required: true },
                                                                    { key: 'asset_id', label: 'Serial Number / ID', type: 'text', section: 'Identity', required: true }
                                                                ]
                                                            });
                                                            setView('manager');
                                                        }
                                                    }}
                                                    className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-950 hover:text-white transition-all shadow-sm"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(p.id)} className="p-2.5 bg-rose-50 text-rose-400 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
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
          </motion.div>
        ) : (
          <motion.div 
            key="manager"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* BLUEPRINT LIST */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="flex items-center gap-4 px-4">
                        <div className="w-2 h-6 bg-emerald-500 rounded-full" />
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest italic">Available Architectures</h3>
                    </div>
                    <div className="space-y-4">
                        {loadingTemplates ? (
                            <div className="p-12 text-center flex justify-center"><LoadingSpinner /></div>
                        ) : blueprints.map(bp => (
                            <div key={bp.id} className="relative group">
                                <button 
                                    onClick={() => handleEditTemplate(bp)}
                                    className={`w-full p-8 rounded-[2.5rem] border-2 text-left transition-all flex items-center justify-between ${
                                        editingTemplate?.id === bp.id ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xl' : 'bg-white border-slate-50 hover:border-emerald-100 shadow-sm'
                                    }`}
                                >
                                    <div className="flex items-center gap-6">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${editingTemplate?.id === bp.id ? 'bg-white/20' : 'bg-emerald-50 text-emerald-600'}`}>
                                            {bp.icon || '📦'}
                                        </div>
                                        <div>
                                            <div className="font-black text-sm uppercase italic tracking-tight">{bp.name}</div>
                                            <div className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${editingTemplate?.id === bp.id ? 'text-white/60' : 'text-slate-400'}`}>
                                                {bp.schema.length} Attributes Defined
                                            </div>
                                        </div>
                                    </div>
                                    <Layout size={18} className={editingTemplate?.id === bp.id ? 'text-white/40' : 'text-slate-200'} />
                                </button>
                                
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        generateCSVTemplate(bp);
                                    }}
                                    title="Download Bulk Template"
                                    className="absolute -right-4 top-1/2 -translate-y-1/2 p-4 bg-slate-950 text-white rounded-2xl opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-4 transition-all shadow-2xl hover:bg-emerald-500 z-20"
                                >
                                    <FileSpreadsheet size={20} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* SCHEMA BUILDER */}
                <div className="lg:col-span-2">
                    {editingTemplate ? (
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
                             {/* Header */}
                             <div className="py-4 px-6 bg-slate-950 text-white flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                                        <ClipboardList size={20} />
                                    </div>
                                    <div>
                                        <h4 className="text-base font-black uppercase tracking-tighter italic">Form Designer</h4>
                                        <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mt-0.5">Configuring {editingTemplate.name || 'New Form'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    {editingTemplate.id && (
                                        <button 
                                            onClick={() => generateCSVTemplate(editingTemplate)}
                                            className="px-4 h-9 bg-white/10 rounded-lg hover:bg-white/20 transition-all flex items-center gap-2 text-[9px] font-black uppercase tracking-widest"
                                        >
                                            <Download size={14} /> Bulk Template
                                        </button>
                                    )}
                                    <button onClick={() => setEditingTemplate(null)} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-all"><X size={16} /></button>
                                </div>
                             </div>

                             {/* Form Body */}
                             <div className="p-4 space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Form Name</label>
                                        <input 
                                            type="text" 
                                            value={editingTemplate.name} 
                                            onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})} 
                                            placeholder="Form Name"
                                            className="w-full h-9 border border-slate-200 rounded-lg px-3 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 transition-all bg-white"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Description</label>
                                        <input 
                                            type="text" 
                                            value={editingTemplate.description} 
                                            onChange={e => setEditingTemplate({...editingTemplate, description: e.target.value})} 
                                            placeholder="Form Description"
                                            className="w-full h-9 border border-slate-200 rounded-lg px-3 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 transition-all bg-white"
                                        />
                                    </div>
                                </div>

                                {/* Attributes Table */}
                                <div className="pt-2 space-y-2">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                        <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] italic">Form Attributes</h5>
                                        <button onClick={addField} className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-transform"><Plus size={12} /> Add New Attribute</button>
                                    </div>

                                    <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-sm">
                                        <table className="w-full text-left border-collapse bg-white">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-100">
                                                    <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Label</th>
                                                    <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                                                    <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-28">Required</th>
                                                    <th className="px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-16">Del</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {editingTemplate.schema.map((field, idx) => {
                                                    let displayType = field.type;
                                                    if (field.type === 'number' && field.unit === 'KG') displayType = 'kg';
                                                    else if (field.type === 'number' && field.unit === 'L') displayType = 'litre';
                                                    else if (field.type === 'number' && field.unit === 'M') displayType = 'metre';
                                                    else if (field.type === 'number' && field.unit === '%') displayType = 'percent';
                                                    else if (field.type === 'number' && field.unit === '$') displayType = 'currency';

                                                    return (
                                                        <tr key={field.key} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-4 py-1.5">
                                                                <input 
                                                                    type="text" 
                                                                    value={field.label === 'Asset Name' || field.label === 'Serial Number / ID' || field.label === 'New Attribute' ? '' : field.label}
                                                                    onChange={e => updateField(idx, { label: e.target.value })}
                                                                    placeholder={field.label}
                                                                    className="w-full h-8 border border-slate-200 rounded-lg px-3 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 transition-all bg-white"
                                                                />
                                                                {field.type === 'select' && (
                                                                    <input 
                                                                        type="text"
                                                                        value={field.options ? field.options.join(', ') : ''}
                                                                        onChange={e => updateField(idx, { options: e.target.value.split(',').map(s => s.trim()) })}
                                                                        placeholder="Options (comma-separated)"
                                                                        className="w-full h-7 mt-1 border border-emerald-200 rounded-lg px-3 text-[11px] font-semibold text-emerald-700 outline-none focus:border-emerald-500 transition-all bg-emerald-50/10"
                                                                    />
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-1.5">
                                                                <select 
                                                                    className="w-full h-8 border border-slate-200 rounded-lg px-2 text-xs font-semibold text-slate-700 cursor-pointer outline-none focus:border-emerald-500 transition-all bg-white" 
                                                                    value={displayType} 
                                                                    onChange={e => updateField(idx, { type: e.target.value })}
                                                                >
                                                                    <optgroup label="Standard">
                                                                        <option value="text">Text</option>
                                                                        <option value="number">Number</option>
                                                                        <option value="date">Date</option>
                                                                        <option value="select">Dropdown</option>
                                                                        <option value="textarea">Multiline</option>
                                                                        <option value="checkbox">Checkbox</option>
                                                                    </optgroup>
                                                                    <optgroup label="Units">
                                                                        <option value="kg">KG</option>
                                                                        <option value="litre">Litre</option>
                                                                        <option value="metre">Metre</option>
                                                                        <option value="percent">%</option>
                                                                        <option value="currency">$</option>
                                                                    </optgroup>
                                                                </select>
                                                            </td>
                                                            <td className="px-4 py-1.5 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateField(idx, { required: !field.required })}
                                                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
                                                                    aria-pressed={!!field.required}
                                                                >
                                                                    <span className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${field.required ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                                                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${field.required ? 'translate-x-5.5' : 'translate-x-1'}`} />
                                                                    </span>
                                                                    {field.required ? 'On' : 'Off'}
                                                                </button>
                                                            </td>
                                                            <td className="px-4 py-1.5 text-center">
                                                                <button 
                                                                    onClick={() => removeField(idx)} 
                                                                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                                    <Button variant="ghost" onClick={() => setEditingTemplate(null)} className="px-6 h-10 rounded-xl font-bold uppercase text-xs tracking-widest text-slate-400">Cancel</Button>
                                    <Button onClick={handleSaveTemplate} className="bg-emerald-600 text-white px-8 h-10 rounded-xl font-bold uppercase text-xs tracking-widest shadow-xl shadow-emerald-500/10">Save Form</Button>
                                </div>
                             </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-32 bg-slate-50/50 rounded-[4rem] border-2 border-dashed border-slate-200 text-center text-slate-400">
                             <Settings2 size={64} className="mb-6 opacity-20" />
                             <h4 className="text-xl font-black uppercase italic tracking-tight">Select an architecture to modify</h4>
                             <p className="text-[10px] font-bold uppercase tracking-widest mt-2 max-w-xs">Alter the DNA of your inventory by editing or creating new blueprints from scratch.</p>
                        </div>
                    )}
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BlueprintModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        onCreated={() => {
          refetchProducts();
          setModalOpen(false);
        }}
        editData={editingItem}
      />
    </div>
  );
};

export default ProductManagement;
