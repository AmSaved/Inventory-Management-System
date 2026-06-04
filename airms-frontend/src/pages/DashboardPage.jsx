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
  ChevronRight, LayoutGrid, Bell, History, XCircle, AlertOctagon,
  Plus, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';


const KPITile = memo(({ label, value, icon, gradient, onClick, subLabel }) => (
  <motion.div 
    whileHover={{ y: -4, scale: 1.01 }}
    onClick={onClick}
    className={`relative group bg-white rounded-2xl p-5 shadow-sm border border-slate-100 transition-all duration-300 ${onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-200' : ''} overflow-hidden`}
  >
    <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-[0.04] transition-opacity duration-300 rounded-full -mr-12 -mt-12`}></div>
    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-md mb-3 group-hover:scale-105 transition-all duration-300`}>
      {React.cloneElement(icon, { size: 18 })}
    </div>
    <div className="text-2xl font-bold text-slate-900 mb-0.5">{value}</div>
    <div className="text-xs font-medium text-slate-500">{label}</div>
    {subLabel && <div className="text-[10px] font-bold text-blue-600 mt-0.5 opacity-80">{subLabel}</div>}
  </motion.div>
));


const COLORS = [
  '#2563eb', // Blue 600
  '#059669', // Emerald 600
  '#d97706', // Amber 600
  '#dc2626', // Red 600
  '#7c3aed', // Violet 600
  '#0891b2', // Cyan 600
  '#db2777', // Pink 600
  '#4f46e5'  // Indigo 600
];

