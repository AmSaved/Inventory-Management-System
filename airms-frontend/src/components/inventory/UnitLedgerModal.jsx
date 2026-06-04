import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, Search, Trash2, 
  QrCode, Box, Lock,
  ArrowLeftRight, Layers,
  PackageMinus, UserCheck
} from 'lucide-react';
import { getAssetName } from '../../utils/assetName';

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
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  if (!item) return null;

  const inventoryData = item.records || [item];

  // Expand each record into individual unit rows
  const units = useMemo(() => {
    const allUnits = [];
    inventoryData.forEach(record => {
      if (record.serial_number) {
        for (let i = 0; i < record.quantity; i++) {
          allUnits.push({
            ...record,
            type: 'serialized',
            displaySerial: record.serial_number,
            virtualId: `${record.id}-${i}`
          });
        }
      } else {
        for (let i = 0; i < record.quantity; i++) {
          allUnits.push({
            ...record,
            type: 'bulk',
            displaySerial: 'BULK UNIT',
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

  const availableCount = units.filter(u => u.status !== 'assigned').length;
  const assignedCount = units.filter(u => u.status === 'assigned').length;
  const allAssigned = availableCount === 0 && assignedCount > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[45px] shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-950 p-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-blue-600 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-500/20">
               <Layers className="text-white" size={26} />
            </div>
            <div>
              <h2 className="text-white font-black text-2xl tracking-tighter uppercase italic">{item.product?.name}</h2>
              <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.3em]">
                Unit Ledger
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
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Stock</span>
                 <p className="text-xl font-black text-slate-900 tracking-tighter">{item.quantity} Units</p>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available</span>
                 <p className="text-sm font-black text-blue-600">{availableCount} Units</p>
              </div>
              {assignedCount > 0 && (
                <>
                  <div className="h-8 w-px bg-slate-200" />
                  <div>
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned to Users</span>
                     <p className="text-sm font-black text-amber-600">{assignedCount} Units</p>
                  </div>
                </>
              )}
           </div>
           <div className="flex gap-3">
             {/* Transfer Stock — disabled if all assigned */}
             <button 
               onClick={() => !allAssigned && onTransfer(item)} 
               disabled={allAssigned}
               title={allAssigned ? 'All items are assigned to users' : 'Transfer Stock'}
               className={`h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                 allAssigned 
                   ? 'bg-slate-100 text-slate-300 border border-slate-100 cursor-not-allowed' 
                   : 'bg-white border border-slate-200 hover:bg-slate-50'
               }`}
             >
               {allAssigned ? <Lock size={14} className="text-slate-300" /> : <ArrowLeftRight size={14} className="text-blue-600" />}
               Transfer Stock
             </button>
             {/* Discharge Stock — disabled if all assigned */}
             <button 
               onClick={() => !allAssigned && navigate(`/discharge?product_id=${item.product_id}&org_node_id=${item.org_node_id}`)} 
               disabled={allAssigned}
               title={allAssigned ? 'All items are assigned to users' : 'Discharge Stock'}
               className={`h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                 allAssigned 
                   ? 'bg-slate-100 text-slate-300 border border-slate-100 cursor-not-allowed' 
                   : 'bg-white border border-slate-200 hover:bg-slate-50'
               }`}
             >
               {allAssigned ? <Lock size={14} className="text-slate-300" /> : <PackageMinus size={14} className="text-red-600" />}
               Discharge Stock
             </button>
           </div>
        </div>

        {/* Ledger Table */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white">
            <table className="w-full bg-white">
              <thead>
               <tr className="bg-green-600">
                <th className="px-5 py-3 text-left text-[12px] font-bold text-white uppercase tracking-[0.2em]">Unit Identity</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-white uppercase tracking-[0.2em]">Registry / Location</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-white uppercase tracking-[0.2em]">Status</th>
                <th className="px-5 py-3 text-right text-[12px] font-bold text-white uppercase tracking-[0.2em]">Operations</th>
               </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
               {filteredUnits.map((u) => {
                 const isAssigned = u.status === 'assigned';
                 const assignedName = u.assignedUser 
                   ? `${u.assignedUser.first_name} ${u.assignedUser.last_name}` 
                   : (u.assigned_to ? `User #${u.assigned_to}` : 'User');
                 return (
                   <tr key={u.virtualId} className={`group transition-all ${isAssigned ? 'bg-amber-50/40' : 'hover:bg-green-50'}`}>
                     <td className="px-5 py-3">
                       <div className="flex items-center gap-3">
                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                           isAssigned ? 'bg-amber-100 text-amber-600' :
                           u.type === 'serialized' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                         }`}>
                           {isAssigned ? <UserCheck size={18} /> : u.type === 'serialized' ? <QrCode size={18} /> : <Box size={18} />}
                         </div>
                         <div>
                           <div className="font-semibold text-sm text-slate-900 tracking-tight">
                             {getAssetName(u)}
                           </div>
                           <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5 mt-0.5">
                             <span className="font-mono">{u.displaySerial}</span>
                           </div>
                         </div>
                       </div>
                     </td>
                     <td className="px-5 py-3">
                       <div className="text-sm font-bold text-slate-700">{u.location_details || u.organizationNode?.name || 'Unassigned'}</div>
                     </td>
                     <td className="px-5 py-3">
                       {isAssigned ? (
                         <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-wide">
                           <UserCheck size={10} />
                           Assigned → {assignedName}
                         </span>
                       ) : (
                         <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-wide">
                           {u.status || 'Available'}
                         </span>
                       )}
                     </td>
                     <td className="px-5 py-3 text-right">
                       <div className={`flex items-center justify-end gap-1.5 transition-opacity ${isAssigned ? 'opacity-30' : 'opacity-50 group-hover:opacity-100'}`}>
                         <ToolButton 
                           icon={isAssigned ? <Lock size={14} /> : <ArrowLeftRight size={14} />} 
                           title={isAssigned ? 'Cannot transfer — item is assigned to a user' : 'Internal Transfer'} 
                           onClick={() => !isAssigned && onTransfer(u)} 
                           disabled={isAssigned}
                         />
                         <ToolButton 
                           icon={isAssigned ? <Lock size={14} /> : <PackageMinus size={14} />} 
                           title={isAssigned ? 'Cannot discharge — item is assigned to a user' : 'Discharge Unit'} 
                           onClick={() => !isAssigned && navigate(`/discharge?inventory_id=${u.id}`)} 
                           color={isAssigned ? 'slate' : 'red'}
                           disabled={isAssigned}
                         />
                         <ToolButton icon={<QrCode size={14} />} title="Print Identity Label" onClick={() => onQr(u)} />
                         <ToolButton 
                           icon={<Trash2 size={14} />} 
                           title={isAssigned ? 'Cannot decommission — item is assigned to a user' : 'Decommission Unit'} 
                           onClick={() => !isAssigned && onDecommission(u)} 
                           color={isAssigned ? 'slate' : 'red'}
                           disabled={isAssigned}
                         />
                       </div>
                     </td>
                   </tr>
                 );
               })}
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

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
             Inventory Unit Ledger · {units.length} Records
           </p>
           <button onClick={onClose} className="text-[9px] font-black text-slate-500 hover:text-slate-900 uppercase tracking-widest">
             Close Ledger
           </button>
        </div>
      </div>
    </div>
  );
};

const ToolButton = ({ icon, title, onClick, color = 'slate', disabled = false }) => {
  const colors = {
    slate: 'text-slate-600 hover:text-blue-600 hover:border-blue-200',
    red: 'text-red-500 hover:text-red-600 hover:border-red-200'
  };
  return (
    <button 
      onClick={onClick} 
      title={title}
      disabled={disabled}
      className={`w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center transition-all ${disabled ? 'cursor-not-allowed opacity-40' : colors[color]} opacity-90 hover:opacity-100`}
    >
      {icon}
    </button>
  );
};

export default UnitLedgerModal;
