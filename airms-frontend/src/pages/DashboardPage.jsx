import React, { useState, useEffect, useMemo, memo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import dashboardService from '../services/dashboardService';
import organizationService from '../services/organizationService';
import requestService from '../services/requestService';
import api from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CascadingUnitSelector from '../components/common/CascadingUnitSelector';
import ApprovalTaskCard from '../components/dashboard/ApprovalTaskCard';
import UserManagement from '../components/admin/UserManagement';
import RoleManagement from '../components/admin/RoleManagement';
import ProductManagement from '../components/admin/ProductManagement';
import OrganizationManagement from '../components/admin/OrganizationManagement';
import Modal from '../components/common/Modal';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';
import {
  Building2, Calendar, Box, PackagePlus, PackageMinus,
  ArrowLeftRight, Send, AlertTriangle, ClipboardCheck, Users,
  Layers, Activity, TrendingUp, Shield, ArrowRight, CheckCircle2,
  MoreVertical, Eye, Search, Filter, RotateCcw, MessageSquare,
  User as UserIcon, Package, Zap, Fingerprint, Activity as ActivityIcon,
  ChevronRight, LayoutGrid, Bell, History, XCircle, AlertOctagon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ─── DYNAMIC COMMAND MODULES ───────────────────────────────────────────────────
 */

/**
 * ─── DYNAMIC COMMAND MODULES (MEMOIZED) ─────────────────────────────────────────
 */

const KPITile = memo(({ label, value, icon, gradient, onClick, subLabel }) => (
  <motion.div 
    whileHover={{ y: -8, scale: 1.02 }}
    onClick={onClick}
    className={`relative group bg-white rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-50 transition-all duration-500 ${onClick ? 'cursor-pointer hover:shadow-[0_40px_80px_rgba(0,0,0,0.1)]' : ''} overflow-hidden`}
  >
    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-[0.05] transition-opacity duration-500 rounded-full -mr-16 -mt-16`}></div>
    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg shadow-blue-500/10 mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
      {React.cloneElement(icon, { size: 24 })}
    </div>
    <div className="text-5xl font-black text-slate-900 tracking-tighter italic mb-1">{value}</div>
    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">{label}</div>
    {subLabel && <div className="text-[9px] font-bold text-blue-500 uppercase tracking-widest mt-2 opacity-60">{subLabel}</div>}
  </motion.div>
));

const DecisionDeck = memo(({ approvals, onAction }) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between px-2">
       <div className="flex items-center gap-4">
          <div className="w-2 h-8 bg-rose-600 rounded-full" />
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">Authorization Command</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Pending Operational Approvals</p>
          </div>
       </div>
       <Link to="/requests" className="text-[10px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest bg-blue-50 px-6 py-2 rounded-full transition-all">
          View All
       </Link>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
       {approvals.slice(0, 4).map(task => (
          <ApprovalTaskCard key={task.id} task={task} onAction={onAction} />
       ))}
    </div>
  </div>
));

const AssetInsight = memo(({ inventory = [] }) => (
  <div className="space-y-8">
    <div className="flex items-center gap-4 px-2">
       <div className="w-2 h-8 bg-blue-600 rounded-full" />
       <div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Resource Analytics</h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Institutional Inventory Distribution</p>
       </div>
    </div>
    <div className="grid grid-cols-1 gap-4">
      {inventory.slice(0, 5).map(item => (
        <div key={item.name} className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-slate-100 hover:shadow-xl hover:shadow-slate-200/40 transition-all group overflow-hidden relative">
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-50 group-hover:bg-blue-600 transition-all duration-500 rounded-2xl flex items-center justify-center">
                <Box size={20} className="text-slate-400 group-hover:text-white" />
              </div>
              <div>
                <div className="font-black text-slate-900 text-sm italic uppercase">{item.name}</div>
                <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1 opacity-70">{item.code || 'ASSET-NODE'}</div>
              </div>
            </div>
            <div className="text-right">
               <div className="text-2xl font-black text-slate-900 tracking-tighter italic">{item.stock_count || 0}</div>
               <div className="text-[8px] text-slate-400 uppercase font-black tracking-widest">Units</div>
            </div>
          </div>
          <div className="mt-4 h-1.5 bg-slate-100 rounded-full overflow-hidden">
             <div 
               className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-1000" 
               style={{ width: `${Math.min(((item.stock_count || 0) / 200) * 100, 100)}%` }}
             />
          </div>
        </div>
      ))}
    </div>
  </div>
));

/**
 * ─── UNIVERSAL COMMAND ENGINE ──────────────────────────────────────────────────
 */
const DashboardPage = () => {
  const { user, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(searchParams.get('unit') || user?.org_node_id || '');
  const tabParam = searchParams.get('tab');

  // Staff-specific states
  const [activeMenu, setActiveMenu] = useState(null);
  const [transferAsset, setTransferAsset] = useState(null);
  const [returnAsset, setReturnAsset] = useState(null);
  const [reportAsset, setReportAsset] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Protocol Form States
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [returnCondition, setReturnCondition] = useState('good');
  const [reportDetails, setReportDetails] = useState('');

  const capabilities = useMemo(() => ({
    canApprove: hasPermission('request:approve'),
    canManageOrg: hasPermission('organization:manage') || hasPermission('dashboard:executive'),
    canViewInventory: hasPermission('inventory:view') || hasPermission('inventory:manage'),
    canViewUsers: hasPermission('user:view') || hasPermission('user:manage'),
    isRoot: user?.role?.level >= 100,
    isStaff: user?.role?.level < 30 
  }), [user, hasPermission]);

  useEffect(() => {
    if (!user) return;
    if (!tabParam) fetchData();
    else setLoading(false);
  }, [user, tabParam, selectedUnit]);

  useEffect(() => {
    if (transferAsset && users.length === 0) {
      setLoadingUsers(true);
      api.get('/users', { params: { limit: 500 } })
        .then(res => setUsers(Array.isArray(res.data?.data) ? res.data.data : []))
        .finally(() => setLoadingUsers(false));
    }
  }, [transferAsset]);

  // 1. URL Syncing: Sync selectedUnit state with 'unit' query parameter
  useEffect(() => {
    const unitFromUrl = searchParams.get('unit');
    if (unitFromUrl !== null && unitFromUrl !== selectedUnit) {
      setSelectedUnit(unitFromUrl);
    }
  }, [searchParams, selectedUnit]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (!capabilities.isStaff) {
        const data = await dashboardService.getStats({ org_node_id: selectedUnit });
        setStats(data);
      } else {
        const res = await dashboardService.getUserStats();
        setStats(res?.data || res);
      }
    } catch (err) {
      console.error('Command fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleWorkflowAction = async (id, action) => {
    const loadingToast = toast.loading('Executing Protocol...');
    try {
      if (action === 'approve') await requestService.approveRequest(id);
      else await requestService.rejectRequest(id);
      toast.success(`Protocol ${action}d`, { id: loadingToast });
      fetchData();
    } catch (error) {
      toast.error('Protocol Failure', { id: loadingToast });
    }
  };

  // ── CORE PROTOCOLS ──
  const executeTransfer = async () => {
    if (!transferTarget || !transferReason) return toast.error('PROTOCOL INCOMPLETE: Target & Reason Required');
    setSubmitting(true);
    try {
      await api.post('/requests', {
        request_type: 'transfer',
        purpose: `Instant Handover: ${transferAsset?.product?.name}`,
        priority: 'medium',
        items: [{ product_id: transferAsset.product_id, quantity_requested: 1, notes: `Target UID: ${transferTarget}` }],
        org_node_id: transferAsset.org_node_id,
        target_user_id: transferTarget,
        notes: JSON.stringify({ assignment_id: transferAsset.id, justification: transferReason })
      });
      toast.success('Handover Protocol Initiated');
      setTransferAsset(null);
      fetchData();
    } catch (err) { toast.error('Protocol Interrupted'); }
    finally { setSubmitting(false); }
  };

  const executeReturn = async () => {
    setSubmitting(true);
    try {
      await api.post('/requests', {
        request_type: 'return',
        purpose: `Institutional Return: ${returnAsset?.product?.name}`,
        items: [{ product_id: returnAsset.product_id, quantity_requested: 1, notes: `State: ${returnCondition}` }],
        org_node_id: returnAsset.org_node_id,
        notes: JSON.stringify({ assignment_id: returnAsset.id, condition: returnCondition })
      });
      toast.success('Decommissioning Logged');
      setReturnAsset(null);
      fetchData();
    } catch (err) { toast.error('Return Failed'); }
    finally { setSubmitting(false); }
  };

  const executeReport = async () => {
    if (!reportDetails) return toast.error('PROTOCOL INCOMPLETE: Details Required');
    setSubmitting(true);
    try {
      await api.post('/requests', {
        request_type: 'issue',
        purpose: `Incident Report: ${reportAsset?.product?.name}`,
        priority: 'high',
        items: [{ product_id: reportAsset.product_id, quantity_requested: 1, notes: reportDetails }],
        org_node_id: reportAsset.org_node_id,
        notes: JSON.stringify({ assignment_id: reportAsset.id })
      });
      toast.success('Incident Protocol Logged');
      setReportAsset(null);
      setReportDetails('');
      fetchData();
    } catch (err) { toast.error('Report Failure'); }
    finally { setSubmitting(false); }
  };

  const handleFulfill = async (id) => {
    const loadingToast = toast.loading('Acknowledging Receipt...');
    try {
      await api.post(`/requests/${id}/fulfill`);
      toast.success('Protocol Fulfilled', { id: loadingToast });
      fetchData();
    } catch (error) { toast.error('Fulfillment Error', { id: loadingToast }); }
  };

  if (loading || !user) return <LoadingSpinner />;

  // ── TAB RENDERING ──
  if (tabParam) {
    if (tabParam === 'structure') return <OrganizationManagement />;
    const tabTitles = { users: 'Personnel Registry', roles: 'Authority Matrix', products: 'Asset Lexicon' };
    return (
      <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="flex justify-between items-end pb-8 border-b-2 border-slate-100 px-4">
          <div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">{tabTitles[tabParam] || tabParam}</h1>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mt-3 ml-1 italic">Command & Control Layer</p>
          </div>
        </div>
        <div className="bg-white/40 backdrop-blur-xl rounded-[3.5rem] p-4 ring-1 ring-white shadow-[0_32px_64px_rgba(0,0,0,0.04)]">
          {tabParam === 'users' && <UserManagement orgNodeId={selectedUnit} />}
          {tabParam === 'roles' && <RoleManagement />}
          {tabParam === 'products' && <ProductManagement />}
        </div>
      </div>
    );
  }

  const actualStats = stats?.data || stats || {};
  const metrics = actualStats.metrics || {};
  const nodeDistribution = actualStats.level_distribution || actualStats.branch_inventory || [];
  const pendingApprovals = actualStats.pending_approvals || actualStats.recent_requests || [];
  const myAssignments = actualStats.my_assignments || [];
  const myRequests = actualStats.my_requests || [];

  return (
    <div className="min-h-screen bg-white relative overflow-hidden pb-24">
      {/* Background patterns removed for clean integrated look */}

      <div className="relative z-10 max-w-[1700px] mx-auto space-y-12 py-12 px-8">
        {/* UNIVERSAL COMMAND HEADER */}
        <div className="bg-slate-900 rounded-[3rem] p-10 shadow-xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-transparent"></div>
          <div className="relative z-10 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-10">
            <div className="flex items-center gap-8">
               <div className="w-20 h-20 bg-white/10 backdrop-blur-xl border border-white/20 rounded-[30px] flex items-center justify-center shadow-2xl rotate-3 group-hover:rotate-0 transition-transform duration-500">
                  <Fingerprint size={40} className="text-blue-400" />
               </div>
               <div>
                  <div className="text-[11px] font-black text-blue-400 uppercase tracking-[0.4em] mb-2 ml-1 italic">
                    {capabilities.isRoot ? 'Institutional Authority' : 'Operational Scope'}
                  </div>
                  <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">
                    {capabilities.isRoot ? 'Institutional Governance Core' : (user?.organization_node?.name || 'Central Governance')}
                  </h1>
                  <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mt-3 ml-1 italic opacity-80">
                    {capabilities.isRoot ? 'System Architect' : (user?.organization_node?.type?.name || 'System Core')} Access
                  </p>
               </div>
            </div>
            <div className="flex items-center gap-6 bg-white/5 backdrop-blur-xl p-5 rounded-[40px] border border-white/10">
               {(!capabilities.isStaff && !capabilities.isRoot) && (
                  <div className="flex items-center gap-4 px-6 border-r border-white/10">
                    <CascadingUnitSelector value={selectedUnit} onChange={setSelectedUnit} className="bg-transparent text-white min-w-[280px] h-14 rounded-2xl border-none font-black text-xs uppercase" />
                  </div>
               )}
               <div className={`flex items-center gap-4 px-8 h-16 rounded-[28px] shadow-xl ${capabilities.isRoot ? 'bg-indigo-600' : 'bg-blue-600'}`}>
                  <Shield size={20} className="text-white" />
                  <span className="text-white italic text-sm font-black uppercase tracking-[0.2em]">
                    {capabilities.isRoot ? 'INSTITUTIONAL ROOT' : 'LOCAL HUB'}
                  </span>
               </div>
            </div>
          </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 space-y-16">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8">
               {capabilities.isRoot ? (
                 <>
                   <KPITile 
                     label="System Nodes" 
                     value={metrics.total_nodes || 0} 
                     icon={<Building2 />} 
                     gradient="from-blue-600 to-indigo-700" 
                     onClick={() => navigate('/dashboard?tab=structure')} 
                     subLabel="Global Infrastructure"
                   />
                   <KPITile 
                     label="Organizations" 
                     value={metrics.total_companies || 0} 
                     icon={<Building2 />} 
                     gradient="from-emerald-500 to-teal-700" 
                     subLabel="Active Multi-Tenants"
                   />
                   <KPITile 
                     label="Global Catalog" 
                     value={metrics.total_products || 0} 
                     icon={<LayoutGrid />} 
                     gradient="from-amber-500 to-orange-700" 
                     onClick={() => setSearchParams({ tab: 'products' })}
                     subLabel="Universal Assets"
                   />
                   <KPITile 
                     label="Governance" 
                     value={metrics.total_roles || 0} 
                     icon={<Shield />} 
                     gradient="from-indigo-600 to-purple-700" 
                     onClick={() => setSearchParams({ tab: 'roles' })}
                     subLabel="Security Roles"
                   />
                   <KPITile 
                     label="System Users" 
                     value={metrics.total_users || 0} 
                     icon={<Users />} 
                     gradient="from-slate-700 to-slate-900" 
                     onClick={() => setSearchParams({ tab: 'users' })}
                     subLabel="Total Registry"
                   />
                 </>
               ) : (
                 <>
                    {capabilities.canManageOrg && (
                      <>
                        <KPITile label="Nodes" value={metrics.total_nodes || 0} icon={<Building2 />} gradient="from-blue-600 to-indigo-700" onClick={() => navigate('/dashboard?tab=structure')} />
                        <KPITile 
                          label={capabilities.isRoot ? "Global Registry" : "Branch Team"} 
                          value={metrics.total_users || 0} 
                          icon={<Users />} 
                          gradient="from-emerald-500 to-teal-700" 
                          onClick={() => setSearchParams({ tab: 'users' })}
                          subLabel="Active Personnel"
                        />
                      </>
                    )}
                    <KPITile 
                      label="Assets" 
                      value={capabilities.isStaff ? myAssignments.length : (metrics.total_stock || 0)} 
                      icon={<Box />} 
                      gradient="from-amber-500 to-orange-700" 
                    />
                    <KPITile 
                      label="Attention" 
                      value={pendingApprovals.length} 
                      icon={<ClipboardCheck />} 
                      gradient="from-rose-600 to-pink-700" 
                      subLabel="Action Items" 
                      onClick={pendingApprovals.length > 0 ? () => {} : null}
                    />
                 </>
               )}
           </div>

           <div className="grid grid-cols-1 xl:grid-cols-3 gap-16">
              <div className="xl:col-span-2 space-y-16">
                 {(!capabilities.isRoot && capabilities.canApprove && pendingApprovals.length > 0) && <DecisionDeck approvals={pendingApprovals} onAction={handleWorkflowAction} />}

                 {/* PERSONAL VAULT */}
                 <div className="space-y-8">
                    <div className="flex items-center justify-between px-2">
                       <div className="flex items-center gap-4">
                          <div className="w-2 h-8 bg-blue-600 rounded-full" />
                          <div>
                            <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">Personnel Vault</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Resources Under Active Custody</p>
                          </div>
                       </div>
                    </div>
                    <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] border border-white/50 shadow-sm overflow-hidden">
                       <table className="w-full text-left border-collapse">
                          <thead>
                             <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Detail</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Serial / SKU</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">State</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Custody Date</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                             {myAssignments.map(asset => (
                                <tr key={asset.id} className="group hover:bg-blue-50/30 transition-colors">
                                   <td className="px-8 py-6">
                                      <div className="flex items-center gap-4">
                                         <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-slate-950 group-hover:text-blue-400 transition-all"><Package size={22} /></div>
                                         <div>
                                            <div className="font-black text-slate-900 text-sm italic uppercase">{asset.product?.name}</div>
                                            <div className="text-[9px] font-bold text-blue-500 uppercase tracking-widest mt-0.5">{asset.product?.brand || 'ASSET'}</div>
                                         </div>
                                      </div>
                                   </td>
                                   <td className="px-8 py-6">
                                      <div className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{asset.serial_number}</div>
                                      <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{asset.product?.sku}</div>
                                   </td>
                                   <td className="px-8 py-6">
                                      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                         asset.condition === 'new' ? 'bg-emerald-50 text-emerald-600' : 
                                         asset.condition === 'good' ? 'bg-blue-50 text-blue-600' : 
                                         'bg-amber-50 text-amber-600'
                                      }`}>
                                         {asset.condition || 'STANDARD'}
                                      </span>
                                   </td>
                                   <td className="px-8 py-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                      {new Date(asset.assigned_at).toLocaleDateString()}
                                   </td>
                                   <td className="px-8 py-6 text-right">
                                      <div className="flex justify-end gap-3">
                                         <button 
                                           onClick={() => setTransferAsset(asset)}
                                           title="Initiate Transfer"
                                           className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl hover:bg-slate-950 hover:text-blue-400 transition-all"
                                         >
                                            <ArrowLeftRight size={16} />
                                         </button>
                                         <button 
                                           onClick={() => setReturnAsset(asset)}
                                           title="Return to Store"
                                           className="w-10 h-10 flex items-center justify-center bg-teal-50 text-teal-600 rounded-xl hover:bg-slate-950 hover:text-teal-400 transition-all"
                                         >
                                            <RotateCcw size={16} />
                                         </button>
                                         <button 
                                           onClick={() => setReportAsset(asset)}
                                           title="Report Issue"
                                           className="w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-600 rounded-xl hover:bg-slate-950 hover:text-rose-400 transition-all"
                                         >
                                            <AlertTriangle size={16} />
                                         </button>
                                      </div>
                                   </td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                       {myAssignments.length === 0 && (
                          <div className="p-20 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">No assets currently assigned to your account.</div>
                       )}
                    </div>
                 </div>

                 {/* ACTIVITY LEDGER */}
                 <div className="space-y-8">
                    <div className="flex items-center gap-4 px-2">
                       <div className="w-2 h-8 bg-slate-950 rounded-full" />
                       <div>
                          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Activity Ledger</h3>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Lifecycle Tracking of Personal Protocols</p>
                       </div>
                    </div>
                    <div className="space-y-4">
                       {myRequests.slice(0, 5).map(req => (
                          <div key={req.id} className="bg-white/40 backdrop-blur-md rounded-3xl p-6 border border-white/50 flex items-center justify-between group hover:bg-white transition-all duration-500">
                             <div className="flex items-center gap-6">
                                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all"><ActivityIcon size={20} /></div>
                                <div>
                                   <div className="font-black text-slate-900 text-sm uppercase italic">{req.items?.[0]?.product?.name || 'PROTOCOL'}</div>
                                   <div className="text-[9px] font-black text-slate-400 uppercase mt-1">{req.request_type.toUpperCase()} • {req.request_number}</div>
                                </div>
                             </div>
                             <div className="flex items-center gap-6">
                                <Badge variant={req.status === 'approved' ? 'success' : 'gray'} className="text-[8px] font-black px-4 py-1.5 rounded-xl">{req.status.toUpperCase()}</Badge>
                                {req.status === 'approved' && <button onClick={() => handleFulfill(req.id)} className="bg-blue-600 text-white text-[9px] font-black uppercase px-4 py-2 rounded-xl shadow-lg shadow-blue-500/20">Fulfill</button>}
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>

              <div className="space-y-16">
                 {(!capabilities.isRoot && capabilities.canViewInventory) && <AssetInsight inventory={nodeDistribution} />}
                 <div className="bg-slate-900 rounded-[3rem] p-10 shadow-xl space-y-8">
                    <h4 className="text-[11px] font-black text-blue-400 uppercase tracking-[0.4em] italic">Command Palette</h4>
                    <div className="space-y-4">
                       <button onClick={() => navigate('/requests/new')} className="w-full flex items-center justify-between p-5 bg-white/5 hover:bg-white group rounded-3xl transition-all border border-white/10"><span className="font-black text-[10px] text-white group-hover:text-slate-900 uppercase italic ml-2">Initiate Request</span><div className="w-10 h-10 bg-white/10 group-hover:bg-blue-600 rounded-xl flex items-center justify-center text-white"><Send size={18} /></div></button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* MODALS */}
      <Modal isOpen={!!transferAsset} onClose={() => setTransferAsset(null)} title="HANDOVER PROTOCOL" onConfirm={executeTransfer} confirmText="COMMIT TRANSFER">
         <div className="space-y-8 p-2">
            <div className="bg-slate-50 p-8 rounded-[2.5rem] flex items-center gap-8"><div className="w-20 h-20 bg-slate-950 rounded-[28px] flex items-center justify-center text-blue-400"><Package size={32} /></div><div><h4 className="text-2xl font-black text-slate-900 uppercase italic">{transferAsset?.product?.name}</h4><div className="text-[9px] font-black text-slate-400 mt-2">SN: {transferAsset?.serial_number}</div></div></div>
            <select className="w-full h-16 bg-slate-50 border-none rounded-3xl px-8 font-black text-xs uppercase" value={transferTarget} onChange={e => setTransferTarget(e.target.value)}><option value="">Select Personnel...</option>{users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}</select>
            <textarea className="w-full h-32 bg-slate-50 border-none rounded-3xl p-8 font-bold text-sm" placeholder="Reason..." value={transferReason} onChange={e => setTransferReason(e.target.value)} />
         </div>
      </Modal>

      <Modal isOpen={!!returnAsset} onClose={() => setReturnAsset(null)} title="DECOMMISSIONING" onConfirm={executeReturn} confirmText="FINALIZE RETURN">
         <div className="space-y-8 p-2">
            <div className="bg-teal-50 p-8 rounded-[2.5rem] flex flex-col items-center text-center"><RotateCcw size={48} className="text-teal-600 mb-4" /><h4 className="text-2xl font-black text-slate-900 uppercase italic">Return Entry</h4><p className="text-slate-400 text-xs font-medium max-w-xs mt-2">Relinquishing custody of {returnAsset?.product?.name}.</p></div>
            <select className="w-full h-16 bg-slate-50 border-none rounded-3xl px-8 font-black text-xs uppercase" value={returnCondition} onChange={e => setReturnCondition(e.target.value)}><option value="good">OPTIMAL</option><option value="used">STANDARD</option><option value="damaged">CRITICAL</option></select>
         </div>
      </Modal>

      <Modal isOpen={!!reportAsset} onClose={() => setReportAsset(null)} title="INCIDENT REPORT" onConfirm={executeReport} confirmText="LOG INCIDENT">
         <div className="space-y-8 p-2">
            <div className="bg-rose-50 p-8 rounded-[2.5rem] flex flex-col items-center text-center"><AlertOctagon size={48} className="text-rose-600 mb-4" /><h4 className="text-2xl font-black text-slate-900 uppercase italic">Incident Protocol</h4></div>
            <textarea className="w-full h-40 bg-rose-50/30 border-none rounded-3xl p-8 font-bold text-sm" placeholder="Telemetry details..." value={reportDetails} onChange={e => setReportDetails(e.target.value)} />
         </div>
      </Modal>
    </div>
  );
};

export default DashboardPage;