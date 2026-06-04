import React, { useState, useRef } from 'react';
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
  MoreVertical,
  Building2,
  Eye
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { getAssetName } from '../utils/assetName';

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
  // Ref guard: synchronous check that prevents double-submission even before
  // React re-renders the disabled state on the button.
  const isSubmittingRef = useRef(false);
  const [activeTab, setActiveTab] = useState('create');
  const [searchParams] = useSearchParams();

  
  const [selectionModalOpen, setSelectionModalOpen] = useState(false);
  const [activeDestIndex, setActiveDestIndex] = useState(null);
  const [activeItemIndex, setActiveItemIndex] = useState(null);
  const [availablePhysicalItems, setAvailablePhysicalItems] = useState([]);
  const [loadingPhysical, setLoadingPhysical] = useState(false);
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  // Serial numbers already committed to pending/unacknowledged transfers
  const [pendingTransferSerials, setPendingTransferSerials] = useState(new Set());

  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewingTransfer, setViewingTransfer] = useState(null);
  const [serialInfoMap, setSerialInfoMap] = useState({});
  const [qrModalItem, setQrModalItem] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

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
    const serialNum = searchParams.get('serial_number');

    if (nodeid && (pid || serialNum)) {
      setShowModal(true);
      setSourceNodeId(nodeid);

      // We need to wait for inventory to load before we can set the product_id correctly 
      // because handleUpdateItem relies on sourceInventory to find max_qty.
      // However, we can set the initial state here.
      setDestinations([{
        to_node_id: '',
        items: [{ 
          category: '', 
          sub_category: '', 
          product_id: pid || '', 
          quantity: 1, 
          max_qty: 0,
          serial_numbers: serialNum ? [serialNum] : []
        }]
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
        const serialNum = searchParams.get('serial_number');

        if (serialNum || pid) {
          const invItem = serialNum 
            ? inv.find(i => i.serial_number === serialNum)
            : inv.find(i => i.product_id === parseInt(pid));

          if (invItem) {
            setDestinations(prev => {
              const next = [...prev];
              next[0].items[0].product_id = invItem.product_id.toString();
              next[0].items[0].max_qty = invItem.quantity;
              // Also try to pre-fill category/sub-category for better UX
              next[0].items[0].category = invItem.product?.category || '';
              next[0].items[0].sub_category = invItem.product?.sub_category || '';
              if (serialNum && !next[0].items[0].serial_numbers?.includes(serialNum)) {
                next[0].items[0].serial_numbers = [serialNum];
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

  const handleViewDetails = async (transfer) => {
    setLoadingDetails(true);
    try {
      const response = await api.get(`/transfers/${transfer.id}`);
      const detail = response.data.data;
      setViewingTransfer(detail);
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
      console.error('Could not retrieve transfer details', e);
      toast.error('Could not retrieve transfer details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleAddDestination = () => {
    setDestinations([...destinations, { to_node_id: '', items: [{ category: '', sub_category: '', product_id: '', quantity: 1, max_qty: 0, serial_numbers: [] }] }]);
  };

  const handleRemoveDestination = (index) => {
    const newDest = [...destinations];
    newDest.splice(index, 1);
    setDestinations(newDest);
  };

  const handleAddItem = (destIndex) => {
    const newDest = [...destinations];
    newDest[destIndex].items.push({ category: '', sub_category: '', product_id: '', quantity: 1, max_qty: 0, serial_numbers: [] });
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
    setPendingTransferSerials(new Set());

    try {
      // Fetch available inventory for this category + branch
      const res = await api.get('/inventory', {
        params: {
          category: item.category,
          org_node_id: sourceNodeId,
          status: 'available',
          exact_node: 'true',
          limit: 500
        }
      });
      setAvailablePhysicalItems(res.data.data || []);

      // Also fetch pending/unacknowledged transfers from this source node
      // to lock items that are already committed but not yet delivered
      try {
        const pendingRes = await api.get('/transfers', {
          params: { from_node_id: sourceNodeId, limit: 500 }
        });
        const allTransfers = pendingRes.data?.data || pendingRes.data || [];
        // Consider pending, in_transit, and unacknowledged transfers as locked
        const lockedStatuses = ['pending', 'in_transit', 'approved', 'in_progress'];
        const locked = new Set();
        allTransfers
          .filter(t => lockedStatuses.includes((t.status || '').toLowerCase()))
          .forEach(t => {
            (t.items || []).forEach(ti => {
              if (ti.serial_numbers?.length) ti.serial_numbers.forEach(sn => locked.add(sn));
              else if (ti.serial_number) locked.add(ti.serial_number);
            });
          });
        setPendingTransferSerials(locked);
      } catch (_) {
        // Non-critical — if this call fails, just show all items without locking
      }
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
    // Synchronous guard — blocks any duplicate click before React re-renders
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    if (!sourceNodeId) {
      isSubmittingRef.current = false;
      return toast.error('Select a source branch');
    }

    // Validation
    for (const dest of destinations) {
      if (!dest.to_node_id) {
        isSubmittingRef.current = false;
        return toast.error('Route destination missing');
      }
      for (const [idx, item] of dest.items.entries()) {
        if (!item.category) {
          isSubmittingRef.current = false;
          return toast.error(`Category missing on line ${idx + 1}`);
        }
        if (item.quantity <= 0) {
          isSubmittingRef.current = false;
          return toast.error(`Quantity must be greater than zero on line ${idx + 1}`);
        }
        if ((item.serial_numbers?.length || 0) !== parseInt(item.quantity)) {
          isSubmittingRef.current = false;
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

      toast.success('Transfer Requested Successfully');
      setShowModal(false);
      // Reset form
      setSourceNodeId('');
      setDestinations([{ to_node_id: '', items: [{ category: '', quantity: 1, serial_numbers: [] }] }]);
      refetch();
    } catch (error) {
      // Error handled by global interceptor
    } finally {
      isSubmittingRef.current = false;
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

  const getRootNodeId = (node) => {
    if (!node) return null;
    if (!node.path) return node.id;
    const pathParts = node.path.split('/').filter(Boolean);
    return pathParts.length > 0 ? parseInt(pathParts[0]) : node.id;
  };

  const sourceRootId = getRootNodeId(sourceNode);

  const peerNodes = nodes.filter(n =>
    n.id !== parseInt(sourceNodeId) &&
    n.status === 'active' &&
    getRootNodeId(n) === sourceRootId
  );

  // Removed full-page spinner to match Intake speed
  // if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-[1200px] mx-auto space-y-4 pt-2 pb-4 px-4 md:px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2 border-b border-slate-100">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
              <Truck className="text-white" size={18} />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Transfer Inventories to Peer Branch</h1>
          </div>
          
        </div>

        <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/50">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === 'create' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Create Transfer
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === 'ledger' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Transfer History ({transfersData?.length || 0})
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'create' ? (
          <motion.div
            key="create-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Manifest Creator Form (Embedded) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/70 p-5 space-y-5">
              
              {/* Simplified departure origin selection without Locked badge */}
              <div className="p-3 rounded-xl flex items-center justify-between bg-slate-50 border border-slate-200/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-200">
                    <MapPin size={16} className="text-blue-500" />
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-400 block">Departure Origin</span>
                    <span className="text-sm font-semibold text-slate-900">{sourceNode?.name || 'Your Authorized Branch'}</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Destinations */}
              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <h4 className="text-sm font-semibold text-slate-800">Select branch</h4>
                  <button
                    onClick={handleAddDestination}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1 shadow-sm transition-all"
                  >
                    <Plus size={14} /> Add Destination
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {destinations.map((dest, destIndex) => (
                    <div key={destIndex} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 relative shadow-sm hover:border-blue-300 transition-all">
                      {destinations.length > 1 && (
                        <button
                          onClick={() => handleRemoveDestination(destIndex)}
                          className="absolute -top-2.5 -right-2.5 w-7 h-7 bg-white text-rose-500 rounded-full flex items-center justify-center border border-rose-200 hover:bg-rose-500 hover:text-white shadow-sm transition-all z-10"
                        >
                          <XCircle size={16} />
                        </button>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-500 ml-1 flex items-center gap-1">
                            <MapPin size={10} /> Target Branch
                          </label>
                          <select
                            className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer text-sm"
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

                      <div className="space-y-3 pt-2">
                        <div className="flex justify-between items-center px-1">
                          <span className="text-xs font-medium text-slate-400"></span>
                          <button
                            onClick={() => handleAddItem(destIndex)}
                            className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-0.5"
                          >
                            <Plus size={10} /> Add Item Line
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          {dest.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 relative group/item">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-slate-500 ml-1">Category</label>
                                  <select
                                    className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-500 transition-all text-sm"
                                    value={item.category}
                                    onChange={(e) => handleUpdateItem(destIndex, itemIndex, 'category', e.target.value)}
                                  >
                                    <option value="">-- Asset Type --</option>
                                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                  </select>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-slate-500 ml-1">Quantity</label>
                                  <input
                                    type="number"
                                    min="1"
                                    disabled={!item.category}
                                    className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-500 transition-all text-sm disabled:opacity-50"
                                    value={item.quantity}
                                    onChange={(e) => handleUpdateItem(destIndex, itemIndex, 'quantity', parseInt(e.target.value))}
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-slate-500 ml-1">Serial Mapping</label>
                                  <button
                                    type="button"
                                    disabled={!item.category}
                                    onClick={() => openSelectionModal(destIndex, itemIndex)}
                                    className={`w-full h-11 rounded-xl font-semibold px-4 text-xs transition-all flex items-center justify-between shadow-sm disabled:opacity-50 ${(item.serial_numbers?.length || 0) === parseInt(item.quantity)
                                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-100'
                                      }`}
                                  >
                                    <span>
                                      {(item.serial_numbers?.length || 0) === parseInt(item.quantity)
                                        ? `✓ ${item.serial_numbers.length} selected`
                                        : `Scan ${item.quantity} serials`}
                                    </span>
                                    <Zap size={12} />
                                  </button>
                                </div>
                              </div>

                              {item.serial_numbers?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-3 border-t border-slate-200/50 mt-3">
                                  {item.serial_numbers.map(sn => (
                                    <span key={sn} className="px-2.5 py-1 bg-white text-slate-600 rounded-lg text-[9px] font-bold border border-slate-200 shadow-sm">
                                      {sn}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {dest.items.length > 1 && (
                                <button
                                  onClick={() => handleRemoveItem(destIndex, itemIndex)}
                                  className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors"
                                >
                                  <XCircle size={16} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons on the bottom of manifest page */}
              <div className="pt-4 flex items-center justify-between gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setDestinations([{ to_node_id: '', items: [{ category: '', sub_category: '', product_id: '', quantity: 1, max_qty: 0, serial_numbers: [] }] }]);
                    toast.success('Manifest draft reset');
                  }}
                  className="px-4 h-9 border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-xl font-medium text-sm transition-all"
                >
                  Reset
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-fit px-5 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-xl transition-all shadow-md uppercase text-xs tracking-wider flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <LoadingSpinner size="0.2" /> : <Truck size={14} />}
                  Submit Transfer
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="ledger-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
          >
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
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="p-12 text-center"><LoadingSpinner /></td>
                    </tr>
                  ) : !transfersData?.length ? (
                    <tr>
                      <td colSpan="5" className="p-12 text-center text-slate-400 text-sm">No transfers found.</td>
                    </tr>
                  ) : (
                    transfersData.map((transfer) => {
                      const fromName = transfer.fromNode?.name || transfer.fromUser?.first_name || 'System Bulk';
                      const toName = transfer.toNode?.name || transfer.toUser?.first_name || 'N/A';
                      const isTargetBranch = transfer.to_node_id && user?.org_node_id &&
                        Number(transfer.to_node_id) === Number(user.org_node_id);

                      return (
                        <tr key={transfer.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 text-sm font-medium text-slate-900">{fromName}</td>
                          <td className="p-4 text-sm text-slate-600">{toName}</td>
                          <td className="p-4">
                            {transfer.to_node_id && user?.org_node_id && (
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                isTargetBranch
                                  ? 'bg-purple-50 text-purple-600 border-purple-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}>
                                {isTargetBranch ? '↓ Receiving' : '↑ Dispatching'}
                              </span>
                            )}
                          </td>
                          <td className="p-4">{getStatusBadge(transfer)}</td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Dynamic Approval Check */}
                              {transfer.can_action && (
                                <Button
                                  onClick={() => handleAction(transfer.id, 'approve')}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 h-8 rounded-lg text-xs"
                                >
                                  <Zap size={12} /> Process
                                </Button>
                              )}
                              {/* Legacy/Fallback Check */}
                              {!transfer.workflow_id && transfer.status === 'pending' && user?.role?.level >= 50 && (
                                <Button
                                  onClick={() => handleAction(transfer.id, 'approve')}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 h-8 rounded-lg text-xs"
                                >
                                  <Zap size={12} /> Authorize
                                </Button>
                              )}
                              {transfer.status === 'approved' && (
                                <Button
                                  onClick={() => handleAction(transfer.id, 'execute')}
                                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 h-8 rounded-lg text-xs"
                                >
                                  <Truck size={12} /> Execute
                                </Button>
                              )}
                              {transfer.can_acknowledge && (
                                <Button
                                  onClick={() => handleAction(transfer.id, 'acknowledge')}
                                  className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs px-3 h-8 rounded-lg transition-all flex items-center gap-1 animate-pulse"
                                >
                                  <CheckCircle2 size={12} /> Acknowledge
                                </Button>
                              )}
                              <button
                                onClick={() => handleViewDetails(transfer)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
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
            <div className="mt-4">
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
                <h4 className="text-sm font-bold text-slate-900">Origin Point</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Fixed departure node (Your Branch)</p>
              </div>
            </div>
            <div className="w-full h-14 px-6 bg-white border-2 border-slate-200 rounded-2xl font-semibold text-slate-900 flex items-center shadow-sm">
              <MapPin size={18} className="text-blue-500 mr-3" />
              {sourceNode?.name || 'Authorized Branch'}
            </div>
          </div>

          {/* Destinations - Dynamic List */}
          <div className="space-y-6">
            <div className="flex justify-between items-center px-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Routing Manifest</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Define destination routes & splits</p>
              </div>
              <Button
                onClick={handleAddDestination}
                className="bg-slate-900 text-white h-10 px-6 rounded-xl font-semibold text-sm flex items-center gap-2"
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
                    <label className="text-xs font-medium text-slate-500 ml-1">Destination Branch</label>
                    <select
                      className="w-full h-14 px-6 bg-slate-50 border-2 border-transparent rounded-2xl font-medium text-slate-900 outline-none focus:border-blue-500 transition-all cursor-pointer text-sm"
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
                    <span className="text-xs font-medium text-slate-400">Included Assets</span>
                    <button
                      onClick={() => handleAddItem(destIndex)}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      + Add Item
                    </button>
                  </div>

                  {dest.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex flex-col space-y-4 bg-slate-50/50 p-6 rounded-[24px] border border-slate-100 relative group/item">
                      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                        {/* Category Selection */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-500 ml-1">Asset Category</label>
                          <select
                            className="w-full h-14 px-6 bg-white border-2 border-slate-100 rounded-2xl font-medium text-slate-900 outline-none focus:border-blue-500 transition-all text-sm"
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
                          <label className="text-xs font-medium text-slate-500 ml-1">Transfer Amount</label>
                          <input
                            type="number"
                            min="1"
                            disabled={!item.category}
                            className="w-full h-14 px-6 bg-white border-2 border-slate-100 rounded-2xl font-medium text-slate-900 outline-none focus:border-blue-500 transition-all text-sm disabled:opacity-50"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(destIndex, itemIndex, 'quantity', parseInt(e.target.value))}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-500 ml-1">Physical Asset Selection</label>
                          <button
                            type="button"
                            disabled={!item.category}
                            onClick={() => openSelectionModal(destIndex, itemIndex)}
                            className={`w-full h-14 rounded-2xl font-semibold px-6 text-sm transition-all flex items-center justify-between shadow-sm disabled:opacity-50 ${(item.serial_numbers?.length || 0) === parseInt(item.quantity)
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

          <div className="pt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
              className="w-fit px-6 border border-slate-200 rounded-xl h-10 font-semibold text-slate-600 text-xs transition-all hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-fit px-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold h-10 rounded-xl transition-all shadow-md text-xs border-none"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
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
          <div className="bg-slate-950 p-6 rounded-[30px] border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <p className="text-xs font-medium text-blue-400 mb-1">Target Quantity</p>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-white tracking-tight">
                  {destinations[activeDestIndex]?.items[activeItemIndex]?.serial_numbers?.length || 0} /
                </span>
                <input
                  type="number"
                  min={1}
                  value={destinations[activeDestIndex]?.items[activeItemIndex]?.quantity || 1}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    const next = [...destinations];
                    next[activeDestIndex].items[activeItemIndex].quantity = val;
                    if ((next[activeDestIndex].items[activeItemIndex].serial_numbers?.length || 0) > val) {
                      next[activeDestIndex].items[activeItemIndex].serial_numbers = next[activeDestIndex].items[activeItemIndex].serial_numbers.slice(0, val);
                    }
                    setDestinations(next);
                  }}
                  className="w-20 h-11 rounded-2xl border border-slate-300 bg-white px-3 text-xl font-bold text-blue-700 text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-slate-400 mb-1">Source Node</p>
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
              <div className="py-10 text-center text-slate-400 font-medium text-sm animate-pulse">Scanning Branch Registry...</div>
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
                  const isLocked = pendingTransferSerials.has(inv.serial_number);
                  return (
                    <button
                      key={inv.id}
                      onClick={() => !isLocked && togglePhysicalItem(inv.serial_number)}
                      disabled={isLocked}
                      title={isLocked ? 'Already committed to a pending transfer' : undefined}
                      className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all group ${
                        isLocked
                          ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100'
                          : 'bg-white border-slate-50 hover:border-blue-200'
                      }`}
                    >
                      <div className="text-left">
                        <p className={`text-sm font-semibold ${isLocked ? 'text-gray-400' : isSelected ? 'text-white' : 'text-slate-900'}`}>
                          {inv.product?.name} — {inv.serial_number || 'No serial'}
                        </p>
                        {isLocked ? (
                          <p className="text-xs font-bold mt-1 text-amber-600 uppercase tracking-wider">⏳ Pending Transfer — Locked</p>
                        ) : null}
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        isLocked ? 'border-gray-300 bg-gray-100' : isSelected ? 'bg-white border-white' : 'border-slate-200 group-hover:border-blue-400'
                      }`}>
                        {isSelected && !isLocked && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                        {isLocked && <div className="w-2 h-2 bg-gray-300 rounded-full" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Button
            onClick={() => setSelectionModalOpen(false)}
            className="w-full h-12 bg-slate-950 text-white rounded-2xl font-semibold text-sm mt-4"
          >
            Finalize Physical Allocation
          </Button>
        </div>
      </Modal>

      {/* Details Modal */}
      <Modal
        isOpen={viewModalOpen}
        onClose={() => { setViewModalOpen(false); setViewingTransfer(null); }}
        title={`Asset Intelligence: Transfer Details`}
        size="lg"
      >
        <div className="space-y-6 p-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] border-b border-gray-100 pb-2">
              Transfer Routing
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Origin Node</p>
                <p className="text-sm font-bold text-gray-800">{viewingTransfer?.fromNode?.name || 'Central Office'}</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Destination Node</p>
                <p className="text-sm font-bold text-gray-800">{viewingTransfer?.toNode?.name || viewingTransfer?.toUser?.first_name || 'N/A'}</p>
              </div>
            </div>

            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] border-b border-gray-100 pb-2 mt-6">
              Transferred Assets Breakdown
            </h3>
            
            {loadingDetails ? (
              <div className="text-center py-10 text-xs font-semibold text-slate-400 animate-pulse">Resolving Assets...</div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left bg-white">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Item Name</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">ID / Serial Number (QR Code)</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Current Branch</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(viewingTransfer?.items || []).flatMap((item, idx) => {
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
                            viewingTransfer?.fromNode?.name ||
                            'Central Office';

                          return (
                            <tr key={`${idx}-${sidx}`} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-5 py-4 align-middle">
                                <div className="flex flex-col">
                                  <span className="font-bold text-gray-900 text-sm">{individualName}</span>
                                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Category: {category}</span>
                                </div>
                              </td>
                              <td className="px-5 py-4 align-middle">
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
                                        className="p-1 bg-white border border-gray-200 rounded shadow-sm hover:border-gray-400 hover:scale-105 transition-all cursor-pointer shrink-0"
                                        title="Click to view QR label"
                                      >
                                        <QRCode value={JSON.stringify({ id: item.id, name: individualName, sku: item.product?.sku || specs.sku || 'N/A', serial: sn })} size={20} level="H" />
                                      </div>
                                      <span className="font-mono text-xs font-bold text-gray-800 bg-gray-50 px-2 py-0.5 border border-gray-200 rounded shadow-sm">{sn}</span>
                                    </>
                                  ) : (
                                    <span className="font-mono text-xs font-semibold text-gray-400 italic">{sn}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-4 align-middle">
                                <span className="bg-gray-100 text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">{currentBranch}</span>
                              </td>
                              <td className="px-5 py-4 align-middle">
                                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold bg-gray-50 text-gray-600 border border-gray-200">{item.status || 'Selected'}</span>
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
                <p className="text-xs font-semibold text-slate-505 mt-0.5">{qrModalItem.name || qrModalItem.product?.name || 'Item'}</p>
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
                <button onClick={() => setQrModalItem(null)} className="flex-1 h-9 bg-slate-100 border border-slate-200 text-slate-650 font-semibold rounded-lg text-xs hover:bg-slate-200 transition-all">Close</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransfersPage;
