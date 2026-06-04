import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
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
import inventoryService from '../services/inventoryService';
import toast from 'react-hot-toast';
import { parseSpecifications } from '../utils/helpers';
import Pagination from '../components/ui/Pagination';
import api from '../services/api';
import { QrCode, Plus, Trash2 } from 'lucide-react';

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
  const [qrModalItem, setQrModalItem] = useState(null);
  const [availableNodeInventory, setAvailableNodeInventory] = useState([]);
  const [loadingViewInventory, setLoadingViewInventory] = useState(false);
  const [savedAllocations, setSavedAllocations] = useState({});

  // Edit & Cancel States
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Edit categories and sub-categories resolution helper
  const editCategories = [...new Set(catalogProducts.map(p => p.category?.trim()).filter(Boolean))].sort();

  const getEditSubCategories = (category) => {
    if (!category) return [];
    return [...new Set(
      catalogProducts
        .filter(p => p.category?.trim().toUpperCase() === category.toUpperCase())
        .map(p => p.sub_category?.trim())
        .filter(Boolean)
    )].sort();
  };

  const handleEditClick = (request) => {
    const type = request.request_type?.toLowerCase() || '';
    if (type === 'transfer') {
      navigate(`/requests/transfer?edit=true&id=${request.id}`);
    } else if (type === 'return') {
      navigate(`/requests/return?edit=true&id=${request.id}`);
    } else if (type === 'issue' || type === 'report') {
      navigate(`/requests/report?edit=true&id=${request.id}`);
    } else {
      navigate(`/requests/new?edit=true&id=${request.id}`);
    }
  };

  const handleEditFieldChange = (field, value) => {
    setEditingRequest(prev => ({ ...prev, [field]: value }));
  };

  const handleEditItemChange = (index, field, value) => {
    setEditingRequest(prev => {
      const updatedItems = [...prev.items];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      if (field === 'category') {
        updatedItems[index].sub_category = '';
      }
      return { ...prev, items: updatedItems };
    });
  };

  const handleAddEditItem = () => {
    setEditingRequest(prev => ({
      ...prev,
      items: [...prev.items, { category: '', sub_category: '', quantity: 1, specifications: '' }]
    }));
  };

  const handleRemoveEditItem = (index) => {
    setEditingRequest(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!editingRequest) return;
    if (editingRequest.items.some(item => !item.category)) {
      return toast.error('Please select a category for all items');
    }

    setProcessing(true);
    try {
      const payload = {
        purpose: editingRequest.purpose,
        priority: editingRequest.priority,
        expected_delivery_date: editingRequest.expectedDate || null,
        items: editingRequest.items.map(item => ({
          quantity_requested: item.quantity,
          specifications: {
            category: item.category,
            sub_category: item.sub_category || null,
            notes: item.specifications
          }
        }))
      };

      await requestService.updateRequest(editingRequest.id, payload);
      toast.success('Request updated successfully');
      setEditModalOpen(false);
      setEditingRequest(null);
      refetch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update request');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelClick = (request) => {
    setCancellingRequest(request);
    setCancelReason('');
    setCancelModalOpen(true);
  };

  const handleCancelSubmit = async () => {
    if (!cancellingRequest) return;
    setProcessing(true);
    try {
      await requestService.cancelRequest(cancellingRequest.id, cancelReason);
      toast.success('Request cancelled successfully');
      setCancelModalOpen(false);
      setCancellingRequest(null);
      refetch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel request');
    } finally {
      setProcessing(false);
    }
  };

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

  const normalizeAllocations = (value) => Object.fromEntries(
    Object.entries(value || {}).map(([itemId, entry]) => [itemId, typeof entry === 'object' && entry !== null ? entry.id || entry.inventory_id || entry.value || '' : entry])
  );

  const normalizeSpecifications = (specifications) => {
    if (typeof specifications === 'string') {
      try {
        return JSON.parse(specifications);
      } catch (err) {
        return {};
      }
    }
    return typeof specifications === 'object' && specifications !== null ? specifications : {};
  };

  const inferResourceOrigin = (record) => {
    const text = [
      record?.resource_origin,
      record?.request_type,
      record?.transfer_type,
      record?.discharge_type,
      record?.return_type,
      record?.type,
    ].filter(Boolean).join(' ').toLowerCase();

    if (/return|inventory-return|inventory_return/.test(text)) return 'return';
    if (/transfer|inventory-transfer|inventory_transfer/.test(text)) return 'transfer';
    if (/discharge|issue/.test(text)) return 'discharge';
    return 'request';
  };

  const getItemDisplayName = (item, specs = {}) => {
    const source = typeof specs === 'object' && specs !== null ? specs : normalizeSpecifications(item?.specifications || specs);
    const candidateKeys = ['item_name', 'item name', 'name', 'product_name', 'product name', 'asset_name', 'asset name', 'title', 'label'];

    for (const key of candidateKeys) {
      if (source?.[key]) return String(source[key]);
      const matchedKey = Object.keys(source || {}).find(existing => existing.toLowerCase() === key.toLowerCase());
      if (matchedKey && source[matchedKey]) return String(source[matchedKey]);
    }

    return item?.product?.name || item?.product_name || item?.name || item?.item_name || source?.name || 'Item';
  };

  const canShowInventorySelection = (requestData) => {
    const origin = inferResourceOrigin(requestData);

    if (['transfer', 'discharge', 'return', 'inventory', 'inventory-returns'].includes(origin)) {
      return false;
    }

    return ['request', 'new'].includes(origin) && (requestData?.items || []).length === 1;
  };

  const handleApprove = async (requestId, isApproving) => {
    // Direct approval with no selected allocations required (backend auto-fulfillment handles allocation)

    setProcessing(true);
    try {
      if (isApproving) {
        const payloadAllocations = normalizeAllocations(Object.keys(allocations).length ? allocations : savedAllocations);
        await requestService.approveRequest(requestId, comments, payloadAllocations);
      } else {
        await requestService.rejectRequest(requestId, comments);
      }
      toast.success(`Request ${isApproving ? 'approved' : 'rejected'} successfully`);
      setApprovalModalOpen(false);
      setComments('');
      setAllocations({});
      setSavedAllocations({});
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

    const hasAlreadyActed = request.approvals?.some(a => Number(a.approver_id || a.user_id) === Number(user.id));
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
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-md animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          Awaiting Receipt
        </span>
      );
    }

    if (status === 'fulfilled') {
      return <span className="text-xs font-medium text-gray-900 bg-white border border-gray-200 px-3 py-1 rounded-md">Fulfilled / Received</span>;
    }
    
    if (status === 'pending' || (request.workflow_status && request.workflow_status.toLowerCase().startsWith('pending') && !request.workflow_status.toLowerCase().includes('acknowledgment'))) {
      return <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-md">Pending</span>;
    }

    if (request.workflow_status) {
      const cleanWf = request.workflow_status.replace(/\s*\(.*?\)\s*/g, '').trim();
      return <span className="text-xs font-medium text-gray-900 bg-white border border-gray-200 px-3 py-1 rounded-md">{capitalize(cleanWf)}</span>;
    }
    
    return <span className="text-xs font-medium text-gray-900 bg-white border border-gray-200 px-3 py-1 rounded-md">{capitalize(status)}</span>;
  };


  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-4 md:px-0">
        <h1 className="text-2xl font-bold text-gray-900"></h1>
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
              <p className="text-xs text-gray-400 font-medium mt-2 ml-2">Press Enter to search</p>
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
                  <th className="px-6 py-4 text-xs font-medium text-gray-400">Request #</th>
                  <th className="px-6 py-4 text-xs font-medium text-gray-400">Requester</th>
                  <th className="px-6 py-4 text-xs font-medium text-gray-400">Sub-Unit / Branch</th>


                  <th className="px-6 py-4 text-xs font-medium text-gray-400 text-center">Status</th>
                  <th className="px-6 py-4 text-xs font-medium text-gray-400 text-center">Date</th>
                  <th className="px-6 py-4 text-xs font-medium text-gray-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-5 text-center flex justify-center"><LoadingSpinner /></td>
                  </tr>
                ) : !data || data.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-5 text-center text-gray-400 font-medium text-sm bg-gray-50/50">No requests found</td>
                  </tr>
                ) : (
                  data.map((request) => (
                  <tr key={request.id} className="hover:bg-primary-50/30 transition-all cursor-default group">
                    <td className="px-6 py-5 align-middle">
                      <span className="text-xs font-bold text-primary-600 tracking-tighter capitalize">{request.request_type ? `${request.request_type.replace(/_/g, ' ')}` : 'Request'}</span>
                    </td>
                    <td className="px-6 py-5 align-middle">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-800 leading-none">{request.requester?.first_name} {request.requester?.last_name}</span>
                        <span className="text-xs text-gray-400 font-medium mt-1">{request.requester?.employee_id}</span>
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
                        {request.status?.toLowerCase() === 'pending' && Number(request.requester_id) === Number(user?.id) && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditClick(request);
                              }}
                              className="bg-primary-600 text-white hover:bg-primary-750 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-md hover:scale-105 transition-all"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelClick(request);
                              }}
                              className="bg-red-500 text-white hover:bg-red-600 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-md hover:scale-105 transition-all"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        <button
                          onClick={async () => {
                            try {
                              setLoadingViewInventory(true);
                              const response = await api.get(`/requests/${request.id}`);
                              const detail = response.data.data;
                              setViewingRequest(detail);
                              setAllocations({});
                              setSavedAllocations({});
                              setAvailableNodeInventory([]);

                              if (canShowInventorySelection(detail)) {
                                const currentNodeId = user?.organizationNode?.id || user?.org_node_id;
                                if (currentNodeId) {
                                  const inventoryResponse = await inventoryService.getAllInventory({
                                    org_node_id: currentNodeId,
                                    status: 'available',
                                    limit: 100
                                  });
                                  const inventoryList = inventoryResponse?.data?.data || inventoryResponse?.data || [];
                                  setAvailableNodeInventory(inventoryList);
                                }
                              }

                              setViewModalOpen(true);
                            } catch (e) {
                              console.error('Could not retrieve protocol details', e);
                              toast.error('Could not retrieve protocol details');
                            } finally {
                              setLoadingViewInventory(false);
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
                            className="bg-amber-500 text-white hover:bg-amber-600 px-3 py-1.5 rounded-xl text-xs font-medium shadow-md hover:scale-105 transition-all flex items-center gap-1"
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
                              className="bg-primary-600 text-white hover:bg-primary-700 px-3 py-1.5 rounded-xl text-xs font-medium shadow-md hover:scale-105 transition-all"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRequest(request);
                                setApprovalAction('reject');
                                setApprovalModalOpen(true);
                              }}
                              className="bg-red-500 text-white hover:bg-red-600 px-3 py-1.5 rounded-xl text-xs font-medium shadow-md hover:scale-105 transition-all"
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
        title={`${approvalAction === 'approve' ? 'Authorize' : 'Reject'} Request`}
      >
        <div className="space-y-6 p-2">
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-between items-center">
             <div>
                <p className="text-xs text-gray-400 font-medium">Originator</p>
                <p className="font-semibold text-gray-800">{selectedRequest?.requester?.first_name} {selectedRequest?.requester?.last_name}</p>
             </div>
             <div className="text-right">
                <p className="text-xs text-gray-400 font-medium">Purpose</p>
                <p className="text-sm font-medium text-gray-600">{selectedRequest?.purpose || 'General Asset Procurement'}</p>
             </div>
          </div>

          {/* Requested Items read-only details display in the approval modal */}
          {approvalAction === 'approve' && selectedRequest?.items?.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-primary-600 px-1">
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
                          <p className="font-semibold text-gray-800 text-sm">{getItemDisplayName(item, specs) || 'N/A'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{item.product?.category || specs.category || 'N/A'}</p>
                        </div>
                        <Badge variant="default">QTY: {item.quantity_requested}</Badge>
                      </div>
                      
                      {item.product && (item.product.brand || item.product.ram || item.product.storage) && (
                        <div className="flex flex-wrap gap-2 text-xs font-medium text-gray-500 mt-2 border-t border-gray-50 pt-2">
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
                          <span className="font-mono font-semibold text-slate-800 bg-white px-2 py-0.5 border border-gray-200 rounded shadow-sm">{displaySerial}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2 px-1">Comments</label>
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
              className="flex-1 bg-gray-100 text-gray-500 hover:bg-gray-200 py-3 rounded-2xl font-medium text-sm transition-all"
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
              className={`flex-1 ${approvalAction === 'approve' ? 'bg-primary-600 hover:bg-primary-700' : 'bg-red-500 hover:bg-red-600'} text-white py-3 rounded-2xl font-semibold text-sm shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]`}
              onClick={() => handleApprove(selectedRequest?.id, approvalAction === 'approve')}
              disabled={processing}
            >
              {processing ? 'Processing...' : approvalAction === 'approve' ? 'Approve' : 'Reject'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title={`Asset Intelligence: ${viewingRequest?.request_type ? `${viewingRequest.request_type.charAt(0).toUpperCase() + viewingRequest.request_type.slice(1).replace(/_/g, ' ')} Request` : 'Details'}`}
      >
        <div className="space-y-6 p-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
           <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-600 border-b border-gray-100 pb-2">
                 Request Details & Submitted Fields
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                  <p className="text-xs text-gray-400 font-medium">Purpose</p>
                  <p className="text-sm font-semibold text-gray-800">{viewingRequest?.purpose || '—'}</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                  <p className="text-xs text-gray-400 font-medium">Requested By</p>
                  <p className="text-sm font-semibold text-gray-800">{viewingRequest?.requester?.first_name} {viewingRequest?.requester?.last_name}</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                  <p className="text-xs text-gray-400 font-medium">Branch</p>
                  <p className="text-sm font-semibold text-gray-800">{viewingRequest?.organizationNode?.name || '—'}</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                  <p className="text-xs text-gray-400 font-medium">Submission Date</p>
                  <p className="text-sm font-semibold text-gray-800">{formatDate(viewingRequest?.created_at)}</p>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-gray-600 border-b border-gray-100 pb-2 mt-6">
                User Request Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                  <p className="text-xs text-gray-400 font-medium">Reason</p>
                  <p className="text-sm font-semibold text-gray-800">{viewingRequest?.reason || '—'}</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                  <p className="text-xs text-gray-400 font-medium">Category</p>
                  <p className="text-sm font-semibold text-gray-800">{viewingRequest?.category || '—'}</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                  <p className="text-xs text-gray-400 font-medium">Priority</p>
                  <p className="text-sm font-semibold text-gray-800">{viewingRequest?.priority || '—'}</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                  <p className="text-xs text-gray-400 font-medium">Expected Date</p>
                  <p className="text-sm font-semibold text-gray-800">{viewingRequest?.expected_date || '—'}</p>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-gray-600 border-b border-gray-100 pb-2 mt-6">
                Item Specifications (Optional Enhancements)
              </h3>
              {canShowInventorySelection(viewingRequest) ? (
                <div className="space-y-3">
                  {(viewingRequest?.items || []).map((item, idx) => {
                    const specs = normalizeSpecifications(item.specifications);
                    const customFields = Object.entries(specs).filter(([key]) => !['name','sku','category','notes','serial_number','quantity_requested','source_node_id'].includes(key.toLowerCase()));
                    return (
                      <div key={idx} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{getItemDisplayName(item, specs) || 'Requested Item'}</p>
                            <p className="text-xs text-gray-400 font-medium">Category: {item.product?.category || specs.category || 'General'}</p>
                          </div>
                          <span className="text-xs font-medium text-primary-600 bg-primary-50 px-3 py-1 rounded-full">Qty {item.quantity_requested || 1}</span>
                        </div>
                        {customFields.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {customFields.map(([key, value]) => (
                              <div key={key} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                                <p className="text-xs font-medium text-gray-400">{key}</p>
                                <p className="text-sm font-semibold text-gray-700 mt-1">{String(value || '—')}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">No extra specifications provided for this item.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left bg-white">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-5 py-3.5 text-xs font-semibold text-gray-500">Item Name</th>
                          <th className="px-5 py-3.5 text-xs font-semibold text-gray-500">ID / Serial Number (QR Code)</th>
                          <th className="px-5 py-3.5 text-xs font-semibold text-gray-500">Current Branch</th>
                          <th className="px-5 py-3.5 text-xs font-semibold text-gray-500">Custody / Assignment Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(viewingRequest?.items || []).map((item, idx) => {
                          const specs = normalizeSpecifications(item.specifications);
                          const name = getItemDisplayName(item, specs) || `Item #${item.product_id || item.id}`;
                          const sku = item.product?.sku || specs.sku || 'N/A';
                          const category = item.product?.category || specs.category || 'General';
                          let serials = [];
                          if (item.serial_numbers && item.serial_numbers.length > 0) serials = item.serial_numbers;
                          else if (item.serial_number) serials = [item.serial_number];
                          else if (specs.serial_number) serials = [specs.serial_number];
                          else serials = ['PENDING-HANDOVER'];
                          const currentBranch = item.organizationNode?.name || viewingRequest?.organizationNode?.name || 'Central Office';
                          const assignedTo = viewingRequest?.targetUser ? `Assigned to "${viewingRequest.targetUser.first_name} ${viewingRequest.targetUser.last_name}"` : viewingRequest?.requester ? `Assigned to "${viewingRequest.requester.first_name} ${viewingRequest.requester.last_name}"` : 'In Branch Storage';
                          return (
                            <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-5 py-4 align-middle"><div className="flex flex-col"><span className="font-semibold text-gray-900 text-sm">{name}</span><span className="text-[10px] text-gray-400 font-medium mt-0.5">Category: {category}</span></div></td>
                              <td className="px-5 py-4 align-middle"><div className="space-y-1.5">{serials.map((sn, sidx) => <div key={sidx} className="flex items-center gap-2">{sn !== 'PENDING-HANDOVER' ? <><div onClick={() => setQrModalItem({ id: item.id, serial_number: sn, name: getItemDisplayName(item, specs), product: { ...(item.product || {}), name: getItemDisplayName(item, specs), sku: item.product?.sku || specs.sku || 'N/A', category: item.product?.category || specs.category || 'General' } })} className="p-1 bg-white border border-gray-200 rounded shadow-sm hover:border-gray-400 hover:scale-105 transition-all cursor-pointer shrink-0" title="Click to view QR label"><QRCode value={JSON.stringify({ id: item.id, name: getItemDisplayName(item, specs), sku: item.product?.sku || specs.sku || 'N/A', serial: sn })} size={20} level="H" /></div><span className="font-mono text-xs font-semibold text-gray-800 bg-gray-50 px-2 py-0.5 border border-gray-200 rounded shadow-sm">{sn}</span></> : <span className="font-mono text-xs font-semibold text-gray-450 italic">{sn}</span>}</div>)}</div></td>
                              <td className="px-5 py-4 align-middle"><span className="bg-gray-100 text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1 text-[11px] font-semibold">{currentBranch}</span></td>
                              <td className="px-5 py-4 align-middle"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${assignedTo.startsWith('Assigned') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}><span className={`w-1.5 h-1.5 rounded-full ${assignedTo.startsWith('Assigned') ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>{assignedTo}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {canShowInventorySelection(viewingRequest) && (
                <>
                  <h3 className="text-sm font-semibold text-gray-600 border-b border-gray-100 pb-2 mt-6">
                    Available Items at Current Node (Category Match)
                  </h3>
                  {loadingViewInventory ? (
                    <div className="flex justify-center py-4"><LoadingSpinner /></div>
                  ) : (
                    <div className="space-y-3">
                      {(viewingRequest?.items || []).map((item, idx) => {
                        const specs = normalizeSpecifications(item.specifications);
                        const category = item.product?.category || specs.category || 'General';
                        const matchingInventory = availableNodeInventory.filter(inv => {
                          const invCategory = inv.product?.category || inv.category || '';
                          return invCategory === category || inv.product_id === item.product_id;
                        });

                        return (
                          <div key={`avail-${idx}`} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{getItemDisplayName(item, specs) || 'Requested Item'}</p>
                                <p className="text-[10px] text-gray-400 font-medium">Category: {category}</p>
                              </div>
                              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">{matchingInventory.length} available</span>
                            </div>
                            {matchingInventory.length > 0 ? (
                              <>
                              <select
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                                value={allocations[item.id] || ''}
                                onChange={(e) => setAllocations(prev => ({ ...prev, [item.id]: e.target.value }))}
                              >
                                <option value="">Select an available item to assign</option>
                                {matchingInventory.map(inv => (
                                  <option key={inv.id} value={inv.id}>
                                    {inv.product?.name || inv.product_name || 'Inventory Item'} · SN: {inv.serial_number || 'N/A'} · Qty: {inv.quantity || 1} · Node: {inv.organizationNode?.name || 'Current Node'}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  setSavedAllocations(prev => ({ ...prev, [item.id]: allocations[item.id] || '' }));
                                  toast.success('Allocation saved for this item.');
                                }}
                                className="w-full rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500"
                              >
                                Save Selection
                              </button>
                              </>
                            ) : (
                              <p className="text-xs text-gray-400">No available inventory is currently listed for this category at the current node.</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              <h3 className="text-sm font-semibold text-gray-600 border-b border-gray-100 pb-2 mt-6">
              </h3>
              
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left bg-white">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Item Name</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">ID / Serial Number (QR Code)</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Current Branch</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Custody / Assignment Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(viewingRequest?.items || []).map((item, idx) => {
                        const { specs } = parseSpecifications(item.specifications);
                        const name = getItemDisplayName(item, specs) || `Item #${item.product_id || item.id}`;
                        const sku = item.product?.sku || specs.sku || 'N/A';
                        const category = item.product?.category || specs.category || 'General';

                        let serials = [];
                        if (item.serial_numbers && item.serial_numbers.length > 0) {
                          serials = item.serial_numbers;
                        } else if (item.serial_number) {
                          serials = [item.serial_number];
                        } else if (specs.serial_number) {
                          serials = [specs.serial_number];
                        } else {
                          serials = ['PENDING-HANDOVER'];
                        }

                        const currentBranch = item.organizationNode?.name || 
                                             viewingRequest.organizationNode?.name || 
                                             'Central Office';

                        const assignedTo = viewingRequest.targetUser 
                          ? `Assigned to "${viewingRequest.targetUser.first_name} ${viewingRequest.targetUser.last_name}"`
                          : viewingRequest.requester 
                            ? `Assigned to "${viewingRequest.requester.first_name} ${viewingRequest.requester.last_name}"`
                            : 'In Branch Storage';

                        return (
                          <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-5 py-4 align-middle">
                              <div className="flex flex-col">
                                <span className="font-bold text-gray-900 text-sm">{name}</span>
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                                  SKU: {sku} · Cat: {category}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4 align-middle">
                              <div className="space-y-1.5">
                                {serials.map((sn, sidx) => (
                                  <div key={sidx} className="flex items-center gap-2">
                                    {sn !== 'PENDING-HANDOVER' ? (
                                      <>
                                        <div 
                                          onClick={() => setQrModalItem({
                                            id: item.id,
                                            serial_number: sn,
                                            name: getItemDisplayName(item, specs),
                                            product: { ...(item.product || {}), name: getItemDisplayName(item, specs), sku: item.product?.sku || specs.sku || 'N/A', category: item.product?.category || specs.category || 'General' }
                                          })}
                                          className="p-1 bg-white border border-gray-200 rounded shadow-sm hover:border-gray-400 hover:scale-105 transition-all cursor-pointer shrink-0"
                                          title="Click to view QR label"
                                        >
                                          <QRCode value={JSON.stringify({ id: item.id, name: getItemDisplayName(item, specs), sku: item.product?.sku || specs.sku || 'N/A', serial: sn })} size={20} level="H" />
                                        </div>
                                        <span className="font-mono text-xs font-bold text-gray-800 bg-gray-50 px-2 py-0.5 border border-gray-200 rounded shadow-sm">
                                          {sn}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="font-mono text-xs font-semibold text-gray-450 italic">
                                        {sn}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="px-5 py-4 align-middle">
                              <span className="bg-gray-100 text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
                                {currentBranch}
                              </span>
                            </td>
                            <td className="px-5 py-4 align-middle">
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                assignedTo.startsWith('Assigned') 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                  : 'bg-gray-50 text-gray-500 border border-gray-200'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${assignedTo.startsWith('Assigned') ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                                {assignedTo}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              
           </div>
        </div>
      </Modal>

      {/* Pop-up Identity Tag Modal */}
      {qrModalItem && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setQrModalItem(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-4 text-center bg-slate-50 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Asset Identity Tag</h3>
                <p className="text-xs font-semibold text-slate-505 mt-0.5">{qrModalItem.name || qrModalItem.product?.name || 'Item'}</p>
             </div>
             <div className="p-6 flex flex-col items-center gap-4 bg-white">
                <div className="p-3 bg-white rounded-xl shadow-sm ring-1 ring-slate-100">
                   <QRCode value={JSON.stringify({ id: qrModalItem.id, name: qrModalItem.name || qrModalItem.product?.name || 'Item', sku: qrModalItem.product?.sku || 'N/A', serial: qrModalItem.serial_number })} size={180} level="H" />
                </div>
                <div className="text-center font-mono text-xs font-bold text-slate-900 uppercase tracking-widest mt-2 bg-slate-50 px-3 py-1 rounded border border-slate-200">
                  {qrModalItem.serial_number}
                </div>
             </div>
             <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
                <button onClick={() => window.print()} className="flex-1 h-9 bg-slate-950 text-white font-semibold rounded-lg text-xs hover:bg-slate-900 transition-all shadow-sm">Print</button>
                <button onClick={() => setQrModalItem(null)} className="flex-1 h-9 bg-slate-100 border border-slate-200 text-slate-650 font-semibold rounded-lg text-xs hover:bg-slate-200 transition-all">Close</button>
             </div>
          </div>
        </div>
      )}

      {/* Acknowledge Receipt Modal */}
      <Modal
        isOpen={acknowledgeModalOpen}
        onClose={() => {
          if (!processing) {
            setAcknowledgeModalOpen(false);
            setAcknowledgeRequest(null);
          }
        }}
        title="Acknowledge Receipt"
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
              <p className="text-sm font-semibold text-amber-900">Physical Asset Handover Confirmation</p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                By clicking <strong>Confirm Receipt</strong>, you declare that you have <strong>physically received</strong> the assets listed below.
                This action is irreversible and will formally transfer custody to your account.
              </p>
            </div>
          </div>

          {/* Request summary */}
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2">
            <div className="flex justify-between">
              <span className="text-xs font-medium text-gray-400">Requester</span>
              <span className="text-xs font-bold text-gray-800">{acknowledgeRequest?.requester?.first_name} {acknowledgeRequest?.requester?.last_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs font-medium text-gray-400">Sub-Unit</span>
              <span className="text-xs font-bold text-gray-600">{acknowledgeRequest?.organizationNode?.name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs font-medium text-gray-400">Status</span>
              <span className="text-xs font-bold text-amber-600">Pending Your Receipt</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-4">
            <button
              className="flex-1 bg-gray-100 text-gray-500 hover:bg-gray-200 py-3 rounded-2xl font-medium text-sm transition-all"
              disabled={processing}
              onClick={() => {
                setAcknowledgeModalOpen(false);
                setAcknowledgeRequest(null);
              }}
            >
              Cancel
            </button>
            <button
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-2xl font-semibold text-sm shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
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

      {/* Edit Request Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => {
          if (!processing) {
            setEditModalOpen(false);
            setEditingRequest(null);
          }
        }}
        title="Edit Request"
      >
        {editingRequest && (
          <form onSubmit={handleUpdateSubmit} className="space-y-6 p-2 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {/* Purpose */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Purpose / Reason <span className="text-red-400">*</span></label>
              <Input
                value={editingRequest.purpose}
                onChange={(e) => handleEditFieldChange('purpose', e.target.value)}
                placeholder="Why do you need it?"
                required
                className="h-11 rounded-xl border border-gray-200 bg-gray-50 font-medium px-4 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Priority */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500">Requisition Priority</label>
                <select
                  className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-4 font-semibold text-gray-700 outline-none hover:bg-gray-100 transition-all cursor-pointer text-sm"
                  value={editingRequest.priority}
                  onChange={(e) => handleEditFieldChange('priority', e.target.value)}
                >
                  <option value="low">Standard Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">Urgent Requirement</option>
                </select>
              </div>

              {/* Expected Date */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500">Expected Delivery Date</label>
                <Input
                  type="date"
                  value={editingRequest.expectedDate}
                  onChange={(e) => handleEditFieldChange('expectedDate', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="h-11 rounded-xl border border-gray-200 bg-gray-50 font-medium px-4 text-sm"
                />
              </div>
            </div>

            {/* Requested Items */}
            <div className="space-y-4 pt-2">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <h3 className="text-sm font-bold text-gray-800">Requested Items</h3>
                <button
                  type="button"
                  onClick={handleAddEditItem}
                  className="text-xs font-semibold text-primary-600 hover:text-primary-750 flex items-center gap-1 bg-primary-50 px-3 py-1.5 rounded-xl border border-primary-200 transition-all shadow-sm"
                >
                  <Plus size={14} className="inline mr-1" /> Add Item
                </button>
              </div>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {editingRequest.items.map((item, index) => (
                  <div key={index} className="space-y-4 p-4 bg-gray-50 rounded-2xl border border-gray-150 relative group">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-gray-400">Item #{index + 1}</span>
                      {editingRequest.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEditItem(index)}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    {loadingCatalog ? (
                      <div className="flex justify-center py-2"><LoadingSpinner /></div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Category Select */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500">Category <span className="text-red-400">*</span></label>
                            <select
                              className="w-full h-10 bg-white border border-gray-200 rounded-xl px-3 font-semibold text-gray-700 outline-none hover:border-primary-200 transition-all cursor-pointer text-xs"
                              value={item.category}
                              onChange={(e) => handleEditItemChange(index, 'category', e.target.value)}
                              required
                            >
                              <option value="">Choose Category...</option>
                              {editCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                          </div>

                          {/* Sub-Category Select */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500">Sub-Category</label>
                            <select
                              className="w-full h-10 bg-white border border-gray-200 rounded-xl px-3 font-semibold text-gray-700 outline-none hover:border-primary-200 transition-all cursor-pointer text-xs disabled:opacity-40"
                              value={item.sub_category}
                              disabled={!item.category}
                              onChange={(e) => handleEditItemChange(index, 'sub_category', e.target.value)}
                            >
                              <option value="">Any Sub-Category...</option>
                              {getEditSubCategories(item.category).map(sub => <option key={sub} value={sub}>{sub}</option>)}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Quantity */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500">Quantity</label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleEditItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                              required
                              className="h-10 border border-gray-200 bg-white rounded-xl font-bold text-center text-primary-600 text-sm shadow-sm"
                            />
                          </div>

                          {/* Specifications */}
                          <div className="md:col-span-2 space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500">Specifications</label>
                            <Input
                              value={item.specifications}
                              onChange={(e) => handleEditItemChange(index, 'specifications', e.target.value)}
                              placeholder="e.g. 16GB RAM, 512GB SSD..."
                              className="h-10 rounded-xl border border-gray-200 bg-white font-medium text-xs px-3"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-4 border-t border-gray-150 pt-4">
              <button
                type="button"
                className="flex-1 bg-gray-100 text-gray-500 hover:bg-gray-200 py-3 rounded-2xl font-medium text-sm transition-all"
                disabled={processing}
                onClick={() => {
                  setEditModalOpen(false);
                  setEditingRequest(null);
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-2xl font-semibold text-sm shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                disabled={processing}
              >
                {processing ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Cancel Request Confirmation Modal */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => {
          if (!processing) {
            setCancelModalOpen(false);
            setCancellingRequest(null);
            setCancelReason('');
          }
        }}
        title="Cancel Request"
      >
        <div className="space-y-6 p-2">
          <div className="flex items-start gap-4 p-5 bg-red-50 border border-red-200 rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500 flex items-center justify-center flex-shrink-0 shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-red-950">Cancel Resource Request</p>
              <p className="text-xs text-red-700 mt-1 leading-relaxed">
                Are you sure you want to cancel this request? This action will permanently abort the request and remove it from all approval workflows.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 px-1">Reason for Cancellation (Optional)</label>
            <textarea
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-250 rounded-2xl shadow-inner focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-700 text-sm animate-none"
              placeholder="Provide a reason for cancelling this request..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>

          <div className="flex gap-4">
            <button
              className="flex-1 bg-gray-100 text-gray-500 hover:bg-gray-200 py-3 rounded-2xl font-medium text-sm transition-all"
              disabled={processing}
              onClick={() => {
                setCancelModalOpen(false);
                setCancellingRequest(null);
                setCancelReason('');
              }}
            >
              No, Keep Request
            </button>
            <button
              className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-2xl font-semibold text-sm shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              disabled={processing}
              onClick={handleCancelSubmit}
            >
              {processing ? 'Processing...' : 'Yes, Cancel Request'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RequestsPage;