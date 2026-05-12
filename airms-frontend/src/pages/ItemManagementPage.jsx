import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { useFetch } from '../hooks/useFetch';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CascadingUnitSelector from '../components/common/CascadingUnitSelector';
import inventoryService from '../services/inventoryService';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  Box, Search, GitFork, Trash2, Info, X,
  AlertTriangle, PackagePlus, PackageMinus, Layers, QrCode,
  Edit3, ArrowRight, ArrowLeftRight, MessageSquareWarning, RefreshCw,
  Menu, Filter, ChevronDown
} from 'lucide-react';
import UnitLedgerModal from '../components/inventory/UnitLedgerModal';

// ─── IDENTITY CARD MODAL ─────────────────────────────────────────────────────
const IdentityCard = ({ item, onClose }) => {
  if (!item) return null;
  const p = item.product || {};
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-slate-950 p-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-3xl flex items-center justify-center">
              <Box className="text-white" size={26} />
            </div>
            <div>
              <h2 className="text-white font-black text-xl tracking-tighter uppercase">{p.name || 'Unknown Item'}</h2>
              <div className="text-blue-400 text-[10px] font-black uppercase tracking-widest">{p.sku}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 transition-all text-white">
            <X size={18} />
          </button>
        </div>
        <div className="p-10 space-y-6">
           <div className="grid grid-cols-2 gap-6">
              <div className="p-6 bg-slate-50 rounded-[30px]">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock Status</p>
                 <p className="text-2xl font-black text-slate-900 tracking-tighter">{item.quantity} Units Available</p>
              </div>
              <div className="p-6 bg-blue-50 rounded-[30px]">
                 <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Catalog Entry</p>
                 <p className="text-sm font-black text-blue-900 uppercase tracking-widest">{p.category || 'General'}</p>
              </div>
           </div>
           <div className="space-y-4">
              <DetailRow label="Condition" value={item.condition} />
              <DetailRow label="Latest Location" value={item.location_details} />
              <DetailRow label="Batch Identity" value={item.batch_number} />
              <DetailRow label="Storage Node" value={item.organizationNode?.name} />
           </div>
        </div>
      </div>
    </div>
  );
};

const DetailRow = ({ label, value }) => (
  <div className="flex justify-between items-center py-4 border-b border-slate-50 last:border-0">
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    <span className="text-sm font-black text-slate-900">{value || 'N/A'}</span>
  </div>
);

