import React, { useState } from 'react';
import Card, { CardContent, CardHeader, CardTitle } from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useFetch } from '../../hooks/useFetch';
import inventoryService from '../../services/inventoryService';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const StockIntakeForm = ({ onSuccess, onCancel }) => {
  const { user } = useAuth();
  const isStorageManager = user?.role?.name === 'storage_manager';
  
  const [items, setItems] = useState([{ 
    product_id: '', 
    quantity: 1, 
    unit_price: 0, 
    batch_number: '', 
    serial_number: ''
  }]);
  
  const { data: productsData } = useFetch('/products');
  const { data: nodesData } = useFetch('/organization/nodes');
  
  const products = productsData?.products || [];
  const storageNodes = (nodesData?.data || []).filter(n => n.can_store_inventory || n.type?.is_storage_allowed);
  
  const [orgNodeId, setOrgNodeId] = useState('');
  const [supplier, setSupplier] = useState('');
  const [totalProducts, setTotalProducts] = useState(0);

  React.useEffect(() => {
    if (isStorageManager && user?.org_node_id) {
      setOrgNodeId(user.org_node_id);
    }
  }, [isStorageManager, user]);

  const handleAddItem = () => {
    setItems([...items, { 
      product_id: '', 
      quantity: 1, 
      unit_price: 0, 
      batch_number: '', 
      serial_number: '' 
    }]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!orgNodeId) return toast.error('Please select a destination node');
    try {
      const formattedItems = items.map(item => ({
        ...item,
        product_id: parseInt(item.product_id),
        quantity: parseInt(item.quantity)
      }));

      await inventoryService.createStoreForm({
        org_node_id: parseInt(orgNodeId),
        supplier,
        items: formattedItems,
        total_quantity: parseInt(totalProducts) || 0
      });
      toast.success('Stock intake registered successfully');
      if (onSuccess) onSuccess();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to complete intake';
      toast.error(errorMsg);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-black text-slate-900 font-display uppercase tracking-tight">Stock Intake Registration</h2>
          <p className="text-slate-500 text-xs font-bold">Log new items into the organization repository</p>
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Source / Supplier</label>
                  <Input 
                    value={supplier} 
                    onChange={(e) => setSupplier(e.target.value)} 
                    placeholder="Enter vendor or warehouse name" 
                    required 
                    className="bg-white border-slate-200 focus:ring-primary-500" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Storage Node Destination</label>
                  <select 
                    className="w-full h-[42px] border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary-500 bg-white transition-all disabled:bg-slate-50 disabled:text-slate-400"
                    value={orgNodeId}
                    onChange={(e) => setOrgNodeId(e.target.value)}
                    disabled={isStorageManager}
                    required
                  >
                    <option value="">Select Destination</option>
                    {storageNodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Inventory Reference #</label>
                  <Input 
                    type="number" 
                    value={totalProducts} 
                    onChange={(e) => setTotalProducts(e.target.value)} 
                    placeholder="Optional reference count" 
                    className="bg-white border-slate-200" 
                  />
                </div>
             </div>

             <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                   <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center">
                      <span className="w-2 h-2 bg-primary-500 rounded-full mr-2"></span>
                      Product Details
                   </h3>
                   <Button type="button" variant="secondary" size="sm" onClick={handleAddItem} className="bg-slate-100 hover:bg-slate-200 border-0 text-slate-700 text-[10px] font-black py-1 h-8">
                      + ADD ANOTHER LINE
                   </Button>
                </div>

                <div className="space-y-4">
                  {items.map((item, index) => {
                    const selectedProp = products.find(p => p.id === parseInt(item.product_id));
                    return (
                      <div key={index} className="group bg-slate-50 border border-slate-100 rounded-2xl p-6 hover:border-primary-200 transition-all hover:bg-white hover:shadow-lg relative">
                        <div className="absolute -left-3 top-6 w-6 h-6 bg-slate-900 text-white text-[10px] font-black flex items-center justify-center rounded-lg shadow-md underline decoration-primary-500 decoration-2">
                           {index + 1}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                           <div className="md:col-span-2 space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Product Catalog Item</label>
                              <select
                                className="w-full h-[42px] border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary-500 bg-white transition-all"
                                value={item.product_id}
                                onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[index].product_id = e.target.value;
                                  setItems(newItems);
                                }}
                                required
                              >
                                <option value="">Choose a product...</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                              </select>
                              {selectedProp && (
                                <div className="flex gap-2 mt-2">
                                   <span className="text-[10px] font-black bg-slate-200 text-slate-600 px-2 py-0.5 rounded tracking-tighter uppercase">{selectedProp.category}</span>
                                   <span className="text-[10px] font-black bg-primary-50 text-primary-600 px-2 py-0.5 rounded tracking-tighter uppercase">{selectedProp.brand}</span>
                                </div>
                              )}
                           </div>
                           
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</label>
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
                                className="bg-white border-slate-200 h-[42px] font-bold text-slate-900"
                              />
                           </div>

                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit Cost</label>
                              <Input 
                                type="number" 
                                step="0.01" 
                                value={item.unit_price} 
                                onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[index].unit_price = parseFloat(e.target.value) || 0;
                                  setItems(newItems);
                                }} 
                                className="bg-white border-slate-200 h-[42px] font-bold text-slate-900" 
                              />
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-slate-100">
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Batch / Lot Number</label>
                              <Input 
                                placeholder="Enter batch ID if applicable" 
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
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Serial Number</label>
                              <Input 
                                placeholder="Individual asset serial number" 
                                value={item.serial_number} 
                                onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[index].serial_number = e.target.value;
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
                <div className="text-slate-500 text-xs font-medium">
                   Confirm that all product details match the physical delivery documentation.
                </div>
                <Button type="submit" className="w-full md:w-auto bg-primary-600 hover:bg-primary-700 text-white font-black px-12 py-4 h-auto shadow-xl shadow-primary-200 transition-all hover:-translate-y-1">
                  COMPLETE STOCK INTAKE
                </Button>
             </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default StockIntakeForm;
