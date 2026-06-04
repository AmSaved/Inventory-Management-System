import React, { useState, useEffect } from 'react';
import { MessageSquare, Package, ChevronRight, RefreshCw } from 'lucide-react';
import dashboardService from '../services/dashboardService';
import requestService from '../services/requestService';
import api from '../services/api';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

// Get display name: real product OR category/subcategory from specifications
const getRequestName = (req) => {
  // If there's a real product attached, show it
  const productName = req.items?.[0]?.product?.name || req.product?.name;
  if (productName) return productName;

  // Otherwise, try building from specifications (category-based requests)
  const specs = req.items?.[0]?.specifications;
  if (specs && typeof specs === 'object') {
    const category = specs.category || '';
    const subCategory = specs.sub_category || '';
    if (category && subCategory) return `${category} - ${subCategory}`;
    if (category) return category;
  }

  return null;
};

// Format request type for display
const getRequestTypeLabel = (type) => {
  if (!type) return 'New Request';
  
  const typeMap = {
    'new': 'New Request',
    'transfer': 'Transfer',
    'return': 'Return',
    'issue': 'Issue Report',
    'procurement': 'Procurement',
    'discharge': 'Discharge',
  };
  
  const normalized = type.toLowerCase().replace(/_/g, ' ').trim();
  return typeMap[normalized] || normalized.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const MyActivityPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMyActivity();
  }, []);

  const fetchMyActivity = async () => {
    try {
      setLoading(true);
      const stats = await dashboardService.getUserStats();
      const actualStats = stats?.data || stats || {};
      setRequests(actualStats.my_requests || []);
    } catch (error) {
      console.error('Failed to fetch activity:', error);
      toast.error('Failed to load activity');
    } finally {
      setLoading(false);
    }
  };

  const handleFulfill = async (requestId, status) => {
    const loadingToast = toast.loading('Acknowledging Receipt...');
    try {
      setSubmitting(true);
      if (status === 'pending_acknowledgment') {
        await requestService.acknowledgeRequest(requestId);
      } else {
        await api.post(`/requests/${requestId}/fulfill`);
      }
      toast.success('Protocol Fulfilled', { id: loadingToast });
      fetchMyActivity();
    } catch (error) {
      console.error('Failed to update request:', error);
      toast.error('Fulfillment Error', { id: loadingToast });
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
            <MessageSquare size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">My Activity</h1>
            <p className="text-xs text-slate-500 mt-0.5">Lifecycle of your resource requests</p>
          </div>
        </div>
        <button
          onClick={() => { setLoading(true); fetchMyActivity(); }}
          disabled={loading || submitting}
          className="p-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-all disabled:opacity-50"
          title="Refresh Activity"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* CONTENT */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <LoadingSpinner />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <MessageSquare size={40} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 text-sm font-semibold">No Activity Yet</p>
          <p className="text-slate-400 text-xs mt-1">Your requests and transactions will appear here</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-3 text-xs font-semibold text-slate-500">Request</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500">Type</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500">Purpose</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500">Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {requests.map((req) => (
                <tr
                  key={req.id}
                  className="group hover:bg-blue-50/30 transition-colors"
                >
                  {/* REQUEST NAME */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
                        req.status === 'fulfilled'
                          ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white'
                          : 'bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white'
                      }`}>
                        <Package size={16} />
                      </div>
                      <div className="text-sm font-medium text-slate-900">
                        {getRequestName(req) || '—'}
                      </div>
                    </div>
                  </td>

                  {/* TYPE */}
                  <td className="px-6 py-4">
                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">
                      {getRequestTypeLabel(req.request_type)}
                    </span>
                  </td>

                  {/* PURPOSE */}
                  <td className="px-6 py-4 max-w-[220px]">
                    <p className="text-xs text-slate-500 font-medium truncate">
                      {req.reason || req.purpose || '—'}
                    </p>
                  </td>

                  {/* STATUS BADGE */}
                  <td className="px-6 py-4">
                    <Badge
                      variant={
                        req.status?.toLowerCase() === 'pending' || req.status?.toLowerCase().startsWith('pending')
                          ? 'yellow'
                          : req.status?.toLowerCase() === 'fulfilled'
                          ? 'success'
                          : req.status?.toLowerCase() === 'approved'
                          ? 'success'
                          : req.status?.toLowerCase() === 'rejected'
                          ? 'danger'
                          : 'gray'
                      }
                      className="px-2 py-0.5 text-[8px] font-black tracking-wider whitespace-nowrap"
                    >
                      {req.status?.toLowerCase() === 'fulfilled'
                        ? 'DEPLOYED'
                        : req.status?.toLowerCase() === 'pending' || (req.workflow_status && req.workflow_status.toLowerCase().startsWith('pending') && !req.workflow_status.toLowerCase().includes('acknowledgment'))
                        ? 'PENDING'
                        : (
                            (req.workflow_status
                              ? req.workflow_status.replace(/\s*\(.*?\)\s*/g, '').trim()
                              : '') ||
                            (req.status || 'Unknown').replace(/_/g, ' ')
                          )
                            .toUpperCase()
                            .substring(0, 16)}
                    </Badge>
                  </td>

                  {/* ACKNOWLEDGE BUTTON */}
                  <td className="px-6 py-4 text-right">
                    {(req.status?.toLowerCase() === 'approved' ||
                      req.status?.toLowerCase() === 'pending_acknowledgment') && (
                      <button
                        onClick={() => handleFulfill(req.id, req.status)}
                        disabled={submitting}
                        className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-lg shadow-sm transition-all"
                      >
                        {submitting
                          ? 'Processing...'
                          : req.status === 'pending_acknowledgment'
                          ? 'Acknowledge'
                          : 'Fulfill'}
                        <ChevronRight size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MyActivityPage;
