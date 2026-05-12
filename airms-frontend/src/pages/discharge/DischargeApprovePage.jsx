import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import toast from 'react-hot-toast';
import Card, { CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Truck, 
  ArrowRight, 
  Building2, 
  User as UserIcon,
  PackageCheck,
  Search,
  Filter,
  MoreVertical,
  ChevronRight,
  ClipboardList,
  Clock
} from 'lucide-react';

const DischargeApprovePage = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' (mine) or 'all'
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // We fetch from our new dynamic endpoint
  const { data: dischargeData, loading, refetch } = useFetch(
    `/discharge/approvals?all=${activeTab === 'all'}`
  );

  const discharges = Array.isArray(dischargeData) ? dischargeData : (dischargeData?.data || []);

  const filteredDischarges = discharges.filter(d => 
    d.discharge_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.fromNode?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAction = async (id, action) => {
    try {
      const endpoint = action === 'approve' ? `/discharge/${id}/approve` : `/discharge/${id}/reject`;
      const res = await api.post(endpoint, {
          notes: `Action taken via Inbox by ${user.first_name}`
      });
      toast.success(res.data.message || 'Operation successful');
      refetch();
    } catch (err) {
      const msg = err.response?.data?.message || `Failed to ${action} discharge`;
      toast.error(msg);
    }
  };

  const handleExecute = async (id) => {
    try {
      const res = await api.post(`/discharge/${id}/execute`);
      toast.success(res.data.message || 'Assets issued successfully');
      refetch();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to issue assets';
      toast.error(msg);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-10 px-4 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 bg-blue-600 rounded-[28px] flex items-center justify-center shadow-2xl shadow-blue-500/20 rotate-3">
              <PackageCheck className="text-white" size={32} />
           </div>
           <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Workflow Inbox</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">Inventory Discharge Protocols</p>
           </div>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-[22px] w-full md:w-auto">
           <button 
             onClick={() => setActiveTab('inbox')}
             className={`flex-1 md:flex-none px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'inbox' ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}
           >
             Pending Actions
           </button>
           <button 
             onClick={() => setActiveTab('all')}
             className={`flex-1 md:flex-none px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'all' ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}
           >
             All Monitorable
           </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-xl flex flex-col md:flex-row items-center gap-4">
          <div className="relative w-full max-w-md">
             <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
             <input 
               type="text"
               placeholder="Search by ID or Name..." 
               className="w-full pl-16 h-14 bg-slate-50 border-none rounded-2xl font-bold text-xs uppercase tracking-widest text-slate-900 focus:ring-2 focus:ring-blue-100 outline-none"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               onKeyDown={(e) => {
                 if (e.key === 'Enter') {
                   setSearchQuery(searchTerm);
                 }
               }}
             />
             <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-2 ml-2">Press Enter to Filter Ledger</p>
          </div>
          <Button onClick={() => refetch()} className="h-14 px-8 rounded-2xl bg-slate-950 text-white font-black uppercase text-[10px] tracking-widest hover:bg-black w-full md:w-auto">
             Refresh Ledger
          </Button>
      </div>

      {/* Table Interface */}
      <Card className="rounded-[45px] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-slate-100">
         <div className="overflow-x-auto">
            <table className="w-full border-collapse">
               <thead>
                  <tr className="bg-slate-950 text-white border-b border-slate-800">
                     <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest">Discharge ID</th>
                     <th className="px-6 py-6 text-left text-[10px] font-black uppercase tracking-widest">Source Node</th>
                     <th className="px-6 py-6 text-left text-[10px] font-black uppercase tracking-widest">Target Destination</th>
                     <th className="px-6 py-6 text-left text-[10px] font-black uppercase tracking-widest">Items Payload</th>
                     <th className="px-6 py-6 text-left text-[10px] font-black uppercase tracking-widest">Workflow Status</th>
                     <th className="px-6 py-6 text-center text-[10px] font-black uppercase tracking-widest">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {filteredDischarges.map((discharge) => (
                    <tr key={discharge.id} className="hover:bg-blue-50/30 transition-colors group">
                       <td className="px-8 py-8">
                          <div className="flex flex-col">
                             <span className="text-lg font-black text-slate-900 tracking-tighter leading-none">{discharge.discharge_number}</span>
                             <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">ID: {discharge.id} • {new Date(discharge.created_at).toLocaleDateString()}</span>
                          </div>
                       </td>
                       <td className="px-6 py-8">
                          <div className="flex flex-col">
                             <span className="text-xs font-black text-slate-900 uppercase truncate max-w-[150px]">{discharge.fromNode?.name}</span>
                             <span className="text-[8px] font-bold text-slate-400 uppercase mt-1">Originating Unit</span>
                          </div>
                       </td>
                       <td className="px-6 py-8">
                          <div className="flex flex-col">
                             <span className="text-xs font-black text-blue-600 uppercase truncate max-w-[150px]">
                                {discharge.toNode?.name || 
                                 (discharge.toUser ? `${discharge.toUser.first_name} ${discharge.toUser.last_name}` : 'Internal / Multiple')}
                             </span>
                             <span className="text-[8px] font-bold text-slate-400 uppercase mt-1">Receiving Target</span>
                          </div>
                       </td>
                       <td className="px-6 py-8">
                          <div className="flex -space-x-3 overflow-hidden">
                             {discharge.items?.slice(0, 3).map((it, i) => (
                               <div key={i} className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-black text-slate-900 shadow-sm" title={it.product?.name}>
                                  {it.product?.name?.[0]}
                               </div>
                             ))}
                             {discharge.items?.length > 3 && (
                               <div className="w-8 h-8 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-[8px] font-black text-white shadow-sm">
                                  +{discharge.items.length - 3}
                               </div>
                             )}
                          </div>
                          <p className="text-[9px] font-bold text-slate-500 mt-2 uppercase tracking-tighter">{discharge.items?.length} Lines Registered</p>
                       </td>
                       <td className="px-6 py-8">
                          <div className="flex flex-col gap-2">
                             <Badge className={`w-fit rounded-full px-4 py-1 font-black text-[9px] uppercase tracking-widest ${
                               discharge.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                               discharge.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                               'bg-amber-100 text-amber-700'
                             }`}>
                                {discharge.workflow_status || discharge.status}
                             </Badge>
                             <div className="flex items-center gap-1.5 ml-1">
                                <Clock size={10} className="text-slate-300" />
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Step Order: {discharge.currentStep?.step_order || 0}</span>
                             </div>
                          </div>
                       </td>
                       <td className="px-6 py-8">
                          <div className="flex items-center justify-center gap-3">
                             <button 
                               onClick={() => navigate(`/discharge/view/${discharge.id}`)}
                               className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-white transition-all shadow-sm border border-slate-50"
                             >
                                <Eye size={18} />
                             </button>
                             
                             {/* Dynamic Action Buttons - Only show if backend says can_action is true */}
                             {discharge.can_action ? (
                               <>
                                 <button 
                                   onClick={() => handleAction(discharge.id, 'approve')}
                                   className="flex items-center gap-2 px-5 h-11 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20"
                                 >
                                    <CheckCircle2 size={14} /> Approve
                                 </button>
                                 <button 
                                   onClick={() => handleAction(discharge.id, 'reject')}
                                   className="flex items-center gap-2 px-5 h-11 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-rose-500/20"
                                 >
                                    <XCircle size={14} /> Reject
                                 </button>
                               </>
                             ) : (
                               <div className="px-4 py-2 bg-slate-50 rounded-xl text-[9px] font-black text-slate-400 uppercase tracking-widest italic opacity-50 border border-slate-100">
                                  Awaiting Turn
                               </div>
                             )}
                          </div>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>

         {loading && (
           <div className="p-20 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accessing Ledger...</p>
           </div>
         )}

         {!loading && filteredDischarges.length === 0 && (
           <div className="p-32 flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center text-slate-200">
                 <ClipboardList size={48} />
              </div>
              <div>
                 <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">No Pending Protocols</h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">Your inbox is currently clear of pending discharge approvals.</p>
              </div>
           </div>
         )}
      </Card>
    </div>
  );
};

export default DischargeApprovePage;
