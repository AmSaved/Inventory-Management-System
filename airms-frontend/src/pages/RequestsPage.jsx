import React, { useState, useEffect } from 'react';
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
import api from '../services/api';

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
  const [acknowledgeModalOpen, setAcknowledgeModalOpen] = useState(false);
  const [acknowledgeRequest, setAcknowledgeRequest] = useState(null);

  // Asset Allocation State (Required for Standard Request final steps)
  const [allocations, setAllocations] = useState({}); 
  const [availableInventory, setAvailableInventory] = useState({}); 
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [productsByCategory, setProductsByCategory] = useState({}); 
  const [selectedProductIds, setSelectedProductIds] = useState({}); 

  // Fetch available inventory and products by category when approval modal opens for the final step
  useEffect(() => {
    const fetchInventoryForAllocation = async () => {
      if (!approvalModalOpen || approvalAction !== 'approve' || !selectedRequest) return;

      // Check if it's the final step
      if (!selectedRequest.is_final_step) return;

      setLoadingInventory(true);
      try {
        // Fetch full request details to be absolutely sure we have latest items
        const res = await api.get(`/requests/${selectedRequest.id}`);
        const request = res.data.data;
        if (request.items && request.items.length > 0) {
          const invMap = {};
          const prodCatMap = {};
          for (const item of request.items) {
            if (item.product_id) {
              const invRes = await api.get('/inventory', {
                params: { product_id: item.product_id, status: 'available', limit: 100 }
              });
              invMap[item.product_id] = invRes.data.data;
            } else {
              const { specs } = parseSpecifications(item.specifications);
              const category = specs.category;
              if (category && !prodCatMap[category]) {
                const prodRes = await api.get('/products', {
                  params: { category, limit: 100 }
                });
                prodCatMap[category] = prodRes.data.data;
              }
            }
          }
          setAvailableInventory(invMap);
          setProductsByCategory(prodCatMap);
        }
      } catch (err) {
        console.error('Failed to load allocation data:', err);
        toast.error('Failed to load available inventory for allocation');
      } finally {
        setLoadingInventory(false);
      }
    };

    fetchInventoryForAllocation();
  }, [approvalModalOpen, approvalAction, selectedRequest]);

  const handleProductChange = async (itemId, category, productId) => {
    setSelectedProductIds(prev => ({ ...prev, [itemId]: productId }));
    // Clear any previous allocation for this item
    setAllocations(prev => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });

    if (!productId) return;

    setLoadingInventory(true);
    try {
      const invRes = await api.get('/inventory', {
        params: { product_id: productId, status: 'available', limit: 100 }
      });
      setAvailableInventory(prev => ({ ...prev, [productId]: invRes.data.data }));
    } catch (err) {
      console.error('Failed to load inventory for product:', err);
      toast.error('Failed to load available inventory');
    } finally {
      setLoadingInventory(false);
    }
  };

  const { data, pagination, loading, refetch } = useFetch('/requests', {
    params: { 
      status: statusFilter,
      search: search,
      page: page,
      limit: 10
    }
  });

  const handleAcknowledge = async () => {
    if (!acknowledgeRequest) return;
    setProcessing(true);
    try {
      await requestService.acknowledgeRequest(acknowledgeRequest.id);
      toast.success('Receipt acknowledged! Assets have been assigned to your account.');
      setAcknowledgeModalOpen(false);
      setAcknowledgeRequest(null);
      refetch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Acknowledgment failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async (requestId, isApproving) => {
    // Direct approval with no selected allocations required (backend auto-fulfillment handles allocation)

    setProcessing(true);
    try {
      if (isApproving) {
        await requestService.approveRequest(requestId, comments, allocations);
      } else {
        await requestService.rejectRequest(requestId, comments);
      }
      toast.success(`Request ${isApproving ? 'approved' : 'rejected'} successfully`);
      setApprovalModalOpen(false);
      setComments('');
      setAllocations({});
      setAvailableInventory({});
      setProductsByCategory({});
      setSelectedProductIds({});
      refetch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Action failed');
    } finally {
      setProcessing(false);
    }
  };

  const canUserApprove = (request) => {
    if (!user || !request.currentStep) return false;
    
    if (request.status !== 'pending') return false;

    const hasAlreadyActed = request.approvals?.some(a => Number(a.user_id) === Number(user.id));
    if (hasAlreadyActed) return false;

    const stepRoleName = (request.currentStep.requiredRole?.name || '').toLowerCase();
    if (stepRoleName === 'user') {
      const targetId = request.target_user_id || request.to_user_id;
      return Number(targetId) === Number(user.id);
    }
    
    return Number(user.role?.id) === Number(request.currentStep.required_role_id);
  };

  const getStatusBadge = (request) => {
    const status = request.status?.toLowerCase();
    const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Unknown';
    
    if (status === 'pending_acknowledgment') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-md animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          Awaiting Receipt
        </span>
      );
    }

    if (status === 'fulfilled') {
      return <span className="text-xs font-medium text-gray-900 bg-white border border-gray-200 px-3 py-1 rounded-md">Fulfilled / Received</span>;
    }
    
    if (request.workflow_status) {
      const cleanWf = request.workflow_status.replace(/\s*\(.*?\)\s*/g, '').trim();
      return <span className="text-xs font-medium text-gray-900 bg-white border border-gray-200 px-3 py-1 rounded-md">{capitalize(cleanWf)}</span>;
    }
    
    return <span className="text-xs font-medium text-gray-900 bg-white border border-gray-200 px-3 py-1 rounded-md">{capitalize(status)}</span>;
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center px-4 md:px-0">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight"></h1>
        {canCreateRequest && (
          <Button onClick={() => navigate('/requests/create')} className="bg-primary-600 hover:bg-primary-700 shadow-lg transform hover:scale-105 transition-all">
             Submit New Request
          </Button>
        )}
      </div>

      <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-3">
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
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 tracking-widest">Request #</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 tracking-widest">Requester</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 tracking-widest">Sub-Unit / Branch</th>


                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 tracking-widest text-center">Current Handover Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 tracking-widest text-center">Submission Date</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 tracking-widest text-right">Ledger Command</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-5 text-center flex justify-center"><LoadingSpinner /></td>
                  </tr>
                ) : !data || data.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-5 text-center text-gray-400 font-bold text-sm tracking-widest uppercase bg-gray-50/50">No requests logged in current ledger view</td>
                  </tr>
                ) : (
                  data.map((request) => (
                  <tr key={request.id} className="hover:bg-primary-50/30 transition-all cursor-default group">
                    <td className="px-6 py-5 align-middle">
                      <span className="text-xs font-bold text-primary-600 tracking-tighter">{request.request_number}</span>
                    </td>
                    <td className="px-6 py-5 align-middle">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-800 leading-none">{request.requester?.first_name} {request.requester?.last_name}</span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">{request.requester?.employee_id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 align-middle">
                      <span className="text-sm text-gray-500 font-medium">{request.organizationNode?.name || 'Institutional Domain'}</span>
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

                        {request.can_acknowledge && (
                          <button
                            onClick={() => {
                              setAcknowledgeRequest(request);
                              setAcknowledgeModalOpen(true);
                            }}
                            className="bg-amber-500 text-white hover:bg-amber-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter shadow-md transform hover:scale-105 transition-all flex items-center gap-1"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Acknowledge
                          </button>
                        )}
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
                ))
              )}
              </tbody>
            </table>
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
          setAllocations({});
          setAvailableInventory({});
          setProductsByCategory({});
          setSelectedProductIds({});
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

          {/* Requested Items read-only details display in the approval modal */}
          {approvalAction === 'approve' && selectedRequest?.items?.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-primary-600 uppercase tracking-[0.2em] px-1">
                Requested Resources Details
              </h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {selectedRequest.items.map((item, index) => {
                  const { specs } = parseSpecifications(item.specifications);
                  const displaySerial = item.serial_number || specs.serial_number || '';
                  return (
                    <div key={item.id || index} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{item.product?.name || specs.name || 'N/A'}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">SKU: {item.product?.sku || specs.sku || 'N/A'} • {item.product?.category || specs.category || 'N/A'}</p>
                        </div>
                        <Badge variant="default">QTY: {item.quantity_requested}</Badge>
                      </div>
                      
                      {item.product && (item.product.brand || item.product.ram || item.product.storage) && (
                        <div className="flex flex-wrap gap-2 text-[10px] font-bold tracking-wider uppercase text-gray-500 mt-2 border-t border-gray-50 pt-2">
                          {item.product.brand && <span>Brand: <span className="text-primary-600">{item.product.brand}</span></span>}
                          {item.product.processor && <span>CPU: <span className="text-primary-600">{item.product.processor}</span></span>}
                          {item.product.ram && <span>RAM: <span className="text-primary-600">{item.product.ram}</span></span>}
                          {item.product.storage && <span>STR: <span className="text-primary-600">{item.product.storage}</span></span>}
                          {item.product.color && <span>CLR: <span className="text-primary-600">{item.product.color}</span></span>}
                        </div>
                      )}

                      {displaySerial && (
                        <div className="mt-2 bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex items-center justify-between text-xs font-semibold">
                          <span className="text-gray-450">Allocated Serial:</span>
                          <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 border border-gray-200 rounded shadow-sm">{displaySerial}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                 setAllocations({});
                 setAvailableInventory({});
                 setProductsByCategory({});
                 setSelectedProductIds({});
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
                          <div className="flex justify-between items-start mb-4">
                             <div>
                                <p className="font-black text-gray-900 text-lg uppercase italic leading-none">{item.product?.name || specs.name || 'N/A'}</p>
                                <p className="text-[9px] text-primary-600 font-black uppercase tracking-widest mt-2">{item.product?.sku || specs.sku || 'N/A'} • {item.product?.category || specs.category || 'N/A'}</p>
                             </div>
                             <div className="px-4 py-2 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-tighter shadow-lg">
                                QTY: {item.quantity_requested}
                             </div>
                          </div>

                          <div className="flex flex-wrap gap-2 text-[10px] font-bold tracking-wider uppercase text-gray-500 mt-2 border-t border-gray-50 pt-2 mb-4">
                            {item.product?.brand && <span>Brand: <span className="text-primary-600">{item.product.brand}</span></span>}
                            {item.product?.processor && <span>CPU: <span className="text-primary-600">{item.product.processor}</span></span>}
                            {item.product?.ram && <span>RAM: <span className="text-primary-600">{item.product.ram}</span></span>}
                            {item.product?.storage && <span>STR: <span className="text-primary-600">{item.product.storage}</span></span>}
                            {item.product?.color && <span>CLR: <span className="text-primary-600">{item.product.color}</span></span>}
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
      {/* Acknowledge Receipt Modal */}
      <Modal
        isOpen={acknowledgeModalOpen}
        onClose={() => {
          if (!processing) {
            setAcknowledgeModalOpen(false);
            setAcknowledgeRequest(null);
          }
        }}
        title={`Acknowledge Receipt — ${acknowledgeRequest?.request_number}`}
      >
        <div className="space-y-6 p-2">
          {/* Header notice */}
          <div className="flex items-start gap-4 p-5 bg-amber-50 border border-amber-200 rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center flex-shrink-0 shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-black text-amber-900 uppercase tracking-tight">Physical Asset Handover Confirmation</p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                By clicking <strong>Confirm Receipt</strong>, you declare that you have <strong>physically received</strong> the assets listed below.
                This action is irreversible and will formally transfer custody to your account.
              </p>
            </div>
          </div>

          {/* Request summary */}
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2">
            <div className="flex justify-between">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Requester</span>
              <span className="text-xs font-bold text-gray-800">{acknowledgeRequest?.requester?.first_name} {acknowledgeRequest?.requester?.last_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sub-Unit</span>
              <span className="text-xs font-bold text-gray-600">{acknowledgeRequest?.organizationNode?.name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</span>
              <span className="text-xs font-bold text-amber-600">Pending Your Receipt</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-4">
            <button
              className="flex-1 bg-gray-100 text-gray-400 hover:bg-gray-200 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all"
              disabled={processing}
              onClick={() => {
                setAcknowledgeModalOpen(false);
                setAcknowledgeRequest(null);
              }}
            >
              Cancel
            </button>
            <button
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              disabled={processing}
              onClick={handleAcknowledge}
            >
              {processing ? (
                <span>Processing...</span>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Confirm Receipt
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RequestsPage;