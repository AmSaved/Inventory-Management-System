import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card, { CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useFetch } from '../hooks/useFetch';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft, Plus, Trash2, Send, CheckCircle2, ClipboardList } from 'lucide-react';

const RequestProductPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  
  const canRequest = hasPermission('item:request');
  
  const [items, setItems] = useState([{ 
    product_id: '', 
    quantity: 1, 
    specifications: '',
    category: '',
    sub_category: ''
  }]);
  
  const [purpose, setPurpose] = useState('');
  const [priority, setPriority] = useState('medium');
  const [expectedDate, setExpectedDate] = useState('');
  
  // Fetching a large limit of active products to build the hierarchy tree
  const { data: productsData } = useFetch('/products?limit=1000&is_active=true');
  const products = Array.isArray(productsData) ? productsData : [];

  // Fetch the dynamic workflow for requests for this branch
  const { data: workflowData } = useFetch('/workflows/active?resource_type=request');
  const activeWorkflow = workflowData?.data;

  // Helper to get unique normalized categories
  const categories = [...new Set(products.map(p => p.category?.trim().toUpperCase()).filter(Boolean))].sort();

  // Helper to get sub-categories for a selected category (Case-Insensitive)
  const getSubCategories = (category) => {
    if (!category) return [];
    return [...new Set(
      products
        .filter(p => p.category?.trim().toUpperCase() === category.toUpperCase())
        .map(p => p.sub_category?.trim().toUpperCase())
        .filter(Boolean)
    )].sort();
  };

  // Helper to get products for a selected sub-category (Case-Insensitive)
  const getFilteredProducts = (category, subCategory) => {
    if (!category) return [];
    return products
      .filter(p => {
        const catMatch = p.category?.trim().toUpperCase() === category.toUpperCase();
        const subMatch = !subCategory || p.sub_category?.trim().toUpperCase() === subCategory.toUpperCase();
        return catMatch && subMatch;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const handleAddItem = () => {
    setItems([...items, { 
      product_id: '', 
      quantity: 1, 
      specifications: '',
      category: '',
      sub_category: ''
    }]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.some(item => !item.product_id)) {
      return toast.error('Please complete the product selection for all items');
    }

    try {
      await api.post('/requests', {
        request_type: 'new',
        purpose,
        priority,
        expected_delivery_date: expectedDate || null,
        items: items.map(item => ({
          product_id: parseInt(item.product_id),
          quantity_requested: item.quantity,
          specifications: item.specifications
        }))
      });
      toast.success('Requisition Protocol Initialized');
      navigate('/dashboard');
    } catch (error) {
      let errorMessage = 'Protocol Failure: Could not submit request';
      if (error.response?.data?.errors && error.response.data.errors.length > 0) {
        errorMessage = error.response.data.errors[0].msg;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      toast.error(errorMessage);
    }
  };

  if (!canRequest) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-[40px] m-10 border-4 border-dashed border-slate-200">
         <div className="w-24 h-24 bg-red-100 rounded-[35px] flex items-center justify-center mb-6 rotate-6 shadow-2xl shadow-red-100/50">
            <ShieldAlert size={40} className="text-red-500" />
         </div>
         <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic mb-2">Protocol Violation</h1>
         <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] max-w-sm leading-relaxed">
            Your assigned access level does not permit entry into the <span className="text-red-500">Resource Acquisition Module</span>. Contact your administrator to request functional clearance.
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
    <div className="max-w-4xl mx-auto space-y-10 py-10 px-4 pb-20">
      <div className="flex items-center space-x-3 text-slate-400 mb-8 font-black uppercase text-[10px] tracking-widest leading-none">
         <button onClick={() => navigate(-1)} className="hover:text-blue-600 transition-colors flex items-center gap-2">
            <ArrowLeft size={16} /> Back to Hub
         </button>
      </div>

      <div className="flex items-center gap-4 mb-10">
         <div className="w-16 h-16 bg-slate-950 rounded-[28px] flex items-center justify-center shadow-2xl rotate-3">
            <Send className="text-blue-500" size={28} />
         </div>
         <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Resource Acquisition</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1 mt-2">New Product Request Protocol</p>
         </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-12">
        {/* REQUIRED FIELDS SECTION */}
        <Card className="rounded-[40px] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-slate-100 mb-10">
          <div className="bg-slate-950 p-8 flex items-center gap-4">
            <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center ring-1 ring-green-500/50">
               <CheckCircle2 className="text-green-500" size={20} />
            </div>
            <div>
               <h2 className="text-white font-black uppercase tracking-widest text-xs">Required Fields</h2>
               <p className="text-slate-400 text-[9px] font-bold tracking-widest uppercase opacity-60 mt-1">Must fill all parameters for validation.</p>
            </div>
          </div>
          <CardContent className="p-10 space-y-10">
            {/* 1. Purpose/Reason */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-xs font-black text-slate-900 bg-slate-100 w-8 h-8 rounded-lg flex items-center justify-center">1</span>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Purpose / Reason</label>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Why do you need it?</p>
                </div>
              </div>
              <Input 
                value={purpose} 
                onChange={(e) => setPurpose(e.target.value)} 
                placeholder="New hire joining IT team / Operational Scaling..." 
                required 
                className="h-14 rounded-2xl border-none bg-slate-50 font-black px-6 text-sm"
              />
            </div>

            {/* 2. Hierarchical Items Section */}
            <div className="space-y-6 pt-6 border-t border-slate-50">
              <div className="flex justify-between items-center px-1">
                 <div className="flex items-center gap-4">
                    <span className="text-xs font-black text-slate-900 bg-slate-100 w-8 h-8 rounded-lg flex items-center justify-center">2</span>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Item Discovery & Quantity</label>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Browse by Category and Sub-category</p>
                    </div>
                 </div>
                 <Button 
                   type="button" 
                   variant="ghost" 
                   className="h-10 text-[10px] font-black text-blue-600 uppercase hover:bg-blue-50 px-4 rounded-xl border border-blue-100" 
                   onClick={handleAddItem}
                 >
                   <Plus size={14} className="mr-2" /> Add Item
                 </Button>
              </div>

              {items.map((item, index) => (
                <div key={index} className="space-y-6 p-8 bg-slate-50 rounded-[30px] border border-slate-100 relative group animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Category Select */}
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                       <select
                        className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 font-black text-slate-900 outline-none hover:border-blue-200 transition-all cursor-pointer text-[10px] uppercase"
                        value={item.category}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].category = e.target.value;
                          newItems[index].sub_category = '';
                          newItems[index].product_id = '';
                          setItems(newItems);
                        }}
                        required
                      >
                        <option value="">Choose Category...</option>
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>

                    {/* Sub-Category Select */}
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Sub-Category</label>
                       <select
                        className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 font-black text-slate-900 outline-none hover:border-blue-200 transition-all cursor-pointer text-[10px] uppercase disabled:opacity-50"
                        value={item.sub_category}
                        disabled={!item.category}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].sub_category = e.target.value;
                          newItems[index].product_id = '';
                          setItems(newItems);
                        }}
                        required
                      >
                        <option value="">Choose Sub-Category...</option>
                        {getSubCategories(item.category).map(sub => <option key={sub} value={sub}>{sub}</option>)}
                      </select>
                    </div>

                    {/* Product Select */}
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Item / Product Model</label>
                       <select
                        className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 font-black text-slate-900 outline-none hover:border-blue-200 transition-all cursor-pointer text-[10px] uppercase disabled:opacity-50"
                        value={item.product_id}
                        disabled={!item.category}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].product_id = e.target.value;
                          setItems(newItems);
                        }}
                        required
                      >
                        <option value="">Select Product...</option>
                        {getFilteredProducts(item.category, item.sub_category).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-8 items-end border-t border-slate-200 pt-6">
                    <div className="w-full md:w-40 space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantity</label>
                      <Input 
                        type="number" 
                        min="1"
                        value={item.quantity} 
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].quantity = parseInt(e.target.value) || 1;
                          setItems(newItems);
                        }}
                        required
                        className="h-12 border border-slate-100 bg-white rounded-2xl font-black text-center text-blue-600 text-lg shadow-sm"
                      />
                    </div>

                    <div className="flex-1 w-full space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex justify-between">
                         <span>Item Specifications (Optional Enhancement)</span>
                         <span className="text-[8px] opacity-60">e.g. 16GB RAM, 512GB SSD</span>
                      </label>
                      <Input 
                        value={item.specifications} 
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].specifications = e.target.value;
                          setItems(newItems);
                        }}
                        placeholder="Specify specific model requirements if necessary..." 
                        className="h-12 rounded-xl border-dashed border-2 border-slate-200 bg-white/50 font-bold text-[11px] px-6 italic"
                      />
                    </div>

                    {items.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => handleRemoveItem(index)}
                        className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all mb-1"
                      >
                         <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* OPTIONAL FIELDS SECTION */}
        <Card className="rounded-[40px] border-none shadow-xl bg-slate-50/50 overflow-hidden ring-1 ring-slate-100">
          <div className="bg-slate-300/30 p-8 flex items-center gap-4 border-b border-slate-100">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
               <ClipboardList className="text-white" size={20} />
            </div>
            <div>
               <h2 className="text-slate-900 font-black uppercase tracking-widest text-xs tracking-tighter">Optional Parameters</h2>
               <p className="text-slate-500 text-[9px] font-bold tracking-widest uppercase opacity-60 mt-1">Enhance your requisition with extra details.</p>
            </div>
          </div>
          <CardContent className="p-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-black text-slate-500 bg-white w-8 h-8 rounded-lg flex items-center justify-center border border-slate-100">1</span>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Requisition Priority</label>
                </div>
                <select 
                  className="w-full h-14 bg-white border border-slate-100 rounded-2xl px-6 font-black text-slate-900 outline-none hover:bg-slate-50 transition-all cursor-pointer text-xs uppercase"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="low">Standard Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">Urgent Requirement</option>
                </select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-black text-slate-500 bg-white w-8 h-8 rounded-lg flex items-center justify-center border border-slate-100">2</span>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Expected Delivery Date</label>
                </div>
                <Input 
                  type="date"
                  value={expectedDate} 
                  onChange={(e) => setExpectedDate(e.target.value)} 
                  className="h-14 rounded-2xl border border-slate-100 bg-white font-black px-6 text-sm uppercase"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SUBMIT BUTTON */}
        <div className="pt-6">
           <Button 
             type="submit" 
             size="lg" 
             className="w-full bg-slate-950 h-24 rounded-[45px] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] hover:bg-slate-900 hover:scale-[1.01] text-white font-black text-2xl tracking-tighter uppercase transition-all flex flex-col items-center justify-center gap-1 group"
           >
             <span className="flex items-center gap-3 group-hover:gap-5 transition-all">
                Submit Requisition Protocol <Send size={24} className="text-blue-500" />
             </span>
             <span className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.4em] opacity-80 group-hover:opacity-100">Execute Secure Data Handshake</span>
           </Button>
        </div>
      </form>
      
      <div className="p-10 bg-slate-950 rounded-[40px] text-center shadow-2xl overflow-hidden relative group">
         <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
         <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] leading-relaxed relative z-10 flex items-center justify-center flex-wrap gap-2">
           Dynamic Approval Pipeline: 
           {activeWorkflow && activeWorkflow.steps && activeWorkflow.steps.length > 0 ? (
             activeWorkflow.steps.map((step, index) => (
               <React.Fragment key={step.id}>
                 <span className="text-white ring-1 ring-slate-800 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/50 shadow-inner">
                   {step.statusLabel ? step.statusLabel.name : (step.requiredRole ? step.requiredRole.name : 'Approval')}
                 </span>
                 {index < activeWorkflow.steps.length - 1 && <span className="text-slate-600">→</span>}
               </React.Fragment>
             ))
           ) : (
             <span className="text-emerald-400 ring-1 ring-emerald-500/30 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shadow-inner ml-2">
               Direct Auto-Approval
             </span>
           )}
         </p>
      </div>
    </div>
  );
};

export default RequestProductPage;
