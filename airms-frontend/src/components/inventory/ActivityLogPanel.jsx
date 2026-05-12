import React from 'react';
import { useFetch } from '../../hooks/useFetch';
import { X, History, Box, Activity, User as UserIcon, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

const ActivityLogPanel = ({ isOpen, onClose }) => {
  // We fetch when the panel is open
  const { data: logs, loading, refetch } = useFetch('/activity?limit=50', {
    // Only fetch if open, but useFetch might fetch on mount, so we handle it gracefully
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Sliding Panel */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-500 ease-in-out">
        {/* Header */}
        <div className="p-6 border-b-2 border-slate-50 flex items-center justify-between bg-slate-900">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                 <History className="text-blue-400" size={20} />
              </div>
              <div>
                 <h2 className="text-sm font-black tracking-widest uppercase text-white">System Activity</h2>
                 <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Global Infrastructure Log</p>
              </div>
           </div>
           <div className="flex items-center gap-2">
             <button 
               onClick={refetch}
               className="p-2 bg-slate-800 text-slate-400 rounded-xl hover:bg-slate-700 hover:text-white transition-colors"
               title="Refresh Logs"
             >
               <RefreshCw size={16} />
             </button>
             <button 
               onClick={onClose}
               className="p-2 bg-slate-800 text-slate-400 rounded-xl hover:bg-red-500 hover:text-white transition-colors"
             >
               <X size={16} />
             </button>
           </div>
        </div>

        {/* Content (Timeline) */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
           {loading ? (
             <div className="flex flex-col items-center justify-center h-full space-y-4">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compiling Records...</p>
             </div>
           ) : logs?.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                   <Activity className="text-slate-200" size={32} />
                </div>
                <div>
                   <p className="text-xs font-black text-slate-700 tracking-tight">No Recent Activity</p>
                   <p className="text-[10px] font-bold text-slate-400">Your infrastructure is currently dormant.</p>
                </div>
             </div>
           ) : (
             <div className="space-y-6">
                {logs?.map((log, index) => (
                  <div key={log.id} className="relative flex gap-4 group">
                     {/* Timeline Line */}
                     {index !== logs.length - 1 && (
                       <div className="absolute left-5 top-10 bottom-[-24px] w-0.5 bg-slate-200 group-hover:bg-blue-200 transition-colors" />
                     )}
                     
                     {/* Icon Node */}
                     <div className="relative z-10 w-10 h-10 bg-white border-2 border-slate-100 rounded-xl shadow-sm flex items-center justify-center flex-shrink-0 group-hover:border-blue-500 group-hover:text-blue-500 transition-colors text-slate-400">
                        <Box size={16} />
                     </div>

                     {/* Event Details */}
                     <div className="flex-1 pt-1 pb-4">
                        <div className="flex items-center justify-between mb-1">
                           <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                             {log.action}
                           </span>
                           <span className="text-[9px] font-bold text-slate-400">
                             {format(new Date(log.created_at), 'MMM dd, HH:mm')}
                           </span>
                        </div>
                        
                        <p className="text-xs font-medium text-slate-600 leading-relaxed mb-2">
                           {log.details?.reason ? `Reason: ${log.details.reason}` : `Resource: ${log.resource}`}
                           {log.details?.adjustment && (
                             <span className={`ml-2 font-black ${log.details.adjustment > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                               {log.details.adjustment > 0 ? '+' : ''}{log.details.adjustment} units
                             </span>
                           )}
                        </p>

                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-white w-fit px-2 py-1 rounded-md border border-slate-100 shadow-sm">
                           <UserIcon size={10} className="text-blue-500" />
                           {log.user?.first_name} {log.user?.last_name}
                        </div>
                     </div>
                  </div>
                ))}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default ActivityLogPanel;
