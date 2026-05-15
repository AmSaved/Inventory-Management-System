import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card, { CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Table, { TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import { useFetch } from '../hooks/useFetch';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/ui/Pagination';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck,
  MoveHorizontal,
  User as UserIcon,
  MapPin,
  Zap,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  Filter,
  Trash2,
  Layers,
  Activity,
  Package,
  MoreVertical
} from 'lucide-react';

const TransfersPage = () => {
  const { user, hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const { data: transfersData, pagination, loading, refetch } = useFetch('/transfers', {
    params: { page, limit: 10 }
  });
  const [showModal, setShowModal] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [sourceNodeId, setSourceNodeId] = useState('');
  const [sourceInventory, setSourceInventory] = useState([]);
  const [destinations, setDestinations] = useState([{ to_node_id: '', items: [{ category: '', sub_category: '', product_id: '', quantity: 1, max_qty: 0, serial_numbers: [] }] }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('create');
  const [searchParams] = useSearchParams();

  // Physical Selection State (Inter-Branch Tracking)
  const [selectionModalOpen, setSelectionModalOpen] = useState(false);
  const [activeDestIndex, setActiveDestIndex] = useState(null);
  const [activeItemIndex, setActiveItemIndex] = useState(null);
  const [availablePhysicalItems, setAvailablePhysicalItems] = useState([]);
  const [loadingPhysical, setLoadingPhysical] = useState(false);
  const [assetSearchQuery, setAssetSearchQuery] = useState('');

  // Fetch nodes for dropdowns
  React.useEffect(() => {
    // Fetch nodes regardless of modal status now that form is on page
    api.get('/organization/nodes?include_peers=true').then(res => {
      setNodes(res.data.data || []);
      // Lock source to user's branch
      if (user?.role?.level < 100 && user?.org_node_id) {
        setSourceNodeId(user.org_node_id.toString());
      }
    });
  }, [user]);

  // Handle URL Pre-fill and Auto-Open
  React.useEffect(() => {
    const pid = searchParams.get('product_id');
    const nodeid = searchParams.get('from_node_id');

    if (pid && nodeid) {
      setShowModal(true);
      setSourceNodeId(nodeid);

      // We need to wait for inventory to load before we can set the product_id correctly 
      // because handleUpdateItem relies on sourceInventory to find max_qty.
      // However, we can set the initial state here.
      setDestinations([{
        to_node_id: '',
        items: [{ category: '', sub_category: '', product_id: pid, quantity: 1, max_qty: 0 }]
      }]);
    }
  }, [searchParams]);

  // Fetch inventory when source node changes
  React.useEffect(() => {
    if (sourceNodeId) {
      api.get(`/inventory?org_node_id=${sourceNodeId}`).then(res => {
        const inv = res.data.data || [];
        setSourceInventory(inv);

        // If we are pre-filling, we need to update the max_qty for the pre-filled product
        const pid = searchParams.get('product_id');
        if (pid) {
          const invItem = inv.find(i => i.product_id === parseInt(pid));
          if (invItem) {
            setDestinations(prev => {
              const next = [...prev];
              if (next[0].items[0].product_id === pid) {
                next[0].items[0].max_qty = invItem.quantity;
                // Also try to pre-fill category/sub-category for better UX
                next[0].items[0].category = invItem.product?.category || '';
                next[0].items[0].sub_category = invItem.product?.sub_category || '';
              }
              return next;
            });
          }
        }
      });
    } else {
      setSourceInventory([]);
    }
  }, [sourceNodeId]);

  const handleAction = async (id, action) => {
    try {
      await api.post(`/transfers/${id}/${action}`);
      toast.success(`Logistics ${action} sequence initialized`);
      refetch();
    } catch (error) {
      // Error handled by global interceptor
    }
  };

  const handleAddDestination = () => {
    setDestinations([...destinations, { to_node_id: '', items: [{ category: '', sub_category: '', product_id: '', quantity: 1, max_qty: 0 }] }]);
  };

  const handleRemoveDestination = (index) => {
    const newDest = [...destinations];
    newDest.splice(index, 1);
    setDestinations(newDest);
  };

  const handleAddItem = (destIndex) => {
    const newDest = [...destinations];
    newDest[destIndex].items.push({ category: '', sub_category: '', product_id: '', quantity: 1, max_qty: 0 });
    setDestinations(newDest);
  };

  const handleRemoveItem = (destIndex, itemIndex) => {
    const newDest = [...destinations];
    newDest[destIndex].items.splice(itemIndex, 1);
    setDestinations(newDest);
  };

  const handleUpdateItem = (destIndex, itemIndex, field, value) => {
    const newDest = [...destinations];
    const item = newDest[destIndex].items[itemIndex];
    item[field] = value;

    if (field === 'category') {
      item.quantity = 1;
      item.serial_numbers = [];
    }

    setDestinations(newDest);
  };

  const openSelectionModal = async (destIndex, itemIndex) => {
    const item = destinations[destIndex].items[itemIndex];
    if (!item.category || !sourceNodeId) {
      return toast.error('Define category and origin branch first');
    }

    setActiveDestIndex(destIndex);
    setActiveItemIndex(itemIndex);
    setLoadingPhysical(true);
    setSelectionModalOpen(true);

    try {
      // Fetch all items in the selected category for this branch
      const res = await api.get('/inventory', {
        params: {
          category: item.category,
          org_node_id: sourceNodeId,
          status: 'available',
          limit: 500 // Higher limit for category-wide scanning
        }
      });
      setAvailablePhysicalItems(res.data.data || []);
    } catch (err) {
      toast.error('Registry Scan Failure: Could not retrieve assets for this category');
    } finally {
      setLoadingPhysical(false);
    }
  };

  const togglePhysicalItem = (serial) => {
    const newDest = [...destinations];
    const item = newDest[activeDestIndex].items[activeItemIndex];
    const currentSns = item.serial_numbers || [];
    const targetQty = parseInt(item.quantity);

    if (currentSns.includes(serial)) {
      item.serial_numbers = currentSns.filter(s => s !== serial);
    } else {
      if (currentSns.length >= targetQty) {
        return toast.error(`Physical allocation limit reached (${targetQty} units)`);
      }

      // Check for global uniqueness within this manifest
      const isAlreadyPicked = destinations.some((d, di) =>
        d.items.some((it, ii) =>
          (di !== activeDestIndex || ii !== activeItemIndex) && it.serial_numbers?.includes(serial)
        )
      );

      if (isAlreadyPicked) {
        return toast.error('This asset ID is already allocated to another destination route');
      }

      item.serial_numbers = [...currentSns, serial];
    }
    setDestinations(newDest);
  };

  const handleSubmit = async () => {
    if (!sourceNodeId) return toast.error('Select a source branch');

    // Validation
    for (const dest of destinations) {
      if (!dest.to_node_id) return toast.error('Route destination missing');
      for (const [idx, item] of dest.items.entries()) {
        if (!item.category) return toast.error(`Category missing on line ${idx + 1}`);
        if (item.quantity <= 0) return toast.error(`Quantity must be greater than zero on line ${idx + 1}`);
        if ((item.serial_numbers?.length || 0) !== parseInt(item.quantity)) {
          return toast.error(`Physical mismatch: Select exactly ${item.quantity} items for category ${item.category}`);
        }
      }
    }

    setIsSubmitting(true);
    try {
      // Loop through destinations and create separate transfers
      await Promise.all(destinations.map(async (dest) => {
        // Group selected serial numbers by their product IDs
        // We need to fetch the inventory details for the picked serials to get their product IDs
        // But wait, the selection modal's 'availablePhysicalItems' already has product info.
        // Let's assume we can map them from the local state or fetch them.
        // For simplicity, we'll iterate through items and their serials.

        const transferItems = [];

        for (const item of dest.items) {
          // Find the actual items from our selection pool (or fetch if needed)
          // Since selection is per-line, we might need a way to look up the product_id of each SN.

          const snToProductMap = {};
          // We can't rely on 'availablePhysicalItems' because it changes when we open different modals.
          // Better approach: When picking an item, store its product_id along with serial.
          // For now, let's re-fetch the metadata for the picked items in this destination.

          const detailsRes = await api.get('/inventory', {
            params: {
              org_node_id: sourceNodeId,
              status: 'available',
              limit: 1000 // Large enough to cover all picked items
            }
          });
          const allInv = detailsRes.data.data || [];

          item.serial_numbers.forEach(sn => {
            const inv = allInv.find(i => i.serial_number === sn);
            if (inv) {
              const pid = inv.product_id;
              if (!snToProductMap[pid]) {
                snToProductMap[pid] = { product_id: pid, quantity: 0, serial_numbers: [] };
              }
              snToProductMap[pid].quantity += 1;
              snToProductMap[pid].serial_numbers.push(sn);
            }
          });

          Object.values(snToProductMap).forEach(group => {
            transferItems.push({
              product_id: group.product_id,
              quantity: group.quantity,
              serial_numbers: group.serial_numbers,
              condition: 'new'
            });
          });
        }

        return api.post('/transfers', {
          from_node_id: sourceNodeId,
          to_node_id: dest.to_node_id,
          transfer_type: 'node_to_node',
          items: transferItems
        });
      }));

      toast.success('All logistics routes successfully initialized');
      setShowModal(false);
      // Reset form
      setSourceNodeId('');
      setDestinations([{ to_node_id: '', items: [{ category: '', quantity: 1, serial_numbers: [] }] }]);
      refetch();
    } catch (error) {
      // Error handled by global interceptor
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (transfer) => {
    if (transfer.workflow_status) {
      const variant = transfer.status === 'approved' ? 'info' : 'warning';
      const colorClass = transfer.status === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200';
      return (
        <Badge variant={variant} className={`uppercase text-[9px] font-black tracking-widest gap-1 ${colorClass}`}>
          <Clock size={10} /> {transfer.workflow_status}
        </Badge>
      );
    }

    switch (transfer.status) {
      case 'pending': return <Badge variant="warning" className="uppercase text-[9px] font-black tracking-widest">In Queue</Badge>;
      case 'approved': return <Badge variant="info" className="uppercase text-[9px] font-black tracking-widest bg-blue-50 text-blue-700">Authorized</Badge>;
      case 'completed': return <Badge variant="success" className="uppercase text-[9px] font-black tracking-widest bg-emerald-50 text-emerald-700">Executed</Badge>;
      case 'rejected': return <Badge variant="danger" className="uppercase text-[9px] font-black tracking-widest bg-red-50 text-red-700">Terminated</Badge>;
      default: return <Badge className="uppercase text-[9px] font-black tracking-widest">{transfer.status}</Badge>;
    }
  };

  // Helper selectors
  const categories = [...new Set(sourceInventory.map(i => i.product?.category).filter(Boolean))];

  // Peer nodes filter
  const sourceNode = nodes.find(n => n.id === parseInt(sourceNodeId));
  const peerNodes = nodes.filter(n =>
    n.id !== parseInt(sourceNodeId) &&
    n.parent_id === sourceNode?.parent_id
  );

  // Removed full-page spinner to match Intake speed
  // if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 py-10 px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-100">
              <Truck className="text-white" size={24} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Logistics Transfer Terminal</h1>
          </div>
          <p className="text-slate-400 font-bold text-[10px] tracking-[0.2em] uppercase ml-1">Enterprise Asset Movement Hub</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl border-2 border-slate-50">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'create' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Draft Manifest
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'ledger' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Logistics Ledger ({transfersData?.data?.length || 0})
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'create' ? (
          <motion.div
            key="create-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-10"
          >
            {/* Manifest Creator Form (Embedded) */}
            <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-100 border-none overflow-hidden p-10 space-y-12">
              <div className="flex items-center justify-between border-b border-slate-50 pb-8">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border-2 border-blue-100">
                    <Layers size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Active Manifest Draft</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Plan route and allocate assets below</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDestinations([{ to_node_id: '', items: [{ category: '', sub_category: '', product_id: '', quantity: 1, max_qty: 0, serial_numbers: [] }] }]);
                      toast.success('Manifest draft reset');
                    }}
                    className="border-2 border-slate-100 rounded-2xl h-12 px-6 font-black text-slate-500 uppercase text-[9px] tracking-widest"
                  >
                    Reset Draft
                  </Button>
                </div>
              </div>

              {/* Source Selection (Simplified as it's locked) */}
              <div className="bg-slate-50 p-8 rounded-[32px] border-2 border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-200">
                    <MapPin size={20} className="text-blue-500" />
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Departure Origin</span>
                    <span className="text-lg font-black text-slate-900 uppercase tracking-tight">{sourceNode?.name || 'Your Authorized Branch'}</span>
                  </div>
                </div>
                <Badge variant="outline" className="bg-white border-2 border-slate-100 rounded-xl px-4 py-2 text-[10px] font-black text-blue-600 tracking-widest">
                  AUTHORITY LOCKED
                </Badge>
              </div>

              {/* Dynamic Destinations */}
              <div className="space-y-8">
                <div className="flex justify-between items-center px-2">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Routing Manifest & Splits</h4>
                  <Button
                    onClick={handleAddDestination}
                    className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-6 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-100 transition-all"
                  >
                    <Plus size={14} /> Add New Destination
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-8">
                  {destinations.map((dest, destIndex) => (
                    <div key={destIndex} className="bg-white border-2 border-slate-100 rounded-[40px] p-8 space-y-8 relative group/dest shadow-sm hover:shadow-xl hover:border-blue-100 transition-all">
                      {destinations.length > 1 && (
                        <button
                          onClick={() => handleRemoveDestination(destIndex)}
                          className="absolute -top-3 -right-3 w-10 h-10 bg-white text-rose-500 rounded-full flex items-center justify-center border-2 border-rose-100 hover:bg-rose-500 hover:text-white shadow-lg transition-all z-10"
                        >
                          <XCircle size={20} />
                        </button>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                            <MapPin size={10} /> Target Branch (Peer Node)
                          </label>
                          <select
                            className="w-full h-16 px-6 bg-slate-50 border-2 border-transparent rounded-2xl font-black text-slate-900 outline-none focus:border-blue-500 transition-all cursor-pointer text-sm"
                            value={dest.to_node_id}
                            onChange={(e) => {
                              const newDest = [...destinations];
                              newDest[destIndex].to_node_id = e.target.value;
                              setDestinations(newDest);
                            }}
                          >
                            <option value="">-- Select Destination --</option>
                            {peerNodes.map(node => (
                              <option key={node.id} value={node.id}>{node.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center px-2">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Planned Allocation</span>
                          <button
                            onClick={() => handleAddItem(destIndex)}
                            className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-1"
                          >
                            <Plus size={12} /> Add Item Line
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          {dest.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="bg-slate-50/50 p-8 rounded-[32px] border border-slate-100 relative group/item">
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-end">
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Category</label>
                                  <select
                                    className="w-full h-16 px-6 bg-white border-2 border-slate-100 rounded-2xl font-black text-slate-900 outline-none focus:border-blue-500 transition-all text-sm"
                                    value={item.category}
                                    onChange={(e) => handleUpdateItem(destIndex, itemIndex, 'category', e.target.value)}
                                  >
                                    <option value="">-- Asset Type --</option>
                                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                  </select>
                                </div>

                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Quantity</label>
                                  <input
                                    type="number"
                                    min="1"
                                    disabled={!item.category}
                                    className="w-full h-16 px-6 bg-white border-2 border-slate-100 rounded-2xl font-black text-slate-900 outline-none focus:border-blue-500 transition-all text-sm disabled:opacity-50"
                                    value={item.quantity}
                                    onChange={(e) => handleUpdateItem(destIndex, itemIndex, 'quantity', parseInt(e.target.value))}
                                  />
                                </div>

                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Serial Mapping</label>
                                  <button
                                    type="button"
                                    disabled={!item.category}
                                    onClick={() => openSelectionModal(destIndex, itemIndex)}
                                    className={`w-full h-16 rounded-2xl font-black px-6 text-[10px] uppercase tracking-widest transition-all flex items-center justify-between shadow-sm disabled:opacity-50 ${(item.serial_numbers?.length || 0) === parseInt(item.quantity)
                                      ? 'bg-emerald-50 text-emerald-600 border-2 border-emerald-100'
                                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-100'
                                      }`}
                                  >
                                    <span>
                                      {(item.serial_numbers?.length || 0) === parseInt(item.quantity)
                                        ? `✓ ${item.serial_numbers.length} SELECTED`
                                        : `SCAN ${item.quantity} SERIALS`}
                                    </span>
                                    <Zap size={14} />
                                  </button>
                                </div>
                              </div>

                              {item.serial_numbers?.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-6 border-t border-slate-200/50 mt-6">
                                  {item.serial_numbers.map(sn => (
                                    <span key={sn} className="px-4 py-2 bg-white text-slate-600 rounded-xl text-[10px] font-black border border-slate-200 shadow-sm">
                                      {sn}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <button
                                onClick={() => handleRemoveItem(destIndex, itemIndex)}
                                className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors"
                              >
                                <XCircle size={18} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-10 flex gap-4">
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full bg-slate-950 border-b-4 border-slate-800 hover:bg-slate-900 text-white font-black h-20 rounded-3xl transition-all shadow-2xl shadow-slate-200 uppercase text-xs tracking-widest flex items-center justify-center gap-3"
                >
                  {isSubmitting ? <LoadingSpinner size="0.3" /> : <Truck size={5} />}
                  submitt
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="ledger-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 gap-6"
          >
            {loading ? (
              // High-end Skeleton Cards
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={`skeleton-${i}`} className="rounded-[40px] border-none bg-white shadow-xl animate-pulse">
                  <CardContent className="p-8 h-32 flex items-center justify-between">
                    <div className="flex-1 flex items-center gap-8">
                       <div className="w-14 h-14 bg-slate-50 rounded-2xl" />
                       <div className="h-4 w-48 bg-slate-50 rounded-lg" />
                       <div className="w-14 h-14 bg-slate-50 rounded-2xl" />
                    </div>
                    <div className="w-32 h-12 bg-slate-50 rounded-xl" />
                  </CardContent>
                </Card>
              ))
            ) : transfersData?.data?.map((transfer) => (
              <Card key={transfer.id} className="rounded-[40px] border-none bg-white shadow-xl shadow-slate-100 overflow-hidden hover:shadow-2xl transition-all group hover:-translate-y-1">
                <CardContent className="p-8">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10">
                    {/* Route Visualizer */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity size={14} className="text-blue-500 animate-pulse" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Routing Sequence #{transfer.transfer_number.split('-')[1]}</span>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="flex flex-col items-center">
                          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-200">
                            {transfer.transfer_type.includes('node') ? <MapPin size={20} className="text-slate-400" /> : <UserIcon size={20} className="text-slate-400" />}
                          </div>
                          <span className="text-[10px] font-black text-slate-900 mt-2 uppercase tracking-tight truncate max-w-[120px]">
                            {transfer.fromNode?.name || transfer.fromUser?.first_name || 'System Bulk'}
                          </span>
                        </div>

                        <div className="flex-1 relative flex flex-col items-center group/arrow">
                          <div className="w-full h-[2px] bg-slate-100 absolute top-7 -z-10" />
                          <div className="bg-white px-4 z-10 transition-transform group-hover/arrow:scale-110">
                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 border-2 border-blue-100 shadow-sm">
                              <ArrowRight size={18} />
                            </div>
                          </div>
                          <span className="text-[9px] font-black text-blue-500 mt-2 uppercase tracking-[0.2em]">{transfer.transfer_type.replace(/_/g, ' ')}</span>
                        </div>

                        <div className="flex flex-col items-center">
                          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center border-2 border-blue-100">
                            {transfer.transfer_type.includes('to_node') ? <MapPin size={20} className="text-blue-500" /> : <UserIcon size={20} className="text-blue-500" />}
                          </div>
                          <span className="text-[10px] font-black text-blue-600 mt-2 uppercase tracking-tight truncate max-w-[120px]">
                            {transfer.toNode?.name || transfer.toUser?.first_name || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions & Status */}
                    <div className="flex flex-col items-end gap-3 min-w-[200px]">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusBadge(transfer)}
                      </div>
                      <div className="flex gap-2">
                        {/* Dynamic Approval Check */}
                        {transfer.can_action && (
                          <Button
                            onClick={() => handleAction(transfer.id, 'approve')}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 h-12 rounded-xl text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-100"
                          >
                            <Zap size={14} /> Process Step
                          </Button>
                        )}
                        {/* Legacy/Fallback Check */}
                        {!transfer.workflow_id && transfer.status === 'pending' && user?.role?.level >= 50 && (
                          <Button
                            onClick={() => handleAction(transfer.id, 'approve')}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 h-12 rounded-xl text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-100"
                          >
                            <Zap size={14} /> Authorize Move
                          </Button>
                        )}
                        {transfer.status === 'approved' && (
                          <Button
                            onClick={() => handleAction(transfer.id, 'execute')}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-black px-6 h-12 rounded-xl text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-100"
                          >
                            <Truck size={14} /> Execute Move
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          className="w-12 h-12 rounded-xl bg-slate-50 text-slate-400 hover:text-blue-600 border border-transparent hover:border-slate-100"
                        >
                          <MoreVertical size={18} />
                        </Button>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 mt-1 uppercase tracking-widest opacity-60">
                        <Clock size={10} /> Queued: {new Date(transfer.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {transfersData?.data?.length === 0 && (
              <div className="py-40 text-center space-y-4">
                <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center mx-auto mb-6">
                  <Truck size={48} className="text-slate-200" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight text-center">Pipeline Neutral</h3>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1 text-center">Zero asset movements currently in transit.</p>
                </div>
              </div>
            )}
            <div className="mt-10">
              <Pagination pagination={pagination} onPageChange={setPage} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Logistics Manifest Creator"
        size="xl"
      >
        <div className="space-y-8 p-6 max-h-[80vh] overflow-y-auto no-scrollbar">
          {/* Source Selection */}
          <div className="bg-slate-50 p-6 rounded-[32px] border-2 border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
                <Truck className="text-white" size={20} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Origin Point</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Fixed departure node (Your Branch)</p>
              </div>
            </div>
            <div className="w-full h-14 px-6 bg-white border-2 border-slate-200 rounded-2xl font-black text-slate-900 flex items-center shadow-sm">
              <MapPin size={18} className="text-blue-500 mr-3" />
              {sourceNode?.name || 'Authorized Branch'}
            </div>
          </div>

          {/* Destinations - Dynamic List */}
          <div className="space-y-6">
            <div className="flex justify-between items-center px-2">
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Routing Manifest</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Define destination routes & splits</p>
              </div>
              <Button
                onClick={handleAddDestination}
                className="bg-slate-900 text-white h-10 px-6 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2"
              >
                <Plus size={14} /> Add Route
              </Button>
            </div>

            {destinations.map((dest, destIndex) => (
              <div key={destIndex} className="bg-white border-2 border-slate-100 rounded-[32px] p-6 space-y-6 relative group/dest shadow-sm hover:shadow-md transition-all">
                {destinations.length > 1 && (
                  <button
                    onClick={() => handleRemoveDestination(destIndex)}
                    className="absolute -top-2 -right-2 w-8 h-8 bg-red-50 text-red-500 rounded-full flex items-center justify-center border-2 border-red-100 hover:bg-red-500 hover:text-white transition-all z-10"
                  >
                    <XCircle size={16} />
                  </button>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Destination Branch (Peer)</label>
                    <select
                      className="w-full h-14 px-6 bg-slate-50 border-2 border-transparent rounded-2xl font-black text-slate-900 outline-none focus:border-blue-500 transition-all cursor-pointer"
                      value={dest.to_node_id}
                      onChange={(e) => {
                        const newDest = [...destinations];
                        newDest[destIndex].to_node_id = e.target.value;
                        setDestinations(newDest);
                      }}
                    >
                      <option value="">-- Select Destination --</option>
                      {peerNodes.map(node => (
                        <option key={node.id} value={node.id}>{node.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Included Assets</span>
                    <button
                      onClick={() => handleAddItem(destIndex)}
                      className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                    >
                      + Add Item
                    </button>
                  </div>

                  {dest.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex flex-col space-y-4 bg-slate-50/50 p-6 rounded-[24px] border border-slate-100 relative group/item">
                      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                        {/* Category Selection */}
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Category</label>
                          <select
                            className="w-full h-14 px-6 bg-white border-2 border-slate-100 rounded-2xl font-black text-slate-900 outline-none focus:border-blue-500 transition-all text-xs"
                            value={item.category}
                            onChange={(e) => handleUpdateItem(destIndex, itemIndex, 'category', e.target.value)}
                          >
                            <option value="">-- Select Category --</option>
                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Transfer Amount</label>
                          <input
                            type="number"
                            min="1"
                            disabled={!item.category}
                            className="w-full h-14 px-6 bg-white border-2 border-slate-100 rounded-2xl font-black text-slate-900 outline-none focus:border-blue-500 transition-all text-xs disabled:opacity-50"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(destIndex, itemIndex, 'quantity', parseInt(e.target.value))}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Physical Asset Selection</label>
                          <button
                            type="button"
                            disabled={!item.category}
                            onClick={() => openSelectionModal(destIndex, itemIndex)}
                            className={`w-full h-14 rounded-2xl font-black px-6 text-[10px] uppercase tracking-widest transition-all flex items-center justify-between shadow-sm disabled:opacity-50 ${(item.serial_numbers?.length || 0) === parseInt(item.quantity)
                              ? 'bg-emerald-50 text-emerald-600 border-2 border-emerald-100'
                              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100'
                              }`}
                          >
                            <span>
                              {(item.serial_numbers?.length || 0) === parseInt(item.quantity)
                                ? `✓ ${item.serial_numbers.length} ALLOCATED`
                                : `SELECT ${item.quantity} ITEMS`}
                            </span>
                            <Layers size={14} />
                          </button>
                        </div>
                      </div>

                      {item.serial_numbers?.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-50 mt-2">
                          {item.serial_numbers.map(sn => (
                            <span key={sn} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-[4px] text-[8px] font-bold">
                              {sn}
                            </span>
                          ))}
                        </div>
                      )}

                      {dest.items.length > 1 && (
                        <button
                          onClick={() => handleRemoveItem(destIndex, itemIndex)}
                          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-6 flex gap-4">
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
              className="flex-1 border-2 border-slate-200 rounded-2xl h-14 font-black text-slate-600 uppercase text-[10px] tracking-widest"
            >
              Discard Manifest
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 border-b-4 border-blue-800 hover:bg-blue-700 text-white font-black h-14 rounded-2xl transition-all shadow-xl shadow-blue-100 uppercase text-[10px] tracking-widest"
            >
              {isSubmitting ? 'Initializing Sequence...' : 'Execute Logistics Movement'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Physical Asset Selection Modal (Inter-Branch) */}
      <Modal
        isOpen={selectionModalOpen}
        onClose={() => setSelectionModalOpen(false)}
        title="Inter-Branch Asset Allocation"
      >
        <div className="space-y-6 p-2">
          <div className="bg-slate-950 p-6 rounded-[30px] border border-slate-800 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-1">Target Quantity</p>
              <p className="text-3xl font-black text-white italic tracking-tighter">
                {destinations[activeDestIndex]?.items[activeItemIndex]?.serial_numbers?.length || 0} / {destinations[activeDestIndex]?.items[activeItemIndex]?.quantity || 0}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Source Node</p>
              <p className="text-sm font-bold text-slate-300 uppercase truncate max-w-[200px]">
                {sourceNode?.name || 'Authorized Branch'}
              </p>
            </div>
          </div>
          
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Search by Serial Number or Asset Name..."
              className="w-full h-14 pl-12 pr-6 bg-slate-100 border-2 border-transparent rounded-2xl font-bold text-slate-900 outline-none focus:border-blue-500 transition-all text-sm"
              value={assetSearchQuery}
              onChange={(e) => setAssetSearchQuery(e.target.value)}
            />
          </div>

          <div className="max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar space-y-2">
            {loadingPhysical ? (
              <div className="py-10 text-center text-slate-400 font-black uppercase text-[10px] animate-pulse">Scanning Branch Registry...</div>
            ) : availablePhysicalItems.filter(inv => 
                inv.serial_number?.toLowerCase().includes(assetSearchQuery.toLowerCase()) || 
                inv.product?.name?.toLowerCase().includes(assetSearchQuery.toLowerCase())
              ).length === 0 ? (
              <div className="py-10 text-center text-slate-400 font-bold text-xs">No matching assets found in this branch's registry.</div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {availablePhysicalItems
                  .filter(inv => 
                    inv.serial_number?.toLowerCase().includes(assetSearchQuery.toLowerCase()) || 
                    inv.product?.name?.toLowerCase().includes(assetSearchQuery.toLowerCase())
                  )
                  .map((inv) => {
                  const isSelected = destinations[activeDestIndex]?.items[activeItemIndex]?.serial_numbers?.includes(inv.serial_number);
                  return (
                    <button
                      key={inv.id}
                      onClick={() => togglePhysicalItem(inv.serial_number)}
                      className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all group ${isSelected
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100'
                        : 'bg-white border-slate-50 hover:border-blue-200'
                        }`}
                    >
                      <div className="text-left">
                        <p className={`text-xs font-black uppercase tracking-tighter ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                          {inv.product?.name} — {inv.serial_number || 'NO SERIAL'}
                        </p>
                        <p className={`text-[8px] font-black uppercase tracking-widest mt-1 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                          {inv.product?.sku} • Condition: {inv.condition} • Batch: {inv.batch_number || 'Standard'}
                        </p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-white border-white' : 'border-slate-200 group-hover:border-blue-400'
                        }`}>
                        {isSelected && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Button
            onClick={() => setSelectionModalOpen(false)}
            className="w-full h-16 bg-slate-950 text-white rounded-[25px] font-black uppercase text-[10px] tracking-widest mt-4"
          >
            Finalize Physical Allocation
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default TransfersPage;
