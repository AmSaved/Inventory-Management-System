import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import Card, { CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatDate } from '../utils/formatters';
import api from '../services/api';
import toast from 'react-hot-toast';
import { parseSpecifications } from '../utils/helpers';
import { 
  Shuffle, 
  Truck, 
  RotateCcw, 
  Package, 
  ClipboardList, 
  Eye, 
  CheckCircle2, 
  XCircle,
  QrCode
} from 'lucide-react';
import QRCode from 'react-qr-code';

const ApprovalLedgerPage = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();

  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState(null);
  const [comments, setComments] = useState('');
  const [processing, setProcessing] = useState(false);
  const [viewingRequest, setViewingRequest] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);

  // Asset Allocation State (Required for Standard Request final steps)
  const [allocations, setAllocations] = useState({}); 
  const [availableInventory, setAvailableInventory] = useState({}); 
  const [loadingInventory, setLoadingInventory] = useState(false);
  
  const [fullRequestDetails, setFullRequestDetails] = useState(null);
  const [activeQr, setActiveQr] = useState(null); 

  // Fetch full details and available inventory when approval modal opens for the final step
  useEffect(() => {
    const fetchInventoryForAllocation = async () => {
      if (!approvalModalOpen || approvalAction !== 'approve' || !selectedRequest) return;

      // ONLY fetch inventory if it's the final step
      if (!selectedRequest.is_final_step) return;

      setLoadingInventory(true);
      try {
        // 1. Fetch full request details to get items
        const res = await api.get(`/requests/${selectedRequest.id}`);
        const request = res.data.data;
        setFullRequestDetails(request);

        // 2. Determine if it's the final step (Backend could tell us, but we can check if it's the last step in steps array)
        // If it's a request and we have items, pre-fetch available inventory for each product
        if (request.items && request.items.length > 0) {
          const invMap = {};
          for (const item of request.items) {
            const invRes = await api.get('/inventory', {
              params: { product_id: item.product_id, status: 'available', limit: 100 }
            });
            invMap[item.product_id] = invRes.data.data;
          }
          setAvailableInventory(invMap);
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
  const typeConfig = {
    inventory: { title: 'Inventory Transfer Approvals', icon: <Shuffle className="text-blue-500" /> },
    items: { title: 'Item Transfer Approvals', icon: <Package className="text-indigo-500" /> },
    returns: { title: 'Return Request Approvals', icon: <RotateCcw className="text-orange-500" /> },
    'inventory-returns': { title: 'Inventory Return Approvals', icon: <RotateCcw className="text-orange-600" /> },
    discharge: { title: 'Discharge Approvals', icon: <Truck className="text-emerald-500" /> },
    default: { title: 'Pending Approvals', icon: <ClipboardList className="text-gray-500" /> }
  };

  const config = typeConfig[type] || typeConfig.default;

  // Fetch categorized data (History + Pending)
  const { data: rawData, loading, refetch } = useFetch(
    type === 'discharge' ? '/discharge/approvals' :
      type === 'inventory' ? '/transfers/approvals' :
        type === 'inventory-returns' ? '/returns/approvals' :
          type === 'returns' ? '/requests' :
            `/requests`, {
    params: {
      type: type === 'returns' ? 'return' : type,
      search,
      all: true
    }
  });

  const data = Array.isArray(rawData) ? rawData : (rawData?.data || []);

  const canUserApprove = (item) => {
    const userRoleId = Number(user.role?.id || user.role_id);
    const stepRoleId = item.currentStep?.required_role_id ? Number(item.currentStep.required_role_id) : null;

    // 1. Direct Role Match Override (Priority 1)
    if (stepRoleId && userRoleId === stepRoleId) return true;

    // 2. If backend already calculated authority, trust it
    if (item.can_action === true) return true;
    if (item.can_action === false) return false;

    // 3. Fallback check for workflow step requirements
    if (!user || !item.currentStep) return false;

    const step = item.currentStep;

    // Check Permission Authority
    if (step.required_permission && hasPermission(step.required_permission)) return true;

    // Check Global/Admin overrides
    if (hasPermission('system:manage') || hasPermission('workflow:process')) return true;

    return false;
  };

  const handleAction = async (requestId, action) => {
    setProcessing(true);
    try {
      // Map the resource type for the backend workflow processor
      const resourceType = selectedRequest?.resource_origin || 'request';
      await api.post(`/approvals/${requestId}/${action}`, {
        comments,
        resourceType,
        allocations
      });

      toast.success(`Request ${action === 'approve' ? 'authorized' : 'rejected'} successfully`);
      setApprovalModalOpen(false);
      setComments('');
      refetch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Command execution failed');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (item) => {
    const status = item.status?.toLowerCase();

    if (status === 'fulfilled') {
      return <Badge variant="success">FULFILLED / RECEIVED</Badge>;
    }

    if (item.workflow_status) {
      const isFinished = status === 'approved' || status === 'completed';
      const variant = isFinished ? 'success' : 'warning';
      return <Badge variant={variant}>{item.workflow_status.toUpperCase()}</Badge>;
    }

    const variantMap = {
      pending: 'warning',
      approved: 'success',
      completed: 'success',
      rejected: 'danger',
      cancelled: 'default'
    };

    return <Badge variant={variantMap[status] || 'default'}>{status?.toUpperCase() || 'UNKNOWN'}</Badge>;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">


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
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
            <table className="w-full text-left border-collapse bg-white">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Resource #</th>
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
                {data?.map((item) => {
                  const requester = item.requester || item.creator;
                  const orgNode = item.organizationNode || item.fromNode;
                  const typeLabel = item.request_type || item.transfer_type || item.discharge_type || type;
                  const priority = item.priority || 'normal';

                  return (
                    <tr key={item.id} className="hover:bg-primary-50/30 transition-all cursor-default group">
                      <td className="px-6 py-5 align-middle">
                        <span className="font-black text-primary-600 tracking-tighter text-sm">
                          {item.transfer_number || item.discharge_number || item.request_number || `#${item.id}`}
                        </span>
                      </td>
                      <td className="px-6 py-5 align-middle">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800 leading-none">{requester?.first_name} {requester?.last_name}</span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">{requester?.employee_id || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 align-middle">
                        <span className="text-sm text-gray-500 font-medium">{orgNode?.name || 'Institutional Domain'}</span>
                      </td>
                      <td className="px-6 py-5 align-middle text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[9px] font-black uppercase tracking-tighter">
                            {typeLabel}
                          </span>
                          <span className={`${priority === 'high' ? 'text-red-500' : 'text-primary-500'} text-[9px] font-black uppercase tracking-widest`}>
                            {priority}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 align-middle text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] font-black text-gray-800 uppercase tracking-tighter italic">
                            {item.workflow?.name || 'Standard Request'}
                          </span>
                          <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">
                            {item.workflow?.resource_type || 'default'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 align-middle text-center">
                        {getStatusBadge(item)}
                      </td>
                      <td className="px-6 py-5 align-middle text-center">
                        <span className="text-xs text-gray-400 font-bold">{formatDate(item.created_at)}</span>
                      </td>
                      <td className="px-6 py-5 align-middle">
                        <div className="flex justify-end gap-2 pr-2">
                          <button
                            onClick={async () => {
                              try {
                                const endpoint = item.resource_origin === 'discharge' ? `/discharge/${item.id}` : `/requests/${item.id}`;
                                const response = await api.get(endpoint);
                                setViewingRequest(response.data.data);
                                setViewModalOpen(true);
                              } catch (e) {
                                toast.error('Could not retrieve protocol details');
                              }
                            }}
                            className="p-2 text-gray-300 hover:text-primary-600 hover:bg-white rounded-xl transition-all shadow-none hover:shadow-md"
                          >
                            <Eye size={18} />
                          </button>

                          {(item.can_action || canUserApprove(item)) && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  setSelectedRequest(item);
                                  setApprovalAction('approve');
                                  setApprovalModalOpen(true);
                                }}
                                className="bg-primary-600 text-white hover:bg-primary-700 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter shadow-md transform hover:scale-105 transition-all"
                              >
                                Authorize
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedRequest(item);
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
                  );
                })}
              </tbody>
            </table>
            {(!data || data.length === 0) && (
              <div className="text-center py-20 bg-gray-50/50">
                <span className="text-gray-400 font-bold text-sm tracking-widest uppercase italic opacity-50">
                  Command queue clear for {type} ledger
                </span>
              </div>
            )}
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
          setFullRequestDetails(null);
        }}
        title={`${approvalAction === 'approve' ? 'Authorize' : 'Reject'} Ledger Entry`}
      >
        <div className="space-y-6 p-2">
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Resource ID</p>
            <p className="font-black text-gray-800 tracking-tighter">
              {selectedRequest?.transfer_number || selectedRequest?.discharge_number || selectedRequest?.request_number || `#${selectedRequest?.id}`}
            </p>
          </div>

          {/* Physical Asset Allocation Section - Only for Final Step of Requests (NOT Discharges) */}
          {approvalAction === 'approve' && selectedRequest?.resource_origin !== 'discharge' && selectedRequest?.is_final_step && fullRequestDetails?.items?.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-primary-600 uppercase tracking-[0.2em] px-1">
                Physical Asset Allocation
              </h3>
              <div className="space-y-3">
                {fullRequestDetails.items.map((item) => (
                  <div key={item.id} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-700 uppercase">{item.product?.name}</span>
                      <Badge variant="default">QTY: {item.quantity_requested}</Badge>
                    </div>

                    <div>
                      <select
                        className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary-500"
                        value={allocations[item.id] || ''}
                        onChange={(e) => setAllocations(prev => ({ ...prev, [item.id]: e.target.value }))}
                      >
                        <option value="">-- Select Physical Asset (Serial/Batch) --</option>
                        {availableInventory[item.product_id]?.map(inv => (
                          <option key={inv.id} value={inv.id}>
                            {inv.serial_number ? `SN: ${inv.serial_number}` : (inv.batch_number ? `Batch: ${inv.batch_number}` : `ID: ${inv.id}`)}
                            ({inv.quantity} available in {inv.organizationNode?.name})
                          </option>
                        ))}
                        {(!availableInventory[item.product_id] || availableInventory[item.product_id].length === 0) && (
                          <option disabled>No available stock found in visible nodes</option>
                        )}
                      </select>
                    </div>
                  </div>
                ))}
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
            <Button
              variant="default"
              className="flex-1 py-4 rounded-2xl font-black uppercase text-[11px]"
              onClick={() => {
                setApprovalModalOpen(false);
                setComments('');
                setApprovalAction(null);
                setAllocations({});
                setAvailableInventory({});
                setFullRequestDetails(null);
              }}
            >
              Discard Action
            </Button>
            <Button
              className={`flex-1 ${approvalAction === 'approve' ? 'bg-primary-600 hover:bg-primary-700' : 'bg-red-500 hover:bg-red-600'} text-white py-4 rounded-2xl font-black uppercase text-[11px] shadow-xl`}
              onClick={() => handleAction(selectedRequest?.id, approvalAction)}
              disabled={processing}
            >
              {processing ? 'Processing...' : `Execute ${approvalAction?.toUpperCase()}`}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title={`Asset Intelligence: ${viewingRequest?.request_number || viewingRequest?.transfer_number || viewingRequest?.discharge_number}`}
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
                        QTY: {item.quantity_requested || item.quantity}
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest ml-1">Digital Barcode / UUID</p>
                          <div className="p-4 bg-white rounded-2xl border border-gray-100 font-mono text-xs font-black text-slate-800 flex items-center justify-between group-hover:border-blue-200 transition-all">
                            <span>{displayBarcode}</span>
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          </div>
                        </div>
                        
                        {userNotes && (
                          <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                            <p className="text-[8px] text-blue-400 font-black uppercase tracking-widest mb-1">Custom Specifications</p>
                            <p className="text-[10px] text-blue-900 font-bold italic">"{userNotes}"</p>
                          </div>
                        )}
                      </div>

                      {/* Asset Identity List with Interactive QR Sign */}
                      <div className="mt-8 space-y-3 bg-white p-6 rounded-[35px] border border-gray-100 shadow-inner">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 px-2">Tracked Asset Protocols</h4>
                        <div className="divide-y divide-gray-50">
                          {(item.serial_numbers && item.serial_numbers.length > 0) ? (
                            item.serial_numbers.map((sn, snIdx) => {
                              const isExpanded = activeQr === `sn-${idx}-${snIdx}`;
                              return (
                                <div key={snIdx} className="py-4 flex items-center justify-between group">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-800 tracking-tighter uppercase">{sn}</span>
                                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest italic">Physical Serial Number</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-4">
                                    {isExpanded ? (
                                      <div className="flex items-center gap-4 animate-in slide-in-from-right-4 duration-300">
                                        <div className="p-2 bg-white rounded-xl shadow-xl ring-1 ring-gray-100">
                                          <QRCode value={sn} size={80} />
                                        </div>
                                        <button 
                                          onClick={() => setActiveQr(null)}
                                          className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-red-50 hover:text-red-500 transition-all"
                                        >
                                          <XCircle size={16} />
                                        </button>
                                      </div>
                                    ) : (
                                      <button 
                                        onClick={() => setActiveQr(`sn-${idx}-${snIdx}`)}
                                        className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 rounded-2xl hover:bg-primary-600 hover:text-white transition-all shadow-sm group-hover:scale-105"
                                      >
                                        <QrCode size={20} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          ) : (item.serial_number || specs.serial_number) && (
                            <div className="py-4 flex items-center justify-between group">
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-slate-800 tracking-tighter uppercase">{item.serial_number || specs.serial_number}</span>
                                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest italic">Physical Serial Number</span>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                {activeQr === `sn-${idx}-single` ? (
                                  <div className="flex items-center gap-4 animate-in slide-in-from-right-4 duration-300">
                                    <div className="p-2 bg-white rounded-xl shadow-xl ring-1 ring-gray-100">
                                      <QRCode value={item.serial_number || specs.serial_number} size={80} />
                                    </div>
                                    <button 
                                      onClick={() => setActiveQr(null)}
                                      className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-red-50 hover:text-red-500 transition-all"
                                    >
                                      <XCircle size={16} />
                                    </button>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => setActiveQr(`sn-${idx}-single`)}
                                    className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 rounded-2xl hover:bg-primary-600 hover:text-white transition-all shadow-sm group-hover:scale-105"
                                  >
                                    <QrCode size={20} />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
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

export default ApprovalLedgerPage;
