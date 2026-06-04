import React, { useState } from 'react';
import QRCode from 'react-qr-code';
import Card, { CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/common/Modal';
import { useFetch } from '../hooks/useFetch';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye,
  RotateCcw,
  Package,
  Building2,
  ArrowRight,
  CheckCircle2,
  XCircle,
  ClipboardList,
  User as UserIcon,
  Calendar,
  FileText,
  Layers,
  Clock,
  Activity,
} from 'lucide-react';

const ReturnsPage = () => {
  const { user } = useAuth();
  const { data: returns, refetch: refresh } = useFetch('/returns', { params: { limit: 500, page: 1 } });
  const [activeTab, setActiveTab] = useState('request');

  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [notes, setNotes] = useState('');
  const { data: myAssignments } = useFetch('/assignments/my-assignments');

  // Detail view modal state
  const [viewingReturn, setViewingReturn] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [qrModalItem, setQrModalItem] = useState(null);

  const handleViewDetail = async (id) => {
    setLoadingDetail(true);
    try {
      const res = await api.get(`/returns/${id}`);
      setViewingReturn(res.data.data);
      setViewModalOpen(true);
    } catch (e) {
      toast.error('Could not load return details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleApplyReturn = async () => {
    try {
      await api.post('/returns', {
        assignment_id: selectedAssignment.id,
        notes
      });
      toast.success('Return request submitted');
      setShowApplyModal(false);
      refresh();
    } catch (error) {
      toast.error('Failed to submit return request');
    }
  };

  const handleApproval = async (id, action) => {
    try {
      if (action === 'approve') {
        await api.post(`/returns/${id}/process`, { notes: 'Approved' });
        toast.success('Return approved');
      } else {
        await api.post(`/returns/${id}/reject`, { reason: 'Rejected' });
        toast.success('Return rejected');
      }
      refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to process approval');
    }
  };

  const handleAcknowledge = async (id) => {
    try {
      await api.post(`/returns/${id}/acknowledge`, {});
      toast.success('Receipt acknowledged and inventory restocked');
      refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to acknowledge return receipt');
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      pending: { label: 'Pending Approval', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
      pending_acknowledgment: { label: 'Pending Acknowledgment', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
      completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
      rejected: { label: 'Rejected', cls: 'bg-rose-50 text-rose-700 border border-rose-200' },
      cancelled: { label: 'Cancelled', cls: 'bg-slate-50 text-slate-500 border border-slate-200' },
    };
    const s = map[status] || { label: status, cls: 'bg-slate-50 text-slate-600 border border-slate-200' };
    return <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${s.cls}`}>{s.label}</span>;
  };

  const getItemDisplayName = (item) => {
    const specs = typeof item?.specifications === 'string' ? (() => { try { return JSON.parse(item.specifications); } catch { return {}; } })() : (item?.specifications || {});
    const candidateKeys = ['item_name', 'item name', 'name', 'product_name', 'product name', 'asset_name', 'asset name', 'title', 'label'];
    for (const key of candidateKeys) {
      if (specs?.[key]) return String(specs[key]);
      const matchedKey = Object.keys(specs || {}).find(existing => existing.toLowerCase() === key.toLowerCase());
      if (matchedKey && specs[matchedKey]) return String(specs[matchedKey]);
    }
    return item?.name || item?.item_name || item?.product?.name || item?.product_name || specs?.name || 'Item';
  };

  // useFetch sets data = response.data.data, so returns IS already the array
  const returnsList = Array.isArray(returns) ? returns : (returns?.data || returns || []);
  // myAssignments is also unwrapped by useFetch
  const activeAssignments = Array.isArray(myAssignments)
    ? myAssignments.filter(a => a.status === 'active')
    : (myAssignments?.data?.filter(a => a.status === 'active') || []);

  return (
    <div className="max-w-[1200px] mx-auto space-y-4 pt-2 pb-4 px-4 md:px-6">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
            <RotateCcw className="text-white" size={18} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Returns Management</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/50">
          <button
            onClick={() => setActiveTab('request')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === 'request' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Request Return
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Return History ({returnsList.length})
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* ══════════════════════════════════════════
            TAB 1 — REQUEST RETURN FORM
        ══════════════════════════════════════════ */}
        {activeTab === 'request' && (
          <motion.div
            key="request-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-5"
          >
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/70 p-6 space-y-6">

              {/* Info panel */}
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
                <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <RotateCcw className="text-blue-600" size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">Return to Source Branch</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Select an active assignment from your inventory to request a return. The item will be routed back to your source branch for acknowledgement.
                  </p>
                </div>
              </div>

              {/* Form */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
                    Select Asset to Return
                  </label>
                  <select
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:border-blue-400 focus:bg-white transition-all text-sm"
                    onChange={(e) => setSelectedAssignment(activeAssignments.find(a => a.id === parseInt(e.target.value)))}
                    defaultValue=""
                  >
                    <option value="">— Select an active assignment —</option>
                    {activeAssignments.map(a => (
                      <option key={a.id} value={a.id}>{a.product?.name} ({a.serial_number})</option>
                    ))}
                  </select>
                  {activeAssignments.length === 0 && (
                    <p className="text-[10px] text-slate-400 italic ml-1">No active assignments found for your account.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
                    Reason / Notes
                  </label>
                  <textarea
                    className="w-full border border-slate-200 rounded-xl p-3.5 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:border-orange-400 transition-all resize-none h-24"
                    placeholder="Provide a reason for the return..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={handleApplyReturn}
                  disabled={!selectedAssignment}
                  className="px-6 h-10 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-md shadow-blue-100"
                >
                  <RotateCcw size={13} /> Submit Return Request
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════
            TAB 2 — RETURN HISTORY
        ══════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <motion.div
            key="history-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
          >
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-green-600 text-white">
                    <th className="p-4 text-sm font-bold">Requested By</th>
                    <th className="p-4 text-sm font-bold">From</th>
                    <th className="p-4 text-sm font-bold">To</th>
                    <th className="p-4 text-sm font-bold">Date</th>
                    <th className="p-4 text-sm font-bold">Status</th>
                    <th className="p-4 text-sm font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returnsList.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-12 text-center text-slate-400 text-sm">No return records found.</td>
                    </tr>
                  ) : (
                    returnsList.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 text-sm font-medium text-slate-900">
                          {r.user?.first_name} {r.user?.last_name}
                        </td>
                        <td className="p-4 text-sm text-slate-600">
                          {r.fromNode?.name || `Branch ${r.from_node_id}`}
                        </td>
                        <td className="p-4 text-sm text-slate-600">
                          {r.toNode?.name || `Branch ${r.to_node_id}`}
                        </td>
                        <td className="p-4 text-sm text-slate-500">
                          {new Date(r.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="p-4">
                          {getStatusBadge(r.status)}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Approve / Reject */}
                            {r.status === 'pending' && r.can_action && (
                              <>
                                <button
                                  onClick={() => handleApproval(r.id, 'approve')}
                                  className="flex items-center gap-1 px-3 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-all"
                                >
                                  <CheckCircle2 size={12} /> Approve
                                </button>
                                <button
                                  onClick={() => handleApproval(r.id, 'reject')}
                                  className="flex items-center gap-1 px-3 h-8 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs transition-all"
                                >
                                  <XCircle size={12} /> Reject
                                </button>
                              </>
                            )}
                            {/* Awaiting Turn */}
                            {r.status === 'pending' && !r.can_action && (
                              <span className="text-xs text-slate-400 italic">Awaiting Turn</span>
                            )}
                            {/* Acknowledge Receipt */}
                            {r.status === 'pending_acknowledgment' && r.can_acknowledge && (
                              <button
                                  onClick={() => handleAcknowledge(r.id)}
                                  className="flex items-center gap-1 px-3 h-8 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold text-xs transition-all animate-pulse"
                              >
                                <CheckCircle2 size={12} /> Acknowledge
                              </button>
                            )}
                            {/* Pending Acknowledgment label (no button) */}
                            {r.status === 'pending_acknowledgment' && !r.can_acknowledge && (
                              <span className="text-xs text-blue-500 italic">Pending Acknowledgment</span>
                            )}
                            <button
                              onClick={() => handleViewDetail(r.id)}
                              disabled={loadingDetail}
                              className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ───── Detail View Modal ───── */}
      <Modal
        isOpen={viewModalOpen}
        onClose={() => { setViewModalOpen(false); setViewingReturn(null); }}
        title=""
        size="lg"
        showFooter={false}
      >
        {viewingReturn && (
          <div className="space-y-0">
            {/* Modal Header */}
            <div className="flex items-start gap-4 pb-5 border-b border-slate-100">
              <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                <RotateCcw className="text-orange-400" size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Return Record</p>
                <h2 className="text-lg font-black text-slate-900 tracking-tight mt-0.5 capitalize">
                  {viewingReturn.return_type ? `${viewingReturn.return_type} Return` : 'Inventory Return'}
                </h2>
                <div className="mt-1">{getStatusBadge(viewingReturn.status)}</div>
              </div>
              {viewingReturn.return_type && (
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide flex-shrink-0 ${viewingReturn.return_type === 'inventory' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
                  {viewingReturn.return_type} Return
                </span>
              )}
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3 py-5 border-b border-slate-100">
              <div className="p-3.5 bg-slate-50 rounded-xl">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1.5">
                  <UserIcon size={10} /> Requested By
                </p>
                <p className="text-sm font-bold text-slate-800">
                  {viewingReturn.user?.first_name} {viewingReturn.user?.last_name}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1.5">
                  <Calendar size={10} /> Date Submitted
                </p>
                <p className="text-sm font-bold text-slate-800">
                  {new Date(viewingReturn.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>

              <div className="p-3.5 bg-orange-50 rounded-xl border border-orange-100">
                <p className="text-[9px] font-bold text-orange-400 uppercase tracking-widest flex items-center gap-1 mb-1.5">
                  <Building2 size={10} /> From Branch
                </p>
                <p className="text-sm font-bold text-orange-700">
                  {viewingReturn.fromNode?.name || `Branch ${viewingReturn.from_node_id}`}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1.5">
                  <ArrowRight size={10} /> To Branch (Source)
                </p>
                <p className="text-sm font-bold text-slate-800">
                  {viewingReturn.toNode?.name || `Branch ${viewingReturn.to_node_id}`}
                </p>
              </div>

              {viewingReturn.workflow_status && (
                <div className="col-span-2 p-3.5 bg-slate-50 rounded-xl">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1.5">
                    <Layers size={10} /> Workflow Status
                  </p>
                  <p className="text-sm font-semibold text-slate-700">{viewingReturn.workflow_status}</p>
                </div>
              )}

              {viewingReturn.notes && (
                <div className="col-span-2 p-3.5 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1 mb-1.5">
                    <FileText size={10} /> Notes / Justification
                  </p>
                  <p className="text-sm text-blue-800 italic">"{viewingReturn.notes}"</p>
                </div>
              )}
            </div>

            {/* Items List */}
            <div className="pt-5">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-4 flex items-center gap-2">
                <Package size={12} className="text-slate-400" />
                Returned Items ({viewingReturn.items?.length || 0})
              </h3>

              {(!viewingReturn.items || viewingReturn.items.length === 0) ? (
                <div className="p-8 bg-slate-50 rounded-2xl text-center">
                  <Package className="text-slate-300 mx-auto mb-2" size={28} />
                  <p className="text-xs text-slate-400 font-medium">No items listed for this return</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left bg-white">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Item Name</th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">ID / Serial (QR)</th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Current Branch</th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Custody Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewingReturn.items.map((item, idx) => {
                          const name = getItemDisplayName(item) || `Item #${item.product_id || item.id}`;
                          const category = item.product?.category || 'General';
                          const sn = item.serial_number || `REG-ID-${item.id}`;
                          const currentBranch = viewingReturn.fromNode?.name || 'Central Office';
                          const assignedTo = viewingReturn.user
                            ? `Assigned to "${viewingReturn.user.first_name} ${viewingReturn.user.last_name}"`
                            : 'In Branch Storage';

                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3.5 align-middle">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-900 text-sm">{name}</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                    Category: {category}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 align-middle">
                                <div className="flex items-center gap-2">
                                  <div
                                    onClick={() => setQrModalItem({
                                      id: item.id,
                                      serial_number: sn,
                                      name: getItemDisplayName(item),
                                      product: { ...(item.product || {}), name: getItemDisplayName(item), sku: item.product?.sku || 'N/A' }
                                    })}
                                    className="p-1 bg-white border border-slate-200 rounded shadow-sm hover:border-slate-400 hover:scale-105 transition-all cursor-pointer shrink-0"
                                    title="Click to view QR label"
                                  >
                                    <QRCode value={JSON.stringify({ id: item.id, name: getItemDisplayName(item), sku: item.product?.sku || 'N/A', serial: sn })} size={20} level="H" />
                                  </div>
                                  <span className="font-mono text-xs font-bold text-slate-800 bg-slate-50 px-2 py-0.5 border border-slate-200 rounded shadow-sm">
                                    {sn}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 align-middle">
                                <span className="bg-slate-100 text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
                                  {currentBranch}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 align-middle">
                                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
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
              )}
            </div>

            {/* Close Button */}
            <div className="pt-5 flex justify-end">
              <button
                onClick={() => { setViewModalOpen(false); setViewingReturn(null); }}
                className="px-6 h-9 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* QR Identity Tag Modal */}
      {qrModalItem && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setQrModalItem(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="p-4 text-center bg-slate-50 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Asset Identity Tag</h3>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">{qrModalItem.name || qrModalItem.product?.name || 'Item'}</p>
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
              <button onClick={() => setQrModalItem(null)} className="flex-1 h-9 bg-slate-100 border border-slate-200 text-slate-600 font-semibold rounded-lg text-xs hover:bg-slate-200 transition-all">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnsPage;
