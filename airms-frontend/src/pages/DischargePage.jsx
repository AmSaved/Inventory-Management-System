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
import LoadingSpinner from '../components/common/LoadingSpinner';
import Badge from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import CascadingUnitSelector from '../components/common/CascadingUnitSelector';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import QRCode from 'react-qr-code';
import { getAssetName } from '../utils/assetName';
import { 
  Building2, 
  User as UserIcon, 
  ArrowRight, 
  Package, 
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
  RefreshCw,
  Eye
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
    <div className={`px-2 py-1 rounded-lg border flex items-center gap-1.5 ${stock === 0 ? 'bg-red-50 border-red-100 text-red-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
      <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${stock === 0 ? 'bg-red-600' : 'bg-emerald-600'}`} />
      <span className="text-[9px] font-black uppercase tracking-widest">
        {loading ? 'CALC...' : `STOCK: ${stock}`}
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
  
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewingDischarge, setViewingDischarge] = useState(null);
  const [serialInfoMap, setSerialInfoMap] = useState({});
  const [qrModalItem, setQrModalItem] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Physical Selection State
  const [selectionModalOpen, setSelectionModalOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(null);
  const [availablePhysicalItems, setAvailablePhysicalItems] = useState([]);
  const [loadingPhysical, setLoadingPhysical] = useState(false);

  const [splitState, setSplitState] = useState({ index: null, count: 2 });

  const [sourceInventory, setSourceInventory] = useState([]);

  const getAvailableQtyForProduct = (productId) => {
    if (!productId || !sourceInventory) return 0;
    return sourceInventory
      .filter(i => String(i.product_id) === String(productId) && i.status === 'available')
      .reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  };

  const getTotalRequestedQtyForProduct = (productId, excludeIndex = null) => {
    let total = 0;
    items.forEach((item, idx) => {
      if (idx === excludeIndex) return;
      if (String(item.product_id) === String(productId)) {
        total += Number(item.quantity || 0);
      }
    });
    return total;
  };

  const getAvailableProductsForLine = (selectedProductId) => {
    return products.filter(p => {
      if (selectedProductId && String(p.id) === String(selectedProductId)) return true;
      return sourceInventory.some(i => String(i.product_id) === String(p.id) && i.status === 'available' && (Number(i.quantity) || 0) > 0);
    });
  };

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

  // Flatten the org tree to count all available destination branches (excluding source)
  const flattenTree = (nodes, excludeId) => {
    const result = [];
    const traverse = (list) => {
      for (const node of (list || [])) {
        if (String(node.id) !== String(excludeId)) result.push(node);
        if (node.children?.length) traverse(node.children);
      }
    };
    traverse(nodes);
    return result;
  };
  const availableDestinations = flattenTree(fullTree, fromUnitId);
  const maxSplitBranches = availableDestinations.length;
  
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

  useEffect(() => {
    if (fromUnitId) {
      api.get(`/inventory?org_node_id=${fromUnitId}&limit=5000`).then(res => {
        setSourceInventory(res.data.data || []);
      });
    } else {
      setSourceInventory([]);
    }
  }, [fromUnitId]);

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

  const handleViewDetails = async (form) => {
    setLoadingDetails(true);
    try {
      const response = await api.get(`/discharge/${form.id}`);
      const detail = response.data.data;
      setViewingDischarge(detail);
      setSerialInfoMap({});
      setViewModalOpen(true);

      const items = detail?.items || [];
      const infoMap = {};
      const serialsToFetch = [];

      items.forEach(it => {
        if (it.serial_numbers?.length) {
          serialsToFetch.push(...it.serial_numbers);
        } else if (it.serial_number) {
          serialsToFetch.push(it.serial_number);
        }
      });

      await Promise.all(serialsToFetch.map(async (sn) => {
        try {
          const res = await api.get(`/inventory`, { params: { serial_number: sn, limit: 1 } });
          const list = res?.data?.data || res?.data || [];
          if (list.length > 0) {
            const inv = list[0];
            const resolvedName = getAssetName(inv, false);
            const branchName = inv.organizationNode?.name || 'Authorized Branch';
            infoMap[sn] = {
              name: resolvedName,
              branchName: branchName
            };
          }
        } catch (_) {}
      }));
      setSerialInfoMap(infoMap);
    } catch (e) {
      console.error('Could not retrieve discharge details', e);
      toast.error('Could not retrieve discharge details');
    } finally {
      setLoadingDetails(false);
    }
  };

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
    if (totalQty <= 1) return toast.error('Cannot split a quantity of 1');
    // Toggle the inline split panel for this item
    setSplitState(prev =>
      prev.index === index ? { index: null, count: 2 } : { index, count: 2 }
    );
  };

  const confirmSplit = (index) => {
    const item = items[index];
    const totalQty = parseInt(item.quantity) || 0;
    const splitCount = parseInt(splitState.count);

    if (!splitCount || splitCount < 2) return toast.error('Enter at least 2 branches');
    if (splitCount > totalQty) return toast.error(`Quantity is ${totalQty} — cannot split into more branches than items`);
    if (maxSplitBranches > 0 && splitCount > maxSplitBranches) {
      return toast.error(`Only ${maxSplitBranches} destination branch${maxSplitBranches !== 1 ? 'es' : ''} available — cannot split into ${splitCount}`);
    }

    const baseQty = Math.floor(totalQty / splitCount);
    const remainder = totalQty % splitCount;

    const newItems = [...items];
    const itemTemplate = { ...item };
    newItems.splice(index, 1);

    const generatedItems = [];
    for (let i = 0; i < splitCount; i++) {
      generatedItems.push({
        ...itemTemplate,
        to_unit_id: '',
        quantity: i === splitCount - 1 ? baseQty + remainder : baseQty,
        serial_numbers: []
      });
    }

    newItems.splice(index, 0, ...generatedItems);
    setItems(newItems);
    setSplitState({ index: null, count: 2 });
    toast.success(`Split into ${splitCount} branch lines`);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    const item = newItems[index];

    if (field === 'quantity') {
      if (value === '' || isNaN(parseInt(value))) {
        item.quantity = '';
        setItems(newItems);
        return;
      }
      const productId = item.product_id;
      let qty = Math.max(0, parseInt(value) || 0);
      if (productId) {
        const available = getAvailableQtyForProduct(productId);
        const otherRequested = getTotalRequestedQtyForProduct(productId, index);
        const maxAllowedForThisLine = Math.max(0, available - otherRequested);
        
        if (qty > maxAllowedForThisLine) {
          qty = maxAllowedForThisLine;
          toast.error(`Only ${maxAllowedForThisLine} additional units available for this product (Total branch stock: ${available})`, { id: 'qty-limit-toast' });
        }
        item.quantity = qty;
        
        if ((item.serial_numbers?.length || 0) > qty) {
          item.serial_numbers = item.serial_numbers.slice(0, qty);
        }
      } else {
        item.quantity = qty;
      }
    } else {
      item[field] = value;
      if (field === 'product_id') {
        item.quantity = 1;
        item.serial_numbers = [];
        const available = getAvailableQtyForProduct(value);
        if (available === 0 && value) {
          toast.error('This product is out of stock in the selected origin branch.', { id: 'stock-alert-toast' });
        }
      }
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
          exact_node: 'true',
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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      let rows = [];
      if (/\.xlsx?$/i.test(file.name)) {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      } else {
        const text = await file.text();
        rows = text.split('\n').slice(1).map(row => row.split(',').map(cell => cell.trim()));
      }

      const newItems = rows
        .map(row => {
          const [sku, qty, sns, cond, batch] = row;
          if (!sku) return null;
          const prod = products.find(p => p.sku === sku);
          return {
            product_id: prod ? prod.id.toString() : '',
            to_unit_id: '',
            quantity: parseInt(qty) || 1,
            serial_numbers: sns ? String(sns).replace(/"/g, '').split(',').map(s => s.trim()).filter(Boolean) : [],
            condition: cond || 'new',
            batch_number: batch || ''
          };
        })
        .filter(Boolean);

      if (newItems.length > 0) {
        setItems(newItems);
        toast.success(`Imported ${newItems.length} distribution lines.`);
      } else {
        toast.error('No valid rows were found in the uploaded file.');
      }
    } catch (error) {
      console.error('Bulk import failed:', error);
      toast.error('Unable to parse the selected file. Please use a valid CSV or XLSX file.');
    } finally {
      e.target.value = null;
    }
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

    // Validate quantities against total available stock in branch
    const productTotals = {};
    for (const item of items) {
      if (item.product_id) {
        productTotals[item.product_id] = (productTotals[item.product_id] || 0) + Number(item.quantity || 0);
      }
    }

    for (const [productId, totalRequested] of Object.entries(productTotals)) {
      const available = getAvailableQtyForProduct(productId);
      if (totalRequested > available) {
        const prodName = products.find(p => p.id.toString() === productId)?.name || `ID ${productId}`;
        return toast.error(`Insufficient inventory: requested ${totalRequested} units of "${prodName}", but only ${available} are available in this branch.`);
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
      toast.success('Discharged request sent successfully');
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
    <div className="max-w-[1200px] mx-auto space-y-4 pt-2 pb-4 px-4 md:px-6">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2 border-b border-slate-100">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
              <Zap className="text-white" size={18} />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Discharge Inventories to Branches</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/50">
            <button onClick={() => setView('new')} className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${view === 'new' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Discharge</button>
            <button onClick={() => setView('list')} className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${view === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Discharge History</button>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".csv,.xlsx,.xls" />
          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/50">
            <button type="button" onClick={handleDownloadTemplate} className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-blue-600 transition-all group relative">
              <Download size={16} />
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Template</span>
            </button>
            <button type="button" onClick={() => fileInputRef.current.click()} className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-blue-600 transition-all group relative">
              <Upload size={16} />
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Bulk CSV/XLSX</span>
            </button>
          </div>
          {view === 'new' && (
            <Button type="button" onClick={handleAddItem} className="bg-slate-950 hover:bg-black text-white font-bold h-9 px-3 rounded-lg transition-all shadow-sm flex items-center gap-1.5 text-xs">
              <Plus size={14} strokeWidth={2.5} /> Add manual item
            </Button>
          )}
        </div>
      </div>
      
      {view === 'new' ? (
        <form onSubmit={handleSubmit} className="flex gap-4 items-start">
          {/* LEFT COMPACT PANEL (sticky sidebar) - Exactly two rows */}
          <div className="w-60 shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4 sticky top-4">
             {/* Row 1: Origin Unit Display */}
             <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-0.5 block">Origin Branch</label>
                <div className="text-xs font-bold text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-100 truncate" title={user?.organizationNode?.name || 'Current Node'}>
                  {user?.organizationNode?.name || 'Current Node'}
                </div>
             </div>

             {/* Row 2: Payload Lines Count */}
             <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Payload Lines</div>
                  <div className="text-2xl font-bold text-slate-900 tracking-tight leading-none mt-1">
                    {items.length}
                  </div>
                </div>
                <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                  <CheckCircle2 size={16} />
                </div>
             </div>
          </div>

          {/* RIGHT COMPACT PANEL (process lines) */}
          <div className="flex-1 min-w-0 space-y-3">
             {items.map((item, index) => {
                const selectedP = products?.find(p => p.id.toString() === item.product_id);
                return (
                  <Card key={index} className="relative rounded-xl bg-white shadow-sm border border-slate-200 p-3 space-y-2.5">
                    {/* TOP LINE: Index, Product Selection, Split + Qty — all in one row */}
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 shrink-0 rounded-lg bg-slate-900 text-blue-400 flex items-center justify-center text-xs font-bold italic">
                        {index + 1}
                      </div>
                      
                      <select
                        className="flex-1 min-w-0 max-w-[18rem] h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:bg-white transition-all"
                        value={item.product_id}
                        onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                        required
                      >
                        <option value="">Select product</option>
                        {getAvailableProductsForLine(item.product_id).map(p => <option key={p.id} value={p.id.toString()}>{p.name} — [{p.sku}]</option>)}
                      </select>

                      <LiveStockBadge productId={item.product_id} nodeId={fromUnitId} />

                      <button 
                        type="button" 
                        onClick={() => handleSplitItem(index)} 
                        className={`h-9 shrink-0 px-3 rounded-xl text-sm font-semibold flex items-center justify-center border transition-all ml-1 ${
                          splitState.index === index
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                        title="Split into multiple branches"
                      >
                        Split
                      </button>

                      <input 
                        type="number" 
                        value={item.quantity} 
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                        min="1"
                        max={item.product_id ? Math.max(0, getAvailableQtyForProduct(item.product_id) - getTotalRequestedQtyForProduct(item.product_id, index)) : undefined}
                        title={item.product_id ? `Max available: ${Math.max(0, getAvailableQtyForProduct(item.product_id) - getTotalRequestedQtyForProduct(item.product_id, index))}` : undefined}
                        className="w-16 h-9 shrink-0 border border-slate-200 bg-slate-50 rounded-xl font-bold text-sm text-blue-600 text-center shadow-inner focus:bg-white focus:border-blue-400 outline-none"
                        required 
                      />

                      <button
                        type="button"
                        onClick={() => openSelectionModal(index)}
                        className={`h-9 shrink-0 rounded-xl font-semibold px-2.5 text-[10px] transition-all flex items-center gap-1.5 ${
                          item.serial_numbers?.length === parseInt(item.quantity)
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : 'bg-blue-600 text-white shadow-sm hover:bg-blue-500 border border-blue-600'
                        }`}
                      >
                        <span className="truncate">{item.serial_numbers?.length === parseInt(item.quantity) ? 'Selected' : 'Select'}</span>
                        <Layers size={10} className="shrink-0" />
                      </button>
                    </div>

                    {/* METADATA PREVIEW ROW (compact inline text if product selected) */}
                    {selectedP && (
                      <div className="text-[10px] text-slate-500 bg-slate-50/50 px-2 py-1 rounded border border-slate-100 flex gap-4 truncate">
                        <span><strong>Brand/Model:</strong> {selectedP.brand} {selectedP.model}</span>
                        <span><strong>Category:</strong> {selectedP.category}</span>
                        <span><strong>UOM:</strong> {selectedP.unit}</span>
                      </div>
                    )}

                    {/* BOTTOM LINE: Destination dropdown, Allocate button, Delete row */}
                    <div className="flex items-center gap-2.5">
                      <div className="flex-[2] min-w-0">
                        <CascadingUnitSelector 
                          key={`target-node-${index}-${fromUnitId}`}
                          value={item.to_unit_id}
                          sourceNodeId={fromUnitId}
                          initialTree={fullTree}
                          loading={treeLoading}
                          onChange={(val) => updateItem(index, 'to_unit_id', val)}
                          className="bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        />
                      </div>

                      {items.length > 1 && (
                        <button 
                           type="button" 
                           onClick={() => handleRemoveItem(index)}
                           className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors border border-slate-200 flex items-center justify-center shrink-0"
                           title="Remove line"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>

                    {/* ── INLINE SPLIT PANEL ── */}
                    {splitState.index === index && (
                      <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                        <span className="text-[11px] font-bold text-blue-700 shrink-0">Split into</span>
                        <input
                          type="number"
                          min={2}
                          max={Math.min(parseInt(item.quantity) || 99, maxSplitBranches || 99)}
                          value={splitState.count}
                          onChange={e => setSplitState(prev => ({ ...prev, count: e.target.value }))}
                          className="w-16 h-8 border border-blue-300 bg-white rounded-lg font-bold text-sm text-blue-700 text-center outline-none focus:border-blue-500"
                          autoFocus
                        />
                        <span className="text-[11px] font-bold text-blue-700 shrink-0">branches</span>
                        {maxSplitBranches > 0 && (
                          <span className="text-[10px] text-blue-500 font-semibold shrink-0">
                            (max: {Math.min(parseInt(item.quantity) || 99, maxSplitBranches)})
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => confirmSplit(index)}
                          className="ml-auto h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
                        >
                          Confirm Split
                        </button>
                        <button
                          type="button"
                          onClick={() => setSplitState({ index: null, count: 2 })}
                          className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg border border-slate-200 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {/* SERIAL NUMBERS PREVIEW (pills) */}
                    {item.serial_numbers?.length > 0 && (
                      <div className="flex flex-wrap gap-1 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                         {item.serial_numbers.map(sn => (
                           <span key={sn} className="px-1.5 py-0.5 bg-white text-slate-500 rounded text-[9px] font-bold border border-slate-100">
                             {sn}
                           </span>
                         ))}
                      </div>
                    )}
                  </Card>
                );
             })}

             {/* Centered Submit Manifest Button at the bottom middle */}
             <div className="pt-4 flex justify-center">
                 <button 
                   disabled={submitting}
                   type="submit" 
                   className="px-5 py-2 bg-slate-950 hover:bg-black text-white font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-2 shadow-md w-fit"
                 >
                  {submitting ? 'Authenticating...' : (
                    <>Submit Discharge <ArrowRight size={13} /></>
                  )}
                </button>
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
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-green-600 text-white">
                          <th className="p-4 text-sm font-bold">From</th>
                          <th className="p-4 text-sm font-bold">To</th>
                          <th className="p-4 text-sm font-bold">Role</th>
                          <th className="p-4 text-sm font-bold">Status</th>
                          <th className="p-4 text-sm font-bold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {listLoading ? (
                          <tr>
                            <td colSpan="5" className="p-12 text-center"><LoadingSpinner /></td>
                          </tr>
                        ) : dischargeList.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="p-12 text-center text-slate-400 text-sm">No discharge records found.</td>
                          </tr>
                        ) : (
                          dischargeList.map(form => {
                            const isTargetBranch = form.to_node_id && user?.org_node_id &&
                              Number(form.to_node_id) === Number(user.org_node_id);
                            const isAtSourceNode = form.from_node_id && user?.org_node_id &&
                              Number(form.from_node_id) === Number(user.org_node_id);
                            const userCanApprove = form.can_action &&
                              !form.approvals?.some(a => Number(a.approver_id || a.user_id) === Number(user?.id));

                            return (
                              <tr key={form.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-4 text-sm font-medium text-slate-900">{form.fromNode?.name || '—'}</td>
                                <td className="p-4 text-sm text-slate-600">
                                  {form.discharge_type === 'user'
                                    ? `${form.toUser?.first_name} ${form.toUser?.last_name}`
                                    : form.toNode?.name || '—'}
                                </td>
                                <td className="p-4 text-sm text-slate-600">
                                  {form.to_node_id && user?.org_node_id && (
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                      isTargetBranch
                                        ? 'bg-purple-50 text-purple-600 border-purple-200'
                                        : 'bg-slate-100 text-slate-500 border-slate-200'
                                    }`}>
                                      {isTargetBranch ? '↓ Receiving' : '↑ Dispatching'}
                                    </span>
                                  )}
                                </td>
                                <td className="p-4 text-sm text-slate-600">
                                  <Badge className={`rounded-full px-2.5 py-0.5 font-semibold text-[10px] border ${
                                    form.status === 'acknowledged' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                                    form.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    form.status === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    form.status.startsWith('pending') ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200'
                                  }`}>
                                    {form.status.replace(/_/g, ' ')}
                                  </Badge>
                                </td>
                                <td className="p-4 text-sm text-slate-600 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {userCanApprove && (
                                      <>
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
                                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 h-8 rounded-lg text-xs transition-all"
                                        >
                                          Approve
                                        </Button>
                                        <Button
                                          onClick={async () => {
                                            try {
                                              await api.post(`/discharge/${form.id}/reject`, { reason: 'Rejected via Ledger' });
                                              toast.success('Discharge protocol rejected.');
                                              refetchList();
                                              window.dispatchEvent(new Event('workflowUpdated'));
                                            } catch (err) {
                                              toast.error(err.response?.data?.message || 'Rejection failed');
                                            }
                                          }}
                                          className="bg-red-500 hover:bg-red-400 text-white font-bold px-3 h-8 rounded-lg text-xs transition-all"
                                        >
                                          Reject
                                        </Button>
                                      </>
                                    )}
                                    {!isTargetBranch && form.status === 'approved' && (
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
                                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 h-8 rounded-lg text-xs transition-all"
                                      >
                                        Execute
                                      </Button>
                                    )}
                                    {form.can_acknowledge && !isAtSourceNode && (
                                      <Button
                                        onClick={async () => {
                                          try {
                                            const res = await api.post(`/discharge/${form.id}/acknowledge`, {});
                                            toast.success(res.data.message);
                                            refetchList();
                                            window.dispatchEvent(new Event('workflowUpdated'));
                                          } catch (err) {
                                            toast.error(err.response?.data?.message || 'Acknowledgement failed');
                                          }
                                        }}
                                        className="bg-teal-600 hover:bg-teal-500 text-white font-bold px-3 h-8 rounded-lg text-xs transition-all flex items-center gap-1"
                                      >
                                        <CheckCircle2 size={12} /> Acknowledge
                                      </Button>
                                    )}
                                    <button
                                      onClick={() => handleViewDetails(form)}
                                      className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                                      title="View Details"
                                    >
                                      <Eye size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {pagination && pagination.pages > 1 && (
                    <Pagination pagination={pagination} onPageChange={setPage} />
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
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div>
              <p className="text-xs font-semibold text-blue-400 mb-0.5">Target Quantity</p>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-white">
                  {items[activeItemIndex]?.serial_numbers?.length || 0} /
                </span>
                <input
                  type="number"
                  min={1}
                  value={items[activeItemIndex]?.quantity || ''}
                  onChange={e => {
                    const val = e.target.value;
                    const newItems = [...items];
                    const item = newItems[activeItemIndex];
                    if (val === '' || isNaN(parseInt(val))) {
                      item.quantity = '';
                      setItems(newItems);
                      return;
                    }
                    const parsedVal = Math.max(0, parseInt(val) || 0);
                    const productId = item.product_id;

                    const available = getAvailableQtyForProduct(productId);
                    const otherRequested = getTotalRequestedQtyForProduct(productId, activeItemIndex);
                    const maxAllowedForThisLine = Math.max(0, available - otherRequested);

                    let qty = parsedVal;
                    if (qty > maxAllowedForThisLine) {
                      qty = maxAllowedForThisLine;
                      toast.error(`Only ${maxAllowedForThisLine} additional units available for this product (Total branch stock: ${available})`, { id: 'qty-limit-toast' });
                    }

                    item.quantity = qty;
                    if ((item.serial_numbers?.length || 0) > qty) {
                      item.serial_numbers = (item.serial_numbers || []).slice(0, qty);
                    }
                    setItems(newItems);
                  }}
                  className="w-16 h-8 ml-1 rounded-lg border border-slate-300 bg-white px-2 text-base font-bold text-blue-700 text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                  style={{ minWidth: 0 }}
                />
              </div>
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

      {/* Details Modal */}
      <Modal
        isOpen={viewModalOpen}
        onClose={() => { setViewModalOpen(false); setViewingDischarge(null); }}
        title={`Asset Intelligence: Discharge Details`}
        size="lg"
      >
        <div className="space-y-6 p-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] border-b border-gray-100 pb-2">
              Discharge Routing
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Origin Node</p>
                <p className="text-sm font-bold text-gray-800">{viewingDischarge?.fromNode?.name || 'Central Office'}</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Destination Node / Recipient</p>
                <p className="text-sm font-bold text-gray-800">{viewingDischarge?.discharge_type === 'user' ? `${viewingDischarge?.toUser?.first_name} ${viewingDischarge?.toUser?.last_name}` : viewingDischarge?.toNode?.name || 'N/A'}</p>
              </div>
            </div>

            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] border-b border-gray-100 pb-2 mt-6">
              Discharged Assets Breakdown
            </h3>
            
            {loadingDetails ? (
              <div className="text-center py-10 text-xs font-semibold text-slate-400 animate-pulse">Resolving Assets...</div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-green-600 text-white">
                        <th className="p-4 text-sm font-bold">Item Name</th>
                        <th className="p-4 text-sm font-bold">ID / Serial Number (QR Code)</th>
                        <th className="p-4 text-sm font-bold">Current Branch</th>
                        <th className="p-4 text-sm font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(viewingDischarge?.items || []).flatMap((item, idx) => {
                        const specs = item.specifications ? (typeof item.specifications === 'string' ? JSON.parse(item.specifications) : item.specifications) : {};
                        const category = item.product?.category || specs.category || 'General';

                        let serials = [];
                        if (item.serial_numbers && item.serial_numbers.length > 0) serials = item.serial_numbers;
                        else if (item.serial_number) serials = [item.serial_number];
                        else serials = ['PENDING-HANDOVER'];

                        return serials.map((sn, sidx) => {
                          const individualName =
                            serialInfoMap[sn]?.name ||
                            item.product?.name ||
                            `Item #${item.product_id || item.id}`;

                          const currentBranch =
                            serialInfoMap[sn]?.branchName ||
                            viewingDischarge?.fromNode?.name ||
                            'Central Office';

                          return (
                            <tr key={`${idx}-${sidx}`} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-4 text-sm text-slate-600 align-middle">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-900 text-sm">{individualName}</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Category: {category}</span>
                                </div>
                              </td>
                              <td className="p-4 text-sm text-slate-600 align-middle">
                                <div className="flex items-center gap-2">
                                  {sn !== 'PENDING-HANDOVER' ? (
                                    <>
                                      <div
                                        onClick={() => setQrModalItem({
                                          id: item.id,
                                          serial_number: sn,
                                          name: individualName,
                                          product: { ...(item.product || {}), name: individualName, sku: item.product?.sku || specs.sku || 'N/A', category }
                                        })}
                                        className="p-1 bg-white border border-slate-200 rounded shadow-sm hover:border-slate-400 hover:scale-105 transition-all cursor-pointer shrink-0"
                                        title="Click to view QR label"
                                      >
                                        <QRCode value={JSON.stringify({ id: item.id, name: individualName, sku: item.product?.sku || specs.sku || 'N/A', serial: sn })} size={20} level="H" />
                                      </div>
                                      <span className="font-mono text-xs font-bold text-gray-800 bg-gray-50 px-2 py-0.5 border border-slate-200 rounded shadow-sm">{sn}</span>
                                    </>
                                  ) : (
                                    <span className="font-mono text-xs font-semibold text-slate-400 italic">{sn}</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 text-sm text-slate-600 align-middle">
                                <span className="bg-slate-100 text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">{currentBranch}</span>
                              </td>
                              <td className="p-4 text-sm text-slate-600 align-middle">
                                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold bg-slate-50 text-slate-600 border border-slate-200">{item.status || 'Selected'}</span>
                              </td>
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Pop-up Identity Tag Modal */}
      {qrModalItem && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setQrModalItem(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-4 text-center bg-slate-50 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Asset Identity Tag</h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">{qrModalItem.name || qrModalItem.product?.name || 'Item'}</p>
             </div>
             <div className="p-6 flex flex-col items-center gap-4 bg-white">
                <div className="p-3 bg-white rounded-xl shadow-sm ring-1 ring-slate-100">
                   <QRCode value={JSON.stringify({ id: qrModalItem.id, name: qrModalItem.name || qrModalItem.product?.name || 'Item', sku: qrModalItem.product?.sku || 'N/A', serial: qrModalItem.serial_number })} size={180} level="H" />
                </div>
                <div className="text-center font-mono text-xs font-bold text-slate-900 uppercase tracking-widest mt-2 bg-slate-50 px-3 py-1 rounded border border-slate-200">
                  {qrModalItem.serial_number}
                </div>
             </div>
             <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
                <button onClick={() => window.print()} className="flex-1 h-9 bg-slate-950 text-white font-semibold rounded-lg text-xs hover:bg-slate-900 transition-all shadow-sm">Print</button>
                <button onClick={() => setQrModalItem(null)} className="flex-1 h-9 bg-slate-100 border border-slate-200 text-slate-600 font-semibold rounded-lg text-xs hover:bg-slate-200 transition-all">Close</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DischargePage;
