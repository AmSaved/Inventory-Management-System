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

  const handleGlobalManifestUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check for a blueprint reference
    const currentProductId = batchProduct || items[0]?.product_id;
    if (!currentProductId) {
      return toast.error('Please pick a Blueprint on the page first so I know which columns to map!');
    }

    const defaultProduct = products.find(p => p.id === parseInt(currentProductId));
    const schema = defaultProduct?.blueprintTemplate?.schema || [];

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;

      // IMPROVED LINE SPLITTING (Handles Windows/Mac/Linux line endings)
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);

      if (lines.length < 2) return toast.error('CSV is empty or missing headers');

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const explodedItemsList = [];

      const findColValue = (rowCols, targets) => {
        const idx = headers.findIndex(h => targets.some(t => h.includes(t.toLowerCase())));
        return idx > -1 ? rowCols[idx]?.trim() : '';
      };

      // MANIFEST EXPLOSION: Force individual cards for every row
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length < 2) continue; // Skip malformed lines

        const itemCustomFields = {};

        // Map dynamic fields based on blueprint schema
        schema.forEach(field => {
          const colIdx = headers.findIndex(h => h.includes(field.label.toLowerCase()));
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
          is_bulk_mode: false // CRITICAL: Force individual card mode
        });
      }

      if (explodedItemsList.length > 0) {
        setItems(explodedItemsList);
        toast.success(`Manifest Exploded! Prepared ${explodedItemsList.length} individual items.`, {
          duration: 6000,
          icon: '💥'
        });
      } else {
        toast.error('No valid items found in CSV');
      }
    };
    reader.readAsText(file);
    e.target.value = null; // Clear input for re-uploads
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedNode) return toast.error('Please select an organizational node');

    if (items.some(it => !it.product_id)) {
      return toast.error('All items must be linked to a blueprint before registering.');
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading('Synchronizing Bulk Manifest...');
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
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      {/* HEADER Area */}
      <div className="bg-slate-900 rounded-2xl p-6 shadow-md relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-transparent"></div>
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl flex items-center justify-center text-blue-400 shadow-sm">
                <PackagePlus size={20} />
            </div>
            <div>
                <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-0.5">
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight leading-none">
                   Intake Inventory
                </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => navigate('/admin/products', { state: { view: 'manager', action: 'create' } })}
              className="bg-emerald-600 text-white h-10 px-4 rounded-lg font-bold text-xs tracking-wide hover:bg-emerald-500 transition-all shadow-sm flex items-center"
            >
              <Plus size={14} className="mr-1.5" /> New Form
            </Button>
            <label className="bg-blue-600 text-white h-10 px-4 rounded-lg font-bold text-xs tracking-wide hover:bg-blue-500 transition-all shadow-sm flex items-center cursor-pointer group/btn relative">
              <FileSpreadsheet size={14} className="mr-1.5" /> Import form (CSV)
              <input type="file" accept=".csv" className="hidden" onChange={handleGlobalManifestUpload} />
            </label>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">1</div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Destination</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 ml-1">Receiving Node</label>
              <CascadingUnitSelector
                value={selectedNode}
                onChange={(id, node) => {
                  setSelectedNode(id);
                  setSelectedNodeData(node);
                  if (node) setItems(prev => prev.map(item => ({ ...item, location_details: item.location_details || node.name })));
                }}
              />
            </div>
            <Input label="Arrival Date" type="date" value={storeForm.date} onChange={e => setStoreForm({ ...storeForm, date: e.target.value })} className="h-10 bg-slate-50 border border-slate-200 rounded-lg font-semibold px-4 text-sm text-slate-800" />
            {/* <Input label="Manifest Reference" value={storeForm.notes} onChange={e => setStoreForm({ ...storeForm, notes: e.target.value })} placeholder="Reference..." className="h-10 bg-slate-50 border border-slate-200 rounded-lg font-semibold px-4 text-sm text-slate-800" /> */}
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">2</div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Intake Form</h2>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setItems([{ ...EMPTY_ITEM }])} className="text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1.5">
                <XCircle size={14} /> Reset Form
              </button>
              <button type="button" onClick={addItem} className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-xs font-bold text-blue-600 hover:border-blue-500 hover:bg-slate-50 transition-all flex items-center gap-1.5">
                <Plus size={14} /> Add Single Row
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {items.map((it, idx) => {
              const selectedProduct = products.find(p => p.id === parseInt(it.product_id));
              const schema = selectedProduct?.blueprintTemplate?.schema || [];

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                  key={idx}
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 w-12 h-12 bg-slate-50 rounded-bl-xl flex items-center justify-center text-slate-300 font-bold text-sm italic opacity-50 group-hover:text-blue-500 transition-colors">
                    {idx + 1}
                  </div>

                  <div className="space-y-4">
                    <select
                      value={it.product_id}
                      onChange={e => updateItem(idx, 'product_id', e.target.value)}
                      className="w-full max-w-md h-10 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg px-4 text-sm font-semibold text-slate-700 outline-none transition-all"
                    >
                      <option value="">-- SELECT BLUEPRINT --</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
                    </select>

                    {schema.length > 0 && (
                      <div className="pt-4 border-t border-slate-100 animate-in fade-in duration-700">
                        <DynamicFieldRenderer
                          schema={schema}
                          values={it.custom_fields}
                          onChange={(key, val) => {
                            const newFields = { ...it.custom_fields, [key]: val };
                            updateItem(idx, 'custom_fields', newFields);
                          }}
                          columns={2}
                        />
                      </div>
                    )}
                  </div>

                  <div className="pt-4 flex justify-end border-t border-slate-100">
                    <button type="button" onClick={() => removeItem(idx)} className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 hover:text-rose-700 transition-colors">
                      <Trash2 size={14} /> Remove Unit
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 h-9 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 text-xs w-fit"
            >
              {isSubmitting ? <LoadingSpinner size="sm" /> : (
                <>
                  Commit <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      <CatalogSidebar isOpen={catalogOpen} onClose={() => setCatalogOpen(false)} onSelectProduct={handleSelectFromCatalog} onNewBlueprint={() => setBlueprintModalOpen(true)} />
      <BlueprintModal isOpen={blueprintModalOpen} onClose={() => setBlueprintModalOpen(false)} onCreated={handleBlueprintCreated} />
    </div>
  );
};

export default StorePage;
