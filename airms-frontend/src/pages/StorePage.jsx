import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CascadingUnitSelector from '../components/common/CascadingUnitSelector';
import DynamicFieldRenderer from '../components/common/DynamicFieldRenderer';
import inventoryService from '../services/inventoryService';
import productService from '../services/productService';
import toast from 'react-hot-toast';
import {
  PackagePlus, FileText, Plus, Trash2,
  Search, Upload, Info, AlertCircle,
  ArrowRight, CheckCircle2, ChevronDown, ChevronUp,
  ScanLine, Box, Warehouse, Tag, HelpCircle,
  Layers, Zap, ListOrdered, Download, FileSpreadsheet,
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

// New Components
import BlueprintModal from '../components/modals/BlueprintModal';
import CatalogSidebar from '../components/dashboard/CatalogSidebar';

const EMPTY_ITEM = {
  product_id: '',
  quantity: 1,
  unit_price: '',
  is_serialized: true,
  serial_number: '',
  bulk_ids: '',
  is_bulk_mode: false,
  batch_number: '',
  location_details: '',
  condition: 'new',
  notes: '',
  custom_fields: {}
};

const StorePage = () => {
  const navigate = useNavigate();
  const [selectedNode, setSelectedNode] = useState('');
  const [storeForm, setStoreForm] = useState({
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [selectedNodeData, setSelectedNodeData] = useState(null);

  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchProduct, setBatchProduct] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // UI State
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [blueprintModalOpen, setBlueprintModalOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(null);

  const { data: productsData, loading: productsLoading, refetch: refetchProducts } = useFetch('/products', {
    params: { limit: 1000, order_by: 'updated_at', order_direction: 'DESC' }
  });
  const products = productsData || [];

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

  const normalizeImportHeader = (value = '') =>
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const findMatchingColumnIndex = (headers, field) => {
    const candidates = [field.label, field.key, field.name, field.placeholder]
      .filter(Boolean)
      .map(value => normalizeImportHeader(value));

    return headers.findIndex(header => {
      const normalizedHeader = normalizeImportHeader(header);
      return candidates.some(candidate =>
        candidate === normalizedHeader ||
        candidate.includes(normalizedHeader) ||
        normalizedHeader.includes(candidate)
      );
    });
  };

  const handleGlobalManifestUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const currentProductId = batchProduct || items[0]?.product_id;
    if (!currentProductId) {
      return toast.error('Please pick a Blueprint on the page first so I know which columns to map!');
    }

    const defaultProduct = products.find(p => p.id === parseInt(currentProductId));
    const schema = defaultProduct?.blueprintTemplate?.schema || [];

    try {
      let rows = [];
      let headers = [];

      if (/\.xlsx?$/i.test(file.name)) {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      } else {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) return toast.error('CSV/XLSX is empty or missing headers');
        rows = lines.map(line => line.split(',').map(cell => cell.trim()));
      }

      if (!rows.length || rows.length < 2) {
        return toast.error('CSV/XLSX is empty or missing headers');
      }

      headers = rows[0].map(h => String(h).trim().toLowerCase());
      const explodedItemsList = [];

      const findColValue = (rowCols, targets) => {
        const idx = headers.findIndex(h => targets.some(t => h.includes(t.toLowerCase())));
        return idx > -1 ? String(rowCols[idx] ?? '').trim() : '';
      };

      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].map(cell => String(cell ?? '').trim());
        if (cols.every(cell => !cell)) continue;

        const itemCustomFields = {};

        schema.forEach(field => {
          const colIdx = findMatchingColumnIndex(headers, field);
          if (colIdx > -1 && cols[colIdx]) {
            itemCustomFields[field.key] = cols[colIdx];
          }
        });

        explodedItemsList.push({
          ...EMPTY_ITEM,
          product_id: defaultProduct.id,
          serial_number: findColValue(cols, ['serial', 'sn', 'id']),
          batch_number: findColValue(cols, ['batch', 'lot']),
          condition: findColValue(cols, ['condition', 'state'])?.toLowerCase() || 'new',
          location_details: selectedNodeData?.name || '',
          custom_fields: itemCustomFields,
          quantity: 1,
          is_bulk_mode: false
        });
      }

      if (explodedItemsList.length > 0) {
        setItems(explodedItemsList);
        toast.success(`Manifest Exploded! Prepared ${explodedItemsList.length} individual items.`, {
          duration: 6000,
          icon: '💥'
        });
      } else {
        toast.error('No valid items found in the uploaded file');
      }
    } catch (error) {
      console.error('Bulk import failed:', error);
      toast.error('Unable to parse the selected file. Please use a valid CSV or XLSX file.');
    } finally {
      e.target.value = null;
    }
  };

  const handleSelectFromCatalog = (product) => {
    if (activeItemIndex !== null) {
      updateItem(activeItemIndex, 'product_id', product.id);
    } else {
      setBatchProduct(product.id);
      setItems(prev => prev.map(item => ({ ...item, product_id: product.id })));
    }
    setCatalogOpen(false);
    setActiveItemIndex(null);
  };

  const handleBlueprintCreated = useCallback((newProduct) => {
    refetchProducts();
    if (activeItemIndex !== null) {
      updateItem(activeItemIndex, 'product_id', newProduct.id);
      setActiveItemIndex(null);
    } else {
      setBatchProduct(newProduct.id);
      setItems(prev => prev.map(item => ({ ...item, product_id: newProduct.id })));
    }
    setBlueprintModalOpen(false);
  }, [activeItemIndex, refetchProducts, updateItem]);

  const addItem = () => {
    const newItem = { ...EMPTY_ITEM };
    if (selectedNodeData) newItem.location_details = selectedNodeData.name;
    setItems([...items, newItem]);
  };

  const removeItem = (idx) => {
    if (items.length === 1) return setItems([{ ...EMPTY_ITEM }]);
    setItems(items.filter((_, i) => i !== idx));
  };

  const validateRequiredFields = (item, selectedProduct) => {
    const schema = selectedProduct?.blueprintTemplate?.schema || [];

    return schema
      .filter(field => field.required)
      .filter(field => {
        const value = item.custom_fields?.[field.key];
        if (field.type === 'checkbox') return !value;
        return !String(value ?? '').trim();
      })
      .map(field => ({ key: field.key, label: field.label }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedNode) return toast.error('Please select an organizational node');

    if (items.some(it => !it.product_id)) {
      return toast.error('All items must be linked to a blueprint before registering.');
    }

    const validationErrors = {};
    items.forEach((item, idx) => {
      const selectedProduct = products.find(p => p.id === parseInt(item.product_id));
      const missingFields = validateRequiredFields(item, selectedProduct);

      if (missingFields.length > 0) {
        validationErrors[idx] = missingFields.reduce((acc, field) => {
          acc[field.key] = `${field.label} is required.`;
          return acc;
        }, {});
      }
    });

    setFieldErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      toast.error('Please complete all required blueprint fields before submitting.');
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading('');
    try {
      const finalItems = [];
      for (const item of items) {
        if (item.is_bulk_mode && item.bulk_ids) {
          const ids = item.bulk_ids.split('\n').map(id => id.trim()).filter(id => id);
          ids.forEach(id => {
            finalItems.push({ ...item, serial_number: id, quantity: 1 });
          });
        } else {
          finalItems.push(item);
        }
      }

      const payload = {
        ...storeForm,
        org_node_id: parseInt(selectedNode),
        items: finalItems.map(it => {
          let extractedSerial = it.serial_number;
          if (!extractedSerial && it.custom_fields) {
            const serialKey = Object.keys(it.custom_fields).find(k =>
              k.toLowerCase().includes('serial') ||
              k.toLowerCase().includes('sn') ||
              k.toLowerCase() === 'id' ||
              k.toLowerCase().includes('number')
            );
            if (serialKey) {
              extractedSerial = it.custom_fields[serialKey];
            }
          }

          return {
            product_id: parseInt(it.product_id),
            quantity: parseInt(it.quantity),
            serial_number: extractedSerial || null,
            batch_number: it.batch_number || `B-${Date.now().toString().slice(-6)}`,
            location_details: it.location_details,
            condition: it.condition,
            notes: it.notes,
            custom_fields: it.custom_fields
          };
        })
      };

      const response = await inventoryService.createStoreForm(payload);
      toast.success(response?.message || `Success! ${finalItems.length} assets deployed to inventory.`, { id: loadingToast });
      navigate('/inventory');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Intake Failure', { id: loadingToast });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-4 pt-2 pb-4 px-4 md:px-6">
      {/* HEADER Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2 border-b border-slate-100">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
              <PackagePlus className="text-white" size={18} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic">Intake Inventory</h1>
              <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase">Deploy Assets to Repository</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/products', { state: { view: 'manager', action: 'create' } })}
            className="h-10 px-4 bg-emerald-600 text-white rounded-xl flex items-center gap-2 hover:bg-emerald-500 transition-all active:scale-95 shadow-lg text-[9px] font-black uppercase tracking-wider"
          >
            <Plus size={14} />
            <span>New Form</span>
          </button>
          <label className="h-10 px-4 bg-slate-950 text-white rounded-xl flex items-center gap-2 hover:bg-blue-600 transition-all active:scale-95 shadow-lg text-[9px] font-black uppercase tracking-wider cursor-pointer">
            <FileSpreadsheet size={14} />
            <span>Import CSV/XLSX</span>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleGlobalManifestUpload} />
          </label>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── HORIZONTAL LAYOUT: Destination (left compact panel) + Intake Form (right) ── */}
        <div className="flex gap-4 items-start">

          {/* ── LEFT: Destination Panel (compact sticky sidebar) ── */}
          <div className="w-64 shrink-0 bg-white rounded-3xl border-2 border-slate-50 shadow-lg shadow-slate-100 p-6 space-y-4 sticky top-4">
            <div className="flex items-center gap-3 border-b-2 border-slate-50 pb-3">
               <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-md shadow-blue-500/20">1</div>
               <div>
                  <h2 className="text-xs font-black text-slate-900 tracking-tight uppercase italic">Destination</h2>
                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">Receiving node</p>
               </div>
            </div>

            {/* Receiving Node / Branch Selection */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Branch Selection</label>
              <CascadingUnitSelector
                value={selectedNode}
                onChange={(id, node) => {
                  setSelectedNode(id);
                  setSelectedNodeData(node);
                  if (node) setItems(prev => prev.map(item => ({ ...item, location_details: item.location_details || node.name })));
                }}
              />
            </div>

            {/* Arrival Date */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Arrival Date</label>
              <input
                type="date"
                value={storeForm.date}
                onChange={e => setStoreForm({ ...storeForm, date: e.target.value })}
                className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:border-blue-400 transition-all shadow-sm"
              />
            </div>

            {/* Commit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-slate-950 hover:bg-blue-600 text-white font-black rounded-xl shadow-xl shadow-slate-100 transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest active:scale-95 mt-2"
            >
              {isSubmitting ? <LoadingSpinner size="sm" /> : (
                <>Commit <ArrowRight size={14} /></>
              )}
            </button>
          </div>

          {/* ── RIGHT: Intake Form ── */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Intake Form Header */}
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-950 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-md">2</div>
                <div>
                   <h2 className="text-xs font-black text-slate-900 tracking-tight uppercase italic">Intake Form</h2>
                   <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">Asset Registration</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => setItems([{ ...EMPTY_ITEM }])} className="text-[10px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest transition-colors flex items-center gap-1.5">
                  <XCircle size={14} /> Reset Form
                </button>
                <button type="button" onClick={addItem} className="h-10 px-4 bg-white border-2 border-slate-50 rounded-xl text-[9px] font-black text-blue-600 hover:border-blue-500/30 hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-sm active:scale-95">
                  <Plus size={14} /> Add Single Row
                </button>
              </div>
            </div>

            {/* Item Cards */}
            <div className="space-y-4">
              {items.map((it, idx) => {
                const selectedProduct = products.find(p => p.id === parseInt(it.product_id));
                const schema = selectedProduct?.blueprintTemplate?.schema || [];

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    key={idx}
                    className="bg-white p-6 rounded-[30px] border border-slate-100 hover:border-blue-600/30 hover:shadow-2xl hover:shadow-blue-500/5 transition-all duration-300 relative overflow-hidden group space-y-4"
                  >
                    <div className="absolute top-0 right-0 w-10 h-10 bg-slate-50 rounded-bl-2xl flex items-center justify-center text-slate-300 font-black text-xs italic opacity-60 group-hover:text-blue-500 transition-colors">
                      {idx + 1}
                    </div>

                    <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Catalog Blueprint</label>
                       <select
                         value={it.product_id}
                         onChange={e => updateItem(idx, 'product_id', e.target.value)}
                         className="w-full max-w-md h-12 bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none transition-all cursor-pointer"
                       >
                         <option value="">-- SELECT BLUEPRINT --</option>
                         {products.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
                       </select>
                    </div>

                    {schema.length > 0 && (
                      <div className="pt-4 border-t border-slate-50 animate-in fade-in duration-700">
                        <DynamicFieldRenderer
                          schema={schema}
                          values={it.custom_fields}
                          errors={fieldErrors[idx] || {}}
                          onChange={(key, val) => {
                            const newFields = { ...it.custom_fields, [key]: val };
                            updateItem(idx, 'custom_fields', newFields);
                            setFieldErrors(prev => ({
                              ...prev,
                              [idx]: {
                                ...(prev[idx] || {}),
                                [key]: ''
                              }
                            }));
                          }}
                        />
                      </div>
                    )}
                    <div className="pt-3 flex justify-end border-t border-slate-50">
                      <button type="button" onClick={() => removeItem(idx)} className="flex items-center gap-1.5 text-[9px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest transition-colors">
                        <Trash2 size={12} /> Remove Unit
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

        </div>
      </form>

      <CatalogSidebar isOpen={catalogOpen} onClose={() => setCatalogOpen(false)} onSelectProduct={handleSelectFromCatalog} onNewBlueprint={() => setBlueprintModalOpen(true)} />
      <BlueprintModal isOpen={blueprintModalOpen} onClose={() => setBlueprintModalOpen(false)} onCreated={handleBlueprintCreated} />
    </div>
  );
};

export default StorePage;
