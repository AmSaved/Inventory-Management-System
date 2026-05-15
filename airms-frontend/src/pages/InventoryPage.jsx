import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { usePermissions } from '../hooks/usePermissions';
import Card, { CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Table, { TableHead, TableHeader, TableBody, TableRow, TableCell } from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CascadingUnitSelector from '../components/common/CascadingUnitSelector';
import { formatNumber, formatDate } from '../utils/formatters';
import inventoryService from '../services/inventoryService';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/ui/Pagination';
import { 
  Package, 
  Search, 
  Filter, 
  Plus, 
  Settings2, 
  History, 
  ArrowRight,
  ShieldCheck,
  Building2,
  Box,
  AlertTriangle,
  Fingerprint,
  QrCode,
  Printer,
  Eye
} from 'lucide-react';
import QRLabel from '../components/inventory/QRLabel';
import ActivityLogPanel from '../components/inventory/ActivityLogPanel';

const InventoryPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canAdjustInventory } = usePermissions();
  
  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [adjusting, setAdjusting] = useState(false);
  const [activityPanelOpen, setActivityPanelOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustmentData, setAdjustmentData] = useState({
    adjustment: 0,
    type: 'add',
    reason: ''
  });

  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [itemForQr, setItemForQr] = useState(null);
  const [page, setPage] = useState(1);

  const handlePrint = () => {
    window.print();
  };

  // Auto-set the user's unit for filtering if not already set
  useEffect(() => {
    if (user?.role?.level < 100 && user?.org_node_id && !selectedUnit) {
      // setSelectedUnit(user.org_node_id); 
      // Note: We might want "All" by default for admins, but for others, auto-select is better.
    }
  }, [user, selectedUnit]);

  const { data: inventoryData, pagination, loading, refetch } = useFetch('/inventory', {
    params: {
      search,
      org_node_id: selectedUnit,
      page,
      limit: 15
    }
  });

  // Reset to page 1 when search or unit changes
  useEffect(() => {
    setPage(1);
  }, [search, selectedUnit]);

  const handleAdjust = async () => {
    if (!adjustmentData.adjustment && adjustmentData.type !== 'set') {
        toast.error('Please enter a valid adjustment value');
        return;
    }
    setAdjusting(true);
    try {
      await inventoryService.adjustQuantity(
        selectedItem.id,
        adjustmentData.adjustment,
        adjustmentData.type,
        adjustmentData.reason
      );
      toast.success('Inventory state updated across system');
      setAdjustModalOpen(false);
      refetch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed');
    } finally {
      setAdjusting(false);
    }
  };

  const getStockStatus = (quantity, minimum) => {
    if (quantity <= 0) return { label: 'DELETED/EMPTY', color: 'danger', icon: <AlertTriangle size={12} /> };
    if (quantity <= minimum) return { label: 'CRITICAL LOW', color: 'warning', icon: <History size={12} /> };
    return { label: 'SECURE STOCK', color: 'success', icon: <ShieldCheck size={12} /> };
  };

  // We remove the full-page loading return to keep the UI static during fetch
  // if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 py-10 px-6 print:hidden">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-2xl">
                <Box className="text-blue-400" size={24} />
             </div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Inventory Assets</h1>
          </div>
          <p className="text-slate-400 font-bold text-[10px] tracking-[0.2em] uppercase ml-1">
            Global Infrastructure Ledger — {user?.company?.name || 'Authorized Entity'}
          </p>
        </div>
        
         <div className="flex gap-3">
           <Button 
            variant="outline"
            className="border-2 border-slate-200 rounded-2xl px-6 h-14 font-black text-slate-600 hover:bg-slate-50 uppercase text-[10px] tracking-widest"
            onClick={() => setActivityPanelOpen(true)}
           >
             <History size={16} className="mr-2" /> View Logs
           </Button>
            {canAdjustInventory && (
              <Button 
                onClick={() => navigate('/store')}
                className="bg-blue-600 border-b-4 border-blue-800 hover:bg-blue-700 text-white font-black px-8 h-14 rounded-2xl transition-all shadow-xl shadow-blue-100 flex items-center gap-2 uppercase text-[10px] tracking-[0.15em]"
              >
                <Plus size={18} /> Add New Stock
              </Button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* Left Sidebar: Advanced Filters */}
        <div className="lg:col-span-1 space-y-8">
           <div className="p-8 bg-white border border-slate-100 rounded-[40px] shadow-sm space-y-8">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <Filter size={16} className="text-blue-600" />
                    <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest">Scope filtering</h3>
                 </div>
                 <Settings2 size={16} className="text-slate-300" />
              </div>

              <div className="space-y-4">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Organizational Unit</label>
                  <CascadingUnitSelector 
                    value={selectedUnit}
                    onChange={setSelectedUnit}
                    className="bg-white"
                  />
                 <p className="text-[9px] text-slate-400 px-2 italic leading-tight">
                    * Results include current unit and all child-level assets.
                 </p>
              </div>

              <div className="space-y-4">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Universal Search</label>
                  <div className="relative group">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" size={16} />
                     <Input
                       placeholder="Search by ID or Name..."
                       value={searchValue}
                       onChange={(e) => setSearchValue(e.target.value)}
                       onKeyDown={(e) => {
                         if (e.key === 'Enter') {
                           setSearch(searchValue);
                         }
                       }}
                       className="pl-12 h-14 rounded-2xl border-2 border-slate-50 font-bold text-sm bg-slate-50/30"
                     />
                     <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-2 ml-1">Enter to Search</p>
                  </div>
              </div>

              <div className="bg-slate-900 rounded-3xl p-6 relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-2">
                   <div className="w-8 h-8 rounded-full bg-blue-500/10 blur-xl" />
                 </div>
                 <div className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">Quick Stats</div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <div className="text-2xl font-black text-white italic tracking-tighter">{inventoryData?.length || 0}</div>
                       <div className="text-[8px] font-bold text-slate-500 uppercase">Records</div>
                    </div>
                    <div>
                       <div className="text-2xl font-black text-white italic tracking-tighter">
                          {inventoryData?.reduce((acc, curr) => acc + (curr.quantity <= curr.minimum_quantity ? 1 : 0), 0)}
                       </div>
                       <div className="text-[8px] font-bold text-slate-500 uppercase">Critical</div>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Right Main Content: Ledger */}
        <div className="lg:col-span-3">
          <Card className="rounded-[40px] border-none bg-white shadow-2xl shadow-slate-100 overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHead>
                  <TableRow className="bg-slate-50/50 border-b-2 border-slate-50">
                    <TableHeader className="py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Details</TableHeader>
                    <TableHeader className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Unit</TableHeader>
                    <TableHeader className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</TableHeader>
                    <TableHeader className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right px-8">Actions</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    // Skeleton Rows for high-end perceived performance
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={`skeleton-${i}`} className="animate-pulse">
                        <TableCell className="py-6 px-8">
                           <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-slate-100 rounded-2xl" />
                              <div className="space-y-2">
                                 <div className="h-4 w-32 bg-slate-100 rounded-lg" />
                                 <div className="h-2 w-20 bg-slate-50 rounded-lg" />
                              </div>
                           </div>
                        </TableCell>
                        <TableCell><div className="h-8 w-24 bg-slate-50 rounded-xl" /></TableCell>
                        <TableCell><div className="h-8 w-32 bg-slate-50 rounded-xl" /></TableCell>
                        <TableCell className="px-8 text-right"><div className="h-10 w-32 bg-slate-50 rounded-xl ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : inventoryData?.map((item) => {
                    const stockStatus = getStockStatus(item.quantity, item.minimum_quantity);
                    return (
                      <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors group">
                        <TableCell className="py-6 px-8">
                           <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-white rounded-2xl border-2 border-slate-50 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                                 <Package className="text-slate-200 group-hover:text-blue-400 transition-colors" size={24} />
                              </div>
                              <div>
                                 <div className="font-black text-slate-900 text-sm tracking-tight">{item.product?.name}</div>
                                 <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                    <span className="text-blue-500">{item.product?.sku}</span>
                                    <span> — </span>
                                    <span>{item.product?.category}</span>
                                 </div>
                              </div>
                           </div>
                        </TableCell>
                        <TableCell>
                           <div className="flex items-center gap-2">
                             <div className="p-2 bg-slate-50 rounded-xl">
                               <Building2 size={12} className="text-slate-400" />
                             </div>
                             <div>
                               <div className="text-xs font-black text-slate-700">{item.organizationNode?.name}</div>
                               <div className="text-[9px] font-bold text-slate-400 uppercase">{item.organizationNode?.code}</div>
                             </div>
                           </div>
                        </TableCell>
                        <TableCell>
                           <div className="space-y-1.5">
                              <div className="flex items-center gap-4">
                                 <div className="text-2xl font-black text-slate-900 tracking-tighter italic">{formatNumber(item.quantity)}</div>
                                 <Badge variant={stockStatus.color} className="rounded-lg px-2.5 py-1 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 border-none shadow-sm">
                                    {stockStatus.icon}
                                    {stockStatus.label}
                                 </Badge>
                              </div>
                              <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Level: {formatNumber(item.minimum_quantity)} Min</div>
                           </div>
                        </TableCell>
                        <TableCell className="px-8 text-right">
                          <div className="flex items-center justify-end gap-2 transition-all">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/inventory/${item.id}`)}
                              className="w-10 h-10 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-blue-600 shadow-sm"
                              title="View Asset Profile"
                            >
                              <Eye size={14} />
                            </Button>
                             <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setItemForQr(item);
                                  setQrModalOpen(true);
                                }}
                                className="w-10 h-10 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 shadow-sm"
                                title="Print Asset Label"
                              >
                                <QrCode size={14} />
                              </Button>
                              {canAdjustInventory && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setAdjustmentData({ adjustment: 0, type: 'add', reason: '' });
                                  setAdjustModalOpen(true);
                                }}
                                className="w-10 h-10 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-emerald-600 shadow-sm"
                              >
                                <Plus size={14} />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {inventoryData?.length === 0 && (
                <div className="flex flex-col items-center justify-center py-32 text-slate-400 space-y-4">
                   <div className="w-20 h-20 bg-slate-50 rounded-[30px] flex items-center justify-center">
                      <Box size={40} className="text-slate-100" />
                   </div>
                   <div className="text-center">
                     <p className="font-black uppercase tracking-[0.2em] text-[10px]">No infrastructure records</p>
                     <p className="text-[10px] font-bold opacity-60">Adjust criteria or expand unit scope.</p>
                   </div>
                </div>
              )}
            </CardContent>
            <Pagination 
              pagination={pagination} 
              onPageChange={setPage} 
            />
          </Card>
        </div>
      </div>

      {/* Adjust Modal: High-End Refactor */}
      <Modal
        isOpen={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        title="Asset State Adjustment"
        onConfirm={handleAdjust}
        confirmText="Push System Update"
        cancelText="Discard"
      >
        <div className="space-y-8 p-2">
          <div className="flex items-center gap-6 p-6 bg-slate-50 rounded-[30px] border border-slate-100">
             <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center">
                <Box className="text-blue-600" size={32} />
             </div>
             <div>
                <h4 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-1">{selectedItem?.product?.name}</h4>
                <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{selectedItem?.product?.sku}</div>
                <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase mt-1">
                  <Building2 size={10} /> {selectedItem?.organizationNode?.name}
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Transformation Type</label>
                <select
                  className="w-full h-14 bg-white border-2 border-slate-100 rounded-2xl px-4 font-bold text-slate-900 focus:border-blue-500 outline-none transition-all cursor-pointer"
                  value={adjustmentData.type}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, type: e.target.value })}
                >
                  <option value="add">Quantity Increment (+)</option>
                  <option value="subtract">Quantity Reduction (-)</option>
                  <option value="set">Absolute Override (=)</option>
                </select>
             </div>
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Movement Value</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={adjustmentData.adjustment}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, adjustment: parseInt(e.target.value) || 0 })}
                  className="h-14 rounded-2xl border-2 border-slate-100 font-black text-xl text-blue-600"
                />
             </div>
          </div>

          <div className="space-y-2">
             <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Justification Reason</label>
             <Input
               placeholder="Audit trial documentation..."
               value={adjustmentData.reason}
               onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
               className="h-14 rounded-2xl border-2 border-slate-100 font-medium"
             />
          </div>

          <div className="p-6 bg-slate-900 rounded-[30px] flex items-center justify-between group">
             <div>
                <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Projected Stock Level</div>
                <div className="text-3xl font-black text-white italic tracking-tighter">
                    {adjustmentData.type === 'add' && (selectedItem?.quantity || 0) + adjustmentData.adjustment}
                    {adjustmentData.type === 'subtract' && (selectedItem?.quantity || 0) - adjustmentData.adjustment}
                    {adjustmentData.type === 'set' && adjustmentData.adjustment}
                </div>
             </div>
             <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-blue-600/20 transition-colors">
                <ArrowRight className="text-white opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" size={24} />
             </div>
          </div>
        </div>
      </Modal>

      {/* QR Label Modal */}
      <Modal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title="Asset Label Preview"
        onConfirm={handlePrint}
        confirmText="Print Label"
      >
        <div className="py-4 flex flex-col items-center space-y-6">
          <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
            <QRLabel item={itemForQr} organizationName={user?.company?.name || 'AIRMS'} />
          </div>
          <div className="text-center space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Printer Optimization</p>
            <p className="text-xs text-slate-500 max-w-xs">
              Labels are formatted for 50mm x 30mm thermal printers or standard A4 sticker sheets.
            </p>
          </div>
        </div>
      </Modal>

      {/* Quick Activity Viewer Panel */}
      <ActivityLogPanel 
        isOpen={activityPanelOpen} 
        onClose={() => setActivityPanelOpen(false)} 
      />
    </div>
  );
};

export default InventoryPage;