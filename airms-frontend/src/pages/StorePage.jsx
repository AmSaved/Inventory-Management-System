import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import inventoryService from '../services/inventoryService';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import CascadingUnitSelector from '../components/common/CascadingUnitSelector';
import {
  PackageCheck, Plus, X, ChevronDown, ChevronUp, Truck, Barcode,
  ArrowRightCircle, ShieldAlert, Building2, Cpu, DollarSign,
  Calendar, Tag, Layers, ScanLine, LayoutList, Search, RefreshCw,
  CheckCircle2, Clock, Split, Upload, Download
} from 'lucide-react';

const EMPTY_ITEM = {
  product_id: '',
  quantity: 1,
  serial_number: '',
  batch_number: '',
  location_details: '',
  condition: 'new',
  supplier: '',
  new_product: {
    name: '', sku: '', category: '', sub_category: '',
    brand: '', model: '', unit: 'Piece (PC)', description: '',
    weight: '', dimensions: '', color: '', material: '',
    processor: '', ram: '', storage: '', graphics: '', display: '', os: ''
  }
};

const Section = ({ icon, title, color = 'blue', children, collapsible = true, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-100 rounded-3xl overflow-hidden">
      <button
        type="button"
        onClick={() => collapsible && setOpen(v => !v)}
        className={`w-full flex items-center justify-between px-6 py-4 bg-slate-50 hover:bg-slate-100 transition-colors ${!collapsible ? 'cursor-default' : ''}`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl bg-${color}-100`}>{icon}</div>
          <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">{title}</span>
        </div>
        {collapsible && (open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />)}
      </button>
      {open && <div className="p-6">{children}</div>}
    </div>
  );
};

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
    {children}
  </div>
);

const inp = "w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all";
const sel = "w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:border-blue-400 transition-all cursor-pointer";

const StorePage = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();

  const canIntake = hasPermission('stock:intake') || hasPermission('inventory:create');

  const [view, setView] = useState('new');
  const [orgNodeId, setOrgNodeId] = useState(user?.org_node_id || '');
  const [supplier, setSupplier] = useState('');
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedItem, setExpandedItem] = useState(0);

  const { data: productsData } = useFetch('/products');
  const { data: storeForms, loading: listLoading, refetch: refetchList } = useFetch(`/store?search=${search}`);
  // useFetch returns the inner 'data' array directly, so productsData is already the array of products
  const products = Array.isArray(productsData) ? productsData : [];
  
  const fileInputRef = React.useRef(null);

  const handleDownloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,SKU,Quantity,SerialNumber,BatchNumber,Location,Condition\nIT-DEL-XPS,1,SN-1001,BATCH-A,Aisle 1,new\nIT-DEL-XPS,1,SN-1002,BATCH-A,Aisle 1,new";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "bulk_intake_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length < 2) return toast.error("CSV appears empty or missing data rows");

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const skuIdx = headers.indexOf('sku');
        const qtyIdx = headers.indexOf('quantity');
        const serialIdx = headers.indexOf('serialnumber');
        const batchIdx = headers.indexOf('batchnumber');
        const locIdx = headers.indexOf('location');
        const condIdx = headers.indexOf('condition');

        if (skuIdx === -1) return toast.error("CSV must contain a 'SKU' column header");

        const newItems = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim());
          const sku = cols[skuIdx];
          if (!sku) continue;

          // Find existing product or map to NEW
          const pMatch = products.find(p => p.sku === sku);
          // Deep clone EMPTY_ITEM
          const baseItem = JSON.parse(JSON.stringify(EMPTY_ITEM));
          
          if (pMatch) {
            baseItem.product_id = pMatch.id.toString();
          } else {
            baseItem.product_id = 'NEW';
            baseItem.new_product.sku = sku;
            baseItem.new_product.name = `${sku} (Auto-Generated from CSV)`;
          }

          if (qtyIdx > -1 && cols[qtyIdx]) baseItem.quantity = parseInt(cols[qtyIdx]) || 1;
          if (serialIdx > -1 && cols[serialIdx]) baseItem.serial_number = cols[serialIdx];
          if (batchIdx > -1 && cols[batchIdx]) baseItem.batch_number = cols[batchIdx];
          if (locIdx > -1 && cols[locIdx]) baseItem.location_details = cols[locIdx];
          if (condIdx > -1 && cols[condIdx]) baseItem.condition = cols[condIdx].toLowerCase();

          newItems.push(baseItem);
        }

        if (newItems.length > 0) {
           setItems(newItems);
           setExpandedItem(0);
           toast.success(`Successfully imported ${newItems.length} line items`);
        } else {
           toast.error("No valid data rows found");
        }
      } catch (err) {
        toast.error("Failed to parse CSV file");
        console.error(err);
      }
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const updateItem = (i, field, val) => {
    const next = [...items];
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      next[i] = { ...next[i], [parent]: { ...next[i][parent], [child]: val } };
    } else {
      next[i] = { ...next[i], [field]: val };
    }
    setItems(next);
  };

  const handleAddItem = () => {
    setItems(prev => [...prev, { ...EMPTY_ITEM }]);
    setExpandedItem(items.length);
  };

  const handleRemoveItem = (i) => {
    if (items.length === 1) return toast.error('At least one item required');
    setItems(items.filter((_, idx) => idx !== i));
    if (expandedItem >= items.length - 1) setExpandedItem(Math.max(0, expandedItem - 1));
  };

  const handleSplitItem = (i) => {
    const item = items[i];
    if (parseInt(item.quantity) <= 1) return toast.error('Need qty > 1 to split');
    const half = Math.floor(parseInt(item.quantity) / 2);
    const next = [...items];
    next[i] = { ...next[i], quantity: parseInt(item.quantity) - half };
    next.splice(i + 1, 0, { ...item, quantity: half, serial_number: '', batch_number: '' });
    setItems(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!orgNodeId) return toast.error('Select a destination node');

    const invalidItems = items.filter(it => !it.product_id);
    if (invalidItems.length) return toast.error('Select a product for all items');

    setSubmitting(true);
    try {
      const payload = {
        org_node_id: parseInt(orgNodeId),
        supplier,
        items: items.map(it => {
          const itemPayload = {
            quantity: parseInt(it.quantity),
            serial_number: it.serial_number,
            batch_number: it.batch_number,
            location_details: it.location_details,
            condition: it.condition
          };
          if (it.product_id === 'NEW') {
            itemPayload.new_product = it.new_product;
          } else {
            itemPayload.product_id = parseInt(it.product_id);
          }
          return itemPayload;
        })
      };

      await inventoryService.createStoreForm(payload);
      toast.success('✅ Stock Intake Registered Successfully');
      navigate('/inventory/manage');
    } catch (err) {
      const backendError = err.response?.data;
      if (backendError?.errors && Array.isArray(backendError.errors)) {
        // Display the first specific validation error
        const firstError = backendError.errors[0];
        toast.error(`${firstError.field ? `${firstError.field.split('.').pop()}: ` : ''}${firstError.message}`);
      } else {
        toast.error(backendError?.message || 'Intake process failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const totalQty = items.reduce((s, it) => s + (parseInt(it.quantity) || 0), 0);
  const totalValue = 0; // Financial fields removed per user request

  if (!canIntake) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-10">
        <div className="w-24 h-24 bg-red-100 rounded-[35px] flex items-center justify-center mb-6 rotate-6 shadow-2xl shadow-red-100">
          <ShieldAlert size={40} className="text-red-500" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic mb-2">Access Restricted</h1>
        <p className="text-xs text-slate-400 uppercase tracking-widest max-w-sm">
          Your role does not have <span className="text-red-500">Stock Intake</span> clearance.
        </p>
        <button onClick={() => navigate('/dashboard')} className="mt-8 h-12 px-8 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-700 transition-all">
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-8 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-950 rounded-[28px] flex items-center justify-center shadow-2xl rotate-3">
            <PackageCheck className="text-blue-500" size={28} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Stock Intake</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">Arrival & Asset Registration Ledger</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
          {[['new', 'New Intake', Plus], ['list', 'Active Intakes', LayoutList]].map(([v, label, Icon]) => (
            <button key={v} onClick={() => setView(v)} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === v ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
      </div>

      {view === 'new' ? (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Left Panel */}
          <div className="xl:col-span-4 space-y-6">
            <div className="bg-slate-950 rounded-[40px] p-8 text-white space-y-6 shadow-2xl">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <Building2 className="text-blue-400" size={20} />
                <h3 className="font-black uppercase tracking-widest text-xs">Destination & Logistics</h3>
              </div>

              <Field label="Destination Unit *">
                <CascadingUnitSelector value={orgNodeId} onChange={setOrgNodeId} className="bg-white/10 border-white/20 text-white" />
              </Field>

              <Field label="Global Supplier">
                <div className="relative">
                  <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Vendor / Supplier name" className="w-full h-11 pl-10 pr-4 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:border-blue-400 transition-all" />
                </div>
              </Field>
            </div>

            {/* Summary Card */}
            <div className="bg-blue-600 rounded-[40px] p-8 shadow-2xl shadow-blue-200 space-y-4">
              <div className="flex items-center gap-3">
                <Barcode className="text-white/40" size={20} />
                <h3 className="font-black text-white uppercase tracking-widest text-[10px]">Intake Summary</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-5xl font-black text-white tracking-tighter italic">{totalQty}</div>
                  <div className="text-[9px] font-black text-white/50 uppercase tracking-widest mt-1">Total Units</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-white tracking-tighter">{totalValue > 0 ? totalValue.toLocaleString() : '—'}</div>
                  <div className="text-[9px] font-black text-white/50 uppercase tracking-widest mt-1">Est. Value</div>
                </div>
              </div>
              <div className="text-[9px] text-white/40 uppercase tracking-widest">{items.length} line item{items.length !== 1 ? 's' : ''}</div>
            </div>

            <button
               type="button"
               onClick={handleAddItem}
               className="w-full flex items-center justify-center gap-2 h-14 border-2 border-dashed border-blue-300 rounded-3xl text-blue-600 font-black uppercase text-[10px] tracking-widest hover:bg-blue-50 transition-all"
             >
               <Plus size={18} /> Add Line Item
             </button>

             {/* Bulk Import */}
             <div className="bg-slate-50 border border-slate-200 rounded-[30px] p-6 space-y-4">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-purple-100 rounded-xl text-purple-600"><Upload size={18} /></div>
                   <div>
                     <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Bulk CSV Upload</h3>
                     <button type="button" onClick={handleDownloadTemplate} className="text-[9px] font-bold uppercase tracking-wider text-blue-500 hover:text-blue-700 flex items-center gap-1 mt-0.5">
                       <Download size={10} /> Download Template
                     </button>
                   </div>
                </div>
                
                <input 
                  type="file" 
                  accept=".csv" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden" 
                  id="csv-upload" 
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 h-12 bg-white border border-slate-200 hover:border-purple-300 rounded-2xl text-slate-600 hover:text-purple-600 font-black uppercase text-[9px] tracking-widest transition-all shadow-sm"
                >
                  <Upload size={14} /> Select CSV File
                </button>
             </div>
          </div>

          {/* Right Panel: Items */}
          <div className="xl:col-span-8 space-y-5">
            {items.map((item, i) => {
              const product = products.find(p => p.id === parseInt(item.product_id));
              const isExpanded = expandedItem === i;
              return (
                <div key={i} className="bg-white rounded-[40px] shadow-xl ring-1 ring-slate-100 overflow-hidden hover:shadow-2xl transition-all duration-300">
                  {/* Item Header */}
                  <div className="flex items-center gap-4 p-6 bg-slate-50 border-b border-slate-100">
                    <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-sm shrink-0">{i + 1}</div>
                    <div className="flex-1">
                        <select
                          className={`${sel} ${item.product_id === 'NEW' ? 'ring-2 ring-blue-500 border-blue-500 text-blue-600 font-black' : ''}`}
                          value={item.product_id}
                          onChange={e => updateItem(i, 'product_id', e.target.value)}
                          required
                        >
                          <option value="">— Select Product / Asset —</option>
                          <option value="NEW" className="font-black text-blue-600 bg-blue-50 focus:bg-blue-600 focus:text-white">✦ UNREGISTERED ASSET? (CREATE BLUEPRINT) ✦</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name} · {p.sku} {p.brand ? `(${p.brand})` : ''}</option>
                          ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" onClick={() => setExpandedItem(isExpanded ? -1 : i)} className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-blue-50 hover:border-blue-300 transition-all">
                        {isExpanded ? <ChevronUp size={16} className="text-blue-500" /> : <ChevronDown size={16} className="text-slate-400" />}
                      </button>
                      <button type="button" onClick={() => handleSplitItem(i)} className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-amber-50 hover:border-amber-300 transition-all" title="Split">
                        <Split size={16} className="text-amber-500" />
                      </button>
                      <button type="button" onClick={() => handleRemoveItem(i)} className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-red-50 hover:border-red-300 transition-all">
                        <X size={16} className="text-red-400" />
                      </button>
                    </div>
                  </div>

                  {/* Always-visible row: qty, condition */}
                  <div className="px-6 py-5 grid grid-cols-2 gap-4">
                    <Field label="Quantity *">
                      <input type="number" min="1" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} required className={inp} />
                    </Field>
                    <Field label="Condition">
                      <select value={item.condition} onChange={e => updateItem(i, 'condition', e.target.value)} className={sel}>
                        <option value="new">New</option>
                        <option value="used">Used</option>
                        <option value="refurbished">Refurbished</option>
                        <option value="damaged">Damaged</option>
                        <option value="maintenance">Maintenance</option>
                      </select>
                    </Field>
                  </div>

                  {/* Expanded: full details */}
                  {isExpanded && (
                    <div className="px-6 pb-6 space-y-5 border-t border-slate-100 pt-5">
                      
                      {/* Dynamic Blueprint Form (Only if NEW is selected) */}
                      {item.product_id === 'NEW' && (
                        <div className="space-y-5 bg-blue-50/50 p-6 rounded-3xl border border-blue-100 relative overflow-hidden">
                           <div className="absolute top-0 right-0 p-4 opacity-10">
                              <PackageCheck size={100} />
                           </div>
                           <h4 className="font-black text-blue-800 uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                             <Plus size={16} /> Dynamic Blueprint Generation
                           </h4>
                           
                           <Section icon={<Tag size={16} className="text-blue-500" />} title="Asset Identity" collapsible={false}>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <Field label="Asset Name *">
                                   <input value={item.new_product.name} onChange={e => updateItem(i, 'new_product.name', e.target.value)} placeholder="e.g. Dell XPS 15" required className={inp} />
                                </Field>
                                <Field label="SKU / Identifier *">
                                   <input value={item.new_product.sku} onChange={e => updateItem(i, 'new_product.sku', e.target.value)} placeholder="e.g. IT-DEL-XPS-01" required className={inp} />
                                </Field>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <Field label="Category"><input value={item.new_product.category} onChange={e => updateItem(i, 'new_product.category', e.target.value)} placeholder="Electronics" className={inp} /></Field>
                                <Field label="Sub-Category"><input value={item.new_product.sub_category} onChange={e => updateItem(i, 'new_product.sub_category', e.target.value)} placeholder="Laptops" className={inp} /></Field>
                                <Field label="Brand"><input value={item.new_product.brand} onChange={e => updateItem(i, 'new_product.brand', e.target.value)} placeholder="Dell" className={inp} /></Field>
                                <Field label="Model Ref"><input value={item.new_product.model} onChange={e => updateItem(i, 'new_product.model', e.target.value)} className={inp} /></Field>
                                <Field label="Unit of Measure"><input value={item.new_product.unit} onChange={e => updateItem(i, 'new_product.unit', e.target.value)} placeholder="e.g. Piece (PC), Box, Set" className={inp} /></Field>
                             </div>
                           </Section>

                           <Section icon={<Cpu size={16} className="text-purple-500" />} title="Technical Specs (Optional)" color="purple" collapsible={true} defaultOpen={false}>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Field label="Processor"><input value={item.new_product.processor} onChange={e => updateItem(i, 'new_product.processor', e.target.value)} className={inp} /></Field>
                                <Field label="RAM Memory"><input value={item.new_product.ram} onChange={e => updateItem(i, 'new_product.ram', e.target.value)} className={inp} /></Field>
                                <Field label="Storage"><input value={item.new_product.storage} onChange={e => updateItem(i, 'new_product.storage', e.target.value)} className={inp} /></Field>
                                <Field label="Graphics"><input value={item.new_product.graphics} onChange={e => updateItem(i, 'new_product.graphics', e.target.value)} className={inp} /></Field>
                                <Field label="Display"><input value={item.new_product.display} onChange={e => updateItem(i, 'new_product.display', e.target.value)} className={inp} /></Field>
                                <Field label="OS"><input value={item.new_product.os} onChange={e => updateItem(i, 'new_product.os', e.target.value)} className={inp} /></Field>
                             </div>
                           </Section>

                           <Section icon={<Layers size={16} className="text-amber-500" />} title="Physical Specs (Optional)" color="amber" collapsible={true} defaultOpen={false}>
                             <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <Field label="Weight"><input value={item.new_product.weight} onChange={e => updateItem(i, 'new_product.weight', e.target.value)} className={inp} /></Field>
                                <Field label="Dimensions"><input value={item.new_product.dimensions} onChange={e => updateItem(i, 'new_product.dimensions', e.target.value)} className={inp} /></Field>
                                <Field label="Color"><input value={item.new_product.color} onChange={e => updateItem(i, 'new_product.color', e.target.value)} className={inp} /></Field>
                                <Field label="Material"><input value={item.new_product.material} onChange={e => updateItem(i, 'new_product.material', e.target.value)} className={inp} /></Field>
                             </div>
                           </Section>
                        </div>
                      )}

                      {/* Identity & Tracking (For Inventory Record specifically) */}
                      <Section icon={<ScanLine size={16} className="text-emerald-500" />} title="Registry Tracking" color="emerald" collapsible={false}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Field label="Serial Number">
                            <input value={item.serial_number} onChange={e => updateItem(i, 'serial_number', e.target.value)} placeholder="SN-XXXX-XXXX" className={inp} />
                          </Field>
                          <Field label="Batch / Lot Number">
                            <input value={item.batch_number} onChange={e => updateItem(i, 'batch_number', e.target.value)} placeholder="BATCH-XXXX" className={inp} />
                          </Field>
                          <Field label="Storage Location">
                            <input value={item.location_details} onChange={e => updateItem(i, 'location_details', e.target.value)} placeholder="Aisle A, Shelf 2" className={inp} />
                          </Field>
                        </div>
                      </Section>
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-20 bg-slate-950 rounded-[40px] text-white font-black text-xl tracking-tighter uppercase hover:bg-slate-800 transition-all shadow-2xl flex items-center justify-center gap-4 group disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center gap-3"><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Registering Intake...</span>
              ) : (
                <><ArrowRightCircle className="group-hover:translate-x-2 transition-transform" size={24} /> Commit to Registry</>
              )}
            </button>
          </div>
        </form>
      ) : (
        /* LIST VIEW */
        <div className="space-y-6">
          <div className="flex items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by store number or reference..."
                className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:border-blue-300 transition-all"
              />
            </div>
            <button onClick={() => refetchList()} className="flex items-center gap-2 h-12 px-6 bg-slate-100 hover:bg-slate-200 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-600 transition-all">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {listLoading ? (
            <div className="text-center py-16 text-slate-400">Loading intakes...</div>
          ) : (
            <div className="space-y-4">
              {(storeForms?.data || []).map(form => (
                <div key={form.id} className="bg-white rounded-[40px] shadow-xl ring-1 ring-slate-100 overflow-hidden hover:shadow-2xl transition-all border-l-8 border-slate-900">
                  <div className="p-8 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-5 flex-1">
                      <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-sm italic">#{form.id}</div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">{form.store_number}</h3>
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            form.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                            form.status?.startsWith('pending') ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {form.status?.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {form.organizationNode?.name} · {new Date(form.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-xs font-black text-slate-600 italic mt-0.5">Supplier: {form.supplier || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      {form.status?.startsWith('pending') && (
                        <button
                          onClick={async () => {
                            try {
                              const res = await api.post(`/store/${form.id}/approve`, {});
                              toast.success(res.data.message || 'Approved');
                              refetchList();
                            } catch (err) {
                              toast.error(err.response?.data?.message || 'Approval failed');
                            }
                          }}
                          className="flex items-center gap-2 h-12 px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all"
                        >
                          <CheckCircle2 size={16} /> Approve
                        </button>
                      )}
                      <button
                        onClick={() => toast('Details view coming soon', { icon: '🔜' })}
                        className="h-12 px-6 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!(storeForms?.data?.length) && (
                <div className="text-center py-20 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
                  <Clock className="text-slate-300 mx-auto mb-4" size={40} />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No intake records found.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StorePage;
