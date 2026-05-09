import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Box, Search, Settings2, GitFork, Merge, Trash2, FileSearch, Zap,
  Send, ArrowLeftRight, MessageSquareWarning, PackagePlus, PackageMinus,
  Building2, Tag, Cpu, DollarSign, Calendar, ScanLine, Info, X,
  AlertTriangle, Shield, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';

// ─── IDENTITY CARD MODAL ─────────────────────────────────────────────────────
const IdentityCard = ({ item, onClose }) => {
  const [tab, setTab] = useState('overview');
  if (!item) return null;
  const p = item.product || {};

  const Row = ({ label, value, mono = false }) => (
    value ? (
      <div className="flex justify-between items-start py-2 border-b border-slate-50 last:border-0 gap-4">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">{label}</span>
        <span className={`text-xs font-semibold text-slate-800 text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
      </div>
    ) : null
  );

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Info size={14} /> },
    { id: 'physical', label: 'Physical', icon: <Box size={14} /> },
    { id: 'technical', label: 'Technical', icon: <Cpu size={14} /> },
    { id: 'financial', label: 'Financial', icon: <DollarSign size={14} /> },
    { id: 'lifecycle', label: 'Lifecycle', icon: <Calendar size={14} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-slate-950 p-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-500/30">
              <Box className="text-white" size={26} />
            </div>
            <div>
              <h2 className="text-white font-black text-xl tracking-tighter">{p.name || '—'}</h2>
              <div className="text-blue-400 text-[10px] font-black uppercase tracking-widest">{p.sku} · {p.brand} {p.model}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 transition-all text-white">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-slate-100 shrink-0 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${tab === t.id ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6">
          {tab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-2xl text-center">
                  <div className="text-4xl font-black text-blue-600 tracking-tighter">{item.quantity}</div>
                  <div className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Quantity in Stock</div>
                </div>
                <div className={`p-4 rounded-2xl text-center ${item.quantity <= item.minimum_quantity ? 'bg-red-50' : 'bg-emerald-50'}`}>
                  <div className={`text-lg font-black uppercase tracking-tight ${item.quantity <= item.minimum_quantity ? 'text-red-600' : 'text-emerald-600'}`}>
                    {item.quantity <= item.minimum_quantity ? 'LOW STOCK' : 'SECURE'}
                  </div>
                  <div className={`text-[9px] font-black uppercase tracking-widest ${item.quantity <= item.minimum_quantity ? 'text-red-400' : 'text-emerald-400'}`}>
                    Min: {item.minimum_quantity} | Max: {item.maximum_quantity || '∞'}
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 rounded-2xl divide-y divide-slate-100">
                <Row label="Status" value={item.status} />
                <Row label="Condition" value={item.condition} />
                <Row label="Serial Number" value={item.serial_number} mono />
                <Row label="Batch / Lot" value={item.batch_number} mono />
                <Row label="Location" value={item.location_details} />
                <Row label="Storage Node" value={item.organizationNode?.name} />
                <Row label="Category" value={`${p.category}${p.sub_category ? ' → ' + p.sub_category : ''}`} />
                <Row label="Unit of Measure" value={p.unit} />
              </div>
              {p.description && (
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Description</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{p.description}</p>
                </div>
              )}
            </div>
          )}

          {tab === 'physical' && (
            <div className="bg-slate-50 rounded-2xl divide-y divide-slate-100">
              <Row label="Weight" value={p.weight} />
              <Row label="Dimensions" value={p.dimensions} />
              <Row label="Color" value={p.color} />
              <Row label="Material" value={p.material} />
              {!p.weight && !p.dimensions && !p.color && !p.material && (
                <p className="text-center text-slate-400 text-xs py-10">No physical specs recorded.</p>
              )}
            </div>
          )}

          {tab === 'technical' && (
            <div className="bg-slate-50 rounded-2xl divide-y divide-slate-100">
              <Row label="Processor" value={p.processor} />
              <Row label="RAM" value={p.ram} />
              <Row label="Storage" value={p.storage} />
              <Row label="Graphics" value={p.graphics} />
              <Row label="Display" value={p.display} />
              <Row label="Operating System" value={p.os} />
              <Row label="Battery" value={p.battery} />
              <Row label="Ports" value={p.ports} />
              {!p.processor && !p.ram && !p.storage && (
                <p className="text-center text-slate-400 text-xs py-10">No technical specs recorded.</p>
              )}
            </div>
          )}

          {tab === 'financial' && (
            <div className="bg-slate-50 rounded-2xl divide-y divide-slate-100">
              <Row label="Unit Cost" value={item.unit_cost ? `${parseFloat(item.unit_cost).toLocaleString()}` : null} />
              <Row label="Current Value" value={item.current_value ? `${parseFloat(item.current_value).toLocaleString()}` : null} />
              <Row label="Supplier" value={item.supplier} />
              <Row label="Invoice Number" value={item.invoice_number} mono />
              {!item.unit_cost && !item.supplier && (
                <p className="text-center text-slate-400 text-xs py-10">No financial data recorded.</p>
              )}
            </div>
          )}

          {tab === 'lifecycle' && (
            <div className="bg-slate-50 rounded-2xl divide-y divide-slate-100">
              <Row label="Purchase Date" value={item.purchase_date ? new Date(item.purchase_date).toLocaleDateString() : null} />
              <Row label="Warranty Expiry" value={item.warranty_expiry ? new Date(item.warranty_expiry).toLocaleDateString() : null} />
              <Row label="Expiry Date" value={item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : null} />
              <Row label="Last Counted" value={item.last_counted_at ? new Date(item.last_counted_at).toLocaleDateString() : null} />
              {!item.purchase_date && !item.warranty_expiry && (
                <p className="text-center text-slate-400 text-xs py-10">No lifecycle dates recorded.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
const ItemManagementPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [identityItem, setIdentityItem] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [decommissionModalOpen, setDecommissionModalOpen] = useState(false);

  const [adjustmentData, setAdjustmentData] = useState({ adjustment: 0, type: 'add', reason: '' });
  const [splitData, setSplitData] = useState({ quantity: 1, serial_number: '', batch_number: '', location_details: '' });
  const [decommissionReason, setDecommissionReason] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: inventoryData, loading, refetch } = useFetch('/inventory', {
    params: { search, org_unit_id: selectedUnit, limit: 200 }
  });

  const allItems = inventoryData?.data || [];
  const filteredItems = statusFilter === 'all' ? allItems : allItems.filter(i => i.status === statusFilter);

  const lowStock = allItems.filter(i => i.quantity <= i.minimum_quantity && i.minimum_quantity > 0).length;
  const totalQty = allItems.reduce((s, i) => s + (i.quantity || 0), 0);

  const handleAdjust = async () => {
    try {
      await inventoryService.adjustQuantity(selectedItem.id, adjustmentData.adjustment, adjustmentData.type, adjustmentData.reason);
      toast.success('Quantity adjusted');
      setAdjustModalOpen(false);
      refetch();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const handleSplit = async () => {
    try {
      await inventoryService.splitItem(selectedItem.id, splitData);
      toast.success('Registry divided successfully');
      setSplitModalOpen(false);
      refetch();
    } catch (e) { toast.error(e.response?.data?.message || 'Split failed'); }
  };

  const handleMerge = async () => {
    try {
      const targetId = selectedIds[0];
      const sourceIds = selectedIds.slice(1);
      await inventoryService.mergeItems(targetId, sourceIds);
      toast.success(`${sourceIds.length + 1} records consolidated`);
      setMergeModalOpen(false);
      setSelectedIds([]);
      refetch();
    } catch (e) { toast.error(e.response?.data?.message || 'Merge failed'); }
  };

  const handleDecommission = async () => {
    try {
      await inventoryService.decommissionItem(selectedItem.id, decommissionReason);
      toast.success('Asset decommissioned');
      setDecommissionModalOpen(false);
      refetch();
    } catch (e) { toast.error(e.response?.data?.message || 'Decommission failed'); }
  };

  if (loading && !inventoryData) return <LoadingSpinner />;

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 py-10 px-6 animate-in fade-in duration-500">
      {identityItem && <IdentityCard item={identityItem} onClose={() => setIdentityItem(null)} />}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[45px] border border-slate-100 shadow-xl shadow-slate-100/80">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-slate-950 rounded-[28px] flex items-center justify-center shadow-2xl rotate-3">
            <Box className="text-blue-500" size={32} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Ops Cockpit</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                {user?.organizationNode?.name || user?.organization_node?.name || 'Authorized Domain'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/store')}
            className="group flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-black px-6 h-16 rounded-[28px] uppercase text-xs tracking-widest shadow-xl shadow-blue-200 transition-all border-b-4 border-blue-800"
          >
            <PackagePlus size={20} /> Store Arrival
          </button>
          <button
            onClick={() => navigate('/discharge')}
            className="group flex items-center gap-3 bg-slate-900 hover:bg-black text-white font-black px-6 h-16 rounded-[28px] uppercase text-xs tracking-widest shadow-xl shadow-slate-200 transition-all border-b-4 border-slate-700"
          >
            <PackageMinus size={20} /> Issue Asset
          </button>
        </div>
      </div>

      {/* Pulse Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total SKUs', value: allItems.length, color: 'blue' },
          { label: 'Total Units', value: totalQty.toLocaleString(), color: 'emerald' },
          { label: 'Low Stock', value: lowStock, color: lowStock > 0 ? 'red' : 'slate' },
          { label: 'Selected', value: selectedIds.length, color: selectedIds.length > 0 ? 'purple' : 'slate' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`bg-white rounded-[30px] p-6 shadow-sm ring-1 ring-slate-100 text-center`}>
            <div className={`text-4xl font-black tracking-tighter italic text-${color}-600`}>{value}</div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Sidebar */}
        <div className="xl:col-span-3 space-y-6">
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-8 space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest">Filter Matrix</h3>
              <button onClick={() => refetch()} className="p-2 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-500 transition-all">
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Search</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="SKU, name, serial..."
                  className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:border-blue-300 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Node Scope</label>
              <CascadingUnitSelector value={selectedUnit} onChange={setSelectedUnit} className="bg-white" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Filter</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="available">Available</option>
                <option value="assigned">Assigned</option>
                <option value="maintenance">Maintenance</option>
                <option value="decommissioned">Decommissioned</option>
              </select>
            </div>

            {selectedIds.length > 1 && (
              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={() => navigate(`/inventory/merge?ids=${selectedIds.join(',')}`)}
                  className="w-full flex items-center justify-center gap-2 h-14 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-lg shadow-amber-100 transition-all"
                >
                  <Merge size={18} /> Merge {selectedIds.length} Records
                </button>
              </div>
            )}
          </div>

          {/* Dark Pulse Panel */}
          <div className="bg-slate-950 rounded-[40px] p-8 text-white relative overflow-hidden">
            <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-blue-600/10 rounded-full blur-3xl" />
            <div className="relative z-10 space-y-5">
              <div className="flex items-center gap-2">
                <Zap className="text-blue-500" size={16} />
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-blue-400">Inventory Pulse</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-4xl font-black italic tracking-tighter">{allItems.length}</div>
                  <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">SKU Lines</div>
                </div>
                <div>
                  <div className={`text-4xl font-black italic tracking-tighter ${lowStock > 0 ? 'text-red-500' : 'text-emerald-400'}`}>
                    {lowStock}
                  </div>
                  <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Replenish</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Table */}
        <div className="xl:col-span-9">
          <div className="bg-white rounded-[45px] shadow-xl shadow-slate-100/80 ring-1 ring-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-5 text-left w-12">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === filteredItems.length && filteredItems.length > 0}
                        onChange={() => setSelectedIds(selectedIds.length === filteredItems.length ? [] : filteredItems.map(i => i.id))}
                        className="w-4 h-4 rounded accent-blue-600"
                      />
                    </th>
                    <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Identity</th>
                    <th className="px-4 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Qty</th>
                    <th className="px-4 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Condition</th>
                    <th className="px-4 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Node</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Serial / Batch</th>
                    <th className="px-6 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredItems.map(item => {
                    const isLow = item.quantity <= item.minimum_quantity && item.minimum_quantity > 0;
                    return (
                      <tr key={item.id} className={`group hover:bg-slate-50/60 transition-all duration-150 ${selectedIds.includes(item.id) ? 'bg-blue-50/40' : ''}`}>
                        <td className="px-6 py-5">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(item.id)}
                            onChange={() => setSelectedIds(prev => prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id])}
                            className="w-4 h-4 rounded accent-blue-600"
                          />
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                              <Box className="text-slate-400 group-hover:text-blue-500 transition-colors" size={20} />
                            </div>
                            <div>
                              <div className="font-black text-slate-900 text-sm tracking-tight">{item.product?.name}</div>
                              <div className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">{item.product?.sku}</div>
                              {item.product?.brand && <div className="text-[9px] text-slate-400">{item.product.brand} {item.product.model}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-5">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-black tracking-tighter text-slate-900">{item.quantity}</span>
                            {isLow && <AlertTriangle size={14} className="text-red-500" />}
                          </div>
                          {item.minimum_quantity > 0 && (
                            <div className="text-[9px] text-slate-400 font-bold">Min: {item.minimum_quantity}</div>
                          )}
                        </td>
                        <td className="px-4 py-5">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            item.condition === 'new' ? 'bg-emerald-100 text-emerald-700' :
                            item.condition === 'damaged' ? 'bg-red-100 text-red-700' :
                            item.condition === 'maintenance' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {item.condition || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-5">
                          <div className="flex items-center gap-2">
                            <Building2 size={12} className="text-slate-400 shrink-0" />
                            <span className="text-[10px] font-bold text-slate-600">{item.organizationNode?.name || '—'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="text-[10px] font-mono text-slate-500">
                            {item.serial_number && <div>SN: {item.serial_number}</div>}
                            {item.batch_number && <div>Batch: {item.batch_number}</div>}
                            {!item.serial_number && !item.batch_number && <span className="text-slate-300">—</span>}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-200">
                            {/* Identity Card */}
                            <button onClick={() => setIdentityItem(item)} title="View Identity Card" className="w-9 h-9 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-200 shadow-sm flex items-center justify-center transition-all">
                              <Info size={14} />
                            </button>
                            {/* Adjust */}
                            <button onClick={() => { setSelectedItem(item); setAdjustmentData({ adjustment: 0, type: 'add', reason: '' }); setAdjustModalOpen(true); }} title="Adjust Quantity" className="w-9 h-9 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-emerald-600 hover:border-emerald-200 shadow-sm flex items-center justify-center transition-all">
                              <Zap size={14} />
                            </button>
                            <button disabled={item.quantity <= 1} onClick={() => navigate(`/inventory/split?inventory_id=${item.id}`)} title="Split Registry" className="w-9 h-9 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-purple-600 hover:border-purple-200 shadow-sm flex items-center justify-center transition-all disabled:opacity-30">
                              <GitFork size={14} />
                            </button>
                            {/* Transfer */}
                            <button onClick={() => navigate(`/transfers/new?product_id=${item.product_id}&from_node_id=${item.org_node_id}`)} title="Transfer Between Nodes" className="w-9 h-9 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-amber-600 hover:border-amber-200 shadow-sm flex items-center justify-center transition-all">
                              <ArrowLeftRight size={14} />
                            </button>
                            {/* Request */}
                            <button onClick={() => navigate(`/requests/new?product_id=${item.product_id}`)} title="Request Replenishment" className="w-9 h-9 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-200 shadow-sm flex items-center justify-center transition-all">
                              <Send size={14} />
                            </button>
                            {/* Report Issue */}
                            <button onClick={() => navigate(`/report-problem?inventory_id=${item.id}`)} title="Report Issue" className="w-9 h-9 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-orange-500 hover:border-orange-200 shadow-sm flex items-center justify-center transition-all">
                              <MessageSquareWarning size={14} />
                            </button>
                            {/* Decommission */}
                            <button onClick={() => { setSelectedItem(item); setDecommissionReason(''); setDecommissionModalOpen(true); }} title="Decommission" className="w-9 h-9 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-red-500 hover:border-red-200 shadow-sm flex items-center justify-center transition-all">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-32 text-slate-300 gap-5">
                  <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center">
                    <FileSearch size={40} className="opacity-20" />
                  </div>
                  <div className="text-center">
                    <p className="font-black uppercase tracking-[0.3em] text-xs">Ledger Clear</p>
                    <p className="text-[10px] opacity-60 mt-1">No assets found in selected scope.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODALS */}

      {/* Adjust */}
      <Modal isOpen={adjustModalOpen} onClose={() => setAdjustModalOpen(false)} title="Quantity Adjustment" onConfirm={handleAdjust} confirmText="Apply Adjustment">
        <div className="space-y-6 p-2">
          <div className="p-6 bg-slate-900 rounded-[30px] text-white flex justify-between items-center">
            <div>
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Projected Total</div>
              <div className="text-5xl font-black italic tracking-tighter">
                {adjustmentData.type === 'add' && ((selectedItem?.quantity || 0) + (parseInt(adjustmentData.adjustment) || 0))}
                {adjustmentData.type === 'subtract' && ((selectedItem?.quantity || 0) - (parseInt(adjustmentData.adjustment) || 0))}
                {adjustmentData.type === 'set' && (parseInt(adjustmentData.adjustment) || 0)}
              </div>
            </div>
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center"><Zap className="text-white" size={28} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operation</label>
              <select value={adjustmentData.type} onChange={e => setAdjustmentData({ ...adjustmentData, type: e.target.value })} className="w-full h-12 bg-slate-100 rounded-2xl px-4 font-black text-sm outline-none cursor-pointer">
                <option value="add">Add (+)</option>
                <option value="subtract">Remove (−)</option>
                <option value="set">Set (=)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</label>
              <input type="number" value={adjustmentData.adjustment} onChange={e => setAdjustmentData({ ...adjustmentData, adjustment: parseInt(e.target.value) || 0 })} className="w-full h-12 bg-slate-100 rounded-2xl px-4 font-black text-xl text-blue-600 text-center outline-none" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reason (Audit Log)</label>
            <input value={adjustmentData.reason} onChange={e => setAdjustmentData({ ...adjustmentData, reason: e.target.value })} placeholder="Reason for adjustment..." className="w-full h-12 bg-slate-100 rounded-2xl px-4 font-medium text-sm outline-none" />
          </div>
        </div>
      </Modal>



      {/* Decommission */}
      <Modal isOpen={decommissionModalOpen} onClose={() => setDecommissionModalOpen(false)} title="Decommission Asset" onConfirm={handleDecommission} confirmText="Retire Asset">
        <div className="space-y-6 p-2 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-[30px] flex items-center justify-center mx-auto shadow-xl shadow-red-100">
            <Trash2 className="text-red-500" size={36} />
          </div>
          <div>
            <h4 className="text-xl font-black text-slate-900 tracking-tighter italic mb-2">RETIRE ASSET RECORD</h4>
            <p className="text-xs text-slate-400 uppercase tracking-widest leading-relaxed">
              Asset will be zero-stocked and tagged <span className="text-red-500 font-black">DECOMMISSIONED</span>. Audit trail is preserved.
            </p>
          </div>
          <input
            value={decommissionReason}
            onChange={e => setDecommissionReason(e.target.value)}
            placeholder="Mandatory retirement justification..."
            className="w-full h-12 bg-red-50 rounded-2xl px-4 font-medium text-sm text-red-900 placeholder:text-red-300 outline-none focus:ring-2 focus:ring-red-200"
          />
        </div>
      </Modal>
    </div>
  );
};

export default ItemManagementPage;
