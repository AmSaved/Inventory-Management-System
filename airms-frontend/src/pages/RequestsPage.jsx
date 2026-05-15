import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import Card, { CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatDate } from '../utils/formatters';
import requestService from '../services/requestService';
import toast from 'react-hot-toast';
import { parseSpecifications } from '../utils/helpers';
import Pagination from '../components/ui/Pagination';

const RequestsPage = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { canCreateRequest } = usePermissions();
  const [statusFilter, setStatusFilter] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState(null);
  const [comments, setComments] = useState('');
  const [processing, setProcessing] = useState(false);
  const [viewingRequest, setViewingRequest] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data, pagination, loading, refetch } = useFetch('/requests', {
    params: { 
      status: statusFilter,
      search: search,
      page: page,
      limit: 10
    }
  });

  const handleApprove = async (requestId, isApproving) => {
    setProcessing(true);
    try {
      if (isApproving) {
        await requestService.approveRequest(requestId, comments);
      } else {
        await requestService.rejectRequest(requestId, comments);
      }
      toast.success(`Request ${isApproving ? 'approved' : 'rejected'} successfully`);
      setApprovalModalOpen(false);
      setComments('');
      refetch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Action failed');
    } finally {
      setProcessing(false);
    }
  };

  const canUserApprove = (request) => {
    if (!user || !request.currentStep) return false;
    
    // 1. Only show if the overall status is still pending
    if (request.status !== 'pending') return false;

    // 2. Check if the user has already approved this specific request
    // This assumes the backend returns an approvals array with user_ids
    const hasAlreadyActed = request.approvals?.some(a => Number(a.user_id) === Number(user.id));
    if (hasAlreadyActed) return false;

    // 3. Exact role match for the CURRENT active workflow step
    return Number(user.role?.id) === Number(request.currentStep.required_role_id);
  };

  const getStatusBadge = (request) => {
    const status = request.status?.toLowerCase();
    
    if (status === 'fulfilled') {
      return <Badge variant="success">FULFILLED / RECEIVED</Badge>;
    }
    
    if (request.workflow_status) {
      const isFinished = status === 'approved';
      const variant = isFinished ? 'success' : 'warning';
      return <Badge variant={variant}>{request.workflow_status.toUpperCase()}</Badge>;
    }
    
    const variantMap = {
      pending: 'warning',
      approved: 'success',
      rejected: 'danger',
      cancelled: 'default'
    };
    
    return <Badge variant={variantMap[status] || 'default'}>{status?.toUpperCase() || 'UNKNOWN'}</Badge>;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center px-4 md:px-0">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">System Asset Ledger</h1>
        {canCreateRequest && (
          <Button onClick={() => navigate('/requests/create')} className="bg-primary-600 hover:bg-primary-700 shadow-lg transform hover:scale-105 transition-all">
             Submit New Request
          </Button>
        )}
      </div>

      <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="w-full max-w-md">
              <Input
                placeholder="Search by ID or Name..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSearch(searchValue);
                  }
                }}
                className="bg-gray-50 border-none shadow-inner"
              />
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-2 ml-2">Press Enter to execute search command</p>
            </div>
            <select
              className="px-4 py-2 bg-gray-50 border-none rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold text-gray-600 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Status: All Active</option>
              <option value="pending">In Flow (Pending)</option>
              <option value="approved">Finalized (Approved)</option>
              <option value="fulfilled">Completed (Fulfilled/Received)</option>
              <option value="rejected">Terminated (Rejected)</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
            <table className="w-full text-left border-collapse bg-white">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Request #</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Requester</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Sub-Unit / Branch</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest text-center">Type / priority</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest text-center">Active Blueprint</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest text-center">Current Handover Status</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest text-center">Submission Date</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right">Ledger Command</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.map((request) => (
                  <tr key={request.id} className="hover:bg-primary-50/30 transition-all cursor-default group">
                    <td className="px-6 py-5 align-middle">
                      <span className="font-black text-primary-600 tracking-tighter text-sm">{request.request_number}</span>
                    </td>
                    <td className="px-6 py-5 align-middle">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800 leading-none">{request.requester?.first_name} {request.requester?.last_name}</span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">{request.requester?.employee_id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 align-middle">
                      <span className="text-sm text-gray-500 font-medium">{request.organizationNode?.name || 'Institutional Domain'}</span>
                    </td>
                    <td className="px-6 py-5 align-middle text-center">
                       <div className="flex flex-col items-center gap-1">
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[9px] font-black uppercase tracking-tighter">
                            {request.request_type}
                          </span>
                          <span className={`${request.priority === 'high' ? 'text-red-500' : 'text-primary-500'} text-[9px] font-black uppercase tracking-widest`}>
                            {request.priority}
                          </span>
                       </div>
                    </td>
                    <td className="px-6 py-5 align-middle text-center">
                        <div className="flex flex-col items-center gap-1">
                           <span className="text-[10px] font-black text-gray-800 uppercase tracking-tighter italic">
                              {request.workflow?.name || 'Standard Request'}
                           </span>
                           <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">
                              {request.workflow?.resource_type || 'default'}
                           </span>
                        </div>
                     </td>
                    <td className="px-6 py-5 align-middle text-center">
                       {getStatusBadge(request)}
                    </td>
                    <td className="px-6 py-5 align-middle text-center">
                       <span className="text-xs text-gray-400 font-bold">{formatDate(request.created_at)}</span>
                    </td>
                    <td className="px-6 py-5 align-middle">
                      <div className="flex justify-end gap-2 pr-2">
                        <button
                          onClick={async () => {
                            try {
                              const response = await api.get(`/requests/${request.id}`);
                              setViewingRequest(response.data.data);
                              setViewModalOpen(true);
                            } catch (e) {
                              toast.error('Could not retrieve protocol details');
                            }
                          }}
                          className="p-2 text-gray-300 hover:text-primary-600 hover:bg-white rounded-xl transition-all shadow-none hover:shadow-md"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>

                        {(request.can_action || canUserApprove(request)) && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                setSelectedRequest(request);
                                setApprovalAction('approve');
                                setApprovalModalOpen(true);
                              }}
                              className="bg-primary-600 text-white hover:bg-primary-700 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter shadow-md transform hover:scale-105 transition-all"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRequest(request);
                                setApprovalAction('reject');
                                setApprovalModalOpen(true);
                              }}
                              className="bg-red-500 text-white hover:bg-red-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter shadow-md transform hover:scale-105 transition-all"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!data || data.length === 0) && (
              <div className="text-center py-20 bg-gray-50/50">
                <span className="text-gray-400 font-bold text-sm tracking-widest uppercase">No requests logged in current ledger view</span>
              </div>
            )}
            <div className="p-4 border-t border-gray-50 flex justify-center">
               <Pagination pagination={pagination} onPageChange={setPage} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={approvalModalOpen}
        onClose={() => {
          setApprovalModalOpen(false);
          setComments('');
          setApprovalAction(null);
        }}
        title={`${approvalAction === 'approve' ? 'Authorize' : 'Reject'} Request #${selectedRequest?.request_number}`}
      >
        <div className="space-y-6 p-2">
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-between items-center">
             <div>
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Originator</p>
                <p className="font-bold text-gray-800">{selectedRequest?.requester?.first_name} {selectedRequest?.requester?.last_name}</p>
             </div>
             <div className="text-right">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Purpose</p>
                <p className="text-sm font-medium text-gray-600">{selectedRequest?.purpose || 'General Asset Procurement'}</p>
             </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Institutional Comments</label>
            <textarea
              rows={4}
              className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl shadow-inner focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-700"
              placeholder="Provide context for this command decision..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>
          <div className="flex gap-4">
            <button
              className="flex-1 bg-gray-100 text-gray-400 hover:bg-gray-200 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all"
              onClick={() => {
                 setApprovalModalOpen(false);
                 setComments('');
                 setApprovalAction(null);
              }}
            >
              Discard Action
            </button>
            <button
              className={`flex-1 ${approvalAction === 'approve' ? 'bg-primary-600 hover:bg-primary-700' : 'bg-red-500 hover:bg-red-600'} text-white py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]`}
              onClick={() => handleApprove(selectedRequest?.id, approvalAction === 'approve')}
              disabled={processing}
            >
              {processing ? 'Processing Command...' : `Execute ${approvalAction?.toUpperCase()}`}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title={`Asset Intelligence: ${viewingRequest?.request_number}`}
      >
        <div className="space-y-6 p-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
           <div className="space-y-4">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] border-b border-gray-100 pb-2">
                 Manifested Resources
              </h3>
              <div className="space-y-3">
                 {viewingRequest?.items?.map((item, idx) => {
                    const { specs, notes: userNotes } = parseSpecifications(item.specifications);
                    
                    const displayBarcode = item.barcode || specs.barcode || 'UNASSIGNED_PROTOCOL';
                    const displaySerial = item.serial_number || specs.serial_number || 'PENDING_PHYSICAL_HANDOVER';

                    return (
                      <div key={idx} className="p-6 bg-gray-50 border border-gray-100 rounded-[30px] shadow-sm group">
                         <div className="flex justify-between items-start mb-6">
                            <div>
                               <p className="font-black text-gray-900 text-lg uppercase italic leading-none">{item.product?.name}</p>
                               <p className="text-[9px] text-primary-600 font-black uppercase tracking-widest mt-2">{item.product?.sku} • {item.product?.category}</p>
                            </div>
                            <div className="px-4 py-2 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-tighter shadow-lg">
                               QTY: {item.quantity_requested}
                            </div>
                         </div>
                         
                         <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                               <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest ml-1">Digital Barcode / UUID</p>
                               <div className="p-4 bg-white rounded-2xl border border-gray-100 font-mono text-xs font-black text-slate-800 flex items-center justify-between group-hover:border-blue-200 transition-all">
                                  <span>{displayBarcode}</span>
                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                               </div>
                            </div>
                            <div className="space-y-2">
                               <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest ml-1">Hardware Serial Number</p>
                               <div className="p-4 bg-white rounded-2xl border border-gray-100 font-mono text-xs font-black text-slate-500 flex items-center justify-between italic">
                                  <span>{displaySerial}</span>
                                </div>
                             </div>
                          </div>
   
                          {userNotes && (
                            <div className="mt-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                               <p className="text-[8px] text-blue-400 font-black uppercase tracking-widest mb-1">Custom Specifications</p>
                               <p className="text-[10px] text-blue-900 font-bold italic">"{userNotes}"</p>
                            </div>
                          )}
                       </div>
                    );
                 })}
              </div>
           </div>
        </div>
      </Modal>
    </div>
  );
};

export default RequestsPage;