import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import inventoryService from '../services/inventoryService';
import toast from 'react-hot-toast';
import Button from '../components/ui/Button';
import { 
  GitFork, ChevronLeft, Box, Tag, Package, 
  MapPin, Clock, AlertTriangle, ArrowRight, Zap, Target, Building2
} from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CascadingUnitSelector from '../components/common/CascadingUnitSelector';

const SplitPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inventoryId = searchParams.get('inventory_id');
  const defaultQty = parseInt(searchParams.get('quantity')) || 1;
  const isMaterialize = searchParams.get('mode') === 'materialize';
  
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [splitData, setSplitData] = useState({
    quantity: defaultQty,
    serial_number: '',
    batch_number: '',
    location_details: '',
    org_node_id: ''
  });

  useEffect(() => {
    if (!inventoryId) {
      toast.error('Missing Source Asset Reference');
      navigate('/inventory/manage');
      return;
    }
    
    const fetchItem = async () => {
      try {
        const data = await inventoryService.getInventoryById(inventoryId);
        setItem(data);
        // Pre-fill destination with current node
        setSplitData(prev => ({ ...prev, org_node_id: data.org_node_id }));
        
        if (data.quantity <= 1 && !isMaterialize) {
          toast.error('Source Asset lacks sufficient quantity to execute a split parallel.');
          navigate('/inventory/manage');
        }
      } catch (err) {
        toast.error('Failed to authenticate source asset reference');
        navigate('/inventory/manage');
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [inventoryId, navigate, isMaterialize]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (splitData.quantity >= item?.quantity && !isMaterialize) {
      return toast.error('Split Quantity must be less than the Source Object total quantity.');
    }
    
    if (splitData.quantity < 1) {
       return toast.error('Minimum split trajectory requires 1 unit.');
    }

    setSubmitting(true);
    try {
      await inventoryService.splitItem(item.id, splitData);
      toast.success(isMaterialize ? 'Unit identity bound successfully.' : 'Asset registry fork successful. Parallel object created.');
      navigate('/inventory/manage');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Protocol Failure: Unable to execute registry fork');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!item) return null;

  const maxQty = item.quantity - 1;

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 py-10 px-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
      
      {/* Header Pipeline */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-b-2 border-slate-50 pb-10">
        <div className="space-y-3">
           <button 
             onClick={() => navigate('/inventory/manage')} 
             className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-purple-600 transition-colors group"
           >
             <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Cancel Protocol
           </button>
           <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-purple-950 rounded-[28px] flex items-center justify-center shadow-2xl shadow-purple-900/30 rotate-3">
                 <GitFork className="text-purple-400" size={32} />
              </div>
              <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">
                   Branch Split Protocol
                </h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">
                  Asset Isolation & Distribution between branches
                </p>
              </div>
           </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-12">
         {/* Identity Overview Panel */}
         <div className="xl:col-span-5 space-y-6">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Source Asset</h2>
            
            <div className="bg-white rounded-[40px] p-10 ring-1 ring-slate-100 shadow-xl overflow-hidden relative group border-t-8 border-slate-900">
               <div className="relative z-10 flex flex-col gap-8">
                  {/* Title block */}
                  <div className="flex items-start gap-5">
                    <div className="w-14 h-14 bg-slate-950 rounded-2xl flex items-center justify-center shadow-2xl rotate-3">
                      <Box className="text-white" size={24} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight italic uppercase">{item.product?.name}</h3>
                      <div className="font-mono text-[10px] font-bold text-purple-600 tracking-widest mt-1">
                        SKU: {item.product?.sku}
                      </div>
                    </div>
                  </div>

                  {/* Attributes Matrix */}
                  <div className="grid grid-cols-1 gap-6 bg-slate-50 p-8 rounded-[30px] border border-slate-100">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                           <Target size={12} className="text-slate-300" /> Current Stock
                        </div>
                        <div className="text-2xl font-black italic tracking-tighter text-slate-900">{item.quantity}</div>
                     </div>
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                           <Building2 size={12} className="text-slate-300" /> Current Branch
                        </div>
                        <div className="text-sm font-black text-slate-700">{item.organizationNode?.name}</div>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Configuration Target Panel */}
         <div className="xl:col-span-7 space-y-6">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Fork Target Specification</h2>
            
            <div className="bg-purple-950 rounded-[40px] p-10 ring-8 ring-purple-100/50 shadow-2xl relative overflow-hidden text-white">
               
               <div className="relative z-10 space-y-8">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                     {/* Extraction Volume */}
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-purple-300 uppercase tracking-widest italic">Quantity to Extract</label>
                        <input 
                           type="number" 
                           min={1} 
                           max={maxQty || 1} 
                           value={splitData.quantity} 
                           onChange={e => setSplitData({ ...splitData, quantity: parseInt(e.target.value) || 1 })} 
                           className="w-full h-20 bg-purple-900/80 border-2 border-purple-700/50 rounded-[30px] px-8 font-black text-5xl text-white text-center outline-none focus:border-purple-400 transition-all shadow-inner shadow-black/50" 
                           required
                        />
                     </div>

                     {/* Destination Branch */}
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-purple-300 uppercase tracking-widest italic">Destination Branch / Node</label>
                        <div className="h-20 bg-purple-900/80 border-2 border-purple-700/50 rounded-[30px] p-2 flex items-center">
                           <CascadingUnitSelector 
                             value={splitData.org_node_id} 
                             onChange={(val) => setSplitData({ ...splitData, org_node_id: val })}
                             className="bg-transparent border-none text-white font-black uppercase text-[10px]"
                           />
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-t border-purple-800/50 pt-10">
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-purple-300 uppercase tracking-widest">Serial Number Assignment</label>
                        <input 
                           type="text"
                           value={splitData.serial_number} 
                           onChange={e => setSplitData({ ...splitData, serial_number: e.target.value })} 
                           placeholder="Assign Serial No. (If individual)" 
                           className="w-full h-14 bg-purple-900/40 border-none rounded-[20px] px-6 font-mono text-sm text-white placeholder:text-purple-500/50 outline-none focus:ring-2 focus:ring-purple-500 transition-all" 
                        />
                     </div>

                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-purple-300 uppercase tracking-widest">Granular Location details</label>
                        <input 
                           type="text"
                           value={splitData.location_details} 
                           onChange={e => setSplitData({ ...splitData, location_details: e.target.value })} 
                           placeholder="e.g. Aisle 5, Shelf B" 
                           className="w-full h-14 bg-purple-900/40 border-none rounded-[20px] px-6 text-sm text-white placeholder:text-purple-500/50 outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium" 
                        />
                     </div>
                  </div>
               </div>
            </div>

            <Button 
               type="submit" 
               disabled={submitting}
               className="w-full h-24 bg-white hover:bg-slate-50 text-slate-900 font-black text-2xl uppercase tracking-tighter rounded-[40px] shadow-2xl flex items-center justify-center gap-6 group transition-all"
            >
               {submitting ? 'Executing Fork...' : (
                 <>
                   Commit Registry Fork
                   <ArrowRight className="group-hover:translate-x-4 transition-transform text-purple-600" />
                 </>
               )}
            </Button>
         </div>
      </form>
    </div>
  );
};

export default SplitPage;
