import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card, { CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useFetch } from '../hooks/useFetch';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { 
  RotateCcw, 
  Package, 
  MessageSquare, 
  ShieldCheck, 
  ArrowRight,
  ChevronLeft,
  Building2,
  Undo2
} from 'lucide-react';

const ReturnAssetPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [assignmentId, setAssignmentId] = useState(searchParams.get('assignment_id') || '');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const { data: assignments } = useFetch('/assignments/my-assignments');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assignmentId) {
      return toast.error('Selection incomplete: Verify asset for return');
    }

    setSubmitting(true);
    try {
      const selectedAssignment = assignments?.data?.find(a => a.id === parseInt(assignmentId));
      await api.post('/requests', {
        request_type: 'return',
        purpose: `Hierarchical Return: ${selectedAssignment?.product?.name} (SN: ${selectedAssignment?.serial_number}). Justification: ${reason}`,
        priority: 'medium',
        items: [{
          product_id: selectedAssignment.product_id,
          quantity_requested: 1
        }],
        notes: JSON.stringify({ assignment_id: assignmentId })
      });
      toast.success('Asset Return Protocol Initiated');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Protocol Failure: Return request rejected');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedA = assignments?.data?.find(a => a.id === parseInt(assignmentId));

  return (
    <div className="max-w-[1000px] mx-auto space-y-12 py-10 px-6">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-b-2 border-slate-50 pb-10">
        <div className="space-y-3">
           <button 
             onClick={() => navigate(-1)} 
             className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-emerald-600 transition-colors group"
           >
             <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Operational Return
           </button>
           <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-slate-900 rounded-[28px] flex items-center justify-center shadow-2xl rotate-6">
                 <RotateCcw className="text-emerald-400" size={32} />
              </div>
              <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Asset De-Allocation</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">Infrastructure Re-Entry Protocol</p>
              </div>
           </div>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        {/* Resource Identification */}
        <div className="xl:col-span-7 space-y-8">
           <Card className="rounded-[40px] border-none shadow-2xl bg-white p-10 ring-1 ring-slate-100 space-y-8">
              <div className="flex items-center gap-3">
                 <Package className="text-emerald-600" size={20} />
                 <h3 className="font-black text-slate-900 text-[10px] uppercase tracking-widest">Resource Identification</h3>
              </div>
              
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Active Asset Selection</label>
                    <select 
                      className="w-full h-15 bg-slate-50 border-2 border-slate-100 rounded-[25px] px-6 font-black text-slate-900 outline-none focus:bg-white focus:border-emerald-500 transition-all cursor-pointer"
                      value={assignmentId}
                      onChange={(e) => setAssignmentId(e.target.value)}
                      required
                    >
                      <option value="">Choose item to return...</option>
                      {assignments?.data?.map(a => (
                        <option key={a.id} value={a.id}>{a.product?.name} ({a.serial_number})</option>
                      ))}
                    </select>
                 </div>

                 {selectedA && (
                   <div className="p-6 bg-slate-900 rounded-[30px] border border-slate-800 flex items-center justify-between group overflow-hidden relative">
                      <div className="absolute top-0 right-0 p-2">
                         <Undo2 className="text-emerald-500/10 -rotate-12 group-hover:rotate-0 transition-transform" size={80} />
                      </div>
                      <div className="relative z-10">
                         <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Catalog SKU</div>
                         <div className="text-xl font-black text-white italic tracking-tight uppercase leading-none">{selectedA.product?.sku}</div>
                         <div className="flex items-center gap-1.5 mt-2">
                            <Building2 size={10} className="text-slate-500" />
                            <span className="text-[9px] font-bold text-slate-500 uppercase">Assigned Unit: {user?.org_unit_id}</span>
                         </div>
                      </div>
                   </div>
                 )}

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">De-Allocation Reasoning</label>
                    <textarea 
                      className="w-full h-40 bg-white border-2 border-slate-100 rounded-[30px] p-6 font-medium text-slate-600 outline-none focus:border-emerald-500 transition-all resize-none"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Detail the operational state and reason for return..."
                      required
                    />
                 </div>
              </div>
           </Card>
        </div>

        {/* Action Panel */}
        <div className="xl:col-span-5 space-y-8">
           <div className="bg-emerald-50 p-8 rounded-[40px] border-4 border-emerald-100 flex items-start gap-6 shadow-xl shadow-emerald-50/50">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0">
                 <ShieldCheck className="text-emerald-600" size={28} />
              </div>
              <div className="space-y-2">
                 <h4 className="text-emerald-900 font-black uppercase text-xs tracking-widest">Protocol Check</h4>
                 <p className="text-sm text-emerald-800 leading-relaxed font-medium italic opacity-80">
                    Infrastructure re-entry requires physical verification. Once approved, return the hardware to your **Regional Hub** or **Supply Manager**.
                 </p>
              </div>
           </div>

           <Button 
             type="submit" 
             loading={submitting}
             className="w-full bg-slate-950 h-24 rounded-[40px] shadow-2xl shadow-emerald-100 hover:bg-emerald-600 text-white font-black text-2xl tracking-tighter uppercase transition-all duration-500 flex items-center justify-center gap-6 group"
           >
             {submitting ? (
               <span className="animate-pulse italic">Sequencing Re-Entry...</span>
             ) : (
               <>Initiate Return <ArrowRight className="group-hover:translate-x-3 transition-transform" size={28} /> </>
             )}
           </Button>

           <div className="p-8 bg-slate-50 rounded-[40px] border border-slate-100 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-relaxed">
                 Entity Authorization: {user?.company?.name || 'Authorized Entity'}
                 <br />
                 Hierarchical Multi-Tenancy Scoped
              </p>
           </div>
        </div>
      </form>
    </div>
  );
};

export default ReturnAssetPage;
