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
  const [returnType, setReturnType] = useState('discharge');
  const [refNumber, setRefNumber] = useState('');
  const [targetQty, setTargetQty] = useState(0);

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
    setTargetQty(0);
    
    const expandedItems = [];
    form.items.forEach((item, itemIndex) => {
      const qty = Number(item.quantity || 1);
      const sns = item.serial_numbers || [];
      
      for (let i = 0; i < qty; i++) {
        expandedItems.push({
          uid: `${item.id || itemIndex}-${i}`,
          product: item.product,
          serial_number: sns[i] || null,
          product_id: item.product_id,
          selected: false
        });
      }
    });
    setReturnItems(expandedItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const selectedItems = Array.isArray(returnItems) ? returnItems.filter(item => item.selected) : [];
    
    if (selectedItems.length === 0) {
      return toast.error('No Resources Selected: Specify quantities for return');
    }

    // Group back by product_id for the API
    const grouped = {};
    selectedItems.forEach(item => {
      const pid = item.product_id;
      if (!grouped[pid]) {
        grouped[pid] = {
          product_id: pid,
          quantity: 0,
          condition: 'good'
        };
      }
      grouped[pid].quantity += 1;
    });
    
    const itemsToReturn = Object.values(grouped);

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
      <div className="flex items-center justify-center h-[50vh]">
        <div className="animate-spin text-emerald-500">
           <RotateCcw size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 py-6 px-4 lg:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-slate-100 pb-4">
        <div className="space-y-1">
           <button 
             onClick={() => navigate(-1)} 
             className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-emerald-600 transition-colors group mb-1"
           >
             <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />Back
           </button>
           <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-slate-900 rounded-xl flex items-center justify-center shadow-sm">
                 <History className="text-emerald-400" size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Return Inventories</h1>
                <p className="text-xs font-normal text-slate-400"></p>
              </div>
           </div>
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Step 01: History Explorer */}
        <div className="xl:col-span-4 space-y-4">
           <div className="flex items-center gap-2 px-1">
              <History className="text-emerald-600" size={14} />
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Discharge History</h3>
           </div>

           <div className="space-y-2">
              {history.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                   <p className="text-xs font-medium text-slate-400">No active discharge records found for this branch</p>
                </div>
              ) : (
                history.map(form => (
                  <div 
                    key={form.id}
                    onClick={() => handleSelectForm(form)}
                    className={`p-3 rounded-xl transition-all cursor-pointer border ${
                      selectedForm?.id === form.id 
                      ? 'bg-slate-900 border-slate-900 text-white shadow-md' 
                      : 'bg-white border-slate-100 hover:border-emerald-500 shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                       <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                         selectedForm?.id === form.id ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'
                       }`}>
                          {form.form_number}
                       </span>
                       <span className="text-xs text-slate-400">{new Date(form.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className={`font-bold text-sm tracking-tight ${
                      selectedForm?.id === form.id ? 'text-white' : 'text-slate-900'
                    }`}>
                       {form.items?.length} Resource Classes
                    </div>
                    <div className={`text-xs mt-1.5 font-medium ${
                      selectedForm?.id === form.id ? 'text-slate-300' : 'text-slate-500'
                    }`}>
                       Source: Node {form.from_node_id}
                    </div>
                  </div>
                ))
              )}
           </div>
        </div>

        {/* Step 02: Resource Reconciliation */}
        <div className="xl:col-span-8">
           {selectedForm ? (
             <form onSubmit={handleSubmit} className="space-y-6">
                <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white p-6 space-y-6">
                   <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-2">
                         <Package className="text-emerald-600" size={16} />
                         <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Resource Reconciliation</h3>
                      </div>
                      <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-0.5 rounded-full">
                         Active Receipt: {selectedForm.form_number}
                      </div>
                   </div>

                    <div className="space-y-4">
                       <div className="p-4 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-4">
                          <div>
                             <label className="text-xs font-semibold text-slate-500 ml-1">Target Return Quantity</label>
                             <div className="text-sm font-medium text-slate-600">Enter the total number of items you plan to return</div>
                          </div>
                          <input 
                            type="number"
                            min="0"
                            className="w-24 h-10 bg-slate-50 border border-slate-200 rounded-lg px-3 font-semibold text-slate-900 outline-none focus:border-emerald-500 transition-all text-center"
                            value={targetQty}
                            onChange={(e) => setTargetQty(parseInt(e.target.value) || 0)}
                          />
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {Array.isArray(returnItems) && returnItems.map((item, index) => (
                             <div 
                               key={item.uid}
                               onClick={() => {
                                 const currentSelected = returnItems.filter(it => it.selected).length;
                                 if (!item.selected && currentSelected >= targetQty) {
                                   toast.error(`Limit reached: You can only select up to ${targetQty} items`);
                                   return;
                                 }
                                 setReturnItems(prev => prev.map((it, i) => 
                                   i === index ? { ...it, selected: !it.selected } : it
                                 ));
                                }}
                               className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                                 item.selected 
                                 ? 'bg-emerald-50 border-emerald-500 shadow-sm' 
                                 : 'bg-white border-slate-100 hover:border-emerald-200'
                               }`}
                             >
                                <div>
                                   <div className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">
                                      {item.serial_number ? "Serial Number" : "Unique ID"}
                                   </div>
                                   <div className="text-sm font-bold text-slate-900 tracking-tight mt-0.5">
                                      {item.serial_number || item.uid}
                                   </div>
                                   <div className="mt-1 text-xs font-medium text-slate-500">
                                      {item.product?.name} — [{item.product?.sku}]
                                   </div>
                                </div>
                                <div className="mt-3 flex justify-end">
                                   <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                     item.selected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'
                                   }`}>
                                      {item.selected && <CheckCircle2 size={12} />}
                                   </div>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>

                   <div className="space-y-2">
                      <div className="flex items-center gap-2 ml-1">
                         <Info className="text-emerald-600" size={14} />
                         <label className="text-xs font-semibold text-slate-500">Operational Justification</label>
                      </div>
                      <textarea 
                        className="w-full h-24 bg-slate-50 border border-slate-200 rounded-lg p-3 font-normal text-sm text-slate-600 outline-none focus:bg-white focus:border-emerald-500 transition-all resize-none"
                        placeholder="State the technical reason for the stock re-entry..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        required
                      />
                   </div>

                   <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-start gap-3 max-w-md">
                         <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <ShieldCheck className="text-emerald-600" size={16} />
                         </div>
                         <p className="text-xs text-slate-500 leading-relaxed">
                            By initiating this protocol, you confirm that the physical resources are ready for inspection and transport to the <span className="font-semibold text-slate-700">Primary Hub</span>.
                         </p>
                      </div>
                      <Button 
                        type="submit" 
                        loading={submitting}
                        className="w-full md:w-auto px-6 bg-slate-950 h-10 rounded-lg hover:bg-emerald-600 text-white font-semibold text-xs tracking-wide transition-all flex items-center justify-center gap-2 group"
                      >
                        {submitting ? 'Transmitting...' : 'Initiate Re-Entry'}
                        <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                      </Button>
                   </div>
                </Card>
             </form>
           ) : (
             <div className="h-full flex flex-col items-center justify-center p-12 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 text-center">
                <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-sm mb-6 rotate-12">
                   <AlertTriangle className="text-slate-300" size={32} />
                </div>
                <h2 className="text-lg font-bold text-slate-400 tracking-tight">Selection Required</h2>
                <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
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
