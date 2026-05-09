import React, { useState } from 'react';
import Card, { CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Table, { TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import { useFetch } from '../hooks/useFetch';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
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
  MoreVertical,
  Activity,
  Package
} from 'lucide-react';

const TransfersPage = () => {
  const { user, hasPermission } = useAuth();
  const { data: transfersData, loading, refetch } = useFetch('/transfers');
  const [showModal, setShowModal] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [sourceNodeId, setSourceNodeId] = useState('');
  const [sourceInventory, setSourceInventory] = useState([]);
  const [destinations, setDestinations] = useState([{ to_node_id: '', items: [{ product_id: '', quantity: 1, max_qty: 0 }] }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch nodes for dropdowns
  React.useEffect(() => {
    if (showModal) {
      api.get('/organization/nodes?include_peers=true').then(res => {
        setNodes(res.data.data || []);
        // Lock source to user's branch
        if (user?.org_node_id) {
          setSourceNodeId(user.org_node_id.toString());
        }
      });
    }
  }, [showModal, user]);

  // Fetch inventory when source node changes
  React.useEffect(() => {
    if (sourceNodeId) {
      api.get(`/inventory?org_node_id=${sourceNodeId}`).then(res => {
        setSourceInventory(res.data.data || []);
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
      item.sub_category = '';
      item.product_id = '';
      item.max_qty = 0;
    } else if (field === 'sub_category') {
      item.product_id = '';
      item.max_qty = 0;
    } else if (field === 'product_id') {
      const invItem = sourceInventory.find(i => i.product_id === parseInt(value));
      item.max_qty = invItem ? invItem.quantity : 0;
    }
    
    setDestinations(newDest);
  };

  const handleSubmit = async () => {
    if (!sourceNodeId) return toast.error('Select a source branch');
    
    // Validation
    const isValid = destinations.every(d => d.to_node_id && d.items.every(i => i.product_id && i.quantity > 0));
    if (!isValid) return toast.error('Please fill all required fields');

    setIsSubmitting(true);
    try {
      // Loop through destinations and create separate transfers
      await Promise.all(destinations.map(dest => {
        return api.post('/transfers', {
          from_node_id: sourceNodeId,
          to_node_id: dest.to_node_id,
          transfer_type: 'node_to_node',
          items: dest.items.map(i => ({
            product_id: i.product_id,
            quantity: i.quantity,
            condition: 'new' // Default to new for now
          }))
        });
      }));

      toast.success('All transfer requests generated successfully');
      setShowModal(false);
      // Reset form
      setSourceNodeId('');
      setDestinations([{ to_node_id: '', items: [{ category: '', sub_category: '', product_id: '', quantity: 1, max_qty: 0 }] }]);
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
  const getSubCategories = (category) => [...new Set(sourceInventory.filter(i => i.product?.category === category).map(i => i.product?.sub_category).filter(Boolean))];
  const getProducts = (category, subCategory) => sourceInventory.filter(i => i.product?.category === category && i.product?.sub_category === subCategory);

  // Peer nodes filter
  const sourceNode = nodes.find(n => n.id === parseInt(sourceNodeId));
  const peerNodes = nodes.filter(n => 
    n.id !== parseInt(sourceNodeId) && 
    n.parent_id === sourceNode?.parent_id
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 py-10 px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-100">
                <Truck className="text-white" size={24} />
             </div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Logistics Ledger</h1>
          </div>
          <p className="text-slate-400 font-bold text-[10px] tracking-[0.2em] uppercase ml-1">Enterprise Asset Movement Terminal</p>
        </div>
        
        <div className="flex gap-3">
           <Button 
            variant="outline"
            className="border-2 border-slate-200 rounded-2xl px-6 h-14 font-black text-slate-600 hover:bg-slate-50 uppercase text-[10px] tracking-widest"
           >
             <Filter size={16} className="mr-2" /> All Nodes
           </Button>
           <Button 
             onClick={() => setShowModal(true)}
             className="bg-blue-600 border-b-4 border-blue-800 hover:bg-blue-700 text-white font-black px-8 h-14 rounded-2xl transition-all shadow-xl shadow-blue-100 flex items-center gap-2 uppercase text-[10px] tracking-widest"
           >
             <Plus size={18} /> New Request
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {transfersData?.data?.map((transfer) => (
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
      </div>

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
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Category Selection */}
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                          <select
                            className="w-full h-12 px-4 bg-white border-2 border-slate-100 rounded-xl font-black text-slate-900 outline-none focus:border-blue-500 transition-all text-xs"
                            value={item.category}
                            onChange={(e) => handleUpdateItem(destIndex, itemIndex, 'category', e.target.value)}
                          >
                            <option value="">Select Category</option>
                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                        </div>

                        {/* Subcategory Selection */}
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Sub Category</label>
                          <select
                            className="w-full h-12 px-4 bg-white border-2 border-slate-100 rounded-xl font-black text-slate-900 outline-none focus:border-blue-500 transition-all text-xs"
                            value={item.sub_category}
                            disabled={!item.category}
                            onChange={(e) => handleUpdateItem(destIndex, itemIndex, 'sub_category', e.target.value)}
                          >
                            <option value="">Select Sub Category</option>
                            {getSubCategories(item.category).map(sub => <option key={sub} value={sub}>{sub}</option>)}
                          </select>
                        </div>

                        {/* Product Selection */}
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Product</label>
                          <select
                            className="w-full h-12 px-4 bg-white border-2 border-slate-100 rounded-xl font-black text-slate-900 outline-none focus:border-blue-500 transition-all text-xs"
                            value={item.product_id}
                            disabled={!item.sub_category}
                            onChange={(e) => handleUpdateItem(destIndex, itemIndex, 'product_id', e.target.value)}
                          >
                            <option value="">Select Item</option>
                            {getProducts(item.category, item.sub_category).map(inv => (
                              <option key={inv.product_id} value={inv.product_id}>
                                {inv.product?.name} ({inv.quantity} available)
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-full md:w-32 space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            max={item.max_qty}
                            className="w-full h-12 px-4 bg-white border-2 border-slate-100 rounded-xl font-black text-slate-900 outline-none focus:border-blue-500 transition-all text-xs"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(destIndex, itemIndex, 'quantity', parseInt(e.target.value))}
                          />
                        </div>
                        {dest.items.length > 1 && (
                          <button 
                            onClick={() => handleRemoveItem(destIndex, itemIndex)}
                            className="mt-6 h-12 px-3 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <XCircle size={18} />
                          </button>
                        )}
                      </div>
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
    </div>
  );
};

export default TransfersPage;
