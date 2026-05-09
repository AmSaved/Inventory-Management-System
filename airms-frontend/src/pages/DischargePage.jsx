import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useFetch } from '../hooks/useFetch';
import inventoryService from '../services/inventoryService';
import toast from 'react-hot-toast';
import Card, { CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import CascadingUnitSelector from '../components/common/CascadingUnitSelector';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, 
  User as UserIcon, 
  ArrowRight, 
  Package, 
  Split, 
  Trash2, 
  Plus, 
  Zap, 
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Search,
  FileUp,
  Download,
  Upload,
  Layers,
  Cpu,
  RefreshCw
} from 'lucide-react';

const LiveStockBadge = ({ productId, nodeId }) => {
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!productId || !nodeId) return;
    const fetchStock = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/inventory/availability?product_id=${productId}&org_node_id=${nodeId}`);
        setStock(res.data.data?.current_quantity || 0);
      } catch (err) {
        setStock(0);
      } finally {
        setLoading(false);
      }
    };
    fetchStock();
  }, [productId, nodeId]);

  if (!productId || !nodeId) return null;

  return (
    <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 ${stock === 0 ? 'bg-red-50 border-red-100 text-red-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
      <div className={`w-2 h-2 rounded-full animate-pulse ${stock === 0 ? 'bg-red-600' : 'bg-emerald-600'}`} />
      <span className="text-[10px] font-black uppercase tracking-widest">
        {loading ? 'CALCULATING...' : `IN STOCK: ${stock}`}
      </span>
    </div>
  );
};

const DischargePage = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const fileInputRef = React.useRef(null);
  
  const canDischarge = hasPermission('stock:discharge');
  
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('request_id');

  const [fromUnitId, setFromUnitId] = useState('');
  const [items, setItems] = useState([{ 
    product_id: '', 
    to_unit_id: '',
    quantity: 1, 
    batch_number: '', 
    serial_numbers: [], 
    condition: 'new' 
  }]);
  
  const [view, setView] = useState(searchParams.get('view') || 'new'); // 'new' or 'list'
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  const { data: dischargeForms, loading: listLoading, refetch: refetchList } = useFetch(`/discharge?search=${search}`);
  const { data: productsData } = useFetch('/products');
  const { data: usersData } = useFetch('/users');
  const { data: treeData, loading: treeLoading, refetch: refetchTree } = useFetch('/organization/nodes/tree?scope=distribution');
  
  const products = Array.isArray(productsData) ? productsData : (productsData?.products || productsData?.data || []);
  const fullTree = Array.isArray(treeData) ? treeData : (treeData?.data || []);
  
  useEffect(() => {
    const v = searchParams.get('view');
    if (v) setView(v);
  }, [searchParams]);

  useEffect(() => {
    if (user?.org_node_id && !fromUnitId && !requestId) {
      setFromUnitId(user.org_node_id);
    }
  }, [user, requestId]);

  useEffect(() => {
    if (requestId) {
      api.get(`/requests/${requestId}`).then(res => {
        const request = res.data.data;
        setFromUnitId(request.org_unit_id);
        setItems(request.items.map(item => ({
          product_id: item.product_id,
          to_unit_id: '',
          quantity: item.quantity_requested,
          batch_number: '',
          serial_numbers: [],
          condition: 'new'
        })));
      });
    }
  }, [requestId]);

  const handleAddItem = () => {
    setItems([...items, { product_id: '', to_unit_id: '', quantity: 1, batch_number: '', serial_numbers: [], condition: 'new' }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSplitItem = (index) => {
    const item = items[index];
    const totalQty = parseInt(item.quantity) || 0;
    if (totalQty <= 1) return toast.error('Cannot split quantity of 1');

    const splitInput = window.prompt("In how many branches to split?", "2");
    const splitCount = parseInt(splitInput);

    if (!splitCount || splitCount < 2) return;
    if (splitCount > totalQty) return toast.error(`Maximum possible splits for this quantity is ${totalQty}`);

    const baseQty = Math.floor(totalQty / splitCount);
    const remainder = totalQty % splitCount;
    
    const newItems = [...items];
    const itemTemplate = { ...item };
    
    // Remove the original item so we can replace it with the new batch
    newItems.splice(index, 1);

    const generatedItems = [];
    for (let i = 0; i < splitCount; i++) {
      generatedItems.push({
        ...itemTemplate,
        quantity: i === splitCount - 1 ? (baseQty + remainder) : baseQty,
        serial_numbers: [] // Clear SNs for new branches
      });
    }

    newItems.splice(index, 0, ...generatedItems);
    setItems(newItems);
    toast.success(`Successfully fractured item into ${splitCount} distribution lines.`);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleDownloadTemplate = () => {
    const headers = 'SKU,Quantity,SerialNumbers,Condition,BatchNumber\n';
    const rows = 'LAPTOP-001,5,"SN1, SN2, SN3, SN4, SN5",new,BATCH-A\n';
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'airms_discharge_template.csv';
    a.click();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const rows = text.split('\n').slice(1);
      const newItems = rows.map(row => {
        const [sku, qty, sns, cond, batch] = row.split(',').map(s => s?.trim());
        if (!sku) return null;
        const prod = products.find(p => p.sku === sku);
        return {
          product_id: prod ? prod.id.toString() : '',
          to_unit_id: '',
          quantity: parseInt(qty) || 1,
          serial_numbers: sns ? sns.replace(/"/g, '').split(',').map(s => s.trim()) : [],
          condition: cond || 'new',
          batch_number: batch || ''
        };
      }).filter(Boolean);
      
      if (newItems.length > 0) {
        setItems(newItems);
        toast.success(`Imported ${newItems.length} distribution lines.`);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fromUnitId) return toast.error('Select a source unit');
    
    setSubmitting(true);
    try {
      await inventoryService.createDischargeForm({
        discharge_type: 'unit',
        from_node_id: parseInt(fromUnitId),
        request_id: (requestId && !isNaN(parseInt(requestId))) ? parseInt(requestId) : null,
        items: items.map(it => ({
           ...it,
           product_id: parseInt(it.product_id),
           quantity: parseInt(it.quantity),
           to_node_id: it.to_unit_id ? parseInt(it.to_unit_id) : null,
           to_user_id: null
        }))
      });
      toast.success('Asset Issue Form Created Successfully');
      navigate('/dashboard');
    } catch (error) {
      const errorData = error.response?.data;
      console.error('Discharge Submission Error:', errorData);

      if (errorData?.errors && Array.isArray(errorData.errors)) {
        errorData.errors.forEach(err => {
          const field = err.path || err.param || 'Error';
          const msg = err.msg || 'Validation failed';
          toast.error(`${field}: ${msg}`);
        });
      } else if (errorData?.message) {
        toast.error(errorData.message);
      } else {
        toast.error('Discharge protocol rejected: Check target destinations and stock levels');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!canDischarge) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-[40px] m-10 border-4 border-dashed border-slate-200">
         <div className="w-24 h-24 bg-red-100 rounded-[35px] flex items-center justify-center mb-6 rotate-6 shadow-2xl shadow-red-100/50">
            <ShieldAlert size={40} className="text-red-500" />
         </div>
         <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic mb-2">Protocol Violation</h1>
         <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] max-w-sm leading-relaxed">
            Your assigned access level does not permit entry into the <span className="text-red-500">Asset Issuance Ledger</span>. Contact your administrator to request functional clearance.
         </p>
         <Button 
           variant="ghost" 
           onClick={() => navigate('/dashboard')}
           className="mt-10 h-14 px-10 rounded-2xl bg-white border border-slate-200 text-slate-900 font-black uppercase text-[10px] tracking-widest hover:bg-slate-100"
         >
           Return to Secure Hub
         </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12 py-10 px-4">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-b border-slate-100 pb-10">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
             <div className="w-16 h-16 bg-slate-950 rounded-[32px] flex items-center justify-center shadow-2xl rotate-6 transition-transform hover:rotate-0">
               <Zap className="text-blue-500 fill-blue-500" size={32} />
             </div>
             <div>
               <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Asset Distribution</h1>
               <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">
                 Oversight & Logistics Pipeline
               </div>
             </div>
          </div>
          
          <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit">
             <button 
               onClick={() => setView('new')}
               className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${view === 'new' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-500 hover:text-slate-800'}`}
             >
               Initiate Issue
             </button>
             <button 
               onClick={() => setView('list')}
               className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${view === 'list' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-500 hover:text-slate-800'}`}
             >
               Operational Ledger
             </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".csv" />
          
          <div className="flex bg-slate-100 p-1.5 rounded-[22px]">
             <button type="button" onClick={handleDownloadTemplate} className="p-3 hover:bg-white rounded-xl text-slate-400 hover:text-blue-600 transition-all group relative">
               <Download size={18} />
               <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Template</span>
             </button>
             <button type="button" onClick={() => fileInputRef.current.click()} className="p-3 hover:bg-white rounded-xl text-slate-400 hover:text-blue-600 transition-all group relative">
               <Upload size={18} />
               <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Bulk CSV</span>
             </button>
          </div>

          {view === 'new' && (
            <Button 
              type="button" 
              onClick={handleAddItem}
              className="bg-slate-950 hover:bg-black text-white font-black px-10 h-16 rounded-[28px] transition-all shadow-xl flex items-center gap-4 uppercase text-[10px] tracking-[0.2em]"
            >
              <Plus size={18} strokeWidth={3} /> Add manual item
            </Button>
          )}
        </div>
      </div>
      
      {view === 'new' ? (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-12">
          {/* Logistics Panel */}
          <div className="xl:col-span-4 space-y-10">
             <Card className="rounded-[40px] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-slate-100">
                 <div className="bg-slate-950 p-10 relative overflow-hidden h-full flex flex-col justify-center">
                  <div className="absolute -right-4 -top-4 w-32 h-32 bg-blue-600/20 rounded-full blur-3xl opacity-50" />
                  <div className="flex items-center gap-2 mb-4">
                     <Building2 className="text-blue-500" size={16} />
                     <h2 className="text-blue-500 font-black uppercase tracking-[0.3em] text-[10px]">Extraction Source</h2>
                  </div>
                  <h3 className="text-white text-3xl font-black tracking-tighter leading-none mb-8 italic uppercase">Inventory Origin</h3>
                  
                  <div className="space-y-6 relative z-10">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Centralized Registry Node</label>
                        <CascadingUnitSelector 
                          value={fromUnitId}
                          onChange={setFromUnitId}
                          initialTree={fullTree}
                          loading={treeLoading}
                          className="bg-white"
                        />
                    </div>
                  </div>
                </div>
             </Card>

             <div className="bg-slate-950 rounded-[50px] p-10 ring-8 ring-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-2">Issue Payload</div>
                  <div className="text-7xl font-black text-white tracking-tighter italic">
                    {items.length}
                  </div>
                </div>
                <div className="w-20 h-20 bg-blue-600 rounded-[30px] flex items-center justify-center shadow-2xl shadow-blue-500/20">
                  <CheckCircle2 className="text-white" size={40} />
                </div>
             </div>
          </div>

          {/* Assets Processing Panel */}
          <div className="xl:col-span-8 space-y-10">
             <div className="space-y-8">
                {items.map((item, index) => (
                  <Card key={index} className="rounded-[50px] border-none bg-white shadow-2xl hover:shadow-blue-900/5 transition-all duration-700 overflow-hidden ring-1 ring-slate-100 group">
                     <div className="flex flex-col lg:flex-row">
                        <div className="lg:w-28 bg-slate-950 flex lg:flex-col items-center justify-center p-6 gap-10">
                           <div className="text-4xl font-black text-blue-500/30 italic group-hover:text-blue-500 transition-colors">
                              0{index + 1}
                           </div>
                           <button 
                              type="button" 
                              onClick={() => handleRemoveItem(index)}
                              className="text-slate-700 hover:text-red-500 transition-colors p-4 hover:bg-slate-900 rounded-3xl"
                           >
                             <Trash2 size={24} />
                           </button>
                        </div>
                        
                        <div className="flex-1 p-10 space-y-10">
                           <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
                              <div className="space-y-4 flex-1 w-full max-w-lg">
                                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Registry Category</label>
                                 <select
                                   className="w-full h-14 bg-slate-50 border-none rounded-2xl px-6 font-black text-xs uppercase text-slate-900 focus:bg-white shadow-inner transition-all appearance-none outline-none"
                                   value={item.product_id}
                                   onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                                   required
                                 >
                                   <option value="">Catalogue Selection</option>
                                   {products?.map(p => <option key={p.id} value={p.id.toString()}>{p.name} — [{p.sku}]</option>)}
                                 </select>
                              </div>

                              <div className="space-y-4 w-full lg:w-auto text-right">
                                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2 block">Discharge Amount</label>
                                 <div className="flex items-center justify-end gap-4">
                                    <LiveStockBadge productId={item.product_id} nodeId={fromUnitId} />
                                    <button type="button" onClick={() => handleSplitItem(index)} className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-white transition-all shadow-sm border border-slate-100">
                                       <Split size={14} />
                                    </button>
                                    <Input 
                                      type="number" 
                                      value={item.quantity} 
                                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                      className="w-32 h-14 border-none bg-slate-50 rounded-2xl font-black text-xl text-blue-600 text-center shadow-inner"
                                      required 
                                    />
                                 </div>
                              </div>
                           </div>

                           {(() => {
                             const selectedP = products?.find(p => p.id.toString() === item.product_id);
                             if (!selectedP) return null;
                             return (
                                <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in duration-300">
                                   <div className="space-y-1">
                                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Architectural DNA</div>
                                      <div className="text-[10px] font-bold text-slate-900 truncate uppercase">{selectedP.category} / {selectedP.sub_category}</div>
                                   </div>
                                   <div className="space-y-1">
                                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Brand / Model</div>
                                      <div className="text-[10px] font-bold text-slate-900 truncate uppercase">{selectedP.brand} {selectedP.model}</div>
                                   </div>
                                   <div className="space-y-1">
                                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">UOM Unit</div>
                                      <div className="text-[10px] font-bold text-slate-900 uppercase">{selectedP.unit}</div>
                                   </div>
                                   <div className="space-y-1 text-right">
                                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">State SKU</div>
                                      <div className="text-[10px] font-mono font-bold text-blue-500">{selectedP.sku}</div>
                                   </div>
                                </div>
                             );
                           })()}

                           <div className="bg-blue-50 p-6 rounded-[35px] border border-blue-100 flex flex-col gap-4">
                              <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest ml-4">Target Destination (Peer or Descendant Branch)</label>
                              <CascadingUnitSelector 
                                key={`target-node-${index}-${fromUnitId}`}
                                value={item.to_unit_id}
                                sourceNodeId={fromUnitId}
                                initialTree={fullTree}
                                loading={treeLoading}
                                onChange={(val) => updateItem(index, 'to_unit_id', val)}
                                className="bg-white rounded-[24px]"
                              />
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
                              <div className="space-y-2">
                                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Condition State</label>
                                 <select className="w-full h-12 bg-slate-50 border-none rounded-xl px-4 font-black text-[10px] uppercase text-slate-600 outline-none focus:ring-2 focus:ring-blue-100" value={item.condition} onChange={(e) => updateItem(index, 'condition', e.target.value)}>
                                    <option value="new">Operational Alpha (New)</option>
                                    <option value="good">Operational Beta (Used)</option>
                                    <option value="fair">Degraded (Fair)</option>
                                    <option value="damaged">Critical (Damaged)</option>
                                 </select>
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Serial Reference Sequence</label>
                                 <Input 
                                    placeholder="SN SEQUENCE (COMMAS)" 
                                    value={item.serial_numbers?.join(', ') || ''} 
                                    onChange={(e) => {
                                      const val = e.target.value.trim();
                                      const sns = val ? val.split(',').map(s => s.trim()).filter(Boolean) : null;
                                      updateItem(index, 'serial_numbers', sns);
                                    }} 
                                    className="h-12 border-none bg-slate-50 rounded-xl font-bold px-6 text-xs text-slate-500" 
                                  />
                              </div>
                           </div>
                        </div>
                     </div>
                  </Card>
                ))}
             </div>

             <div className="pt-10 flex flex-col gap-6">
                <Button 
                  disabled={submitting}
                  type="submit" 
                  className="w-full bg-slate-950 h-28 rounded-[55px] shadow-2xl hover:bg-black text-white font-black text-3xl tracking-tighter uppercase transition-all flex items-center justify-center gap-8 group scale-95 hover:scale-100"
                >
                  {submitting ? 'Authenticating Issue...' : (
                    <>Issue Assets <ArrowRight className="group-hover:translate-x-4 transition-all" size={32} /> </>
                  )}
                </Button>
             </div>
          </div>
        </form>
      ) : (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
           {/* Filtering Interface */}
           <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl flex flex-col md:flex-row items-center gap-6">
              <div className="relative flex-1 w-full">
                 <Package className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                 <Input 
                   placeholder="Registry Search (Discharge Number / ID)..." 
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                   className="pl-16 h-16 border-none bg-slate-50 font-black rounded-3xl text-sm uppercase tracking-widest"
                 />
              </div>
              <Button onClick={() => refetchList()} className="h-16 px-10 rounded-3xl bg-slate-900 border-none font-black uppercase text-[10px] tracking-[0.3em] hover:bg-black transition-colors w-full md:w-auto">
                 Sync Record Ledger
              </Button>
           </div>

           {/* Results Grid */}
           <div className="grid grid-cols-1 gap-8">
              {dischargeForms?.data?.map(form => (
                <Card key={form.id} className="rounded-[50px] border-none shadow-2xl bg-white overflow-hidden group hover:scale-[1.01] transition-transform duration-500 ring-1 ring-slate-100">
                   <div className="flex flex-col xl:flex-row">
                      <div className="p-10 flex-1 flex flex-col md:flex-row items-start md:items-center gap-10">
                         <div className="w-24 h-24 bg-slate-950 rounded-[35px] flex items-center justify-center text-blue-500 font-black text-xl italic shadow-2xl">
                            ID#{form.id}
                         </div>
                         <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-4">
                               <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">{form.discharge_number}</h3>
                               <Badge className={`rounded-[20px] px-5 py-2 font-black uppercase tracking-[0.3em] text-[8px] shadow-sm ${
                                 form.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                 form.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                                 form.status.startsWith('pending') ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                               }`}>
                                 {form.status.replace('_', ' ')}
                               </Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-2">
                               <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  <Building2 size={12} className="text-blue-500" /> {form.fromNode?.name}
                               </div>
                               <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  <ArrowRight size={12} className="text-slate-300" /> {form.discharge_type === 'user' ? `${form.toUser?.first_name} ${form.toUser?.last_name}` : form.toNode?.name}
                               </div>
                            </div>
                         </div>
                      </div>

                      <div className="bg-slate-50 p-10 flex items-center justify-center gap-4 border-l border-slate-100">
                         {form.status.startsWith('pending') && (
                           <Button 
                             onClick={async () => {
                               try {
                                 const res = await api.post(`/discharge/${form.id}/approve`, {});
                                 toast.success(res.data.message);
                                 refetchList();
                                } catch (err) {
                                  const errorData = err.response?.data;
                                  if (errorData?.errors && Array.isArray(errorData.errors)) {
                                    errorData.errors.forEach(e => {
                                      const field = e.path || e.field || 'Error';
                                      const msg = e.msg || e.message || 'Validation failed';
                                      toast.error(`${field}: ${msg}`);
                                    });
                                  } else {
                                    toast.error(errorData?.message || 'Verification phase failed');
                                  }
                                }
                             }}
                             className="bg-amber-500 hover:bg-amber-400 text-white font-black px-10 h-16 rounded-3xl shadow-xl shadow-amber-100 uppercase text-[10px] tracking-[0.2em] transition-all"
                           >
                             Approve Phase
                           </Button>
                         )}
                         {form.status === 'approved' && (
                           <Button 
                             onClick={async () => {
                               try {
                                 const res = await api.post(`/discharge/${form.id}/execute`, {});
                                 toast.success(res.data.message);
                                 refetchList();
                                } catch (err) {
                                  const errorData = err.response?.data;
                                  if (errorData?.errors && Array.isArray(errorData.errors)) {
                                    errorData.errors.forEach(e => {
                                      const field = e.path || e.field || 'Error';
                                      const msg = e.msg || e.message || 'Validation failed';
                                      toast.error(`${field}: ${msg}`);
                                    });
                                  } else {
                                    toast.error(errorData?.message || 'Physical issue failed');
                                  }
                                }
                             }}
                             className="bg-blue-600 hover:bg-blue-500 text-white font-black px-10 h-16 rounded-3xl shadow-xl shadow-blue-200 uppercase text-[10px] tracking-[0.2em] transition-all"
                           >
                             Execute Issue
                           </Button>
                         )}
                         <Button variant="ghost" className="h-16 px-8 rounded-3xl bg-white text-slate-900 font-black uppercase text-[9px] tracking-widest shadow-sm hover:translate-y-[-2px] transition-all">
                            Manifest Details
                         </Button>
                      </div>
                   </div>
                </Card>
              ))}
              {dischargeForms?.data?.length === 0 && (
                <div className="py-32 bg-slate-50 rounded-[60px] border-4 border-dashed border-slate-200 flex flex-col items-center justify-center gap-6 opacity-40">
                   <Zap size={60} className="text-slate-300" />
                   <p className="font-black uppercase tracking-[0.4em] text-sm text-slate-400">Distribution Ledger Empty</p>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default DischargePage;
