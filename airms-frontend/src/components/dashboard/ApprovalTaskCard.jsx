import React from 'react';
import { Check, X, ArrowRight, User, MapPin } from 'lucide-react';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

const ApprovalTaskCard = ({ task, onAction }) => {
  const { id, request_number, requester, organizationNode, currentStep, priority, items } = task;
  
  // Format items summary
  const itemsSummary = items?.length > 0 
    ? `${items[0].product?.name || 'Requested Item'}${items.length > 1 ? ` + ${items.length - 1} more` : ''}`
    : 'No items specified';

  const priorityColors = {
    low: 'gray',
    medium: 'blue',
    high: 'amber',
    urgent: 'rose'
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
            <User size={18} />
          </div>
          <div>
            <div className="font-black text-slate-900 text-sm tracking-tight">
              {requester?.first_name} {requester?.last_name}
            </div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
              <MapPin size={10} />
              {organizationNode?.name}
            </div>
          </div>
        </div>
        <Badge variant={priorityColors[priority || 'medium']} className="uppercase text-[9px] px-2 py-0.5 font-black">
          {priority}
        </Badge>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
          <span>Request #</span>
          <span className="text-slate-900">{request_number || `REQ-${id}`}</span>
        </div>
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 group-hover:bg-blue-50/50 group-hover:border-blue-100 transition-colors">
          <div className="text-sm font-black text-slate-800 mb-1">{itemsSummary}</div>
          <div className="text-[10px] text-slate-500 font-medium">
            Waiting for: <span className="text-blue-600 font-black">{currentStep?.statusLabel?.name || 'Authorized Action'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onAction(id, 'reject')}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-all"
        >
          <X size={14} />
          Reject
        </button>
        <button
          onClick={() => onAction(id, 'approve')}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 shadow-lg shadow-slate-200 hover:shadow-blue-200 transition-all"
        >
          <Check size={14} />
          Approve
        </button>
      </div>
    </div>
  );
};

export default ApprovalTaskCard;