const AssetInsight = memo(({ inventory = [] }) => {
  const [activeIndex, setActiveIndex] = useState(-1);

  // Calculate total count
  const totalCount = useMemo(() => {
    return inventory.reduce((sum, item) => sum + (item.stock_count || 0), 0);
  }, [inventory]);

  // Map inventory data to Recharts format
  const chartData = useMemo(() => {
    return inventory
      .filter(item => (item.stock_count || 0) > 0)
      .map(item => ({
        name: item.name,
        value: item.stock_count || 0,
        code: item.code || 'ASSET-NODE'
      }));
  }, [inventory]);

  if (inventory.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-1">
           <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
           <div>
              <h3 className="text-lg font-bold text-slate-900">Resource Analytics</h3>
              <p className="text-[11px] font-medium text-slate-500">Institutional Inventory Distribution</p>
           </div>
        </div>
        <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm text-center text-slate-400 text-xs font-medium">
          No inventory distribution telemetry available.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center gap-3 px-1">
         <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
         <div>
            <h3 className="text-lg font-bold text-slate-900">Resource Analytics</h3>
            <p className="text-[11px] font-medium text-slate-500">Institutional Inventory Distribution</p>
         </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center gap-6">
        {/* Donut Chart Circle Container */}
        <div className="relative w-36 h-36 flex-shrink-0 mx-auto sm:mx-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={65}
                paddingAngle={3}
                dataKey="value"
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(-1)}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]} 
                    opacity={activeIndex === -1 || activeIndex === index ? 1 : 0.6}
                    className="transition-all duration-300 outline-none"
                  />
                ))}
              </Pie>
              <Tooltip 
                cursor={false}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-950 text-white px-2.5 py-1.5 rounded-xl text-[10px] font-bold shadow-xl border border-slate-800">
                        <div className="uppercase tracking-wider">{data.name}</div>
                        <div className="text-blue-400 mt-0.5">{data.value} Units ({((data.value / totalCount) * 100).toFixed(1)}%)</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Central KPI Label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-black text-slate-900 tracking-tight leading-none">
              {totalCount}
            </span>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
              Total Units
            </span>
          </div>
        </div>

        {/* Legend / Breakdown List */}
        <div className="flex-1 w-full space-y-1.5">
          {chartData.map((item, index) => {
            const percentage = ((item.value / totalCount) * 100).toFixed(1);
            const isHovered = activeIndex === index;
            return (
              <div 
                key={item.name}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(-1)}
                className={`flex items-center justify-between p-1.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                  isHovered ? 'bg-slate-50 border-slate-200 shadow-xs scale-[1.01]' : 'bg-transparent border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <div 
                    className="w-2 h-2 rounded-full shrink-0" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                  />
                  <div className="overflow-hidden">
                    <div className="font-bold text-slate-900 text-xs truncate uppercase tracking-tight">
                      {item.name}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div className="text-xs font-black text-slate-900">
                    {item.value} <span className="text-[9px] font-medium text-slate-400">Units</span>
                  </div>
                  <div className="text-[9px] font-black text-blue-600 mt-0.5">
                    {percentage}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

/**
 * ─── UNIVERSAL COMMAND ENGINE ──────────────────────────────────────────────────
 */
const DashboardPage = () => {
  const { user, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(() => {
    const fromUrl = searchParams.get('unit');
    if (fromUrl) return fromUrl;
    if (user?.role?.level >= 100) return '';
    return user?.org_node_id || '';
  });
  const tabParam = searchParams.get('tab');

  const [submitting, setSubmitting] = useState(false);

  // Edit & Cancel States for my requests
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const normalizeSpecifications = (specifications) => {
    if (typeof specifications === 'string') {
      try {
        return JSON.parse(specifications);
      } catch (err) {
        return {};
      }
    }
    return typeof specifications === 'object' && specifications !== null ? specifications : {};
  };

  const editCategories = [...new Set(catalogProducts.map(p => p.category?.trim()).filter(Boolean))].sort();

  const getEditSubCategories = (category) => {
    if (!category) return [];
    return [...new Set(
      catalogProducts
        .filter(p => p.category?.trim().toUpperCase() === category.toUpperCase())
        .map(p => p.sub_category?.trim())
        .filter(Boolean)
    )].sort();
  };

  const handleEditClick = (request) => {
    const type = request.request_type?.toLowerCase() || '';
    if (type === 'transfer') {
      navigate(`/requests/transfer?edit=true&id=${request.id}`);
    } else if (type === 'return') {
      navigate(`/requests/return?edit=true&id=${request.id}`);
    } else if (type === 'issue' || type === 'report') {
      navigate(`/requests/report?edit=true&id=${request.id}`);
    } else {
      navigate(`/requests/new?edit=true&id=${request.id}`);
    }
  };

  const handleEditFieldChange = (field, value) => {
    setEditingRequest(prev => ({ ...prev, [field]: value }));
  };

  const handleEditItemChange = (index, field, value) => {
    setEditingRequest(prev => {
      const updatedItems = [...prev.items];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      if (field === 'category') {
        updatedItems[index].sub_category = '';
      }
      return { ...prev, items: updatedItems };
    });
  };

  const handleAddEditItem = () => {
    setEditingRequest(prev => ({
      ...prev,
      items: [...prev.items, { category: '', sub_category: '', quantity: 1, specifications: '' }]
    }));
  };

  const handleRemoveEditItem = (index) => {
    setEditingRequest(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!editingRequest) return;
    if (editingRequest.items.some(item => !item.category)) {
      return toast.error('Please select a category for all items');
    }

    setSubmitting(true);
    try {
      const payload = {
        purpose: editingRequest.purpose,
        priority: editingRequest.priority,
        expected_delivery_date: editingRequest.expectedDate || null,
        items: editingRequest.items.map(item => ({
          quantity_requested: item.quantity,
          specifications: {
            category: item.category,
            sub_category: item.sub_category || null,
            notes: item.specifications
          }
        }))
      };

      await requestService.updateRequest(editingRequest.id, payload);
      toast.success('Request updated successfully');
      setEditModalOpen(false);
      setEditingRequest(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelClick = (request) => {
    setCancellingRequest(request);
    setCancelReason('');
    setCancelModalOpen(true);
  };

  const handleCancelSubmit = async () => {
    if (!cancellingRequest) return;
    setSubmitting(true);
    try {
      await requestService.cancelRequest(cancellingRequest.id, cancelReason);
      toast.success('Request cancelled successfully');
      setCancelModalOpen(false);
      setCancellingRequest(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel request');
    } finally {
      setSubmitting(false);
    }
  };
  
  const capabilities = useMemo(() => ({
    canApprove: hasPermission('request:approve'),
    canManageOrg: hasPermission('organization:manage') || hasPermission('dashboard:executive'),
    canViewInventory: hasPermission('inventory:view') || hasPermission('inventory:manage'),
    canViewUsers: hasPermission('user:view') || hasPermission('user:manage'),
    canViewTransfers: hasPermission('transfer:view') || hasPermission('inventory:view') || hasPermission('inventory:manage'),
    canViewRequests: hasPermission('request:view') || hasPermission('inventory:view') || hasPermission('inventory:manage'),
    canViewDischarges: hasPermission('discharge:view') || hasPermission('inventory:view') || hasPermission('inventory:manage'),
    canViewIssues: hasPermission('issue:view') || hasPermission('inventory:view') || hasPermission('inventory:manage'),
    isRoot: hasPermission('system:manage') || (user?.role?.level >= 100),
    isStaff: (!hasPermission('dashboard:executive') && !hasPermission('inventory:view') && !hasPermission('organization:manage') && !hasPermission('system:manage')) || (user?.role?.level > 0 && user?.role?.level < 30)
  }), [user, hasPermission]);

  useEffect(() => {
    if (!user) return;
    if (!tabParam) fetchData();
    else setLoading(false);
  }, [user, tabParam, selectedUnit]);


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

  const handleFulfill = async (id, currentStatus) => {
    const loadingToast = toast.loading('Acknowledging Receipt...');
    try {
      if (currentStatus === 'pending_acknowledgment') {
        await requestService.acknowledgeRequest(id);
      } else {
        await api.post(`/requests/${id}/fulfill`);
      }
      toast.success('Protocol Fulfilled', { id: loadingToast });
      fetchData();
    } catch (error) { toast.error('Fulfillment Error', { id: loadingToast }); }
  };

  const getRequestDetails = (req) => {
    const type = req.request_type?.toLowerCase() || '';
    const status = req.status?.toLowerCase() || 'pending';
    const targetName = req.target_user ? `${req.target_user.first_name} ${req.target_user.last_name}`.trim() : 'Users';
    
    let subtitle = '';
    let badgeText = status.toUpperCase();
    let badgeVariant = 'default';
    
    if (type === 'transfer') {
      if (status === 'fulfilled') {
        subtitle = `Transferred to ${targetName}`;
        badgeText = 'TRANSFERRED';
        badgeVariant = 'success';
      } else if (status === 'approved') {
        subtitle = `Approved (Pending Handover to ${targetName})`;
        badgeText = 'APPROVED';
        badgeVariant = 'info';
      } else if (status === 'pending_acknowledgment') {
        subtitle = `Awaiting Handover Receipt by ${targetName}`;
        badgeText = 'AWAITING RECEIPT';
        badgeVariant = 'warning';
      } else if (status === 'rejected') {
        subtitle = `Transfer to ${targetName} Rejected`;
        badgeText = 'REJECTED';
        badgeVariant = 'danger';
      } else {
        subtitle = `Initiating Transfer to ${targetName}`;
        badgeText = 'PENDING';
        badgeVariant = 'warning';
      }
    } else if (type === 'return') {
      if (status === 'fulfilled') {
        subtitle = 'Returned to Storage';
        badgeText = 'RETURNED';
        badgeVariant = 'success';
      } else if (status === 'approved') {
        subtitle = 'Approved (Awaiting Return)';
        badgeText = 'APPROVED';
        badgeVariant = 'info';
      } else if (status === 'pending_acknowledgment') {
        subtitle = 'Awaiting Return Receipt by Storage';
        badgeText = 'AWAITING RECEIPT';
        badgeVariant = 'warning';
      } else if (status === 'rejected') {
        subtitle = 'Return to Storage Rejected';
        badgeText = 'REJECTED';
        badgeVariant = 'danger';
      } else {
        subtitle = 'Initiating Return to Storage';
        badgeText = 'PENDING';
        badgeVariant = 'warning';
      }
    } else if (type === 'issue') {
      if (status === 'fulfilled') {
        subtitle = 'Incident Resolved';
        badgeText = 'RESOLVED';
        badgeVariant = 'success';
      } else if (status === 'pending_acknowledgment') {
        subtitle = 'Incident Resolved (Awaiting Handover)';
        badgeText = 'AWAITING RECEIPT';
        badgeVariant = 'warning';
      } else if (status === 'rejected') {
        subtitle = 'Incident Dismissed';
        badgeText = 'DISMISSED';
        badgeVariant = 'danger';
      } else {
        subtitle = 'Incident Reported';
        badgeText = 'REPORTED';
        badgeVariant = 'warning';
      }
    } else {
      // Default / Procurement / New Intake requests
      if (status === 'fulfilled') {
        subtitle = 'Request Fulfilled';
        badgeText = 'FULFILLED';
        badgeVariant = 'success';
      } else if (status === 'approved') {
        subtitle = 'Request Approved';
        badgeText = 'APPROVED';
        badgeVariant = 'info';
      } else if (status === 'pending_acknowledgment') {
        subtitle = 'Awaiting Physical Handover / Receipt';
        badgeText = 'AWAITING RECEIPT';
        badgeVariant = 'warning';
      } else if (status === 'rejected') {
        subtitle = 'Request Rejected';
        badgeText = 'REJECTED';
        badgeVariant = 'danger';
      } else {
        subtitle = 'Awaiting Approval';
        badgeText = 'PENDING';
        badgeVariant = 'warning';
      }
    }
    
    return { subtitle, badgeText, badgeVariant };
  };

  if (!user) return <LoadingSpinner />;

  // ── TAB RENDERING ──
  if (tabParam) {
    if (tabParam === 'structure') return <OrganizationManagement />;
    return (
      <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="bg-white/30 backdrop-blur-md rounded-[2rem] p-1.5 ring-1 ring-slate-100 shadow-sm">
          {tabParam === 'users' && <UserManagement orgNodeId={selectedUnit} onBack={() => setSearchParams({})} />}
          {tabParam === 'roles' && <RoleManagement onBack={() => setSearchParams({})} />}
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
    <div className="relative overflow-hidden pb-12">
      {/* Background patterns removed for clean integrated look */}

      <div className="relative z-10 max-w-[1700px] mx-auto space-y-4 px-2 lg:px-4">
        {/* Dashboard Title & Unit Selector Header Wrapper */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-xs text-slate-500 mt-0.5">Real-time inventory telemetry & analytics</p>
          </div>
          {(!capabilities.isStaff && !capabilities.isRoot) && (
            <div className="bg-slate-900 p-0.5 rounded-xl border border-slate-800 shadow-sm">
              <CascadingUnitSelector 
                value={selectedUnit} 
                onChange={setSelectedUnit} 
                variant="dropdown"
                className="min-w-[240px] h-10" 
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-16 text-center flex justify-center"><LoadingSpinner /></div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-5">
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
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
                     onClick={() => navigate('/dashboard?tab=structure')}
                     
                   />
                   <KPITile 
                     label="Global Catalog" 
                     value={metrics.total_products || 0} 
                     icon={<LayoutGrid />} 
                     gradient="from-amber-500 to-orange-700" 
                     onClick={() => navigate('/admin/products')}
                     subLabel="Universal Inventories"
                   />
                   
                   {/* Operational Overlays removed for pure Systems Information View */}

                   <KPITile 
                    //  label="Governance" 
                     value={metrics.total_roles || 0} 
                     icon={<Shield />} 
                     gradient="from-slate-700 to-slate-800" 
                     onClick={() => navigate('/admin/roles')}
                     subLabel="Total Roles"
                   />
                   <KPITile 
                     label="Total Systen Users" 
                     value={metrics.total_users || 0} 
                     icon={<Users />} 
                     gradient="from-slate-800 to-slate-950" 
                     onClick={() => navigate('/admin/users')}
                    //  subLabel="Total Registry"
                   />
                 </>
               ) : (
                 <>
                    {capabilities.canManageOrg && (
                      <KPITile label="Sub-Units" value={metrics.total_nodes || 0} icon={<Building2 />} gradient="from-blue-600 to-indigo-700" onClick={() => navigate('/dashboard?tab=structure')} />
                    )}
                    
                    {capabilities.canViewUsers && (
                      <KPITile 
                        label="Users" 
                        value={metrics.total_users || 0} 
                        icon={<Users />} 
                        gradient="from-emerald-600 to-teal-700" 
                        onClick={() => setSearchParams({ tab: 'users' })}
                        subLabel=""
                      />
                    )}

                    <KPITile 
                      label="Total Inventories" 
                      value={capabilities.isStaff ? myAssignments.length : (metrics.total_stock || 0)} 
                      icon={<Box />} 
                      gradient="from-slate-800 to-slate-950" 
                      subLabel={capabilities.isStaff ? "Under Personal Custody" : ""}
                      onClick={() => navigate('/inventory')}
                    />

                    {capabilities.canViewTransfers && (
                      <>
                        <KPITile 
                          label="Total Transfers" 
                          value={metrics.total_transfers || 0} 
                          icon={<ArrowLeftRight />} 
                          gradient="from-blue-500 to-indigo-600" 
                          onClick={() => navigate('/requests/inventory')}
                          subLabel=""
                        />
                        {/* <KPITile 
                          label="Item Volume" 
                          value={metrics.total_transferred_items || 0} 
                          icon={<Activity />} 
                          gradient="from-indigo-600 to-violet-700" 
                          onClick={() => navigate('/requests/inventory')}
                          subLabel="Physical Throughput"
                        /> */}
                      </>
                    )}

                    {capabilities.canViewRequests && (
                      <>
                        <KPITile 
                          label="user requests" 
                          value={metrics.total_procurement || 0} 
                          icon={<PackagePlus />} 
                          gradient="from-emerald-500 to-emerald-700" 
                          onClick={() => navigate('/requests/procurement')}
                          subLabel=""
                        />
                        <KPITile 
                          label="Inventory Returns" 
                          value={metrics.total_returns || 0} 
                          icon={<RotateCcw />} 
                          gradient="from-cyan-500 to-blue-700" 
                          onClick={() => navigate('/requests/inventory-returns')}
                          subLabel=""
                        />
                      </>
                    )}

                    {capabilities.canViewDischarges && (
                      <KPITile 
                        label="Inventory Discharges" 
                        value={metrics.total_discharges || 0} 
                        icon={<PackageMinus />} 
                        gradient="from-orange-500 to-amber-700" 
                        onClick={() => navigate('/requests/discharge')}
                        subLabel=""
                      />
                    )}


                    {pendingApprovals.length > 0 && (
                      <KPITile 
                        label="Pending Tasks" 
                        value={pendingApprovals.length} 
                        icon={<ClipboardCheck />} 
                        gradient="from-amber-400 to-orange-600" 
                        subLabel="Awaiting Protocol" 
                      />
                    )}
                 </>
               )}
           </div>

           <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
               <div className="xl:col-span-2 space-y-4">

                 {capabilities.isRoot ? (
                    <div className="space-y-4">
                       {/* GLOBAL SYSTEM ACTIVITY LEDGER FOR SUPER ADMINS */}
                       <div className="flex items-center gap-3 px-1">
                          <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                          <div>
                             <h3 className="text-lg font-bold text-slate-900 italic">System Audit Log</h3>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Real-time Global Platform Activity</p>
                          </div>
                       </div>
                       <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-4 space-y-3">
                          {(actualStats.recent_activity || []).length > 0 ? (
                             (actualStats.recent_activity || []).map(log => (
                                <div key={log.id} className="flex items-start gap-3 p-3 hover:bg-slate-50/50 rounded-xl transition-colors">
                                   <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                      log.action === 'CREATE' ? 'bg-emerald-50 text-emerald-600' :
                                      log.action === 'UPDATE' ? 'bg-blue-50 text-blue-600' :
                                      log.action === 'DELETE' ? 'bg-rose-50 text-rose-600' :
                                      'bg-slate-100 text-slate-600'
                                   }`}>
                                      <ActivityIcon size={15} />
                                   </div>
                                   <div className="flex-1">
                                      <div className="flex justify-between items-start">
                                         <span className="font-bold text-xs text-slate-900">{log.user ? `${log.user.first_name} ${log.user.last_name}` : 'System'}</span>
                                         <span className="text-[10px] font-black text-slate-400 uppercase">{new Date(log.created_at).toLocaleString()}</span>
                                      </div>
                                      <div className="text-xs font-medium text-slate-500 mt-1">
                                         <span className="font-bold text-slate-700">{log.action}</span> on <span className="font-bold text-slate-700 uppercase">{log.resource}</span> {log.resource_id ? `#${log.resource_id}` : ''}
                                      </div>
                                   </div>
                                </div>
                             ))
                          ) : (
                             <div className="p-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No Recent System Activity</div>
                          )}
                       </div>
                    </div>
                 ) : (
                    <>
                      {/* Activity Ledger moved to dedicated /my-activity page */}
                     </>
                  )}
               </div>

               <div className="space-y-4">
                  {(!capabilities.isRoot && capabilities.canViewInventory) && <AssetInsight inventory={nodeDistribution} />}
               </div>
            </div>


          </div>
        )}
      </div>

      {/* Edit Request Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => {
          if (!submitting) {
            setEditModalOpen(false);
            setEditingRequest(null);
          }
        }}
        title="Edit Request"
      >
        {editingRequest && (
          <form onSubmit={handleUpdateSubmit} className="space-y-6 p-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {/* Purpose */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Purpose / Reason <span className="text-red-400">*</span></label>
              <input
                value={editingRequest.purpose}
                onChange={(e) => handleEditFieldChange('purpose', e.target.value)}
                placeholder="Why do you need it?"
                required
                className="w-full h-11 px-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold text-sm outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Priority */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500">Requisition Priority</label>
                <select
                  className="w-full h-11 bg-slate-50 border-none rounded-2xl px-4 font-bold text-slate-700 outline-none hover:bg-slate-100 transition-all cursor-pointer text-sm"
                  value={editingRequest.priority}
                  onChange={(e) => handleEditFieldChange('priority', e.target.value)}
                >
                  <option value="low">Standard Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">Urgent Requirement</option>
                </select>
              </div>

              {/* Expected Date */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500">Expected Delivery Date</label>
                <input
                  type="date"
                  value={editingRequest.expectedDate}
                  onChange={(e) => handleEditFieldChange('expectedDate', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full h-11 px-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold text-sm outline-none transition-all"
                />
              </div>
            </div>

            {/* Requested Items */}
            <div className="space-y-4 pt-2">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <h3 className="text-sm font-bold text-gray-800">Requested Items</h3>
                <button
                  type="button"
                  onClick={handleAddEditItem}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-750 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 transition-all shadow-sm"
                >
                  <Plus size={14} className="inline mr-1" /> Add Item
                </button>
              </div>

              <div className="space-y-4 max-h-[250px] overflow-y-auto pr-1">
                {editingRequest.items.map((item, index) => (
                  <div key={index} className="space-y-4 p-4 bg-gray-50 rounded-2xl border border-gray-150 relative group">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-gray-400">Item #{index + 1}</span>
                      {editingRequest.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEditItem(index)}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    {loadingCatalog ? (
                      <div className="flex justify-center py-2"><LoadingSpinner /></div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Category Select */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500">Category <span className="text-red-400">*</span></label>
                            <select
                              className="w-full h-10 bg-white border border-gray-200 rounded-xl px-3 font-semibold text-gray-700 outline-none hover:border-blue-200 transition-all cursor-pointer text-xs"
                              value={item.category}
                              onChange={(e) => handleEditItemChange(index, 'category', e.target.value)}
                              required
                            >
                              <option value="">Choose Category...</option>
                              {editCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                          </div>

                          {/* Sub-Category Select */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500">Sub-Category</label>
                            <select
                              className="w-full h-10 bg-white border border-gray-200 rounded-xl px-3 font-semibold text-gray-700 outline-none hover:border-blue-200 transition-all cursor-pointer text-xs disabled:opacity-40"
                              value={item.sub_category}
                              disabled={!item.category}
                              onChange={(e) => handleEditItemChange(index, 'sub_category', e.target.value)}
                            >
                              <option value="">Any Sub-Category...</option>
                              {getEditSubCategories(item.category).map(sub => <option key={sub} value={sub}>{sub}</option>)}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Quantity */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500">Quantity</label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleEditItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                              required
                              className="w-full h-10 border border-gray-200 bg-white rounded-xl font-bold text-center text-blue-600 text-sm shadow-sm outline-none"
                            />
                          </div>

                          {/* Specifications */}
                          <div className="md:col-span-2 space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500">Specifications</label>
                            <input
                              value={item.specifications}
                              onChange={(e) => handleEditItemChange(index, 'specifications', e.target.value)}
                              placeholder="e.g. 16GB RAM, 512GB SSD..."
                              className="w-full h-10 rounded-xl border border-gray-200 bg-white font-medium text-xs px-3 outline-none"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-4 border-t border-gray-150 pt-4">
              <button
                type="button"
                className="flex-1 bg-slate-100 text-slate-500 hover:bg-slate-200 py-3 rounded-2xl font-medium text-sm transition-all"
                disabled={submitting}
                onClick={() => {
                  setEditModalOpen(false);
                  setEditingRequest(null);
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl font-semibold text-sm shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                disabled={submitting}
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Cancel Request Confirmation Modal */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => {
          if (!submitting) {
            setCancelModalOpen(false);
            setCancellingRequest(null);
            setCancelReason('');
          }
        }}
        title="Cancel Request"
      >
        <div className="space-y-6 p-2">
          <div className="flex items-start gap-4 p-5 bg-rose-50 border border-rose-200 rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500 flex items-center justify-center flex-shrink-0 shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-rose-950">Cancel Resource Request</p>
              <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                Are you sure you want to cancel this request? This action will permanently abort the request and remove it from all approval workflows.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 px-1">Reason for Cancellation (Optional)</label>
            <textarea
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner focus:outline-none focus:ring-2 focus:ring-rose-500 text-gray-700 text-sm animate-none"
              placeholder="Provide a reason for cancelling this request..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>

          <div className="flex gap-4">
            <button
              className="flex-1 bg-slate-100 text-slate-500 hover:bg-slate-200 py-3 rounded-2xl font-medium text-sm transition-all"
              disabled={submitting}
              onClick={() => {
                setCancelModalOpen(false);
                setCancellingRequest(null);
                setCancelReason('');
              }}
            >
              No, Keep Request
            </button>
            <button
              className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-2xl font-semibold text-sm shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              disabled={submitting}
              onClick={handleCancelSubmit}
            >
              {submitting ? 'Processing...' : 'Yes, Cancel Request'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DashboardPage;
