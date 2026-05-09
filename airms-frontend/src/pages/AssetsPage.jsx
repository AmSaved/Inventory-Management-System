import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import Card, { CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Table, { TableHead, TableHeader, TableBody, TableRow, TableCell } from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatDate } from '../utils/formatters';
import { ASSIGNMENT_STATUS, ASSIGNMENT_STATUS_COLORS } from '../utils/constants';
import assignmentService from '../services/assignmentService';
import toast from 'react-hot-toast';
import { 
  MoreVertical, 
  Eye, 
  ArrowLeftRight, 
  RotateCcw, 
  AlertTriangle,
  User as UserIcon,
  MessageSquare,
  Package
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const AssetsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnData, setReturnData] = useState({ condition: 'good', notes: '' });
  const [activeMenu, setActiveMenu] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Transfer Modal State
  const [transferAsset, setTransferAsset] = useState(null);
  const [toUserId, setToUserId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferring, setTransferring] = useState(false);

  // Expanded Actions State
  const [reportAsset, setReportAsset] = useState(null);
  const [issueDetails, setIssueDetails] = useState('');

  const { data: usersData } = useFetch('/users', { params: { limit: 500 } });
  const users = Array.isArray(usersData?.data) ? usersData.data : [];

  const { data, loading, refetch } = useFetch('/assignments', {
    params: {
      user_id: user?.id, // Always filter to current user for 'My Assets'
      status: statusFilter,
      search,
      limit: 50
    }
  });

  const handleReturn = async () => {
    if (!returnData.condition) return toast.error('Condition required');
    setProcessing(true);
    try {
      await api.post('/requests', {
        request_type: 'return',
        purpose: `Instant Portfolio Return: ${selectedAsset?.product?.name}`,
        priority: 'medium',
        items: [{
          product_id: selectedAsset.product_id,
          quantity_requested: 1,
          notes: `Condition at return: ${returnData.condition}`
        }],
        notes: JSON.stringify({ assignment_id: selectedAsset.id, condition: returnData.condition })
      });
      toast.success('Return protocol initiated');
      setReturnModalOpen(false);
      refetch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Return protocol failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleTransfer = async () => {
    if (!toUserId || !transferReason) {
      return toast.error('Selection incomplete: Verify recipient and reason');
    }

    setTransferring(true);
    try {
      await api.post('/requests', {
        request_type: 'transfer',
        purpose: `Instant Portfolio Transfer: ${transferAsset?.product?.name}. Justification: ${transferReason}`,
        priority: 'medium',
        items: [{
          product_id: transferAsset.product_id,
          quantity_requested: 1,
          notes: `Transfer target user ID: ${toUserId}`
        }],
        notes: JSON.stringify({ transfer_to_user_id: toUserId, assignment_id: transferAsset.id })
      });
      toast.success('Handover protocol initiated');
      setTransferAsset(null);
      setToUserId('');
      setTransferReason('');
      refetch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Handover failed');
    } finally {
      setTransferring(false);
    }
  };

  const handleReport = async () => {
    if (!issueDetails) return toast.error('Issue details required');
    setProcessing(true);
    try {
      await api.post('/requests', {
        request_type: 'issue',
        purpose: `Incident Report: ${reportAsset?.product?.name}`,
        priority: 'high',
        items: [{
          product_id: reportAsset.product_id,
          quantity_requested: 1,
          notes: issueDetails
        }],
        notes: JSON.stringify({ assignment_id: reportAsset.id })
      });
      toast.success('Incident logged and reported');
      setReportAsset(null);
      setIssueDetails('');
      refetch();
    } catch (error) {
      toast.error('Failed to log report');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    const color = ASSIGNMENT_STATUS_COLORS[status] || 'default';
    const label = status?.toUpperCase() || 'UNKNOWN';
    return <Badge variant={color}>{label}</Badge>;
  };

  const isOverdue = (expectedReturnDate) => {
    return new Date(expectedReturnDate) < new Date();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">My Asset Portfolio</h1>
          <p className="text-gray-500 mt-1">Manage and track items assigned to you personally.</p>
        </div>
        <div className="flex items-center gap-3">
           <Button variant="outline" onClick={() => navigate('/assets/history')} className="border-2 font-semibold hover:bg-gray-50">
            Usage History
          </Button>
           <Button variant="primary" onClick={() => navigate('/requests/new')} className="shadow-lg shadow-primary-200">
            New Request
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Summary Stat Cards with Glassmorphism hints */}
        {[ 
          { label: 'Holdings', value: data?.pagination?.total || 0, color: 'text-gray-900', sub: 'Total items' },
          { label: 'In Use', value: data?.data?.filter(a => a.status === 'active').length || 0, color: 'text-emerald-600', sub: 'Active custody' },
          { label: 'Critical', value: data?.data?.filter(a => a.status === 'active' && isOverdue(a.expected_return_date)).length || 0, color: 'text-rose-600', sub: 'Overdue returns' },
          { label: 'Resolved', value: data?.data?.filter(a => a.status === 'returned').length || 0, color: 'text-blue-600', sub: 'Returned items' }
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-sm hover:shadow-md transition-shadow bg-white/60 backdrop-blur-sm">
            <CardContent className="p-6">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <div className="flex items-end gap-2">
                <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-gray-400 pb-1 font-medium">{stat.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search by asset name or serial number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            {Object.entries(ASSIGNMENT_STATUS).map(([key, value]) => (
              <option key={value} value={value}>{key}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Assets Table */}
      <Card>
        <CardContent className="p-0">
          <Table overflowVisible={activeMenu !== null || transferAsset !== null || returnModalOpen || reportAsset !== null}>
            <TableHead className="bg-gray-50/50">
              <TableRow>
                <TableHeader className="pl-6 uppercase text-[10px] tracking-tighter">Asset Information</TableHeader>
                <TableHeader className="uppercase text-[10px] tracking-tighter">Identity</TableHeader>
                <TableHeader className="uppercase text-[10px] tracking-tighter">Condition</TableHeader>
                <TableHeader className="uppercase text-[10px] tracking-tighter">Ownership</TableHeader>
                <TableHeader className="uppercase text-[10px] tracking-tighter">Custody Period</TableHeader>
                <TableHeader className="pr-6 uppercase text-[10px] tracking-tighter text-right">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.data?.map((asset) => (
                <TableRow key={asset.id} className="group hover:bg-gray-50/80 transition-colors">
                  <TableCell className="pl-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 font-bold shrink-0 shadow-sm border border-primary-100">
                        {asset.product?.name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{asset.product?.name}</p>
                        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-widest">SKU: {asset.product?.sku || 'GENERIC'}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="px-2 py-1 bg-gray-100 rounded font-mono text-xs font-bold text-gray-600 border border-gray-200">
                      {asset.serial_number || 'NO-SERIAL'
                    }</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                       <span className={`text-xs font-bold ${
                         asset.condition_at_assignment === 'good' ? 'text-green-600' : 
                         asset.condition_at_assignment === 'used' ? 'text-amber-600' : 'text-red-600'
                       }`}>
                         {asset.condition_at_assignment?.toUpperCase() || 'GOOD'}
                       </span>
                       {getStatusBadge(asset.status)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                       <p className="text-xs font-bold text-gray-800">{asset.organizationNode?.name || 'Central Office'}</p>
                       <p className="text-[10px] text-gray-400">{asset.organizationNode?.code || 'ROOT'}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                       <p className="text-[11px] text-gray-500 font-medium">
                         From: <span className="text-gray-900">{formatDate(asset.assigned_at)}</span>
                       </p>
                       <p className={`text-[11px] font-bold ${isOverdue(asset.expected_return_date) && asset.status === 'active' ? 'text-red-600' : 'text-gray-400'}`}>
                         {asset.expected_return_date ? `Due: ${formatDate(asset.expected_return_date)}` : 'Indefinite'}
                         {isOverdue(asset.expected_return_date) && asset.status === 'active' && ' ⚠ Overdue'}
                       </p>
                    </div>
                  </TableCell>
                  <TableCell className="pr-6 text-right relative">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => setActiveMenu(activeMenu === asset.id ? null : asset.id)}
                        className="p-2 hover:bg-white rounded-full border border-transparent hover:border-gray-200 text-gray-400 hover:text-primary-600 transition-all shadow-none hover:shadow-sm"
                        aria-label="Actions"
                      >
                        <MoreVertical size={18} />
                      </button>

                      {activeMenu === asset.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setActiveMenu(null)}
                          ></div>
                          <div className="absolute right-6 mt-2 w-48 rounded-2xl shadow-2xl bg-white ring-1 ring-black ring-opacity-5 z-20 overflow-hidden animate-in fade-in zoom-in duration-200 border border-gray-100 divide-y divide-gray-50 text-left">
                            <div className="py-1">
                              <button
                                onClick={() => {
                                  navigate(`/assets/${asset.id}`);
                                  setActiveMenu(null);
                                }}
                                className="flex items-center w-full px-4 py-3 text-xs font-bold text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                              >
                                <Eye size={14} className="mr-3 opacity-60" />
                                VIEW DETAILS
                              </button>
                              <button
                                onClick={() => {
                                  setTransferAsset(asset);
                                  setActiveMenu(null);
                                }}
                                className="flex items-center w-full px-4 py-3 text-xs font-bold text-blue-700 hover:bg-blue-50 transition-colors"
                              >
                                <ArrowLeftRight size={14} className="mr-3 opacity-60" />
                                TRANSFER ASSET
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedAsset(asset);
                                  setReturnModalOpen(true);
                                  setActiveMenu(null);
                                }}
                                className="flex items-center w-full px-4 py-3 text-xs font-bold text-teal-700 hover:bg-teal-50 transition-colors"
                              >
                                <RotateCcw size={14} className="mr-3 opacity-60" />
                                RETURN ASSET
                              </button>
                              <button
                                onClick={() => {
                                  setReportAsset(asset);
                                  setActiveMenu(null);
                                }}
                                className="flex items-center w-full px-4 py-3 text-xs font-bold text-rose-700 hover:bg-rose-50 transition-colors"
                              >
                                <AlertTriangle size={14} className="mr-3 opacity-60" />
                                REPORT ISSUE
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data?.data?.length === 0 && (
            <div className="text-center py-8 text-gray-500">No assets found</div>
          )}
        </CardContent>
      </Card>

      {/* Return Modal */}
      <Modal
        isOpen={returnModalOpen}
        onClose={() => setReturnModalOpen(false)}
        title="Return Asset"
        onConfirm={handleReturn}
        confirmText="Return"
        loading={processing}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asset</label>
            <p className="text-gray-900 font-medium">{selectedAsset?.product?.name}</p>
            <p className="text-sm text-gray-500">Serial: {selectedAsset?.serial_number || 'N/A'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              value={returnData.condition}
              onChange={(e) => setReturnData({ ...returnData, condition: e.target.value })}
            >
              <option value="good">Good</option>
              <option value="used">Used (Normal wear)</option>
              <option value="damaged">Damaged</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Any additional notes about the asset condition..."
              value={returnData.notes}
              onChange={(e) => setReturnData({ ...returnData, notes: e.target.value })}
            />
          </div>
        </div>
      </Modal>

       {/* Transfer Modal */}
       <Modal
         isOpen={!!transferAsset}
         onClose={() => setTransferAsset(null)}
         title="Execute Direct Handover"
         onConfirm={handleTransfer}
         confirmText="Initiate Transfer"
         loading={transferring}
       >
         <div className="space-y-6">
            <div className="p-4 bg-primary-50 rounded-2xl border border-primary-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-primary-600">
                 <Package size={24} />
              </div>
              <div>
                 <div className="text-[10px] font-black text-primary-400 uppercase tracking-widest">Target Resource</div>
                 <div className="font-bold text-gray-900">{transferAsset?.product?.name}</div>
                 <div className="text-[10px] font-mono text-gray-500">SN: {transferAsset?.serial_number}</div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                 <UserIcon size={12} /> Target Custodian
              </label>
              <select 
                  className="w-full h-14 bg-white border-2 border-gray-100 rounded-2xl px-4 font-bold text-gray-900 outline-none focus:border-primary-500 transition-all cursor-pointer"
                  value={toUserId}
                  onChange={(e) => setToUserId(e.target.value)}
              >
                  <option value="">Select recipient...</option>
                  {users.map(u => (
                     <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.employee_id})</option>
                  ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                 <MessageSquare size={12} /> Handover Justification
              </label>
              <textarea 
                  className="w-full h-24 bg-white border-2 border-gray-100 rounded-2xl p-4 font-medium text-gray-700 outline-none focus:border-primary-500 transition-all resize-none"
                  placeholder="Operational reason for this transition..."
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
              />
            </div>
         </div>
       </Modal>

       {/* Incident Modal */}
       <Modal
         isOpen={!!reportAsset}
         onClose={() => setReportAsset(null)}
         title="Asset Incident Report"
         onConfirm={handleReport}
         confirmText="Submit Report"
         loading={processing}
       >
         <div className="space-y-6">
            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-rose-600">
                 <AlertTriangle size={24} />
              </div>
              <div>
                 <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Incident Reference</div>
                 <div className="font-bold text-gray-900">{reportAsset?.product?.name}</div>
                 <div className="text-[10px] font-mono text-gray-500">SN: {reportAsset?.serial_number}</div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                 <MessageSquare size={12} /> Incident Details
              </label>
              <textarea 
                  className="w-full h-32 bg-white border-2 border-gray-100 rounded-2xl p-4 font-medium text-gray-700 outline-none focus:border-rose-500 transition-all resize-none"
                  placeholder="Describe the issue, damage, or malfunction in detail..."
                  value={issueDetails}
                  onChange={(e) => setIssueDetails(e.target.value)}
              />
            </div>
         </div>
       </Modal>
    </div>
  );
};

export default AssetsPage;