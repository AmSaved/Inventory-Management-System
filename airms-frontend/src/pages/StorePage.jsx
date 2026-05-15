import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CascadingUnitSelector from '../components/common/CascadingUnitSelector';
import inventoryService from '../services/inventoryService';
import productService from '../services/productService';
import toast from 'react-hot-toast';
import {
  PackagePlus, FileText, Plus, Trash2,
  Search, Upload, Info, AlertCircle,
  ArrowRight, CheckCircle2, ChevronDown, ChevronUp,
  ScanLine, Box, Warehouse, Tag, HelpCircle,
  Layers
} from 'lucide-react';

// New Components
import BlueprintModal from '../components/modals/BlueprintModal';
import CatalogSidebar from '../components/dashboard/CatalogSidebar';

const EMPTY_ITEM = {
  product_id: '',
  quantity: 1,
  unit_price: '',
  is_serialized: false,
  serial_number: '',
  batch_number: '',
  location_details: '',
  condition: 'new',
  notes: ''
};

const StorePage = () => {
  const navigate = useNavigate();
  const [selectedNode, setSelectedNode] = useState('');
  const [storeForm, setStoreForm] = useState({
    notes: ''
  });
  const [selectedNodeData, setSelectedNodeData] = useState(null);

  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showImportHelp, setShowImportHelp] = useState(false);
  const [batchProduct, setBatchProduct] = useState('');
  
  // UI State for Catalog & Blueprints
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [blueprintModalOpen, setBlueprintModalOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(null); // Track which item is being edited from sidebar

  const { data: products, loading: productsLoading, refetch: refetchProducts } = useFetch('/products', {
    params: { limit: 50, order_by: 'updated_at', order_direction: 'DESC' }
  });

  const updateItem = useCallback((idx, field, value) => {
    setItems(prev => {
      const newItems = [...prev];
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        newItems[idx][parent] = { ...newItems[idx][parent], [child]: value };
      } else {
        newItems[idx][field] = value;
      }
      return newItems;
    });
  }, []);

  const applyBatchProduct = useCallback((productId) => {
    const idToApply = productId || batchProduct;
    if (!idToApply) return toast.error('Please select a batch product first');
    setItems(prev => prev.map(item => ({
      ...item,
      product_id: idToApply
    })));
    toast.success('Linked all manifest items to official catalog blueprint');
  }, [batchProduct]);

  // Handle new blueprint creation
  const handleBlueprintCreated = useCallback((newProduct) => {
    refetchProducts(); // Refresh the list
    
    // If we were editing a specific item, auto-select it
    if (activeItemIndex !== null) {
      updateItem(activeItemIndex, 'product_id', newProduct.id);
      setActiveItemIndex(null);
    } else {
      // If no specific index (e.g. batch), auto-select for ALL items
      setBatchProduct(newProduct.id);
      applyBatchProduct(newProduct.id);
    }
    
    setBlueprintModalOpen(false);
  }, [activeItemIndex, refetchProducts, updateItem, applyBatchProduct]);

  const handleSelectFromCatalog = (product) => {
    if (activeItemIndex !== null) {
      updateItem(activeItemIndex, 'product_id', product.id);
    } else {
      setBatchProduct(product.id);
      applyBatchProduct(product.id); // Apply to all items at once
    }
    setActiveItemIndex(null);
  };

  const openCatalogForItem = (idx) => {
    setActiveItemIndex(idx);
    setCatalogOpen(true);
  };

  // Smart header matching helper
  const findHeader = (headers, targets) => {
    return headers.findIndex(h => {
      const clean = h.replace(/[^a-z0-9]/g, '');
      return targets.some(t => clean.includes(t.replace(/[^a-z0-9]/g, '')));
    });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        toast.error('CSV file is empty or missing headers');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      const skuIdx = findHeader(headers, ['sku', 'product', 'code']);
      const qtyIdx = findHeader(headers, ['quantity', 'qty', 'amount']);
      const serialIdx = findHeader(headers, ['serial', 'sn', 'id']);
      const batchIdx = findHeader(headers, ['batch', 'lot']);
      const locIdx = findHeader(headers, ['location', 'storage', 'aisle']);
      const condIdx = findHeader(headers, ['condition', 'state']);
      const catIdx = findHeader(headers, ['category', 'type', 'group']);
      const unitIdx = findHeader(headers, ['unit', 'uom', 'measure']);

      const newItems = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (!cols[skuIdx]) continue;

        const sku = cols[skuIdx];
        const existingProduct = products?.find(p => p.sku.toLowerCase() === sku.toLowerCase());

        const baseItem = JSON.parse(JSON.stringify(EMPTY_ITEM));

        if (existingProduct) {
          baseItem.product_id = existingProduct.id;
        } else {
          // No auto-generation of products. Item stays unlinked for manual catalog mapping.
          baseItem.product_id = '';
        }

        if (qtyIdx > -1 && cols[qtyIdx]) baseItem.quantity = parseInt(cols[qtyIdx]) || 1;

        // Populate Registry Tracking
        if (serialIdx > -1 && cols[serialIdx]) {
          baseItem.serial_number = cols[serialIdx];
          baseItem.is_serialized = true;
        }
        if (batchIdx > -1 && cols[batchIdx]) baseItem.batch_number = cols[batchIdx];
        
        // Use CSV location if present, otherwise fallback to selected node name
        if (locIdx > -1 && cols[locIdx]) {
          baseItem.location_details = cols[locIdx];
        } else if (selectedNodeData) {
          baseItem.location_details = selectedNodeData.name;
        }

        if (condIdx > -1 && cols[condIdx]) {
          const c = cols[condIdx].toLowerCase();
          if (['new', 'used', 'refurbished', 'damaged'].includes(c)) baseItem.condition = c;
        }

        newItems.push(baseItem);
      }

      if (newItems.length > 0) {
        setItems(newItems);
        toast.success(`Imported ${newItems.length} items from CSV`);
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const addItem = () => {
    const newItem = { ...EMPTY_ITEM };
    if (selectedNodeData) {
      newItem.location_details = selectedNodeData.name;
    }
    setItems([...items, newItem]);
  };

  const removeItem = (idx) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedNode) return toast.error('Please select an organizational node');
    
    // Validation: Ensure all items are linked to a blueprint
    if (items.some(it => !it.product_id)) {
      return toast.error('Validation Error: All manifest items must be linked to a product blueprint.');
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...storeForm,
        org_node_id: parseInt(selectedNode),
        items: items.map(it => ({
          product_id: parseInt(it.product_id),
          quantity: parseInt(it.quantity),
          is_serialized: it.is_serialized,
          serial_number: it.serial_number,
          batch_number: it.batch_number,
          location_details: it.location_details,
          condition: it.condition,
          notes: it.notes
        }))
      };

      await inventoryService.createStoreForm(payload);
      toast.success('Inventory arrival recorded successfully');
      navigate('/inventory');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record arrival');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-6 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 bg-slate-950 rounded-[22px] flex items-center justify-center shadow-xl rotate-3">
              <PackagePlus className="text-blue-500" size={28} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Stock Intake</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Registry Realization Protocol</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => {
              setActiveItemIndex(null);
              setCatalogOpen(true);
            }}
            className="bg-white border-2 border-slate-200 text-slate-600 font-black px-6 py-4 rounded-2xl uppercase text-[10px] tracking-widest flex items-center gap-3 hover:bg-slate-50 hover:border-blue-500 hover:text-blue-600 transition-all shadow-lg active:scale-95"
          >
            <Layers size={18} /> Browse Catalog
          </button>
          <label className="bg-white border-2 border-slate-950 text-slate-950 font-black px-8 py-4 rounded-2xl uppercase text-[10px] tracking-widest flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-all shadow-lg active:scale-95">
            <Upload size={18} /> Import Batch (CSV)
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      {showImportHelp && (
        <div className="bg-blue-50 border border-blue-100 p-8 rounded-[35px] animate-in zoom-in-95 duration-300">
          <h3 className="text-blue-900 font-black uppercase text-xs tracking-widest mb-4 flex items-center gap-2">
            <Info size={16} /> CSV Structure Requirements
          </h3>
          <p className="text-sm text-blue-700 mb-4 font-medium leading-relaxed">
            Your CSV should contain the following headers (case-insensitive):
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['SKU', 'Quantity', 'Serial Number', 'Batch Number', 'Location', 'Condition'].map(h => (
              <div key={h} className="bg-white/50 px-4 py-2 rounded-xl text-[10px] font-bold text-blue-600 border border-blue-200/50">{h}</div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Destination */}
        <div className="bg-white p-10 rounded-[45px] border border-slate-100 shadow-xl shadow-slate-100/50 space-y-8">
          <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black">1</div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">Routing & Metadata</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Arrival Node</label>
              <CascadingUnitSelector 
                value={selectedNode} 
                onChange={(id, node) => {
                  setSelectedNode(id);
                  setSelectedNodeData(node);
                  
                  // Auto-fill Location Details for all items when a node is selected
                  if (node) {
                    setItems(prev => prev.map(item => ({
                      ...item,
                      location_details: item.location_details || node.name
                    })));
                  }
                }} 
              />
            </div>
            <Input label="Store Form #" value={storeForm.store_number} readOnly />
            <Input label="Intake Date" type="date" value={storeForm.date} onChange={e => setStoreForm({ ...storeForm, date: e.target.value })} />
          </div>
          
          {selectedNodeData && !selectedNodeData.can_store_inventory && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-2xl flex items-start gap-4 animate-in slide-in-from-left-4 duration-500">
               <AlertCircle className="text-amber-600 shrink-0" size={20} />
               <div>
                  <h4 className="text-[10px] font-black text-amber-900 uppercase tracking-widest mb-1">Administrative Node Warning</h4>
                  <p className="text-xs text-amber-700 font-medium">
                    The selected node ({selectedNodeData.name}) is not officially marked for inventory storage. 
                    Recording stock here is allowed, but it might not show up in storage-only reports.
                  </p>
               </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-50">
             <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Batch Product (Blueprint)</label>
                  <button 
                    type="button" 
                    onClick={() => {
                      setActiveItemIndex(null);
                      setBlueprintModalOpen(true);
                    }}
                    className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 flex items-center gap-1"
                  >
                    <Plus size={12} /> New Blueprint
                  </button>
                </div>
                <div className="flex gap-4">
                  <select 
                    value={batchProduct} 
                    onChange={e => setBatchProduct(e.target.value)}
                    className="flex-1 h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-sm font-bold outline-none focus:ring-2 ring-blue-500/10"
                  >
                    <option value="">Select from Master Catalog</option>
                    {products?.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
                  </select>
                  <button 
                    type="button"
                    onClick={() => applyBatchProduct()}
                    className="h-14 px-8 bg-blue-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-slate-950 transition-all shadow-lg active:scale-95 shrink-0"
                  >
                    Apply to Manifest
                  </button>
                </div>
                <p className="text-[9px] font-bold text-slate-400 uppercase italic ml-1">Instantly link all manifest items to this blueprint</p>
             </div>
          </div>

          <Input label="Batch Notes" value={storeForm.notes} onChange={e => setStoreForm({ ...storeForm, notes: e.target.value })} placeholder="General arrival context..." />
        </div>

        {/* Step 2: Items */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center text-white font-black">2</div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">Asset Manifest</h2>
            </div>
            <button type="button" onClick={addItem} className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-700">
              <Plus size={16} /> Add Single Entry
            </button>
          </div>

          <div className="space-y-6">
            {items.map((it, idx) => (
              <div key={idx} className="bg-white p-10 rounded-[45px] border border-slate-100 shadow-xl shadow-slate-100/50 space-y-8 animate-in slide-in-from-right-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl italic shrink-0">{idx + 1}</div>
                    <div className="flex-1">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Linked Blueprint</label>
                          <div className="flex gap-4">
                             <button 
                              type="button" 
                              onClick={() => openCatalogForItem(idx)}
                              className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 flex items-center gap-1"
                            >
                              <Layers size={12} /> Catalog
                            </button>
                            <button 
                              type="button" 
                              onClick={() => {
                                setActiveItemIndex(idx);
                                setBlueprintModalOpen(true);
                              }}
                              className="text-[9px] font-black text-emerald-600 uppercase tracking-widest hover:text-emerald-700 flex items-center gap-1"
                            >
                              <Plus size={12} /> New
                            </button>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <select 
                            value={it.product_id} 
                            onChange={e => updateItem(idx, 'product_id', e.target.value)} 
                            className={`flex-1 h-14 bg-slate-50 border-2 rounded-2xl px-6 text-sm font-bold outline-none focus:ring-2 ring-blue-500/10 transition-all ${!it.product_id ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100'}`}
                          >
                            <option value="">-- Link to Catalog Blueprint --</option>
                            {products?.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => openCatalogForItem(idx)}
                            className="h-14 px-6 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-slate-200"
                          >
                            <Search size={18} />
                          </button>
                        </div>
                        {!it.product_id && (
                          <div className="flex items-center gap-2 mt-2 px-2">
                             <AlertCircle size={12} className="text-amber-500" />
                             <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Unlinked Entry: Asset will not be traceable until linked to a blueprint</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={() => removeItem(idx)} className="p-3 bg-red-50 text-red-400 rounded-xl hover:bg-red-100 hover:text-red-600 transition-all ml-6">
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Input label="Quantity *" type="number" value={it.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Condition</label>
                    <select value={it.condition} onChange={e => updateItem(idx, 'condition', e.target.value)} className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-sm font-bold outline-none">
                      <option value="new">Factory New</option>
                      <option value="used">Used / Functional</option>
                      <option value="refurbished">Refurbished</option>
                      <option value="damaged">Damaged / Non-Functional</option>
                    </select>
                  </div>
                </div>

                {/* Registry Section */}
                <div className="bg-slate-50/50 rounded-3xl p-8 space-y-6 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm shadow-emerald-500/10">
                        <ScanLine size={20} />
                      </div>
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registry Tracking</h3>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={it.is_serialized} onChange={e => updateItem(idx, 'is_serialized', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Enable Unique IDs</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Input label="Serial Number" placeholder="SN-XXXX-XXXX" value={it.serial_number} onChange={e => updateItem(idx, 'serial_number', e.target.value)} />
                    <Input label="Batch / Lot Number" placeholder="BATCH-XXXX" value={it.batch_number} onChange={e => updateItem(idx, 'batch_number', e.target.value)} />
                    <Input label="Storage Location" placeholder="Aisle 4" value={it.location_details} onChange={e => updateItem(idx, 'location_details', e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center pt-10">
            <button type="submit" disabled={isSubmitting} className="group relative bg-slate-950 text-white font-black px-12 py-6 rounded-3xl uppercase text-xs tracking-[0.3em] shadow-2xl hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-4">
              {isSubmitting ? <LoadingSpinner size="sm" /> : (
                <>
                  Realize Registry Arrival <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Slide-out Catalog Browser */}
      <CatalogSidebar 
        isOpen={catalogOpen} 
        onClose={() => setCatalogOpen(false)} 
        onSelectProduct={handleSelectFromCatalog}
        onNewBlueprint={() => setBlueprintModalOpen(true)}
      />

      {/* Blueprint Quick-Creation Modal */}
      <BlueprintModal 
        isOpen={blueprintModalOpen} 
        onClose={() => setBlueprintModalOpen(false)} 
        onCreated={handleBlueprintCreated}
      />
    </div>
  );
};

export default StorePage;