// ─── MAIN COCKPIT COMPONENT ──────────────────────────────────────────────────
const ItemManagementPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [identityItem, setIdentityItem] = useState(null);
  const [unitLedgerItem, setUnitLedgerItem] = useState(null);
  const [qrItem, setQrItem] = useState(null);

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [decommissionModalOpen, setDecommissionModalOpen] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);

  const [adjustmentData, setAdjustmentData] = useState({ adjustment: 0, type: 'add', reason: '' });

  const { data: rawItems, loading, refetch } = useFetch('/inventory', {
    params: { search, org_node_id: selectedUnit, limit: 1000 }
  });

  const groupedItems = useMemo(() => {
    if (!rawItems) return [];
    const groups = {};
    rawItems.forEach(item => {
      const key = item.product?.sku || item.product_id || 'unlinked';
      if (!groups[key]) {
        groups[key] = { ...item, quantity: 0, records: [] };
      }
      groups[key].quantity += item.quantity;
      groups[key].records.push(item);
    });
    return Object.values(groups);
  }, [rawItems]);

  const handleAdjust = async () => {
    try {
      await inventoryService.adjustQuantity(selectedItem.id, adjustmentData.adjustment, adjustmentData.type, adjustmentData.reason);
      toast.success('Inventory state adjusted');
      setAdjustModalOpen(false);
      refetch();
    } catch (e) { toast.error('Adjustment failed'); }
  };

  const handleBulkDelete = async () => {
    try {
      await inventoryService.bulkDelete(selectedItem.product_id, selectedItem.org_node_id);
      toast.success(`Registry Wipe: All ${selectedItem.quantity} units removed.`);
      setBulkDeleteModalOpen(false);
      refetch();
    } catch (e) { toast.error('Bulk delete failed'); }
  };

  if (loading && !rawItems) return <LoadingSpinner />;

  return (
    <div className="max-w-[1600px] mx-auto py-8 lg:py-12 px-4 lg:px-8 space-y-8 lg:space-y-10 animate-in fade-in duration-700">
      {identityItem && <IdentityCard item={identityItem} onClose={() => setIdentityItem(null)} />}
      {unitLedgerItem && (
        <UnitLedgerModal 
          item={unitLedgerItem} 
          onClose={() => setUnitLedgerItem(null)} 
          onAdjust={(u) => { setSelectedItem(u); setAdjustModalOpen(true); }}
          onDecommission={(u) => { setSelectedItem(u); setDecommissionModalOpen(true); }}
          onTransfer={(u) => navigate(`/transfers/new?product_id=${u.product_id}&from_node_id=${u.org_node_id}`)}
          onQr={(u) => setQrItem(u)}
          onReport={(u) => navigate(`/report-problem?inventory_id=${u.id}`)}
          onIdentity={(u) => setIdentityItem(u)}
          onReplenish={(u) => navigate(`/requests/new?product_id=${u.product_id}`)}
          onSplit={(u) => navigate(`/inventory/split?inventory_id=${u.id}`)}
        />
      )}

      {/* Hero Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 lg:gap-8 bg-white p-6 lg:p-10 rounded-[35px] lg:rounded-[50px] border border-slate-100 shadow-2xl shadow-slate-200/50">
        <div className="flex items-center gap-4 lg:gap-6">
          <div className="w-16 h-16 lg:w-20 lg:h-20 bg-slate-950 rounded-[28px] lg:rounded-[35px] flex items-center justify-center shadow-2xl rotate-3">
            <Box className="text-blue-500" size={32} />
          </div>
          <div>
            <h1 className="text-2xl lg:text-5xl font-black text-slate-900 tracking-tighter uppercase italic">Ops Cockpit</h1>
            <p className="text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mt-1 lg:mt-2">Inventory Management Domain</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 lg:gap-4 w-full xl:w-auto">
          <button onClick={() => navigate('/store')} className="flex-1 xl:flex-none bg-blue-600 hover:bg-blue-700 text-white font-black px-6 lg:px-8 h-16 lg:h-20 rounded-[25px] lg:rounded-[30px] uppercase text-[10px] lg:text-xs tracking-widest shadow-xl transition-all border-b-4 lg:border-b-8 border-blue-800 active:border-b-0 active:translate-y-2 flex items-center justify-center gap-3">
            <PackagePlus size={20} /> New Intake
          </button>
          <button onClick={() => navigate('/discharge')} className="flex-1 xl:flex-none bg-slate-950 hover:bg-black text-white font-black px-6 lg:px-8 h-16 lg:h-20 rounded-[25px] lg:rounded-[30px] uppercase text-[10px] lg:text-xs tracking-widest shadow-xl transition-all border-b-4 lg:border-b-8 border-slate-800 active:border-b-0 active:translate-y-2 flex items-center justify-center gap-3">
            <PackageMinus size={20} /> Distribution
          </button>
        </div>
      </div>

      {/* Responsive Filter Bar with Mobile Toggle */}
      <div className="bg-white rounded-[35px] lg:rounded-[45px] border border-slate-100 shadow-sm overflow-hidden">
         {/* Mobile Toggle Button (Visible only on small screens) */}
         <div className="md:hidden flex items-center justify-between p-6 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center text-white">
                  <Filter size={18} />
               </div>
               <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Protocol Filters</span>
            </div>
            <button 
               onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
               className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-400"
            >
               {mobileFiltersOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
         </div>

         {/* Filter Content: Hidden on mobile unless toggled */}
         <div className={`${mobileFiltersOpen ? 'block' : 'hidden'} md:block p-6 lg:p-8 animate-in slide-in-from-top duration-300`}>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-end">
               <div className="md:col-span-4 space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Global Search</label>
                  <div className="relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      value={searchValue} 
                      onChange={e => setSearchValue(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && setSearch(searchValue)}
                      className="w-full h-14 pl-14 pr-6 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-300 transition-all"
                      placeholder="SKU or Name..."
                    />
                  </div>
               </div>
               <div className="md:col-span-5 space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Node Focus Scope</label>
                  <CascadingUnitSelector value={selectedUnit} onChange={setSelectedUnit} />
               </div>
               <div className="md:col-span-3">
                  <button onClick={refetch} className="w-full h-14 bg-slate-950 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-600 transition-all shadow-lg active:scale-95">
                    <RefreshCw size={14} /> Refresh Registry
                  </button>
               </div>
            </div>
         </div>
      </div>

      {/* Catalog Display */}
      <div className="bg-white rounded-[40px] lg:rounded-[50px] shadow-xl ring-1 ring-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 lg:px-10 py-6 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Product / SKU</th>
                <th className="px-6 py-6 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Total Qty</th>
                <th className="hidden md:table-cell px-6 py-6 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Global State</th>
                <th className="px-6 lg:px-10 py-6 text-right text-xs font-black text-slate-400 uppercase tracking-widest">Protocol Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {groupedItems.map(group => (
                <tr key={group.product?.sku || group.id} className="group hover:bg-slate-50/50 transition-all">
                  <td className="px-6 lg:px-10 py-6">
                    <div className="flex items-center gap-4 lg:gap-5">
                      <div className="w-12 h-12 lg:w-14 lg:h-14 bg-slate-100 rounded-[20px] lg:rounded-[22px] flex items-center justify-center group-hover:bg-blue-100 transition-all">
                         <Box className="text-slate-400 group-hover:text-blue-600 transition-all" size={24} />
                      </div>
                      <div>
                         <div className="font-black text-slate-900 text-sm lg:text-base tracking-tight uppercase italic break-words max-w-[200px] lg:max-w-none">
                           {group.product?.name || 'CSV Auto-Generated Item'}
                         </div>
                         <div className="text-[10px] lg:text-[11px] font-black text-blue-500 uppercase tracking-widest">
                           {group.product?.sku}
                         </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                     <div className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tighter">{group.quantity}</div>
                     <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Total Units</div>
                  </td>
                  <td className="hidden md:table-cell px-6 py-6">
                     <span className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100">
                        {group.condition || 'Factory New'}
                     </span>
                  </td>
                  <td className="px-6 lg:px-10 py-6 text-right">
                     <div className="flex items-center justify-end gap-2 lg:gap-3">
                        <button onClick={() => { setSelectedItem(group); setBulkDeleteModalOpen(true); }} title="Wipe Entire Group" className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-white border border-slate-100 text-slate-300 hover:text-red-600 hover:border-red-100 shadow-sm flex items-center justify-center transition-all">
                           <Trash2 size={20} />
                        </button>
                        <button onClick={() => setUnitLedgerItem(group)} className="px-5 lg:px-8 h-10 lg:h-12 bg-slate-950 text-white text-[10px] lg:text-[11px] font-black uppercase tracking-widest rounded-xl lg:rounded-2xl hover:bg-blue-600 shadow-xl shadow-blue-500/10 transition-all flex items-center gap-2 lg:gap-3">
                           <Layers size={18} /> <span className="hidden sm:inline">Open Ledger</span>
                        </button>
                     </div>
                  </td>
                </tr>
              ))}
              {groupedItems.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-32 text-center">
                    <Box size={60} className="mx-auto text-slate-100 mb-6" />
                    <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">Master Registry</h1>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR MODAL */}
      {qrItem && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl" onClick={() => setQrItem(null)} />
          <div className="relative w-full max-w-md bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
             <div className="p-10 text-center bg-slate-50 border-b border-slate-100">
                <QrCode size={40} className="mx-auto mb-4 text-slate-900" />
                <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Physical Identity Tag</h3>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">{qrItem.product?.name}</p>
             </div>
             <div className="p-12 flex flex-col items-center gap-8 bg-white">
                <div className="p-6 bg-white rounded-[40px] shadow-2xl ring-1 ring-slate-100">
                   <QRCode value={JSON.stringify({ id: qrItem.id, sku: qrItem.product?.sku, serial: qrItem.serial_number })} size={240} level="H" />
                </div>
                <div className="text-center">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-2">Unique Identity Binding</p>
                   <p className="font-mono text-lg font-black text-slate-900 uppercase">{qrItem.serial_number || `REG-ID-${qrItem.id}`}</p>
                </div>
             </div>
             <div className="p-10 bg-slate-50 flex flex-col gap-4">
                <button onClick={() => window.print()} className="w-full h-16 bg-slate-950 text-white font-black rounded-3xl uppercase text-xs tracking-widest hover:bg-blue-600 transition-all">Print Tag</button>
                <button onClick={() => setQrItem(null)} className="text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest">Dismiss</button>
             </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      <Modal isOpen={bulkDeleteModalOpen} onClose={() => setBulkDeleteModalOpen(false)} title="Confirm Registry Wipe" onConfirm={handleBulkDelete} confirmText="Wipe Group">
        <div className="p-6 text-center space-y-6">
           <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <AlertTriangle size={48} />
           </div>
           <p className="text-sm font-bold text-slate-600">
              This action will permanently delete <span className="text-red-600">{selectedItem?.quantity} units</span> of <span className="font-black underline">{selectedItem?.product?.name}</span> from this node. 
           </p>
           <div className="bg-red-50 p-4 rounded-2xl text-[10px] font-black text-red-700 uppercase tracking-widest">
              Action is irreversible. Audit trail will be logged.
           </div>
        </div>
      </Modal>

      {/* Simple Adjust Modal */}
      <Modal isOpen={adjustModalOpen} onClose={() => setAdjustModalOpen(false)} title="Quick Adjust" onConfirm={handleAdjust}>
        <div className="space-y-6 p-2">
           <div className="grid grid-cols-2 gap-4">
              <select value={adjustmentData.type} onChange={e => setAdjustmentData({...adjustmentData, type: e.target.value})} className="h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 font-black text-xs outline-none">
                 <option value="add">Add (+)</option>
                 <option value="subtract">Subtract (-)</option>
              </select>
              <input type="number" value={adjustmentData.adjustment} onChange={e => setAdjustmentData({...adjustmentData, adjustment: parseInt(e.target.value) || 0})} className="h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 font-black text-xl text-center" />
           </div>
           <Input placeholder="Justification for adjustment..." value={adjustmentData.reason} onChange={e => setAdjustmentData({...adjustmentData, reason: e.target.value})} />
        </div>
      </Modal>

    </div>
  );
};

export default ItemManagementPage;
