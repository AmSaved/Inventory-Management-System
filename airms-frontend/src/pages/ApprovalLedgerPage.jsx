import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import Card, { CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/common/Modal';
import { formatDate } from '../utils/formatters';
import api from '../services/api';
import requestService from '../services/requestService';
import toast from 'react-hot-toast';
import { parseSpecifications } from '../utils/helpers';
import { 
  Shuffle, 
  Truck, 
  RotateCcw, 
  Package, 
  ClipboardList, 
  Eye, 
  XCircle,
  QrCode
} from 'lucide-react';
import QRCode from 'react-qr-code';

const ApprovalLedgerPage = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const { } = useAuth(); // auth context kept for potential future use

  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState(null);
  const [comments, setComments] = useState('');
  const [processing, setProcessing] = useState(false);
  const [viewingRequest, setViewingRequest] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);

  const [activeQr, setActiveQr] = useState(null); 


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

  // Buttons are shown only when the backend explicitly grants can_action.
  // The backend already evaluates role match, branch scope, 4-eyes principle,
  // and global admin overrides — so we trust it as the single source of truth.
  const canUserApprove = (item) => item.can_action === true;

  const handleAction = async (requestId, action) => {

    setProcessing(true);
    try {
      const origin = selectedRequest?.resource_origin || 'request';

      if (origin === 'discharge') {
        if (action === 'approve') {
          await api.post(`/discharge/${requestId}/approve`, { notes: comments });
        } else if (action === 'reject') {
          await api.post(`/discharge/${requestId}/reject`, { reason: comments });
        }
      } else if (origin === 'transfer') {
        if (action === 'approve') {
          await api.post(`/transfers/${requestId}/approve`, { comments });
        } else if (action === 'reject') {
          await api.post(`/transfers/${requestId}/reject`, { reason: comments });
        }
      } else if (origin === 'return') {
        if (action === 'approve') {
          await api.post(`/returns/${requestId}/process`, { notes: comments });
        } else if (action === 'reject') {
          await api.post(`/returns/${requestId}/reject`, { reason: comments });
        }
      } else {
        // Fallback to requestService which respects backend permission checks
        if (action === 'approve') {
          await requestService.approveRequest(requestId, comments, {});
        } else if (action === 'reject') {
          await requestService.rejectRequest(requestId, comments);
        }
      }

      toast.success(`${origin.charAt(0).toUpperCase() + origin.slice(1)} ${action === 'approve' ? 'Approved' : 'Rejected'} successfully`);
      setApprovalModalOpen(false);
      setComments('');
      refetch();
      } catch (error) {
        const backendMsg = error.response?.data?.message;
        const status = error.response?.status;
        let msg = backendMsg || error.message || 'Command execution failed';
        // If authorization failed and we know the required permission, show it
        if (status === 403) {
          const requiredPerm = action === 'approve' ? 'request:approve' : action === 'reject' ? 'request:reject' : null;
          // Prefer backend required permission if available on selected request
          const stepPerm = selectedRequest?.currentStep?.required_permission;
          const perm = stepPerm || requiredPerm;
          if (perm) {
            msg = `${msg} (Missing permission: ${perm})`;
          }
        }
        toast.error(msg);
      } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (item) => {
    const status = item.status?.toLowerCase();
    const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Unknown';

    if (status === 'fulfilled') {
      return <span className="text-xs font-medium text-gray-900 bg-white border border-gray-200 px-3 py-1 rounded-md">Fulfilled / Received</span>;
    }

    if (item.workflow_status) {
      const cleanWf = item.workflow_status.replace(/\s*\(.*?\)\s*/g, '').trim();
      return <span className="text-xs font-medium text-gray-900 bg-white border border-gray-200 px-3 py-1 rounded-md">{capitalize(cleanWf)}</span>;
    }

    return <span className="text-xs font-medium text-gray-900 bg-white border border-gray-200 px-3 py-1 rounded-md">{capitalize(status)}</span>;
  };



  return (
    <div className="space-y-6">


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
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
            <table className="w-full text-left border-collapse bg-white">
              <thead>
                <tr className="bg-gray-50/50 border-b border-black-100">
                  <th className="px-6 py-4 text-[11px] font-white text-black-400 tracking-widest">Resource #</th>
                  <th className="px-6 py-4 text-[11px] font-white text-black-400 tracking-widest">Requester</th>
                  <th className="px-6 py-4 text-[11px] font-white text-black-400 tracking-widest">Sub-Unit / Branch</th>
                  <th className="px-6 py-4 text-[11px] font-white text-black-400 tracking-widest">Target User / Node</th>


                  <th className="px-6 py-4 text-[11px] font-white text-black-400 tracking-widest text-center">current Status</th>
                  <th className="px-6 py-4 text-[11px] font-white text-black-400 tracking-widest text-center">Submission Date</th>
                  <th className="px-6 py-4 text-[11px] font-white text-black-400 tracking-widest text-right">View
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="p-12 text-center"><div className="flex justify-center"></div></td>
                  </tr>
                ) : (!data || data.length === 0) ? (
                  <tr>
                    <td colSpan="7" className="p-12 text-center text-gray-400 italic">Command queue clear for {type} ledger</td>
                  </tr>
                ) : (
                  data?.map((item) => {
                  const requester = item.requester || item.creator;
                  const orgNode = item.organizationNode || item.fromNode;
                  const typeLabel = item.request_type || item.transfer_type || item.discharge_type || type;
                  const priority = item.priority || 'normal';

                  return (
                    <tr key={item.id} className="hover:bg-primary-50/30 transition-all cursor-default group">
                      <td className="px-6 py-5 align-middle">
                        <span className="text-xs font-bold text-primary-500 tracking-tighter">
                          {item.transfer_number || item.discharge_number || item.request_number || `#${item.id}`}
                        </span>
                      </td>
                      <td className="px-6 py-5 align-middle">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-800 leading-none">{requester?.first_name} {requester?.last_name}</span>
                          <span className="text-[10px] text-gray-400 font-bold  tracking-wider mt-1">{requester?.employee_id || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 align-middle">
                        <span className="text-sm text-gray-500 font-medium">{orgNode?.name || 'Institutional Domain'}</span>
                      </td>
                      <td className="px-6 py-5 align-middle">
                        {(() => {
                          const origin = item.resource_origin;
                          if (origin === 'transfer') {
                            if (item.toUser) {
                              return (
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-gray-800 leading-none">{item.toUser.first_name} {item.toUser.last_name}</span>
                                  <span className="text-[10px] text-gray-400 font-bold tracking-wider mt-1">{item.toUser.employee_id || 'N/A'}</span>
                                </div>
                              );
                            }
                            if (item.toNode) {
                              return <span className="text-sm text-gray-500 font-medium">{item.toNode.name}</span>;
                            }
                          }
                          if (origin === 'discharge') {
                            if (item.toUser) {
                              return (
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-gray-800 leading-none">{item.toUser.first_name} {item.toUser.last_name}</span>
                                  <span className="text-[10px] text-gray-400 font-bold  tracking-wider mt-1">{item.toUser.employee_id || 'N/A'}</span>
                                </div>
                              );
                            }
                            if (item.toNode) {
                              return <span className="text-sm text-gray-500 font-medium">{item.toNode.name}</span>;
                            }
                          }
                          if (origin === 'return') {
                            if (item.toNode) {
                              return <span className="text-sm text-gray-500 font-medium">{item.toNode.name}</span>;
                            }
                          }
                          // default / request
                          if (item.targetUser) {
                            return (
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-gray-800 leading-none">{item.targetUser.first_name} {item.targetUser.last_name}</span>
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">{item.targetUser.employee_id || 'N/A'}</span>
                              </div>
                            );
                          }
                          return <span className="text-xs text-gray-400 italic">N/A</span>;
                        })()}
                      </td>


                      <td className="px-6 py-5 align-middle text-center">
                        {getStatusBadge(item)}
                      </td>
                      <td className="px-6 py-5 align-middle text-center">
                        <span className="text-xs text-gray-400 ">{formatDate(item.created_at)}</span>
                      </td>
                      <td className="px-6 py-5 align-middle">
                        <div className="flex justify-end gap-2 pr-2">
                          <button
                            onClick={async () => {
                              try {
                                const endpoint = item.resource_origin === 'discharge' ? `/discharge/${item.id}` :
                                                 item.resource_origin === 'transfer' ? `/transfers/${item.id}` :
                                                 item.resource_origin === 'return' ? `/returns/${item.id}` :
                                                 `/requests/${item.id}`;
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

                          {canUserApprove(item) && (
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
                })
               )}
              </tbody>
            </table>
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
        title={`${approvalAction === 'approve' ? 'Authorize' : 'Reject'} Ledger Entry`}
      >
        <div className="space-y-6 p-2">
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Resource ID</p>
            <p className="font-black text-gray-800 tracking-tighter">
              {selectedRequest?.transfer_number || selectedRequest?.discharge_number || selectedRequest?.request_number || `#${selectedRequest?.id}`}
            </p>
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
            <Button
              variant="default"
              className="flex-1 py-4 rounded-2xl font-black uppercase text-[11px]"
              onClick={() => {
                setApprovalModalOpen(false);
                setComments('');
                setApprovalAction(null);
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
