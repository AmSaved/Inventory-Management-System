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
  ArrowRightLeft, 
  User as UserIcon, 
  Package, 
  MessageSquare, 
  ShieldAlert, 
  ArrowRight,
  ChevronLeft,
  Building2
} from 'lucide-react';

const TransferAssetPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [assignmentId, setAssignmentId] = useState(searchParams.get('assignment_id') || '');
  const [toUserId, setToUserId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const { data: assignments } = useFetch('/assignments/my-assignments');
  const { data: usersData } = useFetch('/users');
  const users = Array.isArray(usersData?.data) ? usersData.data : (Array.isArray(usersData) ? usersData : []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assignmentId || !toUserId) {
      return toast.error('Selection incomplete: Verify asset and recipient');
    }

    setSubmitting(true);
    try {
      const selectedAssignment = assignments?.data?.find(a => a.id === parseInt(assignmentId));
      await api.post('/requests', {
        request_type: 'transfer',
        requester_id: selectedAssignment.user_id,
        org_node_id: selectedAssignment.org_node_id,
        purpose: `Hierarchical Transfer: ${selectedAssignment?.product?.name} to user ID ${toUserId}. Justification: ${reason}`,
        priority: 'medium',
        items: [{
          product_id: selectedAssignment.product_id,
          quantity_requested: 1,
          notes: `Transfer from ${user?.first_name} ${user?.last_name} to target user ID: ${toUserId}`
        }],
        notes: JSON.stringify({ transfer_to_user_id: toUserId, assignment_id: assignmentId })
      });
      toast.success('Asset Transfer Protocol Initiated');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Protocol Failure: Transfer request rejected');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedA = assignments?.data?.find(a => a.id === parseInt(assignmentId));

  return (
    <div className="max-w-[1200px] mx-auto space-y-12 py-10 px-6">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-b-2 border-slate-50 pb-10">
        <div className="space-y-3">
           <button 
             onClick={() => navigate(-1)} 
             className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors group"
           >
             <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Operational Return
           </button>
           <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-slate-900 rounded-[28px] flex items-center justify-center shadow-2xl rotate-3">
                 <ArrowRightLeft className="text-blue-500" size={32} />
              </div>
              <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Asset Handover</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">Personnel-to-Personnel Transition</p>
              </div>
           </div>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-12">
        {/* Source Configuration */}
        <div className="xl:col-span-12 space-y-10">
           <Card className="rounded-[40px] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-slate-100">
              <div className="grid grid-cols-1 lg:grid-cols-3">
                  {/* Panel 1: The Asset */}
                  <div className="p-10 border-r border-slate-100 space-y-8 bg-slate-50/50">
                     <div className="flex items-center gap-3">
                        <Package className="text-blue-600" size={20} />
                        <h3 className="font-black text-slate-900 text-[10px] uppercase tracking-widest">Active Resource</h3>
                     </div>
                     
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Model</label>
                        <select 
                          className="w-full h-14 bg-white border-2 border-slate-100 rounded-2xl px-6 font-black text-slate-900 outline-none focus:border-blue-500 transition-all cursor-pointer"
                          value={assignmentId}
                          onChange={(e) => setAssignmentId(e.target.value)}
                          required
                        >
                          <option value="">Choose your asset...</option>
                          {assignments?.data?.map(a => (
                            <option key={a.id} value={a.id}>{a.product?.name} — {a.serial_number}</option>
                          ))}
                        </select>
                        {selectedA && (
                          <div className="p-4 bg-white border border-slate-100 rounded-2xl animate-in fade-in slide-in-from-top-2">
                             <div className="text-[9px] font-black text-blue-500 uppercase tracking-widest leading-none mb-1">Instance Details</div>
                             <div className="text-sm font-black text-slate-900 italic tracking-tight">{selectedA.product?.sku}</div>
                             <div className="flex flex-wrap gap-2 text-[9px] font-black tracking-widest uppercase text-slate-500 mt-2 border-t border-slate-50 pt-2">
                               {selectedA.product?.brand && <span>Brand: <span className="text-blue-600">{selectedA.product.brand}</span></span>}
                               {selectedA.product?.processor && <span>CPU: <span className="text-blue-600">{selectedA.product.processor}</span></span>}
                               {selectedA.product?.ram && <span>RAM: <span className="text-blue-600">{selectedA.product.ram}</span></span>}
                               {selectedA.product?.storage && <span>STR: <span className="text-blue-600">{selectedA.product.storage}</span></span>}
                               {selectedA.product?.color && <span>CLR: <span className="text-blue-600">{selectedA.product.color}</span></span>}
                               <span>Cond: <span className="text-blue-600">{selectedA.condition || 'New'}</span></span>
                             </div>
                          </div>
                        )}
                     </div>
                  </div>

                  {/* Panel 2: The Recipient */}
                  <div className="p-10 border-r border-slate-100 space-y-8">
                     <div className="flex items-center gap-3">
                        <UserIcon className="text-blue-600" size={20} />
                        <h3 className="font-black text-slate-900 text-[10px] uppercase tracking-widest">Target Personnel</h3>
                     </div>

                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Custodian</label>
                        <select 
                          className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 font-black text-slate-900 outline-none focus:bg-white focus:border-blue-500 transition-all cursor-pointer"
                          value={toUserId}
                          onChange={(e) => setToUserId(e.target.value)}
                          required
                        >
                          <option value="">Choose recipient...</option>
                          {users?.map(u => (
                             <option key={u.id} value={u.id}>{u.first_name} {u.last_name} — {u.employee_id}</option>
                          ))}
                        </select>
                     </div>
                  </div>

                  {/* Panel 3: The Justification */}
                  <div className="p-10 space-y-8 bg-slate-50/50">
                     <div className="flex items-center gap-3">
                        <MessageSquare className="text-blue-600" size={20} />
                        <h3 className="font-black text-slate-900 text-[10px] uppercase tracking-widest">Handover Log</h3>
                     </div>

                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Transfer Logic</label>
                        <textarea 
                          className="w-full h-32 bg-white border-2 border-slate-100 rounded-[25px] p-6 font-medium text-slate-600 outline-none focus:border-blue-500 transition-all resize-none shadow-inner"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Provide the operational justification for this transition..."
                          required
                        />
                     </div>
                  </div>
              </div>
           </Card>
        </div>

        <div className="xl:col-span-8">
           <div className="bg-blue-50 p-8 rounded-[40px] border-4 border-blue-100 flex items-start gap-6 shadow-xl shadow-blue-50/50">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0">
                 <ShieldAlert className="text-blue-600" size={28} />
              </div>
              <div className="space-y-2">
                 <h4 className="text-blue-900 font-black uppercase text-xs tracking-widest">Protocol Verification</h4>
                 <p className="text-sm text-blue-800 leading-relaxed font-medium italic opacity-80">
                    Handover requests are subject to approval by the **Company Chairman** and **Storage Management** to ensure hierarchical compliance and database integrity.
                 </p>
              </div>
           </div>
        </div>

        <div className="xl:col-span-4 flex items-end">
           <Button 
             type="submit" 
             loading={submitting}
             className="w-full bg-slate-950 h-24 rounded-[40px] shadow-2xl hover:bg-blue-600 text-white font-black text-2xl tracking-tighter uppercase transition-all flex items-center justify-center gap-6 group overflow-hidden"
           >
             {submitting ? (
               <span className="animate-pulse">Sequencing Protocol...</span>
             ) : (
               <>Execute Handover <ArrowRight className="group-hover:translate-x-3 transition-transform" /> </>
             )}
           </Button>
        </div>
      </form>
    </div>
  );
};

export default TransferAssetPage;
