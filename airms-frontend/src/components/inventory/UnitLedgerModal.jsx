import React, { useState, useMemo } from 'react';
import { 
  X, Search, Info, Trash2, Edit3, Send, 
  QrCode, MoreHorizontal, AlertTriangle, Box,
  GitFork, MessageSquareWarning, ArrowLeftRight, Layers
} from 'lucide-react';

const UnitLedgerModal = ({ 
  item, 
  onClose, 
  onAdjust, 
  onDecommission, 
  onTransfer, 
  onQr, 
  onReport, 
  onIdentity, 
  onReplenish,
  onSplit 
}) => {
  const [search, setSearch] = useState('');
  if (!item) return null;

  // We use the raw records that were grouped by the parent cockpit
  const inventoryData = item.records || [item];

  // ---------------------------------------------------------------------------
  // AUTO-EXPANSION LOGIC: Expand every record based on its quantity
  // ---------------------------------------------------------------------------
  const units = useMemo(() => {
    const allUnits = [];
    inventoryData.forEach(record => {
      // If the record has a specific serial number, it's usually Qty 1
      // If it's bulk (no serial) with Qty > 1, we expand it into individual rows
      if (record.serial_number) {
        // Serialized items usually have quantity of 1
        for (let i = 0; i < record.quantity; i++) {
          allUnits.push({
            ...record,
            type: 'serialized',
            displaySerial: record.serial_number,
            virtualId: `${record.id}-${i}`
          });
        }
      } else {
        // Bulk items without serials get expanded into individual units
        for (let i = 0; i < record.quantity; i++) {
          allUnits.push({
            ...record,
            type: 'bulk',
            displaySerial: `BULK UNIT`, // Generic label since no serial exists
            virtualId: `${record.id}-v${i}`
          });
        }
      }
    });
    return allUnits;
  }, [inventoryData]);

  const filteredUnits = units.filter(u => 
    u.displaySerial.toLowerCase().includes(search.toLowerCase()) ||
    u.location_details?.toLowerCase().includes(search.toLowerCase()) ||
    (u.batch_number && u.batch_number.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[45px] shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-950 p-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-blue-600 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-500/20">
               <Layers className="text-white" size={26} />
            </div>
            <div>
              <h2 className="text-white font-black text-2xl tracking-tighter uppercase italic">{item.product?.name}</h2>
              <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.3em]">
                {item.product?.sku} · Precision Unit Ledger
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                  placeholder="Filter items..." 
                  className="w-64 h-12 pl-11 pr-4 bg-white/10 border border-white/20 rounded-2xl text-white text-sm placeholder:text-slate-500 outline-none focus:border-blue-500 transition-all"
                />
             </div>
             <button onClick={onClose} className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 transition-all text-white">
                <X size={20} />
             </button>
          </div>
        </div>

        {/* Action Bar */}
        <div className="px-8 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
           <div className="flex items-center gap-8">
              <div>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Stock</span>
                 <p className="text-xl font-black text-slate-900 tracking-tighter">{item.quantity} Units</p>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Individual Units</span>
                 <p className="text-sm font-black text-blue-600 uppercase tracking-widest">{units.length} Records Expanded</p>
              </div>
           </div>
            <div className="flex gap-3">
              <button onClick={() => onTransfer(item)} className="h-10 px-6 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2">
                <ArrowLeftRight size={14} className="text-blue-600" />
                Transfer Stock
              </button>
              <button onClick={() => navigate(`/discharge?product_id=${item.product_id}&org_node_id=${item.org_node_id}`)} className="h-10 px-6 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2">
                <PackageMinus size={14} className="text-red-600" />
                Discharge Stock
              </button>
              <button onClick={() => onReplenish(item)} className="h-10 px-6 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">
                Replenish Product
              </button>
            </div>
        </div>

        {/* Ledger Table */}
        <div className="flex-1 overflow-y-auto p-8">
           <div className="rounded-[30px] border border-slate-100 overflow-hidden shadow-sm">
              <table className="w-full">
                 <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                       <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Unit Identity</th>
                       <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Registry / Location</th>
                       <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Qty</th>
                       <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Unit Operations</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {filteredUnits.map((u, idx) => (
                       <tr key={u.virtualId} className="group hover:bg-slate-50/50 transition-all">
                          <td className="px-6 py-4">
                             <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${u.type === 'serialized' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                   {u.type === 'serialized' ? <QrCode size={18} /> : <Box size={18} />}
                                </div>
                                <div>
                                   <div className={`font-mono text-xs font-bold tracking-tight ${u.type === 'serialized' ? 'text-slate-900' : 'text-slate-400 italic'}`}>
                                      {u.displaySerial}
                                   </div>
                                   <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                      Registry #{u.id} · {u.status}
                                   </div>
                                </div>
                             </div>
                          </td>
                          <td className="px-6 py-4">
                             <div className="text-xs font-bold text-slate-700">{u.location_details || u.organizationNode?.name || 'Unassigned'}</div>
                             <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{u.batch_number || 'No Batch Data'}</div>
                          </td>
                          <td className="px-6 py-4">
                             <span className="text-sm font-black text-slate-900">1</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <div className="flex items-center justify-end gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                <ToolButton icon={<Info size={14} />} title="Inspect Unit" onClick={() => onIdentity(u)} />
                                <ToolButton icon={<Edit3 size={14} />} title="Adjust Unit" onClick={() => onAdjust(u)} />
                                <ToolButton icon={<ArrowLeftRight size={14} />} title="Internal Transfer" onClick={() => onTransfer(u)} />
                                <ToolButton icon={<PackageMinus size={14} />} title="Discharge Unit" onClick={() => navigate(`/discharge?inventory_id=${u.id}`)} color="red" />
                                <ToolButton icon={<QrCode size={14} />} title="Print Identity Label" onClick={() => onQr(u)} />
                                <ToolButton icon={<MessageSquareWarning size={14} />} title="Report Issue" onClick={() => onReport(u)} color="amber" />
                                <ToolButton icon={<Trash2 size={14} />} title="Decommission Unit" onClick={() => onDecommission(u)} color="red" />
                             </div>
                          </td>
                       </tr>
                    ))}
                    {filteredUnits.length === 0 && (
                      <tr>
                        <td colSpan="4" className="py-20 text-center">
                          <Box className="mx-auto text-slate-100 mb-4" size={48} />
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No matching units in registry</p>
                        </td>
                      </tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>

        {/* Footer info */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
             Precision Inventory Node · Multi-Unit Granularity Enabled
           </p>
           <button onClick={onClose} className="text-[9px] font-black text-slate-500 hover:text-slate-900 uppercase tracking-widest">
             Close Ledger
           </button>
        </div>

      </div>
    </div>
  );
};

const ToolButton = ({ icon, title, onClick, color = 'slate' }) => {
  const colors = {
    slate: 'hover:text-blue-600 hover:border-blue-200',
    purple: 'hover:text-purple-600 hover:border-purple-200',
    amber: 'hover:text-amber-600 hover:border-amber-200',
    red: 'hover:text-red-600 hover:border-red-200'
  };
  return (
    <button 
      onClick={onClick} 
      title={title}
      className={`w-9 h-9 rounded-xl bg-white border border-slate-100 text-slate-400 shadow-sm flex items-center justify-center transition-all ${colors[color]}`}
    >
      {icon}
    </button>
  );
};

export default UnitLedgerModal;
