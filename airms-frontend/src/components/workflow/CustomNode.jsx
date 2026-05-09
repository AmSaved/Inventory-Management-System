import React from 'react';
import { Handle, Position } from '@xyflow/react';

const CustomNode = ({ id, data, isConnectable }) => {
  return (
    <div className="bg-white rounded-[24px] border-2 border-slate-50 min-w-[280px] shadow-xl hover:border-blue-200 transition-colors">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-4 h-4 !bg-blue-500 border-4 border-white"
      />
      
      <div className="p-5 flex flex-col gap-4">
        <div className="flex justify-between items-center mb-1">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{data.label || 'Phase Box'}</div>
          <div className="w-2 h-2 rounded-full bg-slate-300" style={{ backgroundColor: data.color || '#cbd5e1' }} />
        </div>
        
        <div className="space-y-3">
            <select 
                className="w-full h-10 rounded-xl border border-slate-100 bg-slate-50 px-3 font-bold text-[11px] outline-none shadow-inner text-slate-800 uppercase italic cursor-pointer focus:border-blue-400"
                value={data.status_id || ''}
                onChange={(e) => data.onChange(id, 'status_id', e.target.value)}
                title="Status Label"
            >
                <option value="">Status Label...</option>
                {data.statusLabels?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <select 
                className="w-full h-10 rounded-xl border border-slate-100 bg-slate-50 px-3 font-bold text-[11px] outline-none shadow-inner text-slate-800 uppercase italic cursor-pointer focus:border-purple-400"
                value={data.required_role_id || ''}
                onChange={(e) => data.onChange(id, 'required_role_id', e.target.value)}
                title="Responsible Role"
            >
                <option value="">Responsible Role...</option>
                {data.roles?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
        </div>
      </div>

      {/* Outgoing routes handles at the bottom */}
      <div className="bg-slate-50 p-3 rounded-b-[22px] border-t border-slate-100 flex justify-between items-center relative">
          <div className="text-[9px] font-black uppercase text-slate-400 w-full text-center tracking-widest">Connect Routes ▼</div>
          
          {/* Custom multiple handles for different actions could be array-based, but for V1 we keep it flexible */}
          <Handle
            type="source"
            position={Position.Bottom}
            id="approve"
            isConnectable={isConnectable}
            className="w-4 h-4 !bg-green-500 border-4 border-white left-1/4"
            title="Approve Route"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="reject"
            isConnectable={isConnectable}
            className="w-4 h-4 !bg-red-500 border-4 border-white left-2/4"
            title="Reject Route"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="escalate"
            isConnectable={isConnectable}
            className="w-4 h-4 !bg-orange-500 border-4 border-white left-3/4"
            title="Escalate Route"
          />
      </div>
    </div>
  );
};

export default CustomNode;
