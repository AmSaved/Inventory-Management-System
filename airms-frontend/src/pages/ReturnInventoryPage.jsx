import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card, { CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/common/Modal';
import QRCode from 'react-qr-code';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw,
  Package,
  ShieldCheck,
  ArrowRight,
  Building2,
  History,
  Info,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Clock,
  User as UserIcon,
  XCircle,
  ClipboardList,
  Calendar,
  FileText,
  Layers,
  Eye,
} from 'lucide-react';

const ReturnInventoryPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('request');

  // ── Request Return state ──
  const [dischargeHistory, setDischargeHistory] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [targetQty, setTargetQty] = useState(0);

  // ── Details view state ──
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

  // ── Return History state ──
  // Fetch with high limit so all sub-branch returns across the hierarchy are included
  const { data: returnsData, refetch: refreshReturns } = useFetch('/returns', {
    params: { limit: 500, page: 1 }
  });
  // The backend returns { data: [...], pagination: {...} } — useFetch sets data = response.data.data
  // So returnsData is already the array (or object with .data)
  const returnsList = Array.isArray(returnsData) ? returnsData : (returnsData?.data || returnsData || []);

  useEffect(() => {
    fetchDischargeHistory();
  }, []);

  const fetchDischargeHistory = async () => {
    try {
      const res = await api.get(`/returns/history/discharge?node_id=${user?.org_node_id}`);
      setDischargeHistory(res.data.data || []);
    } catch (error) {
      toast.error('Could not load discharge history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSelectForm = (form) => {
    setSelectedForm(form);
    setTargetQty(0);
    const expandedItems = [];
    form.items.forEach((item, itemIndex) => {
      const qty = Number(item.quantity || 1);
      const sns = item.serial_numbers || [];
      for (let i = 0; i < qty; i++) {
        expandedItems.push({
          uid: `${item.id || itemIndex}-${i}`,
          product: item.product,
          serial_number: sns[i] || null,
          product_id: item.product_id,
          selected: false,
        });
      }
    });
    setReturnItems(expandedItems);
  };

  const handleSubmitReturn = async (e) => {
    e.preventDefault();
    const selectedItems = returnItems.filter(item => item.selected);
    if (selectedItems.length === 0) return toast.error('Select at least one item to return');

    const grouped = {};
    selectedItems.forEach(item => {
      if (!grouped[item.product_id]) grouped[item.product_id] = { product_id: item.product_id, quantity: 0, condition: 'good' };
      grouped[item.product_id].quantity += 1;
    });

    setSubmitting(true);
    try {
      await api.post('/returns/inventory', {
        from_node_id: user.org_node_id,
        to_node_id: selectedForm.from_node_id,
        request_id: selectedForm.request_id,
        notes,
        items: Object.values(grouped),
      });
      toast.success('Return request submitted successfully');
      setSelectedForm(null);
      setReturnItems([]);
      setNotes('');
      setTargetQty(0);
      refreshReturns();
      setActiveTab('history');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit return');
    } finally {
      setSubmitting(false);
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
      refreshReturns();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to process');
    }
  };

  const handleAcknowledge = async (id) => {
    try {
      await api.post(`/returns/${id}/acknowledge`, {});
      toast.success('Receipt acknowledged — inventory restocked');
      refreshReturns();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to acknowledge');
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

  return (
    <div className="max-w-[1200px] mx-auto space-y-4 pt-2 pb-4 px-4 md:px-6">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100">
            <RotateCcw className="text-white" size={18} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight uppercase italic">Return Inventories</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/50">
          <button
            onClick={() => setActiveTab('request')}
            className={`px-4 py-2 rounded-lg font-bold text-xs uppercase transition-all ${activeTab === 'request' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Request Return
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg font-bold text-xs uppercase transition-all ${activeTab === 'history' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Return History ({returnsList.length})
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* ══════════════════════════════════════════
            TAB 1 — REQUEST RETURN (original form)
        ══════════════════════════════════════════ */}
        {activeTab === 'request' && (
          <motion.div
            key="request-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
          >
            {loadingHistory ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin text-emerald-500"><RotateCcw size={28} /></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                {/* Left: Discharge History Explorer */}
                <div className="xl:col-span-4 space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <History className="text-emerald-600" size={14} />
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Discharge History</h3>
                  </div>

                  <div className="space-y-2">
                    {dischargeHistory.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <ClipboardList className="text-slate-300 mx-auto mb-2" size={28} />
                        <p className="text-xs font-medium text-slate-400">No discharge records found for this branch</p>
                      </div>
                    ) : (
                      dischargeHistory.map(form => (
                        <div
                          key={form.id}
                          onClick={() => handleSelectForm(form)}
                          className={`p-3.5 rounded-xl transition-all cursor-pointer border ${
                            selectedForm?.id === form.id
                              ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                              : 'bg-white border-slate-200 hover:border-emerald-400 shadow-sm'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                              selectedForm?.id === form.id ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {form.form_number}
                            </span>
                            <span className={`text-xs ${selectedForm?.id === form.id ? 'text-slate-300' : 'text-slate-400'}`}>
                              {new Date(form.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className={`font-bold text-sm tracking-tight ${selectedForm?.id === form.id ? 'text-white' : 'text-slate-900'}`}>
                            {form.items?.length} Resource Classes
                          </div>
                          <div className={`text-xs mt-1 font-medium ${selectedForm?.id === form.id ? 'text-slate-300' : 'text-slate-500'}`}>
                            Source: {form.fromNode?.name || `Branch ${form.from_node_id}`}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right: Resource Reconciliation */}
                <div className="xl:col-span-8">
                  {selectedForm ? (
                    <form onSubmit={handleSubmitReturn} className="space-y-5">
                      <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white p-6 space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                          <div className="flex items-center gap-2">
                            <Package className="text-emerald-600" size={16} />
                            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Resource Reconciliation</h3>
                          </div>
                          <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                            {selectedForm.form_number}
                          </div>
                        </div>

                        {/* Target Quantity */}
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
                          <div>
                            <label className="text-xs font-semibold text-slate-500 block">Target Return Quantity</label>
                            <div className="text-xs text-slate-400 mt-0.5">Enter the number of items you plan to return</div>
                          </div>
                          <input
                            type="number"
                            min="0"
                            className="w-24 h-10 bg-white border border-slate-200 rounded-xl px-3 font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all text-center"
                            value={targetQty}
                            onChange={(e) => setTargetQty(parseInt(e.target.value) || 0)}
                          />
                        </div>

                        {/* Item Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {returnItems.map((item, index) => (
                            <div
                              key={item.uid}
                              onClick={() => {
                                const currentSelected = returnItems.filter(it => it.selected).length;
                                if (!item.selected && currentSelected >= targetQty) {
                                  return toast.error(`Limit reached: max ${targetQty} items`);
                                }
                                setReturnItems(prev => prev.map((it, i) =>
                                  i === index ? { ...it, selected: !it.selected } : it
                                ));
                              }}
                              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                                item.selected
                                  ? 'bg-emerald-50 border-emerald-400 shadow-sm'
                                  : 'bg-white border-slate-200 hover:border-emerald-200'
                              }`}
                            >
                              <div>
                                <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                                  {item.serial_number ? 'Serial Number' : 'Unique ID'}
                                </div>
                                <div className="text-sm font-bold text-slate-900 tracking-tight mt-0.5">
                                  {item.serial_number || item.uid}
                                </div>
                                <div className="mt-1 text-xs font-medium text-slate-500">
                                  {item.product?.name} — [{item.product?.sku}]
                                </div>
                              </div>
                              <div className="mt-3 flex justify-end">
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                  item.selected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'
                                }`}>
                                  {item.selected && <CheckCircle2 size={12} />}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 ml-1">
                            <Info className="text-emerald-600" size={13} />
                            <label className="text-xs font-semibold text-slate-500">Operational Justification</label>
                          </div>
                          <textarea
                            className="w-full h-20 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700 outline-none focus:bg-white focus:border-emerald-500 transition-all resize-none"
                            placeholder="State the reason for returning these items..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            required
                          />
                        </div>

                        {/* Submit */}
                        <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                          <div className="flex items-start gap-3 max-w-md">
                            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                              <ShieldCheck className="text-emerald-600" size={15} />
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              By initiating this protocol, you confirm items are ready for transport to the <span className="font-semibold text-slate-700">Source Branch</span>.
                            </p>
                          </div>
                          <Button
                            type="submit"
                            disabled={submitting}
                            className="w-full md:w-auto px-6 bg-slate-900 h-10 rounded-xl hover:bg-emerald-600 text-white font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 group shadow-md"
                          >
                            {submitting ? 'Submitting...' : 'Initiate Return'}
                            <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                          </Button>
                        </div>
                      </Card>
                    </form>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-16 bg-slate-50/60 rounded-2xl border-2 border-dashed border-slate-200 text-center min-h-[300px]">
                      <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-sm mb-5 rotate-6">
                        <AlertTriangle className="text-slate-300" size={30} />
                      </div>
                      <h2 className="text-base font-black text-slate-400 tracking-tight">Selection Required</h2>
                      <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
                        Select a discharge record from the history panel on the left to begin the return reconciliation process.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
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
                    <th className="p-4 text-sm font-bold">From</th>
                    <th className="p-4 text-sm font-bold">To</th>
                    <th className="p-4 text-sm font-bold">Role</th>
                    <th className="p-4 text-sm font-bold">Status</th>
                    <th className="p-4 text-sm font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returnsList.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-12 text-center text-slate-400 text-sm">No return records found.</td>
                    </tr>
                  ) : (
                    returnsList.map((r) => {
                      const fromName = r.fromNode?.name || (r.user ? `${r.user.first_name} ${r.user.last_name}` : `Branch ${r.from_node_id}`);
                      const toName = r.toNode?.name || `Branch ${r.to_node_id}`;
                      const isTargetBranch = r.to_node_id && user?.org_node_id &&
                        Number(r.to_node_id) === Number(user.org_node_id);

                      return (
                        <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 text-sm font-medium text-slate-900">{fromName}</td>
                          <td className="p-4 text-sm text-slate-600">{toName}</td>
                          <td className="p-4 text-sm text-slate-600">
                            {r.to_node_id && user?.org_node_id && (
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                isTargetBranch
                                  ? 'bg-purple-50 text-purple-600 border-purple-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}>
                                {isTargetBranch ? '↓ Receiving' : '↑ Dispatching'}
                              </span>
                            )}
                          </td>
                          <td className="p-4">{getStatusBadge(r.status)}</td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Approve / Reject */}
                              {r.status === 'pending' && r.can_action && (
                                <>
                                  <button
                                    onClick={() => handleApproval(r.id, 'approve')}
                                    className="flex items-center gap-1.5 px-3 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs transition-all shadow-sm"
                                  >
                                    <CheckCircle2 size={13} /> Approve
                                  </button>
                                  <button
                                    onClick={() => handleApproval(r.id, 'reject')}
                                    className="flex items-center gap-1.5 px-3 h-8 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-xs transition-all shadow-sm"
                                  >
                                    <XCircle size={13} /> Reject
                                  </button>
                                </>
                              )}

                              {/* Awaiting Turn */}
                              {r.status === 'pending' && !r.can_action && (
                                <span className="text-xs text-slate-400 italic">
                                  Awaiting Turn
                                </span>
                              )}

                              {/* Acknowledge Receipt */}
                              {r.status === 'pending_acknowledgment' && r.can_acknowledge && (
                                <button
                                  onClick={() => handleAcknowledge(r.id)}
                                  className="flex items-center gap-1.5 px-3 h-8 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-semibold text-xs transition-all shadow-sm animate-pulse"
                                >
                                  <CheckCircle2 size={13} /> Acknowledge
                                </button>
                              )}

                              {/* Pending acknowledgment — no button */}
                              {r.status === 'pending_acknowledgment' && !r.can_acknowledge && (
                                <span className="text-xs text-blue-500 italic">
                                  Pending Acknowledgment
                                </span>
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
                      );
                    })
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
                                  <span className="font-mono text-xs font-bold text-slate-800 bg-slate-50 px-2.5 py-0.5 border border-slate-200 rounded shadow-sm">
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

export default ReturnInventoryPage;
