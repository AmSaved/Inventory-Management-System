import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { useFetch } from '../hooks/useFetch';
import { usePermissions } from '../hooks/usePermissions';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CascadingUnitSelector from '../components/common/CascadingUnitSelector';
import inventoryService from '../services/inventoryService';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getAssetName, getAssetDisplayName } from '../utils/assetName';
import {
  Box, Search, GitFork, Trash2, Info, X,
  AlertTriangle, PackagePlus, PackageMinus, Layers, QrCode,
  Edit3, ArrowRight, ArrowLeftRight, MessageSquareWarning, RefreshCw,
  Menu, Filter, ChevronDown, History, Plus, UserCheck, Lock
} from 'lucide-react';
import UnitLedgerModal from '../components/inventory/UnitLedgerModal';
import ActivityLogPanel from '../components/inventory/ActivityLogPanel';

// ─── IDENTITY CARD MODAL ─────────────────────────────────────────────────────
const IdentityCard = ({ item, onClose }) => {
  if (!item) return null;
  const p = item.product || {};
  const assetName = getAssetName(item);
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-md w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-slate-950 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Box className="text-white" size={16} />
            </div>
            <div>
              <h2 className="text-white font-bold text-sm tracking-tight">{assetName}</h2>
              {assetName !== p.name && p.name && (
                <p className="text-blue-300 text-[10px] font-semibold">{p.name}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-white">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-3">
           <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg">
                 <p className="text-xs font-semibold text-slate-500 mb-0.5">Stock Status</p>
                 <p className="text-base font-bold text-slate-900 tracking-tight">{item.quantity} Units Available</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                 <p className="text-xs font-semibold text-blue-500 mb-0.5">Catalog Entry</p>
                 <p className="text-xs font-bold text-blue-900 tracking-wide">{p.category || 'General'}</p>
              </div>
           </div>
           <div className="space-y-3">
              <DetailRow label="Latest Location" value={item.location_details || item.organizationNode?.name} />
              <DetailRow label="Storage Node" value={item.organizationNode?.name} />
           </div>
        </div>
      </div>
    </div>
  );
};

const DetailRow = ({ label, value }) => (
  <div className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0">
    <span className="text-xs font-semibold text-slate-400">{label}</span>
    <span className="text-xs font-semibold text-slate-800">{value || 'N/A'}</span>
  </div>
);

// ─── MAIN COCKPIT COMPONENT ──────────────────────────────────────────────────
const InventoryPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canAdjustInventory } = usePermissions();

  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [identityItem, setIdentityItem] = useState(null);
  const [unitLedgerItem, setUnitLedgerItem] = useState(null);
  const [qrItem, setQrItem] = useState(null);

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [activityPanelOpen, setActivityPanelOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [decommissionModalOpen, setDecommissionModalOpen] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);

  const [adjustmentData, setAdjustmentData] = useState({ adjustment: 0, type: 'add', reason: '' });

  const { data: rawItems, loading, refetch } = useFetch('/inventory', {
    params: { search, org_node_id: selectedUnit, limit: 1000 }
  });

  // Group by product SKU and track assigned vs available counts
  const groupedItems = useMemo(() => {
    if (!rawItems) return [];
    const groups = {};
    rawItems.forEach(item => {
      const key = item.product?.sku || item.product_id || 'unlinked';
      if (!groups[key]) {
        groups[key] = { ...item, quantity: 0, assignedCount: 0, availableCount: 0, records: [] };
      }
      groups[key].quantity += item.quantity;
      if (item.status === 'assigned') {
        groups[key].assignedCount += item.quantity;
        // Keep the first assignedUser for display
        if (!groups[key].assignedUser && item.assignedUser) {
          groups[key].assignedUser = item.assignedUser;
        }
      } else {
        groups[key].availableCount += item.quantity;
      }
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
    <div className="max-w-[1200px] mx-auto space-y-4 pt-2 pb-4 px-4 md:px-6">
      {identityItem && <IdentityCard item={identityItem} onClose={() => setIdentityItem(null)} />}
      {unitLedgerItem && (
        <UnitLedgerModal 
          item={unitLedgerItem} 
          onClose={() => setUnitLedgerItem(null)} 
          onAdjust={(u) => { setSelectedItem(u); setAdjustModalOpen(true); }}
          onDecommission={(u) => { setSelectedItem(u); setDecommissionModalOpen(true); }}
          onTransfer={(u) => navigate(`/transfers?product_id=${u.product_id}&from_node_id=${u.org_node_id}${u.serial_number ? `&serial_number=${encodeURIComponent(u.serial_number)}` : ''}`)}
          onQr={(u) => setQrItem(u)}
          onReport={(u) => navigate(`/report-problem?inventory_id=${u.id}`)}
          onIdentity={(u) => setIdentityItem(u)}
          onReplenish={(u) => navigate(`/requests/new?product_id=${u.product_id}`)}
          onSplit={(u) => navigate(`/inventory/split?inventory_id=${u.id}`)}
        />
      )}

      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2 border-b border-slate-100">
        <div className="space-y-0.5">
          <div className="flex items-center gap-3">
             <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
                <Box className="text-white" size={18} />
             </div>
             <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Inventories</h1>
          </div>
        </div>
        
         <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
          <p>Select Branch</p>
           <div className="flex-1 md:flex-none h-10 bg-slate-950 rounded-lg flex items-center shadow-sm min-w-[200px]">
             <CascadingUnitSelector 
               value={selectedUnit} 
               onChange={setSelectedUnit} 
               variant="dropdown"
               className="w-full h-full text-white" 
             />
           </div>
           <button onClick={() => navigate('/discharge')} className="flex-1 md:flex-none bg-slate-950 hover:bg-black text-white font-semibold px-4 h-10 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm">
             <PackageMinus size={14} /> Distribution
           </button>
           {canAdjustInventory && (
              <Button 
                onClick={() => navigate('/store')}
                className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 h-10 rounded-lg transition-all shadow-sm flex items-center gap-1.5 text-xs border-none"
              >
                <Plus size={16} /> New Intake
              </Button>
            )}
         </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="w-full">
              <div className="md:hidden flex items-center justify-between p-4 bg-slate-50 border-b border-slate-100">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-950 rounded-lg flex items-center justify-center text-white">
                       <Filter size={14} />
                    </div>
                    <span className="text-xs font-semibold text-slate-950 uppercase tracking-wider">Filters</span>
                   </div>
                   <button 
                      onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
                      className="w-8 h-8 bg-white rounded-lg shadow-sm border border-slate-100 flex items-center justify-center text-slate-400"
                   >
                      {mobileFiltersOpen ? <X size={18} /> : <Menu size={18} />}
                   </button>
              </div>
              <div className={`${mobileFiltersOpen ? 'block' : 'hidden'} md:block p-4 animate-in slide-in-from-top duration-300`}>
                 <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-4 space-y-1.5">
                       <label className="text-xs font-semibold text-slate-500 ml-1">Search</label>
                       <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input 
                            value={searchValue} 
                            onChange={e => setSearchValue(e.target.value)} 
                            onKeyDown={e => e.key === 'Enter' && setSearch(searchValue)}
                            className="w-full h-10 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-blue-300 transition-all text-slate-800"
                            placeholder="Search by item name..."
                          />
                       </div>
                    </div>
                 </div>
              </div>
         </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-green-600 text-white">
                <th className="p-4 text-sm font-bold">Name</th>
                <th className="p-4 text-sm font-bold">Total Qty</th>
                <th className="hidden md:table-cell p-4 text-sm font-bold">Status</th>
                <th className="p-4 text-sm font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupedItems.map(group => {
                const allAssigned = group.availableCount === 0 && group.assignedCount > 0;
                const someAssigned = group.assignedCount > 0 && group.availableCount > 0;
                return (
                  <tr key={group.product?.sku || group.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-sm font-medium text-slate-900">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${allAssigned ? 'bg-amber-50' : 'bg-slate-100 group-hover:bg-blue-50'}`}>
                           <Box className={`transition-colors ${allAssigned ? 'text-amber-500' : 'text-slate-400 group-hover:text-blue-600'}`} size={18} />
                        </div>
                        <div>
                           <div className="font-semibold text-slate-900 text-sm tracking-tight break-words max-w-[200px] lg:max-w-none">
                              {group.product?.name || 'Unknown Item'}
                           </div>
                           {(allAssigned || someAssigned) && (
                             <div className="flex items-center gap-1 mt-0.5">
                               <UserCheck size={10} className="text-amber-500" />
                               <span className="text-[10px] font-semibold text-amber-600">
                                 {group.assignedCount} assigned to user{group.assignedCount > 1 ? 's' : ''}
                                 {group.assignedUser && ` → ${group.assignedUser.first_name} ${group.assignedUser.last_name}`}
                               </span>
                             </div>
                           )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                       <div className="text-sm font-bold text-slate-900 tracking-tight">{group.quantity}</div>
                       <div className="text-[10px] font-semibold text-slate-400 uppercase">
                         {group.availableCount > 0 ? `${group.availableCount} available` : 'All assigned'}
                       </div>
                    </td>
                    <td className="hidden md:table-cell p-4 text-sm text-slate-600">
                       {allAssigned ? (
                         <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded px-2 py-0.5 text-xs font-semibold flex items-center gap-1 w-fit">
                           <Lock size={10} /> Fully Assigned
                         </span>
                       ) : someAssigned ? (
                         <span className="bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5 text-xs font-semibold w-fit block">
                           Partial
                         </span>
                       ) : (
                         <span className="bg-white text-slate-800 border border-slate-200 rounded px-2 py-0.5 text-xs font-normal capitalize">
                            Available
                         </span>
                       )}
                    </td>
                    <td className="p-4 text-sm text-slate-600 text-right">
                       <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => { setSelectedItem(group); setBulkDeleteModalOpen(true); }} 
                            title="Wipe Entire Group" 
                            className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 shadow-sm flex items-center justify-center transition-colors"
                          >
                             <Trash2 size={15} />
                          </button>
                          {/* Transfer — disabled if all items assigned */}
                          <button 
                            onClick={() => !allAssigned && navigate(`/transfers?product_id=${group.product_id}&from_node_id=${group.org_node_id}`)} 
                            title={allAssigned ? 'Item is assigned to a user — cannot transfer' : 'Transfer Stock'} 
                            disabled={allAssigned}
                            className={`w-8 h-8 rounded-lg bg-white border shadow-sm flex items-center justify-center transition-colors ${allAssigned ? 'border-slate-100 text-slate-300 cursor-not-allowed' : 'border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200'}`}
                          >
                             {allAssigned ? <Lock size={13} /> : <ArrowLeftRight size={15} />}
                          </button>
                          {/* Discharge — disabled if all items assigned */}
                          <button 
                            onClick={() => !allAssigned && navigate(`/discharge?product_id=${group.product_id}&org_node_id=${group.org_node_id}`)} 
                            title={allAssigned ? 'Item is assigned to a user — cannot discharge' : 'Discharge Stock'} 
                            disabled={allAssigned}
                            className={`w-8 h-8 rounded-lg bg-white border shadow-sm flex items-center justify-center transition-colors ${allAssigned ? 'border-slate-100 text-slate-300 cursor-not-allowed' : 'border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200'}`}
                          >
                             {allAssigned ? <Lock size={13} /> : <PackageMinus size={15} />}
                          </button>
                          <button onClick={() => setUnitLedgerItem(group)} className="px-3 h-8 bg-slate-950 text-white text-xs font-semibold rounded-lg hover:bg-slate-900 shadow-sm transition-colors flex items-center gap-1.5">
                             <Layers size={14} /> <span className="hidden sm:inline">Open Ledger</span>
                          </button>
                       </div>
                    </td>
                  </tr>
                );
              })}
              {groupedItems.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-16 text-center">
                    <Box size={40} className="mx-auto text-slate-200 mb-2" />
                    <h2 className="text-base font-bold text-slate-400 tracking-tight">No inventory found</h2>
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
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setQrItem(null)} />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-md overflow-hidden animate-in zoom-in-95 duration-500">
             <div className="p-4 text-center bg-slate-50 border-b border-slate-100">
                <QrCode size={32} className="mx-auto mb-2 text-slate-900" />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Physical Identity Tag</h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">{qrItem.product?.name}</p>
             </div>
             <div className="p-4 flex flex-col items-center gap-3 bg-white">
                <div className="p-3 bg-white rounded-xl shadow-sm ring-1 ring-slate-100">
                   <QRCode value={JSON.stringify({ id: qrItem.id, sku: qrItem.product?.sku, serial: qrItem.serial_number })} size={200} level="H" />
                </div>
                <div className="text-center">
                   <p className="text-xs font-semibold text-slate-400 mb-1">Unique Identity</p>
                   <p className="font-mono text-sm font-bold text-slate-900 uppercase">{qrItem.serial_number || `REG-ID-${qrItem.id}`}</p>
                </div>
             </div>
             <div className="p-4 bg-slate-50 flex flex-col gap-3">
                <button onClick={() => window.print()} className="w-full h-10 bg-slate-950 text-white font-semibold rounded-lg text-xs hover:bg-slate-900 transition-all">Print Tag</button>
                <button onClick={() => setQrItem(null)} className="text-xs font-semibold text-slate-400 hover:text-slate-600 text-center">Dismiss</button>
             </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      <Modal isOpen={bulkDeleteModalOpen} onClose={() => setBulkDeleteModalOpen(false)} title="Confirm Registry Wipe" onConfirm={handleBulkDelete} confirmText="Delete All Units" danger>
        <div className="p-4 text-center space-y-4">
           <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
           </div>
           <p className="text-sm text-slate-600">
              This action will permanently delete <span className="font-semibold text-red-600">{selectedItem?.quantity} units</span> of <span className="font-bold underline">{selectedItem?.product?.name}</span> from this node. 
           </p>
           <div className="bg-red-50 p-3 rounded-lg text-xs font-semibold text-red-700">
              Action is irreversible. Audit trail will be logged.
           </div>
        </div>
      </Modal>

      {/* Adjust Modal */}
      <Modal isOpen={adjustModalOpen} onClose={() => setAdjustModalOpen(false)} title="Quick Adjust" onConfirm={handleAdjust}>
        <div className="space-y-4 p-2">
           <div className="grid grid-cols-2 gap-4">
              <select value={adjustmentData.type} onChange={e => setAdjustmentData({...adjustmentData, type: e.target.value})} className="h-10 bg-slate-50 border border-slate-200 rounded-lg px-3 font-semibold text-xs outline-none">
                 <option value="add">Add (+)</option>
                 <option value="subtract">Subtract (-)</option>
              </select>
              <input type="number" value={adjustmentData.adjustment} onChange={e => setAdjustmentData({...adjustmentData, adjustment: parseInt(e.target.value) || 0})} className="h-10 bg-slate-50 border border-slate-200 rounded-lg px-3 font-semibold text-sm text-center outline-none focus:border-blue-500" />
           </div>
           <Input placeholder="Justification for adjustment..." value={adjustmentData.reason} onChange={e => setAdjustmentData({...adjustmentData, reason: e.target.value})} />
        </div>
      </Modal>

      <ActivityLogPanel 
        isOpen={activityPanelOpen} 
        onClose={() => setActivityPanelOpen(false)} 
      />
    </div>
  );
};

export default InventoryPage;