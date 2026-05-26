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
    <div className="max-w-7xl mx-auto space-y-5 py-6 px-4 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-md">
              <PackageCheck className="text-white" size={20} />
           </div>
           <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Workflow Inbox</h1>
              <p className="text-xs text-slate-500 font-normal">Inventory Discharge Protocols</p>
           </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-lg w-full md:w-auto">
           <button 
             onClick={() => setActiveTab('inbox')}
             className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'inbox' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
           >
             Pending Actions
           </button>
           <button 
             onClick={() => setActiveTab('all')}
             className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
           >
             All Monitorable
           </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-3">
          <div className="relative w-full max-w-md">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
             <input 
               type="text"
               placeholder="Search by ID or Name..." 
               className="w-full pl-9 h-10 bg-slate-50 border border-slate-200 rounded-lg text-sm font-normal text-slate-900 focus:ring-2 focus:ring-blue-100 outline-none"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               onKeyDown={(e) => {
                 if (e.key === 'Enter') {
                   setSearchQuery(searchTerm);
                 }
               }}
             />
          </div>
          <Button onClick={() => refetch()} className="h-10 px-4 rounded-lg bg-slate-900 text-white font-semibold text-xs hover:bg-black w-full md:w-auto">
             Refresh Ledger
          </Button>
      </div>

      {/* Table Interface */}
      <Card className="rounded-xl border border-slate-200 shadow-sm bg-white overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full border-collapse">
               <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                     <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Discharge ID</th>
                     <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Source Node</th>
                     <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Target Destination</th>
                     <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Items Payload</th>
                     <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Workflow Status</th>
                     <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Actions</th>
                   </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {filteredDischarges.map((discharge) => (
                    <tr key={discharge.id} className="hover:bg-blue-50/10 transition-colors group">
                       <td className="px-4 py-3">
                          <div className="flex flex-col">
                             <span className="text-sm font-semibold text-slate-900 tracking-tight">{discharge.discharge_number}</span>
                             <span className="text-xs text-slate-500 font-normal">ID: {discharge.id} • {new Date(discharge.created_at).toLocaleDateString()}</span>
                          </div>
                       </td>
                       <td className="px-4 py-3">
                          <div className="flex flex-col">
                             <span className="text-sm font-semibold text-slate-800 truncate max-w-[150px]">{discharge.fromNode?.name}</span>
                             <span className="text-xs text-slate-400 font-normal">Originating Unit</span>
                          </div>
                       </td>
                       <td className="px-4 py-3">
                          <div className="flex flex-col">
                             <span className="text-sm font-semibold text-blue-600 truncate max-w-[150px]">
                                {discharge.toNode?.name || 
                                 (discharge.toUser ? `${discharge.toUser.first_name} ${discharge.toUser.last_name}` : 'Internal / Multiple')}
                             </span>
                             <span className="text-xs text-slate-400 font-normal">Receiving Target</span>
                          </div>
                       </td>
                       <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                             <div className="flex -space-x-2 overflow-hidden">
                                {discharge.items?.slice(0, 3).map((it, i) => (
                                  <div key={i} className="w-6 h-6 rounded-full bg-slate-100 border border-white flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm" title={it.product?.name}>
                                     {it.product?.name?.[0]}
                                  </div>
                                ))}
                                {discharge.items?.length > 3 && (
                                  <div className="w-6 h-6 rounded-full bg-blue-600 border border-white flex items-center justify-center text-xs font-semibold text-white shadow-sm">
                                     +{discharge.items.length - 3}
                                  </div>
                                )}
                             </div>
                             <span className="text-xs text-slate-500 font-normal">({discharge.items?.length || 0} Lines)</span>
                          </div>
                       </td>
                       <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                             <Badge className="w-fit bg-white text-slate-800 border border-slate-200 rounded px-2 py-0.5 text-xs font-normal capitalize">
                                {((discharge.workflow_status ? discharge.workflow_status.replace(/\s*\(.*?\)\s*/g, '').trim() : '') || discharge.status || '').toLowerCase()}
                             </Badge>
                             <div className="flex items-center gap-1 ml-0.5">
                                <Clock size={12} className="text-slate-400" />
                                <span className="text-xs text-slate-400 font-normal">Step: {discharge.currentStep?.step_order || 0}</span>
                             </div>
                          </div>
                       </td>
                       <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                             <button 
                               onClick={() => navigate(`/discharge/view/${discharge.id}`)}
                               className="p-1.5 bg-slate-50 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-all border border-slate-200"
                             >
                                <Eye size={16} />
                             </button>
                             
                             {/* Dynamic Action Buttons - Only show if backend says can_action is true */}
                             {discharge.can_action ? (
                               <>
                                 <button 
                                   onClick={() => handleAction(discharge.id, 'approve')}
                                   className="flex items-center gap-1.5 px-3 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs transition-all shadow-sm"
                                 >
                                    <CheckCircle2 size={13} /> Approve
                                 </button>
                                 <button 
                                   onClick={() => handleAction(discharge.id, 'reject')}
                                   className="flex items-center gap-1.5 px-3 h-8 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-xs transition-all shadow-sm"
                                 >
                                    <XCircle size={13} /> Reject
                                 </button>
                               </>
                             ) : (
                               <div className="px-2 py-1 bg-slate-50 rounded border border-slate-200 text-xs font-normal text-slate-400 italic">
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
           <div className="p-12 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium text-slate-500">Accessing Ledger...</p>
           </div>
         )}

         {!loading && filteredDischarges.length === 0 && (
           <div className="p-16 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
                 <ClipboardList size={36} />
              </div>
              <div>
                 <h3 className="text-lg font-bold text-slate-900">No Pending Protocols</h3>
                 <p className="text-xs text-slate-500 mt-1">Your inbox is currently clear of pending discharge approvals.</p>
              </div>
           </div>
         )}
      </Card>
    </div>
  );
};

export default DischargeApprovePage;
