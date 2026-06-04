import React from 'react';
import { MessageSquare, Package } from 'lucide-react';
import Badge from '../ui/Badge';

const MyActivitySidebar = ({ requests = [], onFulfill }) => {
  return (
    <div className="space-y-6 lg:sticky lg:top-24 lg:h-fit">
      {/* HEADER */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500">
          <MessageSquare size={18} />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tight">My Activity</h3>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Lifecycle of your Resource Requests</p>
        </div>
      </div>

      {/* ACTIVITY STREAM */}
      <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
        {requests.map((req) => (
          <div key={req.id} className="group flex flex-col p-4 bg-white rounded-xl border border-slate-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-sm transition-all duration-500 shrink-0 ${req.status === 'fulfilled' ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white'}`}>
                <Package size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 tracking-tight text-sm mb-1 truncate">
                  {req.items?.[0]?.product?.name || req.product?.name || 'System Request'}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[8px] font-black text-blue-500 uppercase tracking-wider">{req.request_type ? `${req.request_type.replace(/_/g, ' ')}` : 'Request'}</span>
                  <span className="w-0.5 h-0.5 bg-slate-200 rounded-full"></span>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate max-w-[150px]">{req.reason || req.purpose || 'No description'}</p>
                </div>
              </div>
            </div>

            {/* STATUS AND ACTIONS */}
            <div className="flex items-center justify-between mt-3 gap-2">
              <Badge
                variant={
                  req.status?.toLowerCase() === 'pending' || req.status?.toLowerCase().startsWith('pending') ? 'yellow'
                    : req.status?.toLowerCase() === 'fulfilled' ? 'success'
                      : req.status?.toLowerCase() === 'approved' ? 'success'
                        : req.status?.toLowerCase() === 'rejected' ? 'danger'
                          : 'gray'
                }
                className="px-2 py-0.5 text-[8px] font-black tracking-wider whitespace-nowrap"
              >
                {req.status?.toLowerCase() === 'fulfilled' ? 'DEPLOYED'
                  : req.status?.toLowerCase() === 'pending' || (req.workflow_status && req.workflow_status.toLowerCase().startsWith('pending') && !req.workflow_status.toLowerCase().includes('acknowledgment')) ? 'PENDING'
                  : ((req.workflow_status ? req.workflow_status.replace(/\s*\(.*?\)\s*/g, '').trim() : '') || (req.status || 'Unknown').replace('_', ' ')).toUpperCase().substring(0, 12)}
              </Badge>
              {(req.status?.toLowerCase() === 'approved' || req.status?.toLowerCase() === 'pending_acknowledgment') && (
                <button
                  onClick={() => onFulfill && onFulfill(req.id, req.status)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg shadow-md transition-all whitespace-nowrap"
                >
                  Acknowledge
                </button>
              )}
            </div>
          </div>
        ))}
        {requests.length === 0 && (
          <div className="text-slate-400 italic text-xs text-center py-8">
            No recent activity detected.
          </div>
        )}
      </div>
    </div>
  );
};

export default MyActivitySidebar;
