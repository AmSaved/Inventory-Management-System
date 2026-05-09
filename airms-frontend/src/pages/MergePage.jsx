import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import inventoryService from '../services/inventoryService';
import toast from 'react-hot-toast';
import Button from '../components/ui/Button';
import { 
  Merge, ChevronLeft, Box, ShieldAlert, Zap, Cpu, Search, Layers, ArchiveX
} from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';

const MergePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idsParam = searchParams.get('ids');
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!idsParam) {
      toast.error('Selection Error: No items provided for consolidation.');
      navigate('/inventory/manage');
      return;
    }
    
    // We expect comma separated IDs
    const idArray = idsParam.split(',').filter(Boolean);
    if (idArray.length < 2) {
      toast.error('Constraint Violation: Merge operations require a minimum of two identical assets.');
      navigate('/inventory/manage');
      return;
    }

    const fetchItems = async () => {
      try {
        // Fetch all selected items by tracking promises
        const itemPromises = idArray.map(id => inventoryService.getInventoryById(parseInt(id, 10)));
        const fetchedItems = await Promise.all(itemPromises);
        
        // Validation: Ensure they are from same product catalog entry and node
        const firstItem = fetchedItems[0];
        const mismatch = fetchedItems.some(item => item.product_id !== firstItem.product_id || item.org_node_id !== firstItem.org_node_id);
        
        if (mismatch) {
           toast.error('Protocol Lockout: Assets must share the identical SKU and local Node architecture to be consolidated.');
           navigate('/inventory/manage');
           return;
        }

        setItems(fetchedItems);
      } catch (err) {
        toast.error('Failed to authenticate source asset reference');
        navigate('/inventory/manage');
      } finally {
        setLoading(false);
      }
    };
    
    fetchItems();
  }, [idsParam, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length < 2) return;

    const targetId = items[0].id;
    const sourceIds = items.slice(1).map(i => i.id);

    setSubmitting(true);
    try {
      await inventoryService.mergeItems(targetId, sourceIds);
      toast.success(`Consolidation Matrix complete. ${items.length} records collapsed into ID#${targetId}.`);
      navigate('/inventory/manage');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Protocol Failure: Unable to execute registry consolidation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (items.length === 0) return null;

  const targetItem = items[0];
  const sourceItems = items.slice(1);
  const totalVolume = items.reduce((sum, i) => sum + parseInt(i.quantity, 10), 0);

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 py-10 px-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
      
      {/* Header Pipeline */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-b-2 border-slate-50 pb-10">
        <div className="space-y-3">
           <button 
             onClick={() => navigate('/inventory/manage')} 
             className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-amber-600 transition-colors group"
           >
             <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Abort Consolidation Protocol
           </button>
           <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-amber-950 rounded-[28px] flex items-center justify-center shadow-2xl shadow-amber-900/30 rotate-3">
                 <Merge className="text-amber-400" size={32} />
              </div>
              <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Registry Consolidation</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">Asset Volume Aggregation</p>
              </div>
           </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-12">
         {/* Warning Panel */}
         <div className="xl:col-span-12">
            <div className="bg-amber-50 p-8 rounded-[40px] border-4 border-amber-100 flex flex-col md:flex-row items-center gap-8 shadow-xl shadow-amber-50/50">
               <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm flex-shrink-0 relative overflow-hidden">
                  <div className="absolute inset-0 bg-red-100 animate-pulse pointer-events-none opacity-20" />
                  <ShieldAlert className="text-amber-600 relative z-10" size={36} />
               </div>
               <div className="space-y-2">
                  <h4 className="text-amber-900 font-black uppercase text-xl italic tracking-tighter">Destructive Database Action</h4>
                  <p className="text-sm text-amber-800 leading-relaxed font-bold opacity-80 max-w-3xl">
                     You are about to permanently collapse <span className="text-amber-950 font-black px-1 uppercase underline">{sourceItems.length} subordinate records</span> into a primary Host Anchor. 
                     The subordinate records will be tagged as zero-stock and decommissioned, while their cumulative quantity ({totalVolume - targetItem.quantity}) will be absorbed by the Host. Serial traceability of subordinate groups may be overwritten.
                  </p>
               </div>
            </div>
         </div>

         {/* Target Analysis Panel */}
         <div className="xl:col-span-4 space-y-6">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Host Anchor (Surviving Record)</h2>
            
            <div className="bg-slate-950 rounded-[40px] p-10 ring-8 ring-amber-100/50 shadow-2xl relative overflow-hidden text-white h-full group transition-all duration-500 hover:ring-amber-200">
               <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
               <div className="absolute top-8 right-8 w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Layers className="text-amber-400" size={24} />
               </div>

               <div className="relative z-10 space-y-10">
                  <div>
                    <h3 className="text-3xl font-black text-white tracking-tight italic uppercase">{targetItem.product?.name}</h3>
                    <div className="font-mono text-[11px] font-bold text-amber-400 tracking-widest mt-2 bg-amber-900/50 w-fit px-3 py-1 rounded-md border border-amber-700/50">
                      SKU: {targetItem.product?.sku}
                    </div>
                  </div>

                  <div className="space-y-6 bg-white/5 border border-white/10 p-6 rounded-[30px] backdrop-blur-md">
                     <div className="space-y-1">
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Projected Consolidated Volume</div>
                        <div className="text-6xl font-black italic tracking-tighter text-amber-400 drop-shadow-2xl">{totalVolume}</div>
                        <div className="text-xs font-bold text-slate-400 pt-1">Surging from Base <span className="text-white">+ {targetItem.quantity}</span></div>
                     </div>
                  </div>

                  <div className="space-y-4">
                     <div className="flex items-center gap-3">
                        <Zap size={14} className="text-slate-400 shrink-0" />
                        <div className="flex-1">
                           <div className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Retained Serial Pool</div>
                           <div className="text-sm font-mono font-bold text-white break-all">{targetItem.serial_number || 'NULL_MAP'}</div>
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <Cpu size={14} className="text-slate-400 shrink-0" />
                        <div className="flex-1">
                           <div className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Retained Condition Lock</div>
                           <div className="text-sm font-mono font-bold text-white break-all uppercase">{targetItem.condition || 'STANDARD'}</div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Subordinate Selection Panel */}
         <div className="xl:col-span-8 space-y-6">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Subordinate Casualties (Absorbed & Erased)</h2>
            
            <div className="space-y-4">
               {sourceItems.map((source, index) => (
                  <div key={source.id} className="bg-white p-8 rounded-[30px] border border-slate-100 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden group hover:border-red-100 hover:shadow-red-50/50 transition-all duration-300">
                     <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-red-50 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                     
                     <div className="flex items-center gap-8 relative z-10">
                        <div className="flex flex-col items-center gap-2">
                           <div className="w-14 h-14 bg-slate-50 rounded-[20px] flex items-center justify-center border-2 border-slate-100 group-hover:border-red-200 group-hover:bg-red-50 transition-all">
                              <ArchiveX className="text-slate-400 group-hover:text-red-500 transition-colors" size={24} />
                           </div>
                           <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ID #{source.id}</div>
                        </div>

                        <div>
                           <div className="flex items-center gap-3 mb-2">
                              <span className="text-xl font-black text-slate-900 italic">Qty: {source.quantity}</span>
                              <span className="px-2 py-0.5 bg-slate-100 text-[9px] font-black text-slate-500 uppercase tracking-widest rounded-md">Extracted</span>
                           </div>
                           <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                               <div className="flex items-center gap-2"><span>Serial:</span> <span className="text-slate-900 font-mono tracking-tight">{source.serial_number || 'N/A'}</span></div>
                               <div className="flex items-center gap-2"><span>Batch:</span> <span className="text-slate-900 font-mono tracking-tight">{source.batch_number || 'N/A'}</span></div>
                               <div className="flex items-center gap-2"><span>Condition:</span> <span className="text-slate-900">{source.condition || 'N/A'}</span></div>
                               <div className="flex items-center gap-2"><span>Node Loc:</span> <span className="text-slate-900">{source.organizationNode?.name || 'N/A'}</span></div>
                           </div>
                        </div>
                     </div>

                     <div className="md:border-l border-slate-100 md:pl-8 flex flex-col justify-center relative z-10">
                        <div className="text-[9px] font-black uppercase text-red-500/80 tracking-widest text-center italic leading-relaxed">
                           Yielding to Anchor<br/>(Destructive)
                        </div>
                     </div>
                  </div>
               ))}
            </div>

            <div className="pt-8">
               <Button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full h-24 bg-amber-500 hover:bg-amber-600 text-white font-black text-xl uppercase tracking-widest rounded-[35px] shadow-2xl flex items-center justify-center gap-6 group transition-all disabled:bg-slate-300 disabled:shadow-none"
               >
                  {submitting ? 'Executing Database Merge...' : (
                    <>Authorize Consolidation Sequence</>
                  )}
               </Button>
            </div>
         </div>
      </form>
    </div>
  );
};

export default MergePage;
