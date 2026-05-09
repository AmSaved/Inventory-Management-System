import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card, { CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { 
  RotateCcw, 
  Package, 
  ShieldCheck, 
  ArrowRight,
  ChevronLeft,
  Building2,
  FileText,
  History,
  Info,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

const ReturnInventoryPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [history, setHistory] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [returnItems, setReturnItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await api.get(`/returns/history/discharge?node_id=${user?.org_node_id}`);
      setHistory(res.data.data || []);
    } catch (error) {
      toast.error('Strategic Failure: Could not synchronize discharge history');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectForm = (form) => {
    setSelectedForm(form);
    
    // Aggregate items by product_id to prevent duplicates in the UI
    const grouped = {};
    form.items.forEach(item => {
      const pid = item.product_id;
      if (!grouped[pid]) {
        grouped[pid] = {
          product_id: pid,
          product: item.product,
          max: 0
        };
      }
      grouped[pid].max += Number(item.quantity || 0);
    });

    const initialReturns = {};
    Object.values(grouped).forEach(g => {
      initialReturns[g.product_id] = {
        quantity: 0,
        max: g.max,
        product: g.product
      };
    });
    setReturnItems(initialReturns);
  };

  const handleQtyChange = (productId, qty) => {
    const val = parseInt(qty) || 0;
    const max = returnItems[productId]?.max || 0;
    
    if (val > max) {
      toast.error(`Exceeds Receipt: Max allowed is ${max}`);
      return;
    }

    setReturnItems(prev => ({
      ...prev,
      [productId]: { ...prev[productId], quantity: val }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const itemsToReturn = Object.values(returnItems)
      .filter(item => item.quantity > 0)
      .map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        condition: 'good'
      }));

    if (itemsToReturn.length === 0) {
      return toast.error('No Resources Selected: Specify quantities for return');
    }

    setSubmitting(true);
    try {
      await api.post('/returns/inventory', {
        from_node_id: user.org_node_id,
        to_node_id: selectedForm.from_node_id, // Return to source
        request_id: selectedForm.request_id,
        notes: notes,
        items: itemsToReturn
      });
      
      toast.success('Reverse Logistics Protocol Initiated');
      navigate('/requests/inventory-returns');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Return Transmission Failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="animate-spin text-emerald-500">
           <RotateCcw size={48} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-12 py-10 px-6">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-b-2 border-slate-50 pb-10">
        <div className="space-y-3">
           <button 
             onClick={() => navigate(-1)} 
             className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-emerald-600 transition-colors group"
           >
             <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Logistics Hub
           </button>
           <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-slate-900 rounded-[28px] flex items-center justify-center shadow-2xl rotate-6">
                 <History className="text-emerald-400" size={32} />
              </div>
              <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Strategic Re-Entry</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1 mt-1">Institutional Reverse Logistics</p>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        {/* Step 01: History Explorer */}
        <div className="xl:col-span-4 space-y-6">
           <div className="flex items-center gap-3 px-2">
              <FileText className="text-emerald-600" size={16} />
              <h3 className="font-black text-slate-900 text-[10px] uppercase tracking-widest">Discharge History</h3>
           </div>
           
           <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {history.length === 0 ? (
                <div className="p-10 text-center bg-slate-50 rounded-[30px] border-2 border-dashed border-slate-200">
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-loose">No active discharge records found for this branch</p>
                </div>
              ) : (
                history.map(form => (
                  <div 
                    key={form.id}
                    onClick={() => handleSelectForm(form)}
                    className={`p-6 rounded-[30px] transition-all cursor-pointer border-2 ${
                      selectedForm?.id === form.id 
                      ? 'bg-slate-900 border-slate-900 shadow-2xl scale-[1.02]' 
                      : 'bg-white border-slate-100 hover:border-emerald-500 shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                       <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${
                         selectedForm?.id === form.id ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'
                       }`}>
                          {form.form_number}
                       </span>
                       <span className="text-[9px] font-black text-slate-400">{new Date(form.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className={`font-black text-lg italic tracking-tight uppercase leading-none ${
                      selectedForm?.id === form.id ? 'text-white' : 'text-slate-900'
                    }`}>
                       {form.items?.length} Resource Classes
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase mt-2">
                       Source: {form.from_node_id} (Parent)
                    </div>
                  </div>
                ))
              )}
           </div>
        </div>

        {/* Step 02: Resource Reconciliation */}
        <div className="xl:col-span-8">
           {selectedForm ? (
             <form onSubmit={handleSubmit} className="space-y-8">
                <Card className="rounded-[40px] border-none shadow-2xl bg-white p-10 ring-1 ring-slate-100 space-y-10">
                   <div className="flex items-center justify-between border-b border-slate-50 pb-6">
                      <div className="flex items-center gap-3">
                         <Package className="text-emerald-600" size={20} />
                         <h3 className="font-black text-slate-900 text-[10px] uppercase tracking-widest">Resource Reconciliation</h3>
                      </div>
                      <div className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-4 py-1 rounded-full uppercase tracking-widest">
                         Active Receipt: {selectedForm.form_number}
                      </div>
                   </div>

                   <div className="space-y-6">
                      {Object.values(returnItems).map(item => (
                        <div key={item.product?.id} className="p-6 bg-slate-50 rounded-[30px] border border-slate-100 hover:border-emerald-200 transition-all flex flex-col md:flex-row md:items-center gap-6 group">
                           <div className="flex-1 space-y-1">
                              <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Catalog Resource</div>
                              <div className="text-xl font-black text-slate-900 italic tracking-tight uppercase leading-none">{item.product?.name}</div>
                              <div className="flex items-center gap-4 mt-2">
                                 <span className="text-[9px] font-bold text-slate-400 uppercase">Available for Return: {item.max} units</span>
                                 <span className="text-[9px] font-bold text-slate-400 uppercase">SKU: {item.product?.sku}</span>
                              </div>
                           </div>
                           
                           <div className="w-full md:w-48 space-y-2">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Return Quantity</label>
                              <div className="relative">
                                 <input 
                                   type="number"
                                   min="0"
                                   max={item.max}
                                   className="w-full h-14 bg-white border-2 border-slate-100 rounded-[20px] px-6 font-black text-slate-900 outline-none focus:border-emerald-500 transition-all"
                                   value={item.quantity || 0}
                                   onChange={(e) => handleQtyChange(item.product?.id, e.target.value)}
                                 />
                                 <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">/ {item.max}</div>
                              </div>
                           </div>
                        </div>
                      ))}
                   </div>

                   <div className="space-y-4">
                      <div className="flex items-center gap-3 ml-2">
                         <Info className="text-emerald-600" size={14} />
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operational Justification</label>
                      </div>
                      <textarea 
                        className="w-full h-32 bg-slate-50 border-2 border-slate-100 rounded-[30px] p-6 font-medium text-slate-600 outline-none focus:bg-white focus:border-emerald-500 transition-all resize-none shadow-inner"
                        placeholder="State the technical reason for the stock re-entry..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        required
                      />
                   </div>

                   <div className="pt-6 border-t border-slate-50 flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex items-start gap-4 max-w-md">
                         <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                            <ShieldCheck className="text-emerald-600" size={20} />
                         </div>
                         <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-tight">
                            By initiating this protocol, you confirm that the physical resources are ready for inspection and transport to the **Primary Hub**.
                         </p>
                      </div>
                      <Button 
                        type="submit" 
                        loading={submitting}
                        className="w-full md:w-auto px-10 bg-slate-950 h-18 rounded-[25px] hover:bg-emerald-600 text-white font-black text-sm tracking-widest uppercase transition-all duration-500 flex items-center justify-center gap-4 group"
                      >
                        {submitting ? 'Transmitting...' : 'Initiate Re-Entry'}
                        <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
                      </Button>
                   </div>
                </Card>
             </form>
           ) : (
             <div className="h-full flex flex-col items-center justify-center p-20 bg-slate-50/50 rounded-[50px] border-4 border-dashed border-slate-100 text-center">
                <div className="w-24 h-24 bg-white rounded-[40px] flex items-center justify-center shadow-xl mb-8 rotate-12">
                   <AlertTriangle className="text-slate-200" size={48} />
                </div>
                <h2 className="text-2xl font-black text-slate-300 uppercase italic tracking-tighter">Selection Required</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-4 max-w-xs leading-loose">
                   Select a valid discharge record from the history explorer to begin the reconciliation process.
                </p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default ReturnInventoryPage;
