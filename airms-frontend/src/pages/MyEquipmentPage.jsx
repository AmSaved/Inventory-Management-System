import React, { useState, useEffect } from 'react';
import {
  Package,
  ArrowLeftRight,
  RotateCcw,
  AlertTriangle,
  AlertOctagon,
  Search,
  RefreshCw,
  User as UserIcon,
} from 'lucide-react';
import dashboardService from '../services/dashboardService';
import api from '../services/api';
import toast from 'react-hot-toast';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';

const MyEquipmentPage = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modal targets
  const [transferAsset, setTransferAsset] = useState(null);
  const [returnAsset, setReturnAsset] = useState(null);
  const [reportAsset, setReportAsset] = useState(null);

  // Transfer form state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [transferTarget, setTransferTarget] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // Return / Report form state
  const [returnCondition, setReturnCondition] = useState('good');
  const [reportDetails, setReportDetails] = useState('');

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      const res = await dashboardService.getUserStats();
      const actualStats = res?.data || res || {};
      setAssignments(actualStats.my_assignments || []);
    } catch (error) {
      console.error('Failed to fetch equipment:', error);
      toast.error('Failed to load equipment');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEquipment();
  }, []);

  // Debounced user search when transfer modal is open
  useEffect(() => {
    if (!transferAsset) return;
    const delay = setTimeout(() => {
      setLoadingUsers(true);
      api
        .get('/users', { params: { limit: 20, search: userSearchQuery } })
        .then((res) => setUsers(Array.isArray(res.data?.data) ? res.data.data : []))
        .finally(() => setLoadingUsers(false));
    }, 300);
    return () => clearTimeout(delay);
  }, [transferAsset, userSearchQuery]);

  const executeTransfer = async () => {
    if (!transferTarget || !transferReason) {
      return toast.error('Protocol incomplete: target & reason required');
    }
    setSubmitting(true);
    try {
      await api.post('/requests', {
        request_type: 'transfer',
        purpose: `Instant Handover: ${transferAsset?.product?.name}`,
        priority: 'medium',
        items: [
          {
            product_id: transferAsset.product_id,
            quantity_requested: 1,
            notes: `Target UID: ${transferTarget}`,
          },
        ],
        org_node_id: transferAsset.org_node_id,
        target_user_id: transferTarget,
        notes: JSON.stringify({
          assignment_id: transferAsset.id,
          justification: transferReason,
        }),
      });
      toast.success('Transfer request submitted');
      setTransferAsset(null);
      setTransferTarget('');
      setTransferReason('');
      setUserSearchQuery('');
      fetchEquipment();
    } catch {
      toast.error('Transfer protocol interrupted');
    } finally {
      setSubmitting(false);
    }
  };

  const executeReturn = async () => {
    setSubmitting(true);
    try {
      await api.post('/requests', {
        request_type: 'return',
        purpose: `Institutional Return: ${returnAsset?.product?.name}`,
        priority: 'medium',
        items: [
          {
            product_id: returnAsset.product_id,
            quantity_requested: 1,
            notes: `State: ${returnCondition}`,
          },
        ],
        org_node_id: returnAsset.org_node_id,
        notes: JSON.stringify({ assignment_id: returnAsset.id, condition: returnCondition }),
      });
      toast.success('Decommissioning logged');
      setReturnAsset(null);
      setReturnCondition('good');
      fetchEquipment();
    } catch {
      toast.error('Return request failed');
    } finally {
      setSubmitting(false);
    }
  };

  const executeReport = async () => {
    if (!reportDetails) return toast.error('Protocol incomplete: details required');
    setSubmitting(true);
    try {
      await api.post('/requests', {
        request_type: 'issue',
        purpose: `Incident Report: ${reportAsset?.product?.name}`,
        priority: 'high',
        items: [
          {
            product_id: reportAsset.product_id,
            quantity_requested: 1,
            notes: reportDetails,
          },
        ],
        org_node_id: reportAsset.org_node_id,
        notes: JSON.stringify({ assignment_id: reportAsset.id }),
      });
      toast.success('Incident protocol logged');
      setReportAsset(null);
      setReportDetails('');
      fetchEquipment();
    } catch {
      toast.error('Report failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 py-2">
      {/* HEADER */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <Package size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">My Equipment</h1>
            <p className="text-sm text-slate-500 mt-1">Physical assets currently in your custody</p>
          </div>
        </div>
        <button
          onClick={() => { setLoading(true); fetchEquipment(); }}
          disabled={loading}
          className="p-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-all disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* CONTENT */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <LoadingSpinner />
        </div>
      ) : assignments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <Package size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 text-lg font-semibold">No Equipment Assigned</p>
          <p className="text-slate-400 text-sm mt-1">Assets assigned to you will appear here</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-3 text-xs font-semibold text-slate-500">Asset Detail</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500">Serial</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500">State</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500">Custody Date</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {assignments.map((asset) => (
                <tr key={asset.id} className="group hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-slate-950 group-hover:text-blue-400 transition-all">
                        <Package size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-900">{asset.product?.name}</div>
                        <div className="text-[9px] font-bold text-blue-500 uppercase tracking-wider mt-0.5">
                          {asset.product?.brand || 'ASSET'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[10px] font-bold text-slate-900 uppercase tracking-tight">
                      {asset.serial_number || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                        asset.condition === 'new'
                          ? 'bg-emerald-50 text-emerald-600'
                          : asset.condition === 'good'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {asset.condition || 'STANDARD'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {new Date(asset.assigned_at || asset.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setTransferAsset(asset)}
                        title="Initiate Transfer"
                        className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg hover:bg-slate-950 hover:text-blue-400 transition-all"
                      >
                        <ArrowLeftRight size={14} />
                      </button>
                      <button
                        onClick={() => setReturnAsset(asset)}
                        title="Return to Store"
                        className="w-8 h-8 flex items-center justify-center bg-teal-50 text-teal-600 rounded-lg hover:bg-slate-950 hover:text-teal-400 transition-all"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        onClick={() => setReportAsset(asset)}
                        title="Report Issue"
                        className="w-8 h-8 flex items-center justify-center bg-rose-50 text-rose-600 rounded-lg hover:bg-slate-950 hover:text-rose-400 transition-all"
                      >
                        <AlertTriangle size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TRANSFER MODAL */}
      <Modal
        isOpen={!!transferAsset}
        onClose={() => { setTransferAsset(null); setTransferTarget(''); setTransferReason(''); setUserSearchQuery(''); }}
        title="HANDOVER PROTOCOL"
        onConfirm={executeTransfer}
        confirmText="COMMIT TRANSFER"
        loading={submitting}
      >
        <div className="space-y-8 p-2">
          <div className="bg-slate-50 p-8 rounded-[2.5rem] flex items-center gap-8">
            <div className="w-20 h-20 bg-slate-950 rounded-[28px] flex items-center justify-center text-blue-400">
              <Package size={32} />
            </div>
            <div>
              <h4 className="text-2xl font-black text-slate-900 uppercase italic">
                {transferAsset?.product?.name}
              </h4>
              <div className="text-[9px] font-black text-slate-400 mt-2 uppercase tracking-widest">
                SN: {transferAsset?.serial_number || 'N/A'}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">
              <UserIcon size={12} /> Target Custodian
            </label>
            <div className="relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search by name or ID..."
                className="w-full h-14 bg-slate-100 border-2 border-transparent focus:border-blue-500 rounded-3xl pl-14 pr-6 font-bold text-sm transition-all outline-none"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 font-black text-xs uppercase focus:border-blue-500 outline-none transition-all"
              value={transferTarget}
              onChange={(e) => setTransferTarget(e.target.value)}
            >
              <option value="">{loadingUsers ? 'Searching...' : '-- Select Target --'}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name} ({u.employee_id})
                </option>
              ))}
            </select>
            {users.length === 0 && !loadingUsers && userSearchQuery && (
              <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest ml-4 italic">
                No matching personnel found
              </p>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">
              Reason
            </label>
            <textarea
              className="w-full h-28 bg-slate-50 border-none rounded-3xl p-6 font-bold text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Reason for transfer..."
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* RETURN MODAL */}
      <Modal
        isOpen={!!returnAsset}
        onClose={() => { setReturnAsset(null); setReturnCondition('good'); }}
        title="DECOMMISSIONING"
        onConfirm={executeReturn}
        confirmText="FINALIZE RETURN"
        loading={submitting}
      >
        <div className="space-y-8 p-2">
          <div className="bg-teal-50 p-8 rounded-[2.5rem] flex flex-col items-center text-center">
            <RotateCcw size={48} className="text-teal-600 mb-4" />
            <h4 className="text-2xl font-black text-slate-900 uppercase italic">Return Entry</h4>
            <p className="text-slate-400 text-xs font-medium max-w-xs mt-2">
              Relinquishing custody of <strong>{returnAsset?.product?.name}</strong>
            </p>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">
              Condition Grading
            </label>
            <select
              className="w-full h-14 bg-slate-50 border-none rounded-3xl px-6 font-black text-xs uppercase"
              value={returnCondition}
              onChange={(e) => setReturnCondition(e.target.value)}
            >
              <option value="good">OPTIMAL</option>
              <option value="used">STANDARD</option>
              <option value="damaged">CRITICAL</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* REPORT MODAL */}
      <Modal
        isOpen={!!reportAsset}
        onClose={() => { setReportAsset(null); setReportDetails(''); }}
        title="INCIDENT REPORT"
        onConfirm={executeReport}
        confirmText="LOG INCIDENT"
        loading={submitting}
      >
        <div className="space-y-8 p-2">
          <div className="bg-rose-50 p-8 rounded-[2.5rem] flex flex-col items-center text-center">
            <AlertOctagon size={48} className="text-rose-600 mb-4" />
            <h4 className="text-2xl font-black text-slate-900 uppercase italic">Incident Protocol</h4>
            <p className="text-slate-400 text-xs font-medium max-w-xs mt-2">
              Reporting issue for <strong>{reportAsset?.product?.name}</strong>
            </p>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">
              Incident Details
            </label>
            <textarea
              className="w-full h-36 bg-rose-50/30 border-none rounded-3xl p-6 font-bold text-sm resize-none outline-none focus:ring-2 focus:ring-rose-500"
              placeholder="Telemetry details..."
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MyEquipmentPage;
