import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../ui/Button';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Card, { CardContent, CardHeader, CardTitle } from '../ui/Card';
import Badge from '../ui/Badge';
import Table, { TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import ApprovalTaskCard from './ApprovalTaskCard';
import requestService from '../../services/requestService';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';

import {
  MoreVertical,
  Eye,
  ArrowLeftRight,
  RotateCcw,
  AlertTriangle,
  User as UserIcon,
  MessageSquare,
  Package
} from 'lucide-react';
import Modal from '../common/Modal';

const UserDashboard = ({ data, pendingApprovals = [], onActionRefetch }) => {
  const { hasPermission } = useAuth();
  const assignments = data?.my_assignments || [];
  const [requests, setRequests] = useState(data?.my_requests || []);
  const [activeMenu, setActiveMenu] = useState(null);

  // Sync internal state when props data changes (from DashboardPage refetch)
  React.useEffect(() => {
    if (data?.my_requests) {
      setRequests(data.my_requests);
    }
  }, [data]);

  // Transfer Modal State
  const [transferAsset, setTransferAsset] = useState(null);
  const [toUserId, setToUserId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Return & Report State
  const [returnAsset, setReturnAsset] = useState(null);
  const [reportAsset, setReportAsset] = useState(null);
  const [condition, setCondition] = useState('good');
  const [issueDetails, setIssueDetails] = useState('');

  // Personnel directory for transfers (Lazy-loaded)
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Lazy-load personnel only when starting a transfer
  React.useEffect(() => {
    const fetchUsers = async () => {
      if (!transferAsset || users.length > 0) return;

      setLoadingUsers(true);
      try {
        const response = await api.get('/users', { params: { limit: 500 } });
        setUsers(Array.isArray(response.data?.data) ? response.data.data : []);
      } catch (error) {
        console.error('Personnel directory access restricted:', error);
        // We don't toast here to avoid annoying users who might not have permission 
        // until they actually try to select a user.
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [transferAsset, users.length]);

  const handleTransfer = async () => {
    if (!toUserId) {
      return toast.error('Selection incomplete: Please select a Target Custodian');
    }
    if (!reason || reason.trim().length === 0) {
      return toast.error('Selection incomplete: Please provide a reason for the transfer');
    }

    setSubmitting(true);
    try {
      await api.post('/requests', {
        request_type: 'transfer',
        purpose: `Instant Transfer: ${transferAsset?.product?.name}. Justification: ${reason}`,
        priority: 'medium',
        items: [{
          product_id: transferAsset.product_id,
          quantity_requested: 1,
          notes: `Transfer target user ID: ${toUserId}`
        }],
        org_node_id: transferAsset.org_node_id,
        target_user_id: toUserId,
        notes: JSON.stringify({ transfer_to_user_id: toUserId, assignment_id: transferAsset.id })
      });
      toast.success('Transfer request submitted for approval');
      setTransferAsset(null);
      setToUserId('');
      setReason('');
      if (onActionRefetch) onActionRefetch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Transfer protocol failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async () => {
    if (!condition) return toast.error('Condition required');
    setSubmitting(true);
    try {
      await api.post('/requests', {
        request_type: 'return',
        purpose: `Instant Return: ${returnAsset?.product?.name}`,
        priority: 'medium',
        items: [{
          product_id: returnAsset.product_id,
          quantity_requested: 1,
          notes: `Condition at return: ${condition}`
        }],
        org_node_id: returnAsset.org_node_id,
        notes: JSON.stringify({ assignment_id: returnAsset.id, condition })
      });
      toast.success('Return protocol initiated');
      setReturnAsset(null);
      if (onActionRefetch) onActionRefetch();
    } catch (error) {
      toast.error('Return request failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReport = async () => {
    if (!issueDetails) return toast.error('Issue details required');
    setSubmitting(true);
    try {
      await api.post('/requests', {
        request_type: 'issue',
        purpose: `Issue Report: ${reportAsset?.product?.name}`,
        priority: 'high',
        items: [{
          product_id: reportAsset.product_id,
          quantity_requested: 1,
          notes: issueDetails
        }],
        org_node_id: reportAsset.org_node_id,
        notes: JSON.stringify({ assignment_id: reportAsset.id })
      });
      toast.success('Incident logged and reported');
      setReportAsset(null);
      setIssueDetails('');
      if (onActionRefetch) onActionRefetch();
    } catch (error) {
      toast.error('Failed to log report');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFulfill = async (id) => {
    try {
      await api.post(`/requests/${id}/fulfill`);
      toast.success('Receipt acknowledged successfully!');
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'fulfilled' } : r))
      );
      if (onActionRefetch) onActionRefetch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to acknowledge receipt');
    }
  };

  const handleWorkflowAction = async (id, action) => {
    const loadingToast = toast.loading('Processing approval sequence...');
    try {
      if (action === 'approve') {
        await requestService.approveRequest(id);
      } else {
        await requestService.rejectRequest(id);
      }
      toast.success(`Request ${action}d successfully`, { id: loadingToast });
      if (onActionRefetch) onActionRefetch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Action failed', { id: loadingToast });
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">

      {/* DYNAMIC APPROVALS SECTION */}
      {hasPermission('request:approve') && pendingApprovals.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-2 h-8 bg-blue-600 rounded-full" />
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Pending Authorizations</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Personnel Requests Requiring Action</p>
              </div>
            </div>
            <Link to="/requests" className="text-[10px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest bg-blue-50 px-6 py-2 rounded-full transition-all">
              Full Command Center
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {pendingApprovals.slice(0, 3).map(task => (
              <ApprovalTaskCard key={task.id} task={task} onAction={handleWorkflowAction} />
            ))}
          </div>
        </div>
      )}

      {/* ASSET GALLERY */}
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center text-blue-400 shadow-2xl">
            <Package size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">My Personnel Vault</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Active Assets & Resources Under Your Custody</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
          {assignments.map((item) => (
            <div key={item.id} className="group relative bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_32px_64px_rgba(0,0,0,0.1)] hover:-translate-y-2 transition-all duration-500 overflow-hidden">
              {/* Background Glow */}
              <div className={`absolute top-0 right-0 w-32 h-32 ${item.status === 'active' ? 'bg-emerald-500/5' : 'bg-slate-500/5'} rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700`}></div>

              <div className="relative z-10">
                <div className="flex justify-between items-start mb-8">
                  <div className="w-16 h-16 bg-slate-50 rounded-[22px] flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-sm">
                    <Package size={28} />
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setActiveMenu(activeMenu === item.id ? null : item.id)}
                      className="p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-400 hover:text-slate-900"
                    >
                      <MoreVertical size={20} />
                    </button>

                    {activeMenu === item.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)}></div>
                        <div className="absolute right-0 mt-2 w-56 rounded-[2rem] shadow-[0_32px_64px_rgba(0,0,0,0.2)] bg-slate-950/95 backdrop-blur-2xl ring-1 ring-white/10 z-20 overflow-hidden animate-in fade-in zoom-in duration-300">
                          <div className="p-2 space-y-1">
                            <button className="flex items-center w-full px-5 py-4 text-[10px] font-black text-slate-400 hover:text-white hover:bg-white/5 transition-all uppercase tracking-widest rounded-2xl">
                              <Eye size={14} className="mr-3" /> View Details
                            </button>
                            <button
                              onClick={() => { setTransferAsset(item); setActiveMenu(null); }}
                              className="flex items-center w-full px-5 py-4 text-[10px] font-black text-blue-400 hover:text-white hover:bg-blue-500/20 transition-all uppercase tracking-widest rounded-2xl"
                            >
                              <ArrowLeftRight size={14} className="mr-3" /> Transfer Asset
                            </button>
                            <button
                              onClick={() => { setReturnAsset(item); setActiveMenu(null); }}
                              className="flex items-center w-full px-5 py-4 text-[10px] font-black text-teal-400 hover:text-white hover:bg-teal-500/20 transition-all uppercase tracking-widest rounded-2xl"
                            >
                              <RotateCcw size={14} className="mr-3" /> Return Asset
                            </button>
                            <button
                              onClick={() => { setReportAsset(item); setActiveMenu(null); }}
                              className="flex items-center w-full px-5 py-4 text-[10px] font-black text-rose-400 hover:text-white hover:bg-rose-500/20 transition-all uppercase tracking-widest rounded-2xl"
                            >
                              <AlertTriangle size={14} className="mr-3" /> Report Issue
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-black text-slate-900 tracking-tight leading-tight mb-2 group-hover:text-blue-600 transition-colors">{item.product?.name}</h4>
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      SN: {item.serial_number || 'ST-N/A'}
                    </div>
                    <Badge variant={item.status === 'active' ? 'success' : 'gray'} className="text-[8px] font-black px-3 py-0.5">
                      {item.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                  <div>
                    <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Acquired On</div>
                    <div className="text-[10px] font-black text-slate-600 italic uppercase mt-1">{new Date(item.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all">
                    <ArrowLeftRight size={16} />
                  </div>
                </div>
              </div>
            </div>
          ))}

          {assignments.length === 0 && (
            <div className="col-span-full p-20 bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-200 mb-6">
                <Package size={40} />
              </div>
              <h4 className="text-xl font-black text-slate-900 uppercase italic">Vault Empty</h4>
              <p className="text-sm font-medium text-slate-400 mt-2">No assets currently assigned to your ID.</p>
            </div>
          )}
        </div>

        {/* RECENT REQUESTS - STREAM VIEW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 pt-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500">
                <MessageSquare size={18} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tight">Activity Stream</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Lifecycle of your Resource Requests</p>
              </div>
            </div>

            <div className="space-y-4">
              {requests.map((req) => (
                <div key={req.id} className="group flex items-center justify-between p-6 bg-white rounded-[2rem] border border-slate-100 hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] hover:-translate-y-1 transition-all duration-300">
                  <div className="flex items-center gap-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm transition-all duration-500 ${req.status === 'fulfilled' ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white'}`}>
                      <Package size={24} />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 tracking-tight text-base mb-1">
                        {req.items?.[0]?.product?.name || req.product?.name || 'System Request'}
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em]">{req.request_number}</span>
                        <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate max-w-[200px]">{req.reason || req.purpose}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge
                      variant={
                        req.status?.toLowerCase() === 'pending' || req.status?.toLowerCase().startsWith('pending') ? 'yellow'
                          : req.status?.toLowerCase() === 'fulfilled' ? 'success'
                            : req.status?.toLowerCase() === 'approved' ? 'success'
                              : req.status?.toLowerCase() === 'rejected' ? 'danger'
                                : 'gray'
                      }
                      className="px-4 py-1 text-[9px] font-black tracking-widest"
                    >
                      {req.status?.toLowerCase() === 'fulfilled' ? 'DEPLOYED / RECEIVED'
                        : (req.workflow_status || (req.status || 'Unknown').replace('_', ' ')).toUpperCase()}
                    </Badge>
                    {req.status?.toLowerCase() === 'approved' && (
                      <button
                        onClick={() => handleFulfill(req.id)}
                        className="bg-slate-950 hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-2xl shadow-xl transition-all"
                      >
                        Acknowledge Receipt
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {requests.length === 0 && <p className="text-slate-400 italic text-sm text-center py-10">No recent activity detected.</p>}
            </div>
          </div>

          {/* SIDEBAR WIDGET: HELP / PROTOCOL */}
          <div className="space-y-6">
            <div className="p-10 bg-slate-950 rounded-[3rem] shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-transparent opacity-50"></div>
              <div className="relative z-10">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl flex items-center justify-center text-blue-400 mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                  <Shield size={32} />
                </div>
                <h4 className="text-xl font-black text-white tracking-tight italic mb-3 uppercase">Custody Protocol</h4>
                <p className="text-slate-400 text-[11px] font-medium leading-relaxed uppercase tracking-widest opacity-80">
                  All assigned assets are monitored by the Institutional Ledger. Ensure all handovers are logged through the Transfer protocol.
                </p>
                <button className="mt-8 text-[10px] font-black text-blue-400 hover:text-white uppercase tracking-[0.3em] transition-all">
                  Read Policy →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals - Keeping them but ensuring they use the premium button style */}
      <Modal
        isOpen={!!transferAsset}
        onClose={() => setTransferAsset(null)}
        title="Institutional Handover"
        onConfirm={handleTransfer}
        confirmText="Confirm Transfer"
        loading={submitting}
      >
        <div className="space-y-8 p-2">
          <div className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex items-center gap-6">
            <div className="w-16 h-16 bg-white rounded-[22px] flex items-center justify-center shadow-sm text-blue-600">
              <Package size={32} />
            </div>
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Target Resource</div>
              <div className="text-xl font-black text-slate-900 italic uppercase tracking-tighter leading-none">{transferAsset?.product?.name}</div>
              <div className="text-[10px] font-mono text-slate-500 mt-2 font-bold uppercase tracking-widest bg-white/50 px-2 py-0.5 rounded-full inline-block">SN: {transferAsset?.serial_number}</div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">
              <UserIcon size={14} /> Target Custodian
            </label>
            <select
              className="w-full h-16 bg-slate-50 border-2 border-transparent rounded-3xl px-6 font-black text-slate-900 outline-none focus:bg-white focus:border-blue-500 transition-all disabled:opacity-50 appearance-none"
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              disabled={loadingUsers}
            >
              {loadingUsers ? <option>Scanning Personnel...</option> : users.length === 0 ? <option>No Colleagues Found</option> : (
                <>
                  <option value="">Select Target...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.employee_id})</option>)}
                </>
              )}
            </select>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">
              <MessageSquare size={14} /> Transfer Logic
            </label>
            <textarea
              className="w-full h-32 bg-slate-50 border-2 border-transparent rounded-[2rem] p-6 font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all resize-none placeholder:text-slate-300"
              placeholder="Reason for protocol initiation..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!returnAsset}
        onClose={() => setReturnAsset(null)}
        title="Decommissioning Entry"
        onConfirm={handleReturn}
        confirmText="Finalize Return"
        loading={submitting}
      >
        <div className="space-y-8 p-2">
          <div className="p-6 bg-teal-50 rounded-[2.5rem] border border-teal-100 flex items-center gap-6">
            <div className="w-16 h-16 bg-white rounded-[22px] flex items-center justify-center shadow-sm text-teal-600">
              <RotateCcw size={32} />
            </div>
            <div>
              <div className="text-[10px] font-black text-teal-400 uppercase tracking-[0.3em] mb-1">Returning Unit</div>
              <div className="text-xl font-black text-slate-900 italic uppercase tracking-tighter leading-none">{returnAsset?.product?.name}</div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Condition Grading</label>
            <select
              className="w-full h-16 bg-teal-50/30 border-2 border-transparent rounded-3xl px-6 font-black text-slate-900 outline-none focus:bg-white focus:border-teal-500 transition-all cursor-pointer appearance-none"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
            >
              <option value="good">OPTIMAL (Operational)</option>
              <option value="used">STANDARD (Wear Detected)</option>
              <option value="damaged">CRITICAL (Service Required)</option>
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!reportAsset}
        onClose={() => setReportAsset(null)}
        title="Incident Reporting"
        onConfirm={handleReport}
        confirmText="Log Incident"
        loading={submitting}
      >
        <div className="space-y-8 p-2">
          <div className="p-6 bg-rose-50 rounded-[2.5rem] border border-rose-100 flex items-center gap-6">
            <div className="w-16 h-16 bg-white rounded-[22px] flex items-center justify-center shadow-sm text-rose-600">
              <AlertTriangle size={32} />
            </div>
            <div>
              <div className="text-[10px] font-black text-rose-400 uppercase tracking-[0.3em] mb-1">Incident Reference</div>
              <div className="text-xl font-black text-slate-900 italic uppercase tracking-tighter leading-none">{reportAsset?.product?.name}</div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Protocol Details</label>
            <textarea
              className="w-full h-40 bg-rose-50/30 border-2 border-transparent rounded-[2rem] p-6 font-bold text-slate-700 outline-none focus:bg-white focus:border-rose-500 transition-all resize-none placeholder:text-slate-300"
              placeholder="Provide detailed incident telemetry..."
              value={issueDetails}
              onChange={(e) => setIssueDetails(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};


export default UserDashboard;
