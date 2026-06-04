import React, { useState } from 'react';
import Card, { CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import { useFetch } from '../hooks/useFetch';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  User as UserIcon,
  Box,
  AlertOctagon,
  Zap,
  MoreVertical,
} from 'lucide-react';
import Pagination from '../components/ui/Pagination';

const IssuesPage = () => {
  const { user, hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const { data: issuesData, pagination, loading, refetch } = useFetch('/issues', {
    params: { page, limit: 10 }
  });
  const { data: myAssets } = useFetch('/assignments/my-assignments');

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
      toast.success('Issue submitted successfully');
      setFormData({ title: '', description: '', severity: 'medium', issue_type: 'technical', assignment_id: '' });
      refetch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id, action) => {
    try {
      const endpoint = action === 'approve' ? `/issues/${id}/approve` : `/issues/${id}/${action}`;
      await api.post(endpoint, { resolution_notes: 'Processed via Issues page' });
      toast.success(`Issue ${action}d`);
      refetch();
    } catch (error) {
      toast.error(`Action failed: ${error.response?.data?.message}`);
    }
  };

  const getStatusBadge = (status) => {
    if (status.startsWith('pending_')) {
      return (
        <Badge variant="warning" className="bg-amber-50 text-amber-700 border-amber-200 uppercase text-[9px] font-black tracking-widest gap-1">
          <Clock size={10} /> Pending
        </Badge>
      );
    }
    switch (status) {
      case 'open':        return <Badge variant="danger"    className="uppercase text-[9px] font-black tracking-widest">Open</Badge>;
      case 'in_progress': return <Badge variant="warning"   className="uppercase text-[9px] font-black tracking-widest">In Progress</Badge>;
      case 'resolved':    return <Badge variant="success"   className="uppercase text-[9px] font-black tracking-widest">Resolved</Badge>;
      case 'closed':      return <Badge variant="secondary" className="uppercase text-[9px] font-black tracking-widest">Closed</Badge>;
      default:            return <Badge className="uppercase text-[9px] font-black tracking-widest">{status}</Badge>;
    }
  };

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'critical': return <Badge variant="danger"    className="rounded-full h-2 w-2 p-0 min-w-0" title="Critical" />;
      case 'high':     return <Badge variant="warning"   className="rounded-full h-2 w-2 p-0 min-w-0 bg-orange-500" title="High" />;
      case 'medium':   return <Badge variant="info"      className="rounded-full h-2 w-2 p-0 min-w-0" title="Medium" />;
      default:         return <Badge variant="secondary" className="rounded-full h-2 w-2 p-0 min-w-0" title="Low" />;
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-4 pt-2 pb-4 px-4 md:px-6">

      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-100">
            <AlertOctagon className="text-white" size={18} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase italic">Issues & Reports</h1>
            <p className="text-slate-400 font-bold text-[9px] tracking-widest uppercase">Report and track problems</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* Report Form */}
        <div className="xl:col-span-4">
          <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden sticky top-20">
            {/* Form Header */}
            <div className="px-4 py-3 bg-red-50/40 border-b border-red-100 flex items-center gap-3">
              <div className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center flex-shrink-0">
                <AlertCircle className="text-red-500" size={16} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight leading-none">Report a Problem</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Submit a new issue</p>
              </div>
            </div>

            <CardContent className="p-4 space-y-3">
              {/* Title */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Title</label>
                <Input
                  placeholder="Short title of the problem..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="h-9 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900"
                />
              </div>

              {/* Related Item */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Related Item (Optional)</label>
                <select
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 font-semibold text-sm outline-none focus:border-blue-500 transition-all"
                  value={formData.assignment_id}
                  onChange={(e) => setFormData({ ...formData, assignment_id: e.target.value })}
                >
                  <option value="">No specific item</option>
                  {myAssets?.data?.map(a => (
                    <option key={a.id} value={a.id}>{a.product?.name} ({a.product?.sku})</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Priority</label>
                <select
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 font-semibold text-sm outline-none focus:border-blue-500 transition-all"
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                <textarea
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 min-h-[90px] font-medium text-sm text-slate-700 focus:border-blue-500 outline-none transition-all resize-none"
                  placeholder="Describe what happened..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <Button
                onClick={handleReportIssue}
                loading={submitting}
                className="w-fit px-5 py-2 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all"
              >
                Submit Report
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* History Column */}
        <div className="xl:col-span-8 space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Clock size={13} className="text-slate-400" />
            <h3 className="font-black text-slate-400 text-[9px] uppercase tracking-[0.3em]">Report History</h3>
          </div>

          {loading ? (
            <div className="p-10 flex justify-center"><LoadingSpinner /></div>
          ) : issuesData?.data?.map((issue) => (
            <Card key={issue.id} className="rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all group">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex flex-col items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors flex-shrink-0">
                      <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Issue</span>
                      <div className="text-sm font-black tracking-tighter italic">#{issue.issue_number.split('-')[1]}</div>
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getSeverityBadge(issue.severity)}
                        <h3 className="text-sm font-black text-slate-900 tracking-tight leading-none">{issue.title}</h3>
                        {getStatusBadge(issue.status)}
                      </div>
                      <p className="text-slate-500 text-xs font-medium line-clamp-1 max-w-xl">{issue.description}</p>
                      <div className="flex items-center gap-3 pt-0.5">
                        <div className="flex items-center gap-1 opacity-60">
                          <Box size={11} className="text-blue-600" />
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">{issue.product?.name || 'General'}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-60">
                          <UserIcon size={11} className="text-slate-400" />
                          <span className="text-[9px] font-bold text-slate-500 uppercase">{issue.reporter?.first_name} {issue.reporter?.last_name}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-40">
                          <Clock size={10} />
                          <span className="text-[9px] font-bold">{new Date(issue.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end lg:self-center">
                    {(issue.status === 'open' || issue.status.startsWith('pending_')) && (
                      <Button
                        onClick={() => handleAction(issue.id, 'approve')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 h-8 rounded-lg text-[9px] uppercase tracking-widest flex items-center gap-1.5 shadow-sm"
                      >
                        <Zap size={12} /> Process
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:text-blue-600 transition-all border border-transparent hover:border-slate-200"
                    >
                      <MoreVertical size={14} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {!loading && issuesData?.data?.length === 0 && (
            <div className="py-20 text-center space-y-3">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={28} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">All Clear</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">No reports found.</p>
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-center">
            <Pagination pagination={pagination} onPageChange={setPage} />
          </div>
        </div>

      </div>
    </div>
  );
};

export default IssuesPage;
