import React, { useState, useEffect } from 'react';
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
  ScanLine, Box, Warehouse, Tag, HelpCircle
} from 'lucide-react';

const EMPTY_ITEM = {
  product_id: '',
  quantity: 1,
  unit_price: '',
  is_serialized: false,
  serial_number: '',
  batch_number: '',
  location_details: '',
  condition: 'new',
  notes: '',
  is_new_product: false,
  new_product: {
    name: '',
    sku: '',
    category: 'General',
    unit: 'Unit'
  }
};

const StorePage = () => {
  const navigate = useNavigate();
  const [selectedNode, setSelectedNode] = useState('');
  const [storeForm, setStoreForm] = useState({
    store_number: `ST-${Date.now().toString().slice(-6)}`,
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showImportHelp, setShowImportHelp] = useState(false);

  const { data: products, loading: productsLoading } = useFetch('/products', {
    params: { limit: 1000 }
  });

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

      const newItems = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (!cols[skuIdx]) continue;

        const sku = cols[skuIdx];
        const existingProduct = products?.find(p => p.sku === sku);

        const baseItem = JSON.parse(JSON.stringify(EMPTY_ITEM));

        if (existingProduct) {
          baseItem.product_id = existingProduct.id;
        } else {
          baseItem.is_new_product = true;
          baseItem.new_product.sku = sku;
          baseItem.new_product.name = `${sku} (Auto-Generated from CSV)`;
        }

        if (qtyIdx > -1 && cols[qtyIdx]) baseItem.quantity = parseInt(cols[qtyIdx]) || 1;

        // Populate Registry Tracking
        if (serialIdx > -1 && cols[serialIdx]) {
          baseItem.serial_number = cols[serialIdx];
          baseItem.is_serialized = true;
        }
        if (batchIdx > -1 && cols[batchIdx]) baseItem.batch_number = cols[batchIdx];
        if (locIdx > -1 && cols[locIdx]) baseItem.location_details = cols[locIdx];

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

  const addItem = () => setItems([...items, { ...EMPTY_ITEM }]);
  const removeItem = (idx) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx, field, value) => {
    const newItems = [...items];
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      newItems[idx][parent][child] = value;
    } else {
      newItems[idx][field] = value;
    }
    setItems(newItems);
  };

  const toggleNewProduct = (idx) => {
    const newItems = [...items];
    newItems[idx].is_new_product = !newItems[idx].is_new_product;
    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedNode) return toast.error('Please select an organizational node');

    setIsSubmitting(true);
    try {
      const payload = {
        ...storeForm,
        org_node_id: selectedNode,
        items: items.map(it => ({
          product_id: it.is_new_product ? null : it.product_id,
          new_product: it.is_new_product ? it.new_product : null,
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
          <label className="bg-white border-2 border-slate-950 text-slate-950 font-black px-8 py-4 rounded-2xl uppercase text-[10px] tracking-widest flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-all shadow-lg active:scale-95">
            <Upload size={18} /> Import Batch (CSV)
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>
          <button onClick={() => setShowImportHelp(!showImportHelp)} className="p-4 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200 transition-all">
            <HelpCircle size={20} />
          </button>
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
              <CascadingUnitSelector value={selectedNode} onChange={setSelectedNode} />
            </div>
            <Input label="Store Form #" value={storeForm.store_number} readOnly />
            <Input label="Intake Date" type="date" value={storeForm.date} onChange={e => setStoreForm({ ...storeForm, date: e.target.value })} />
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
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl italic">{idx + 1}</div>
                    <div className="flex-1 min-w-[300px]">
                      {!it.is_new_product ? (
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Existing Product Link</label>
                          <select value={it.product_id} onChange={e => updateItem(idx, 'product_id', e.target.value)} className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-sm font-bold outline-none focus:ring-2 ring-blue-500/10">
                            <option value="">Select from Master Catalog</option>
                            {products?.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          <Input label="New Item Name" value={it.new_product.name} onChange={e => updateItem(idx, 'new_product.name', e.target.value)} />
                          <Input label="New Item SKU" value={it.new_product.sku} onChange={e => updateItem(idx, 'new_product.sku', e.target.value)} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => toggleNewProduct(idx)} className={`p-3 rounded-xl transition-all ${it.is_new_product ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:text-slate-600'}`} title="Toggle New Asset Entry">
                      <Tag size={18} />
                    </button>
                    <button type="button" onClick={() => removeItem(idx)} className="p-3 bg-red-50 text-red-400 rounded-xl hover:bg-red-100 hover:text-red-600 transition-all">
                      <Trash2 size={18} />
                    </button>
                  </div>
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
    </div>
  );
};

export default StorePage;
