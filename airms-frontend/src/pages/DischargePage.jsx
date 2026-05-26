import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useFetch } from '../hooks/useFetch';
import inventoryService from '../services/inventoryService';
import toast from 'react-hot-toast';
import Card, { CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/common/Modal';
import Badge from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
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
  const [page, setPage] = useState(1);
  
  // Physical Selection State
  const [selectionModalOpen, setSelectionModalOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(null);
  const [availablePhysicalItems, setAvailablePhysicalItems] = useState([]);
  const [loadingPhysical, setLoadingPhysical] = useState(false);

  const { data: dischargeForms, pagination, loading: listLoading, refetch: refetchList } = useFetch(`/discharge`, {
    params: {
      page,
      limit: 10,
      search: search || undefined,
      node_id: fromUnitId || undefined
    }
  });

  // Listen for workflow changes to refresh the list automatically
  useEffect(() => {
    const handler = () => {
      refetchList();
    };
    window.addEventListener('workflowUpdated', handler);
    return () => {
      window.removeEventListener('workflowUpdated', handler);
    };
  }, []);
  const { data: productsData } = useFetch('/products');
  const { data: usersData } = useFetch('/users');
  const { data: treeData, loading: treeLoading, refetch: refetchTree } = useFetch('/organization/nodes/tree?scope=distribution');
  
  const products = Array.isArray(productsData) ? productsData : (productsData?.products || productsData?.data || []);
  const fullTree = Array.isArray(treeData) ? treeData : (treeData?.data || []);
  
  // Reset page when search or branch filter changes
  useEffect(() => {
    setPage(1);
  }, [search, fromUnitId]);

  useEffect(() => {
    const v = searchParams.get('view');
    if (v) setView(v);
  }, [searchParams]);

  useEffect(() => {
    if (user?.org_node_id && !fromUnitId && !requestId) {
      setFromUnitId(user.org_node_id);
    }
  }, [user, requestId]);

  // Handle URL Pre-fill for Product or Specific Inventory
  useEffect(() => {
    const pid = searchParams.get('product_id');
    const nodeid = searchParams.get('org_node_id');
    const invid = searchParams.get('inventory_id');

    if (pid) {
      setItems([{ 
        product_id: pid, 
        to_unit_id: '',
        quantity: 1, 
        batch_number: '', 
        serial_numbers: [], 
        condition: 'new' 
      }]);
      if (nodeid) setFromUnitId(nodeid);
    } else if (invid) {
      // If we have a specific inventory ID, we should probably fetch its details to pre-fill
      api.get(`/inventory/${invid}`).then(res => {
        const inv = res.data.data;
        setItems([{
          product_id: inv.product_id.toString(),
          to_unit_id: '',
          quantity: 1,
          batch_number: inv.batch_number || '',
          serial_numbers: [inv.serial_number].filter(Boolean),
          condition: inv.condition || 'new'
        }]);
        setFromUnitId(inv.org_node_id.toString());
      });
    }
  }, [searchParams]);

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
    
    // If quantity or product changes, we might need to reset serial numbers if they no longer match
    if (field === 'product_id' || field === 'quantity') {
      newItems[index].serial_numbers = [];
    }
    
    setItems(newItems);
  };

  const openSelectionModal = async (index) => {
    const item = items[index];
    if (!item.product_id || !fromUnitId) {
      return toast.error('Select product and source unit first');
    }

    setActiveItemIndex(index);
    setLoadingPhysical(true);
    setSelectionModalOpen(true);

    try {
      const res = await api.get('/inventory', {
        params: {
          product_id: item.product_id,
          org_node_id: fromUnitId,
          status: 'available',
          limit: 200 // Show up to 200 available items
        }
      });
      
      // Get IDs already selected in OTHER items to prevent double selection
      const otherSelectedIds = items
        .filter((_, i) => i !== index)
        .flatMap(it => it.serial_numbers || []); // Assuming serial_numbers currently stores the serials/identifiers we pick

      // Wait, we should probably store inventory_ids in a separate field or use serial_numbers as unique identifiers
      // Let's assume serial_numbers stores the unique serial string for now.
      
      setAvailablePhysicalItems(res.data.data || []);
    } catch (err) {
      toast.error('Failed to fetch physical inventory items');
    } finally {
      setLoadingPhysical(false);
    }
  };

  const togglePhysicalItem = (serial) => {
    const newItems = [...items];
    const currentSns = newItems[activeItemIndex].serial_numbers || [];
    const targetQty = parseInt(newItems[activeItemIndex].quantity);

    if (currentSns.includes(serial)) {
      newItems[activeItemIndex].serial_numbers = currentSns.filter(s => s !== serial);
    } else {
      if (currentSns.length >= targetQty) {
        return toast.error(`You can only select up to ${targetQty} items for this line`);
      }
      
      // Check for global uniqueness
      const isAlreadyPicked = items.some((it, i) => 
        i !== activeItemIndex && it.serial_numbers?.includes(serial)
      );
      
      if (isAlreadyPicked) {
        return toast.error('This specific item is already assigned to another branch/line');
      }

      newItems[activeItemIndex].serial_numbers = [...currentSns, serial];
    }
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
    
    // Validation: Check that each item has exactly the required number of physical items selected
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const required = parseInt(item.quantity);
      const selected = item.serial_numbers?.length || 0;
      
      if (selected !== required) {
        return toast.error(`Line ${i + 1}: Please select exactly ${required} physical items (currently ${selected})`);
      }
    }
    
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
      toast.success('Discharged successfully');
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
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-2xl m-4 border-2 border-dashed border-slate-200">
         <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center mb-4 shadow-sm">
            <ShieldAlert size={28} className="text-red-500" />
         </div>
         <h1 className="text-lg font-bold text-slate-900 tracking-tight mb-1">Protocol Violation</h1>
         <p className="text-xs font-semibold text-slate-400 max-w-sm leading-relaxed">
            Your assigned access level does not permit entry into the <span className="text-red-500">Asset Issuance Ledger</span>. Contact your administrator to request functional clearance.
         </p>
         <Button 
           variant="ghost" 
           onClick={() => navigate('/dashboard')}
           className="mt-6 h-10 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100"
         >
           Return to Secure Hub
         </Button>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 py-6 px-4 lg:px-6">
      {/* Dynamic Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-slate-100 pb-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
             <div className="w-11 h-11 bg-slate-900 rounded-xl flex items-center justify-center shadow-sm">
               <Zap className="text-blue-500 fill-blue-500" size={20} />
             </div>
             <div>
               <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Discharge Inventories to Branches</h1>
             </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
             <button 
               onClick={() => setView('new')}
               className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'new' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'}`}
             >
               Discharge
             </button>
             <button 
               onClick={() => setView('list')}
               className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'list' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'}`}
             >
               Discharge History
             </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".csv" />
          
          <div className="flex bg-slate-100 p-1 rounded-xl">
             <button type="button" onClick={handleDownloadTemplate} className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-blue-600 transition-all group relative">
               <Download size={16} />
               <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Template</span>
             </button>
             <button type="button" onClick={() => fileInputRef.current.click()} className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-blue-600 transition-all group relative">
               <Upload size={16} />
               <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Bulk CSV</span>
             </button>
          </div>

          {view === 'new' && (
            <Button 
              type="button" 
              onClick={handleAddItem}
              className="bg-slate-950 hover:bg-black text-white font-bold h-10 px-4 rounded-lg transition-all shadow-sm flex items-center gap-1.5 text-xs"
            >
              <Plus size={14} strokeWidth={2.5} /> Add manual item
            </Button>
          )}
        </div>
      </div>
      
      {view === 'new' ? (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Logistics Panel */}
          <div className="xl:col-span-4 space-y-6">
             <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden ring-1 ring-slate-100">
                  <div className="bg-gradient-to-br from-slate-50 via-slate-100 to-white p-5 relative overflow-hidden h-full flex flex-col justify-center">
                   <div className="absolute -right-4 -top-4 w-32 h-32 bg-blue-600/20 rounded-full blur-3xl opacity-50" />
                   <h3 className="text-slate-900 text-base font-bold tracking-tight leading-tight mb-4">Inventory Origin</h3>
                    
                   <div className="space-y-4 relative z-10">
                     <div className="space-y-1">
                         <label className="text-xs font-semibold text-slate-500 ml-1"></label>
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

              <div className="bg-white rounded-2xl p-5 ring-1 ring-slate-200 flex items-center justify-between shadow-sm">
                 <div>
                   <div className="text-xs font-bold text-blue-600 mb-1">Issue Payload</div>
                   <div className="text-3xl font-bold text-slate-900 tracking-tight">
                     {items.length}
                   </div>
                 </div>
                 <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                   <CheckCircle2 className="text-white" size={24} />
                 </div>
              </div>
          </div>

          {/* Assets Processing Panel */}
          <div className="xl:col-span-8 space-y-6">
             <div className="space-y-6">
                {items.map((item, index) => (
                  <Card key={index} className="relative rounded-2xl border-none bg-white shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden ring-1 ring-slate-100 group">
                     <div className="flex flex-col">
                        <div className="absolute right-4 top-1/2 hidden lg:flex flex-col items-center gap-2 -translate-y-1/2">
                           <div className="w-8 h-8 rounded-lg bg-slate-900 text-blue-500 flex items-center justify-center text-xs font-bold italic">
                              0{index + 1}
                           </div>
                           <button 
                              type="button" 
                              onClick={() => handleRemoveItem(index)}
                              className="w-8 h-8 rounded-lg bg-white text-slate-600 hover:text-red-500 hover:bg-slate-100 transition-colors shadow-sm grid place-items-center border border-slate-100"
                           >
                             <Trash2 size={14} />
                           </button>
                        </div>
                        <div className="flex-1 p-5 space-y-6">
                           <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
                              <div className="space-y-1 flex-1 w-full max-w-lg">
                                 <label className="text-xs font-semibold text-slate-500 ml-1">Category</label>
                                 <select
                                   className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg px-4 font-semibold text-sm text-slate-900 focus:bg-white transition-all outline-none"
                                   value={item.product_id}
                                   onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                                   required
                                 >
                                   <option value="">Select product</option>
                                   {products?.map(p => <option key={p.id} value={p.id.toString()}>{p.name} — [{p.sku}]</option>)}
                                 </select>
                              </div>

                              <div className="space-y-1 w-full lg:w-auto text-right">
                                 <label className="text-xs font-semibold text-slate-500 ml-1 block">Discharge Amount</label>
                                 <div className="flex items-center justify-end gap-2">
                                    <LiveStockBadge productId={item.product_id} nodeId={fromUnitId} />
                                    <button type="button" onClick={() => handleSplitItem(index)} className="p-2.5 bg-slate-50 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-white transition-all shadow-sm border border-slate-100">
                                       <Split size={14} />
                                    </button>
                                    <Input 
                                      type="number" 
                                      value={item.quantity} 
                                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                      className="w-20 h-10 border border-slate-200 bg-slate-50 rounded-lg font-bold text-sm text-blue-600 text-center shadow-inner"
                                      required 
                                    />
                                 </div>
                              </div>
                           </div>

                           {(() => {
                             const selectedP = products?.find(p => p.id.toString() === item.product_id);
                             if (!selectedP) return null;
                             return (
                                 <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in duration-300">
                                    <div className="space-y-0.5">
                                       <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Category</div>
                                       <div className="text-[10px] font-bold text-slate-900 truncate uppercase">{selectedP.category} / {selectedP.sub_category}</div>
                                    </div>
                                    <div className="space-y-0.5">
                                       <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Brand / Model</div>
                                       <div className="text-[10px] font-bold text-slate-900 truncate uppercase">{selectedP.brand} {selectedP.model}</div>
                                    </div>
                                    <div className="space-y-0.5">
                                       <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">UOM Unit</div>
                                       <div className="text-[10px] font-bold text-slate-900 uppercase">{selectedP.unit}</div>
                                    </div>
                                    <div className="space-y-0.5 text-right">
                                       <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">SKU</div>
                                       <div className="text-[10px] font-mono font-bold text-blue-500">{selectedP.sku}</div>
                                    </div>
                                 </div>
                              );
                           })()}

                           <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col gap-2">
                              <label className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider ml-1">Target Destination</label>
                              <CascadingUnitSelector 
                                key={`target-node-${index}-${fromUnitId}`}
                                value={item.to_unit_id}
                                sourceNodeId={fromUnitId}
                                initialTree={fullTree}
                                loading={treeLoading}
                                onChange={(val) => updateItem(index, 'to_unit_id', val)}
                                className="bg-white rounded-lg"
                              />
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                              <div className="space-y-1">
                                  <label className="text-[10px] font-semibold text-slate-500 ml-1">Condition State</label>
                                  <select className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg px-3 font-semibold text-xs text-slate-600 outline-none" value={item.condition} onChange={(e) => updateItem(index, 'condition', e.target.value)}>
                                     <option value="new">New</option>
                                     <option value="good">Used</option>
                                     <option value="damaged">Damaged</option>
                                  </select>
                              </div>
                              <div className="space-y-1 md:col-span-2">
                                  <label className="text-[10px] font-semibold text-slate-500 ml-1"></label>
                                  <button
                                    type="button"
                                    onClick={() => openSelectionModal(index)}
                                    className={`w-full h-10 rounded-lg font-bold px-4 text-xs transition-all flex items-center justify-between ${
                                      item.serial_numbers?.length === parseInt(item.quantity) 
                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                                        : 'bg-blue-600 text-white shadow-sm'
                                    }`}
                                  >
                                    <span>
                                      {item.serial_numbers?.length === parseInt(item.quantity) 
                                        ? `✓ ${item.serial_numbers.length} ITEMS ALLOCATED` 
                                        : `SELECT ${item.quantity} PHYSICAL ITEMS`}
                                    </span>
                                    <Layers size={14} />
                                  </button>
                                  {item.serial_numbers?.length > 0 && (
                                    <div className="mt-1.5 flex flex-wrap gap-1 px-1">
                                       {item.serial_numbers.map(sn => (
                                         <span key={sn} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold">
                                           {sn}
                                         </span>
                                       ))}
                                    </div>
                                  )}
                              </div>
                           </div>
                        </div>
                     </div>
                  </Card>
                ))}
             </div>

             <div className="pt-4">
                <Button 
                  disabled={submitting}
                  type="submit" 
                  className="w-full bg-slate-950 h-12 rounded-lg hover:bg-black text-white font-bold text-sm transition-all flex items-center justify-center gap-3 shadow-md"
                >
                  {submitting ? 'Authenticating Issue...' : (
                    <>Submit Manifest <ArrowRight size={16} /> </>
                  )}
                </Button>
             </div>
          </div>
        </form>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
           {/* Filtering Interface */}
           <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-4">
              <div className="relative flex-1 w-full">
                  <Package className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <Input 
                    placeholder="Search Discharge Number / ID..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 h-10 border border-slate-200 bg-slate-50 font-semibold rounded-lg text-xs"
                  />
              </div>
              <Button onClick={() => refetchList()} className="h-10 px-4 rounded-lg bg-slate-900 border-none font-bold text-xs hover:bg-black transition-colors w-full md:w-auto">
                 refresh
              </Button>
           </div>
           {(() => {
              const dischargeList = Array.isArray(dischargeForms) ? dischargeForms : (dischargeForms?.data || []);
              return (
                <div className="space-y-6">
                   <div className="grid grid-cols-1 gap-6">
                      {dischargeList.map(form => (
                        <Card key={form.id} className="rounded-xl border-none shadow-sm bg-white overflow-hidden ring-1 ring-slate-100 hover:shadow-md transition-all duration-300">
                           <div className="flex flex-col xl:flex-row">
                              <div className="p-5 flex-1 flex flex-col md:flex-row items-start md:items-center gap-4">
                                 <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-blue-500 font-bold text-xs shadow-sm">
                                    #{form.id}
                                 </div>
                                 <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-3">
                                       <h3 className="text-base font-bold text-slate-900 tracking-tight">{form.discharge_number}</h3>
                                       <Badge className={`rounded-full px-2.5 py-0.5 font-semibold text-[10px] border shadow-sm ${
                                         form.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                         form.status === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                         form.status.startsWith('pending') ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200'
                                       }`}>
                                         {form.status.replace('_', ' ')}
                                       </Badge>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                                       <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                                          <Building2 size={12} className="text-blue-500" /> {form.fromNode?.name}
                                        </div>
                                       <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                                          <ArrowRight size={12} className="text-slate-300" /> {form.discharge_type === 'user' ? `${form.toUser?.first_name} ${form.toUser?.last_name}` : form.toNode?.name}
                                       </div>
                                    </div>
                                 </div>
                              </div>
        
                              <div className="bg-slate-50/50 p-5 flex items-center justify-center gap-3 border-l border-slate-100">
                                 {(() => {
                                    const userCanApprove = form.can_action && !form.approvals?.some(a => Number(a.user_id) === Number(user?.id));

                                    if (!userCanApprove) return null;
        
                                    return (
                                       <div className="flex gap-2">
                                          <Button 
                                            onClick={async () => {
                                              try {
                                                const res = await api.post(`/discharge/${form.id}/approve`, { notes: 'Authorized via Ledger' });
                                                toast.success(res.data.message);
                                                refetchList();
                                                window.dispatchEvent(new Event('workflowUpdated'));
                                              } catch (err) {
                                                toast.error(err.response?.data?.message || 'Approval failed');
                                              }
                                            }}
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 h-10 rounded-lg text-xs transition-all"
                                          >
                                            Approve
                                          </Button>
                                          <Button 
                                            onClick={async () => {
                                              const reason = window.prompt("Reason for rejection:");
                                              if (reason === null) return;
                                              try {
                                                await api.post(`/discharge/${form.id}/reject`, { notes: reason });
                                                toast.success("Discharge protocol rejected.");
                                                refetchList();
                                                window.dispatchEvent(new Event('workflowUpdated'));
                                              } catch (err) {
                                                toast.error(err.response?.data?.message || 'Rejection failed');
                                              }
                                            }}
                                            className="bg-red-500 hover:bg-red-400 text-white font-bold px-4 h-10 rounded-lg text-xs transition-all"
                                          >
                                            Reject
                                          </Button>
                                       </div>
                                    );
                                 })()}
        
                                 {form.status === 'approved' && (
                                   <Button 
                                     onClick={async () => {
                                       try {
                                         const res = await api.post(`/discharge/${form.id}/execute`, {});
                                         toast.success(res.data.message);
                                         refetchList();
                                         window.dispatchEvent(new Event('workflowUpdated'));
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
                                     className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 h-10 rounded-lg text-xs transition-all"
                                   >
                                     Execute discharge
                                   </Button>
                                 )}
                                 <Button variant="ghost" className="h-10 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all">Details
                                 </Button>
                              </div>
                           </div>
                        </Card>
                      ))}
                      {dischargeList.length === 0 && (
                        <div className="py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-3 opacity-50">
                           <Zap size={40} className="text-slate-300" />
                           <p className="font-bold text-xs text-slate-400">Distribution Ledger Empty</p>
                        </div>
                      )}
                   </div>
                   
                   {pagination && pagination.pages > 1 && (
                     <div className="flex justify-center pt-4">
                        <Pagination pagination={pagination} onPageChange={setPage} />
                     </div>
                   )}
                </div>
              );
           })()}
        </div>
      )}

      {/* Physical Selection Modal */}
      <Modal
        isOpen={selectionModalOpen}
        onClose={() => setSelectionModalOpen(false)}
        title="Physical Asset Registry Allocation"
      >
        <div className="space-y-4 p-2">
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-blue-400 mb-0.5">Target Quantity</p>
              <p className="text-lg font-bold text-white">
                {items[activeItemIndex]?.serial_numbers?.length || 0} / {items[activeItemIndex]?.quantity || 0}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-500 mb-0.5">Catalog Unit</p>
              <p className="text-xs font-bold text-slate-300">
                {products.find(p => p.id.toString() === items[activeItemIndex]?.product_id)?.name || 'N/A'}
              </p>
            </div>
          </div>

          <div className="max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar space-y-2">
            {loadingPhysical ? (
              <div className="py-10 text-center text-slate-400 font-semibold text-xs animate-pulse">Scanning Registry...</div>
            ) : availablePhysicalItems.length === 0 ? (
              <div className="py-10 text-center text-slate-400 font-semibold text-xs">No available items found at origin unit</div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {availablePhysicalItems.map((inv) => {
                  const isPickedInOtherLine = items.some((it, i) => 
                    i !== activeItemIndex && it.serial_numbers?.includes(inv.serial_number)
                  );
                  const isSelected = items[activeItemIndex]?.serial_numbers?.includes(inv.serial_number);

                  return (
                    <button
                      key={inv.id}
                      type="button"
                      disabled={isPickedInOtherLine}
                      onClick={() => togglePhysicalItem(inv.serial_number)}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${
                        isSelected 
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm' 
                          : isPickedInOtherLine 
                            ? 'bg-slate-50 border-slate-100 text-slate-300 opacity-50 cursor-not-allowed'
                            : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${isSelected ? 'bg-white animate-pulse' : 'bg-slate-200'}`} />
                        <div className="text-left">
                          <p className="text-xs font-bold tracking-tight">{inv.serial_number || `ITEM-${inv.id}`}</p>
                          <p className={`text-[9px] font-semibold uppercase tracking-wider ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                            ID: {inv.id} {inv.batch_number ? `• BATCH: ${inv.batch_number}` : ''}
                          </p>
                        </div>
                      </div>
                      {isPickedInOtherLine && <span className="text-[9px] font-bold">ALREADY ALLOCATED</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Button
            onClick={() => setSelectionModalOpen(false)}
            className="w-full bg-slate-950 text-white h-10 rounded-lg font-bold text-xs shadow-sm hover:bg-black transition-colors"
          >
            Confirm Allocation Selection
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default DischargePage;
