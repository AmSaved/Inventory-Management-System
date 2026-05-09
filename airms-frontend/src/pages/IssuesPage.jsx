import React, { useState } from 'react';
import Card, { CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Table, { TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import { useFetch } from '../hooks/useFetch';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  User as UserIcon, 
  Box, 
  Search,
  Filter,
  Plus,
  AlertOctagon,
  LifeBuoy,
  Zap,
  MoreVertical,
  ChevronRight
} from 'lucide-react';

const IssuesPage = () => {
  const { user, hasPermission } = useAuth();
  const { data: issuesData, loading, refetch } = useFetch('/issues');
  const { data: myAssets } = useFetch('/assets');
  
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    severity: 'medium',
    issue_type: 'technical',
    assignment_id: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleReportIssue = async () => {
    if (!formData.title || !formData.description) {
      toast.error('Please fill in title and description');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/issues', formData);
      toast.success('Issue logged in system ledger');
      setShowModal(false);
      setFormData({ title: '', description: '', severity: 'medium', issue_type: 'technical', assignment_id: '' });
      refetch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Reporting failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id, action) => {
    try {
      // Dynamic approval if action is approve, otherwise standard resolve
      const endpoint = action === 'approve' ? `/issues/${id}/approve` : `/issues/${id}/${action}`;
      await api.post(endpoint, { resolution_notes: 'Advanced resolution processed via Command Center' });
      toast.success(`Issue ${action} action executed`);
      refetch();
    } catch (error) {
      toast.error(`Action failed: ${error.response?.data?.message}`);
    }
  };

  const getStatusBadge = (status) => {
    if (status.startsWith('pending_')) {
      return (
        <Badge variant="warning" className="bg-amber-50 text-amber-700 border-amber-200 uppercase text-[9px] font-black tracking-widest gap-1">
           <Clock size={10} /> {status.replace('pending_', '').replace('_', ' ')} phase
        </Badge>
      );
    }
    switch (status) {
      case 'open': return <Badge variant="danger" className="uppercase text-[9px] font-black tracking-widest">Initial Report</Badge>;
      case 'in_progress': return <Badge variant="warning" className="uppercase text-[9px] font-black tracking-widest">Active Resolution</Badge>;
      case 'resolved': return <Badge variant="success" className="uppercase text-[9px] font-black tracking-widest">Resolved</Badge>;
      case 'closed': return <Badge variant="secondary" className="uppercase text-[9px] font-black tracking-widest">Archived</Badge>;
      default: return <Badge className="uppercase text-[9px] font-black tracking-widest">{status}</Badge>;
    }
  };

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'critical': return <Badge variant="danger" className="rounded-full h-2 w-2 p-0 min-w-0" title="Critical" />;
      case 'high': return <Badge variant="warning" className="rounded-full h-2 w-2 p-0 min-w-0 bg-orange-500" title="High" />;
      case 'medium': return <Badge variant="info" className="rounded-full h-2 w-2 p-0 min-w-0" title="Medium" />;
      default: return <Badge variant="secondary" className="rounded-full h-2 w-2 p-0 min-w-0" title="Low" />;
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 py-10 px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-red-100">
                <AlertOctagon className="text-white" size={24} />
             </div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Resolution Center</h1>
          </div>
          <p className="text-slate-400 font-bold text-[10px] tracking-[0.2em] uppercase ml-1">Asset Integrity & Compliance Log</p>
        </div>
        
        <div className="flex gap-3">
           <Button 
            variant="outline"
            className="border-2 border-slate-200 rounded-2xl px-6 h-14 font-black text-slate-600 hover:bg-slate-50 uppercase text-[10px] tracking-widest"
           >
             <LifeBuoy size={16} className="mr-2 text-blue-500" /> Support Desk
           </Button>
           <Button 
             onClick={() => setShowModal(true)}
             className="bg-slate-900 border-b-4 border-slate-700 hover:bg-slate-800 text-white font-black px-8 h-14 rounded-2xl transition-all shadow-xl flex items-center gap-2 uppercase text-[10px] tracking-widest"
           >
             <Plus size={18} /> Log Incident
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {issuesData?.data?.map((issue) => (
          <Card key={issue.id} className="rounded-[35px] border-none bg-white shadow-xl shadow-slate-100 overflow-hidden hover:shadow-2xl transition-all group border-l-[12px] border-slate-50 hover:border-blue-500">
            <CardContent className="p-8">
               <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                  <div className="flex items-start gap-6 flex-1">
                     <div className="w-16 h-16 bg-slate-50 rounded-2xl flex flex-col items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Issue</span>
                        <div className="text-lg font-black tracking-tighter italic">#{issue.issue_number.split('-')[1]}</div>
                     </div>
                     <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3">
                           {getSeverityBadge(issue.severity)}
                           <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none">{issue.title}</h3>
                           {getStatusBadge(issue.status)}
                        </div>
                        <p className="text-slate-500 text-sm font-medium line-clamp-1 max-w-2xl">{issue.description}</p>
                        <div className="flex items-center gap-4 pt-1">
                           <div className="flex items-center gap-1.5 grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                              <Box size={14} className="text-blue-600" />
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">{issue.product?.name || 'General System'}</span>
                           </div>
                           <div className="flex items-center gap-1.5 opacity-60">
                              <UserIcon size={14} className="text-slate-400" />
                              <span className="text-[10px] font-bold text-slate-500 uppercase">{issue.reporter?.first_name} {issue.reporter?.last_name}</span>
                           </div>
                           <div className="flex items-center gap-1.5 opacity-40">
                              <Clock size={12} />
                              <span className="text-[9px] font-bold">{new Date(issue.created_at).toLocaleDateString()}</span>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="flex items-center gap-3 self-end lg:self-center">
                     {/* Workflow Logic Integration */}
                     {(issue.status === 'open' || issue.status.startsWith('pending_')) && (
                        <Button 
                          onClick={() => handleAction(issue.id, 'approve')}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 h-12 rounded-xl text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-100"
                        >
                           <Zap size={14} /> Process Step
                        </Button>
                     )}
                     
                     <Button 
                       variant="ghost" 
                       className="w-12 h-12 rounded-xl bg-slate-50 text-slate-400 hover:text-blue-600 transition-all border border-transparent hover:border-slate-100"
                     >
                        <MoreVertical size={18} />
                     </Button>
                  </div>
               </div>
            </CardContent>
          </Card>
        ))}

        {issuesData?.data?.length === 0 && (
          <div className="py-40 text-center space-y-4">
             <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={48} className="text-emerald-400" />
             </div>
             <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">System Status: Integrity Nominal</h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">No outstanding incident reports in current scope.</p>
             </div>
          </div>
        )}
      </div>

      {/* Enhanced Incident Log Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Incident Documentation"
        onConfirm={handleReportIssue}
        confirmText="Push to System Log"
        size="lg"
      >
        <div className="space-y-8 p-2">
           <div className="flex items-start gap-6 p-6 bg-red-50/50 border border-red-100 rounded-[30px]">
              <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center flex-shrink-0">
                 <AlertCircle className="text-red-500" size={28} />
              </div>
              <div>
                 <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-1">New System Incident</h4>
                 <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase opacity-60">Please provide precise technical details for the resolution desk. All reports are audit-trailed.</p>
              </div>
           </div>

           <div className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 text-right">Primary Subject</label>
                 <Input 
                   placeholder="Brief summary of the anomaly..." 
                   value={formData.title} 
                   onChange={(e) => setFormData({ ...formData, title: e.target.value })} 
                   className="h-14 rounded-2xl border-2 border-slate-50 font-black text-slate-900"
                 />
              </div>

              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Contextual Asset (If any)</label>
                    <select 
                      className="w-full h-14 bg-slate-50/50 border-2 border-slate-50 rounded-2xl px-4 font-bold outline-none"
                      value={formData.assignment_id}
                      onChange={(e) => setFormData({ ...formData, assignment_id: e.target.value })}
                    >
                       <option value="">General System Issue</option>
                       {myAssets?.data?.map(a => (
                         <option key={a.id} value={a.id}>{a.product?.name} ({a.product?.sku})</option>
                       ))}
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Criticality level</label>
                    <select 
                      className="w-full h-14 bg-slate-50/50 border-2 border-slate-50 rounded-2xl px-4 font-bold outline-none"
                      value={formData.severity}
                      onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                    >
                       <option value="low">Low - Informational</option>
                       <option value="medium">Medium - Functional Impairment</option>
                       <option value="high">High - Operational Block</option>
                       <option value="critical">Critical - Infrastructure Hazard</option>
                    </select>
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Incident Detail Ledger</label>
                 <textarea 
                   className="w-full border-2 border-slate-50 bg-slate-50/50 rounded-[30px] p-6 min-h-[150px] font-medium text-slate-700 focus:border-blue-500 outline-none transition-all" 
                   placeholder="Provide step-by-step reproduction or visual description of the problem..."
                   value={formData.description}
                   onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                 />
              </div>
           </div>
        </div>
      </Modal>
    </div>
  );
};

export default IssuesPage;
