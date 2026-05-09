import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import inventoryService from '../../services/inventoryService';
import toast from 'react-hot-toast';
import Card, { CardContent, CardHeader, CardTitle } from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useAuth } from '../../context/AuthContext';

const DischargeForm = ({ requestId, onSuccess, onCancel }) => {
  const { user } = useAuth();
  const isStorageManager = user?.role?.name === 'storage_manager';
  
  const [items, setItems] = useState([{ 
    product_id: '', 
    quantity: 1, 
    batch_number: '', 
    serial_numbers: [], 
    condition: 'new' 
  }]);
  const [dischargeType, setDischargeType] = useState('user');
  const [fromNodeId, setFromNodeId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [toNodeId, setToNodeId] = useState('');

  const { data: productsData } = useFetch('/products');
  const { data: nodesData } = useFetch('/organization/nodes');
  const { data: usersData } = useFetch('/users');
  
  const products = productsData?.products || [];
  const nodes = nodesData?.data || [];
  const usersRaw = usersData?.users || usersData?.data || usersData;
  const usersArray = Array.isArray(usersRaw) ? usersRaw : [];
  
  const filteredUsers = isStorageManager && fromNodeId 
    ? usersArray.filter(u => 
        u.org_node_id === parseInt(fromNodeId) || 
        u.org_node_id == fromNodeId || 
        u.organizationNode?.id === parseInt(fromNodeId)
      )
    : usersArray;

  useEffect(() => {
    if (isStorageManager && user?.org_node_id && !requestId) {
      setFromNodeId(user.org_node_id);
    }
  }, [isStorageManager, user, requestId]);

  useEffect(() => {
    if (requestId) {
      api.get(`/requests/${requestId}`).then(res => {
        const request = res.data.data;
        setFromNodeId(request.org_node_id);
        setToUserId(request.requester_id);
        setDischargeType('user');
        setItems(request.items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity_requested,
          batch_number: '',
          serial_numbers: [],
          condition: 'new'
        })));
      });
    }
  }, [requestId]);

  const handleAddItem = () => {
    setItems([...items, { product_id: '', quantity: 1, batch_number: '', serial_numbers: [], condition: 'new' }]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fromNodeId) return toast.error('Please select a source storage node');
    try {
      await inventoryService.createDischargeForm({
        discharge_type: dischargeType === 'branch' ? 'node' : dischargeType,
        from_node_id: parseInt(fromNodeId),
        to_user_id: dischargeType === 'user' ? parseInt(toUserId) : null,
        to_node_id: dischargeType === 'branch' ? parseInt(toNodeId) : null,
        request_id: requestId || null,
        items
      });
      toast.success('Asset discharge executed successfully');
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error('Failed to execute asset discharge');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-black text-slate-900 font-display uppercase tracking-tight">Asset Discharge / Issue</h2>
          <p className="text-slate-500 text-xs font-bold">Release equipment to individuals or other storage locations</p>
        </div>
        <Button variant="outline" size="sm" onClick={onCancel} className="text-slate-400 hover:text-rose-500 hover:border-rose-200">
          Cancel & Return
        </Button>
      </div>
      
      <Card className="shadow-xl border-0 overflow-hidden bg-white ring-1 ring-slate-200">
        <CardContent className="p-0">
          <form onSubmit={handleSubmit}>
            <div className="p-8 bg-slate-50/50 grid grid-cols-1 md:grid-cols-3 gap-8 border-b border-slate-100">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Source Node</label>
                <select 
                  className="w-full h-[42px] border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary-500 bg-white transition-all disabled:bg-slate-50 disabled:text-slate-400"
                  value={fromNodeId}
                  onChange={(e) => setFromNodeId(e.target.value)}
                  disabled={isStorageManager}
                  required
                >
                  <option value="">Select Source Location</option>
                  {nodes?.filter(n => n.can_store_inventory || n.type?.is_storage_allowed).map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Recipient Type</label>
                <div className="flex bg-slate-200/50 p-1 rounded-xl gap-1 h-[42px]">
                   <button 
                     type="button" 
                     onClick={() => setDischargeType('user')}
                     className={`flex-1 text-[10px] font-black uppercase rounded-lg transition-all ${dischargeType === 'user' ? 'bg-white shadow-sm text-primary-600' : 'text-slate-500 hover:bg-white/50'}`}
                   >
                     Personnel
                   </button>
                   <button 
                     type="button" 
                     onClick={() => setDischargeType('branch')}
                     className={`flex-1 text-[10px] font-black uppercase rounded-lg transition-all ${dischargeType === 'branch' ? 'bg-white shadow-sm text-primary-600' : 'text-slate-500 hover:bg-white/50'}`}
                   >
                     Another Location
                   </button>
                </div>
              </div>

              <div className="space-y-2">
                {dischargeType === 'user' ? (
                  <>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Recipient Personnel</label>
                    <select 
                      className="w-full h-[42px] border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary-500 bg-white transition-all"
                      value={toUserId}
                      onChange={(e) => setToUserId(e.target.value)}
                      required
                    >
                      <option value="">Select User</option>
                      {filteredUsers?.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name} (#{u.employee_id})</option>)}
                    </select>
                  </>
                ) : (
                  <>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Target Storage Node</label>
                    <select 
                      className="w-full h-[42px] border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary-500 bg-white transition-all"
                      value={toNodeId}
                      onChange={(e) => setToNodeId(e.target.value)}
                      required
                    >
                      <option value="">Select Target Location</option>
                      {nodes?.filter(n => n.can_store_inventory || n.type?.is_storage_allowed).map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>
                  </>
                )}
              </div>
            </div>

            <div className="p-8 space-y-6">
               <div className="flex items-center justify-between">
                   <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></span>
                      Allocation Details
                   </h3>
                   <Button type="button" variant="secondary" size="sm" onClick={handleAddItem} className="bg-slate-100 hover:bg-slate-200 border-0 text-slate-700 text-[10px] font-black py-1 h-8">
                      + ADD LINE ITEM
                   </Button>
                </div>

                <div className="space-y-4">
                  {items.map((item, index) => {
                    const selectedProp = products?.find(p => p.id === parseInt(item.product_id));
                    return (
                      <div key={index} className="group bg-slate-50 border border-slate-100 rounded-2xl p-6 hover:border-emerald-200 transition-all hover:bg-white hover:shadow-lg relative">
                        <div className="absolute -left-3 top-6 w-6 h-6 bg-slate-900 text-white text-[10px] font-black flex items-center justify-center rounded-lg shadow-md underline decoration-emerald-500 decoration-2">
                           {index + 1}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                           <div className="md:col-span-2 space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory Item</label>
                              <select
                                className="w-full h-[42px] border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 bg-white transition-all"
                                value={item.product_id}
                                onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[index].product_id = e.target.value;
                                  setItems(newItems);
                                }}
                                required
                              >
                                <option value="">Select Stock...</option>
                                {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                              {selectedProp && (
                                 <div className="flex gap-2 mt-2">
                                    <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded uppercase tracking-tighter">SKU: {selectedProp.sku}</span>
                                    <span className="text-[10px] font-black bg-slate-200 text-slate-600 px-2 py-0.5 rounded uppercase tracking-tighter">{selectedProp.brand}</span>
                                 </div>
                              )}
                           </div>
                           
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Release Quantity</label>
                              <Input 
                                type="number" 
                                min="1"
                                value={item.quantity} 
                                onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[index].quantity = parseInt(e.target.value) || 0;
                                  setItems(newItems);
                                }}
                                required
                                className="bg-white border-slate-200 h-[42px] font-bold"
                              />
                           </div>

                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Condition Flag</label>
                              <select 
                                className="w-full h-[42px] border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 bg-white"
                                value={item.condition}
                                onChange={(e) => {
                                   const newItems = [...items];
                                   newItems[index].condition = e.target.value;
                                   setItems(newItems);
                                }}
                              >
                                 <option value="new">Pristine / New</option>
                                 <option value="good">Good / Used</option>
                                 <option value="fair">Fair / Wear</option>
                                 <option value="damaged">Damaged / Repair</option>
                              </select>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-slate-100">
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Internal Batch ID</label>
                              <Input 
                                placeholder="Ref #" 
                                value={item.batch_number} 
                                onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[index].batch_number = e.target.value;
                                  setItems(newItems);
                                }} 
                                className="bg-white border-slate-200 h-[42px]" 
                              />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Serial Identifiers (Comma Separated)</label>
                              <Input 
                                placeholder="SN1, SN2..." 
                                value={item.serial_numbers?.join(', ')} 
                                onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[index].serial_numbers = e.target.value.split(',').map(s => s.trim());
                                  setItems(newItems);
                                }} 
                                className="bg-white border-slate-200 h-[42px]" 
                              />
                           </div>
                        </div>

                        {items.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => handleRemoveItem(index)}
                            className="absolute -right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white text-rose-500 rounded-full shadow-lg border border-rose-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-50"
                          >
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="text-slate-500 text-xs font-medium max-w-md italic">
                   Warning: This action will deduct quantities from your local inventory and update the asset distribution register.
                </div>
                <Button type="submit" className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black px-12 py-4 h-auto shadow-xl shadow-emerald-200 transition-all hover:-translate-y-1">
                  EXECUTE DISTRIBUTION
                </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default DischargeForm;
