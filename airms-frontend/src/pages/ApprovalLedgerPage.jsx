import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import Card, { CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/common/Modal';
import { formatDate } from '../utils/formatters';
import api from '../services/api';
import requestService from '../services/requestService';
import inventoryService from '../services/inventoryService';
import { getAssetName } from '../utils/assetName';
import toast from 'react-hot-toast';
import { 
  Shuffle, 
  Truck, 
  RotateCcw, 
  Package, 
  ClipboardList, 
  Eye, 
  XCircle,
  QrCode
} from 'lucide-react';
import QRCode from 'react-qr-code';

const ApprovalLedgerPage = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [searchValue, setSearchValue] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState(null);
  const [comments, setComments] = useState('');
  const [processing, setProcessing] = useState(false);
  const [viewingRequest, setViewingRequest] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewingResourceOrigin, setViewingResourceOrigin] = useState(null);
  const [qrModalItem, setQrModalItem] = useState(null);
  const [availableNodeInventory, setAvailableNodeInventory] = useState([]);
  const [loadingInventoryForView, setLoadingInventoryForView] = useState(false);
  const [allocations, setAllocations] = useState({});
  const [savedAllocations, setSavedAllocations] = useState({});
  const [serialNameMap, setSerialNameMap] = useState({});
  const [approvalInventory, setApprovalInventory] = useState([]);
  const [approvalAllocations, setApprovalAllocations] = useState({});
  const [loadingApprovalInventory, setLoadingApprovalInventory] = useState(false);
  const [approvalRequestDetail, setApprovalRequestDetail] = useState(null);
  const [stockCounts, setStockCounts] = useState({});

  const [activeQr, setActiveQr] = useState(null); 


  const typeConfig = {
    inventory: {
      title: 'Inventory Transfer Approvals',
      description: 'Inventory Transfers between Branches',
      icon: <Shuffle className="text-blue-500" />
    },
    items: {
      title: 'Item Transfer Approvals',
      description: 'Item Transfers between Users',
      icon: <Package className="text-indigo-500" />
    },
    returns: {
      title: 'Return Request Approvals',
      description: 'Item Returns from Users',
      icon: <RotateCcw className="text-orange-500" />
    },
    'inventory-returns': {
      title: 'Inventory Return Approvals',
      description: 'Inventory Returns between Branches',
      icon: <RotateCcw className="text-orange-600" />
    },
    discharge: {
      title: 'Discharge Approvals',
      description: 'Asset Discharges to External Parties',
      icon: <Truck className="text-emerald-500" />
    },
    default: {
      title: 'Pending Approvals',
      description: 'User Requests',
      icon: <ClipboardList className="text-gray-500" />
    }
  };

  const config = typeConfig[type] || typeConfig.default;

  // Human-readable label shown at the top of the table
  const tableDescription = (() => {
    switch (type) {
      case 'inventory':        return 'Inventory Transfers between Branches';
      case 'items':            return 'Item Transfers between Users';
      case 'returns':          return 'Item Returns from Users';
      case 'inventory-returns':return 'Inventory Returns between Branches';
      case 'discharge':        return 'Asset Discharges to External Parties';
      default:                 return 'User Requests';
    }
  })();

  // Fetch categorized data (History + Pending)
  const { data: rawData, loading, refetch } = useFetch(
    type === 'discharge' ? '/discharge/approvals' :
      type === 'inventory' ? '/transfers/approvals' :
        type === 'inventory-returns' ? '/returns/approvals' :
          type === 'returns' ? '/returns/approvals' :
            `/requests`, {
    params: {
      type: type === 'returns' ? 'returns' : type,
      search,
      all: true
    }
  });

  const data = Array.isArray(rawData) ? rawData : (rawData?.data || []);

  // Buttons are shown only when the backend explicitly grants can_action.
  // The backend already evaluates role match, branch scope, 4-eyes principle,
  // and global admin overrides — so we trust it as the single source of truth.
  const canUserApprove = (item) => item.can_action === true;

  const isProductRequest = (item) => {
    if (!item) return false;
    const origin = String(
      item?.resource_origin || item?.type || 'request'
    ).toLowerCase();
    const reqType = String(item?.request_type || '').toLowerCase();
    return ['request', 'new', 'procurement', 'requisition'].some(t => origin.includes(t)) &&
      !['transfer', 'discharge', 'return'].some(t => origin.includes(t)) &&
      reqType !== 'return';
  };

  const getCandidateNodeIds = (requestData, item) => {
    const candidates = [
      requestData?.organizationNode?.id,
      requestData?.fromNode?.id,
      requestData?.toNode?.id,
      requestData?.targetNode?.id,
      item?.organizationNode?.id,
      item?.fromNode?.id,
      item?.toNode?.id,
      user?.organizationNode?.id,
      user?.org_node_id,
      requestData?.org_node_id,
      item?.org_node_id,
    ];

    return [...new Set(candidates.filter(Boolean).map(Number).filter(Boolean))];
  };

  const loadAvailableInventoryForView = async (requestData) => {
    setLoadingInventoryForView(true);
    try {
      const items = requestData?.items || [];
      const inventoryPool = [];

      for (const item of items) {
        const specs = normalizeSpecifications(item.specifications);
        const productId = item.product_id || item.product?.id;
        const category = item.product?.category || specs.category;
        const candidateNodeIds = getCandidateNodeIds(requestData, item);

        const fetchCandidates = [];
        if (productId) {
          candidateNodeIds.forEach(nodeId => fetchCandidates.push({ product_id: productId, org_node_id: nodeId, status: 'available', limit: 100 }));
          fetchCandidates.push({ product_id: productId, status: 'available', limit: 100 });
        }
        if (category) {
          candidateNodeIds.forEach(nodeId => fetchCandidates.push({ category, org_node_id: nodeId, status: 'available', limit: 100 }));
          fetchCandidates.push({ category, status: 'available', limit: 100 });
        }

        for (const params of fetchCandidates) {
          try {
            const response = await inventoryService.getAllInventory(params);
            const list = response?.data?.data || response?.data || [];
            list.forEach(entry => {
              if (!inventoryPool.some(existing => existing.id === entry.id)) {
                inventoryPool.push(entry);
              }
            });
            if (inventoryPool.length > 0) break;
          } catch (err) {
            continue;
          }
        }
      }

      setAvailableNodeInventory(inventoryPool);
    } catch (err) {
      console.error('Failed to load inventory for approval view', err);
      setAvailableNodeInventory([]);
    } finally {
      setLoadingInventoryForView(false);
    }
  };

  const loadInventoryForApproval = async (requestData) => {
    setLoadingApprovalInventory(true);
    setApprovalInventory([]);
    setStockCounts({});
    try {
      const items = requestData?.items || [];
      const inventoryPool = [];
      const countsMap = {};
      for (const item of items) {
        const specs = normalizeSpecifications(item.specifications);
        const productId = item.product_id || item.product?.id;
        const category = item.product?.category || specs.category;
        const candidateNodeIds = getCandidateNodeIds(requestData, item);
        const fetchCandidates = [];
        if (productId) {
          candidateNodeIds.forEach(nodeId => fetchCandidates.push({ product_id: productId, org_node_id: nodeId, status: 'available', limit: 100 }));
          fetchCandidates.push({ product_id: productId, status: 'available', limit: 100 });
        }
        if (category) {
          candidateNodeIds.forEach(nodeId => fetchCandidates.push({ category, org_node_id: nodeId, status: 'available', limit: 100 }));
          fetchCandidates.push({ category, status: 'available', limit: 100 });
        }
        for (const params of fetchCandidates) {
          try {
            const response = await inventoryService.getAllInventory(params);
            const list = response?.data?.data || response?.data || [];
            const total = response?.pagination?.total ?? list.length;
            countsMap[item.id] = total;
            list.forEach(entry => {
              if (!inventoryPool.some(existing => existing.id === entry.id)) inventoryPool.push(entry);
            });
            if (inventoryPool.length > 0) break;
          } catch (err) { continue; }
        }
      }
      setApprovalInventory(inventoryPool);
      setStockCounts(countsMap);
    } catch (err) {
      console.error('Failed to load inventory for approval', err);
    } finally {
      setLoadingApprovalInventory(false);
    }
  };

  const normalizeAllocations = (value) => Object.fromEntries(
    Object.entries(value || {}).map(([itemId, entry]) => {
      if (Array.isArray(entry)) return [itemId, entry.filter(Boolean)];
      return [itemId, typeof entry === 'object' && entry !== null ? entry.id || entry.inventory_id || entry.value || '' : entry];
    })
  );

  const normalizeSpecifications = (specifications) => {
    if (typeof specifications === 'string') {
      try {
        return JSON.parse(specifications);
      } catch (e) {
        return {};
      }
    }
    return typeof specifications === 'object' && specifications !== null ? specifications : {};
  };

  const inferResourceOrigin = (record) => {
    if (record?.resource_origin) {
      const ro = record.resource_origin.toLowerCase();
      if (['request', 'transfer', 'discharge', 'return'].includes(ro)) {
        return ro;
      }
    }

    const text = [
      record?.resource_origin,
      record?.request_type,
      record?.transfer_type,
      record?.discharge_type,
      record?.return_type,
      record?.type,
    ].filter(Boolean).join(' ').toLowerCase();

    if (/return|inventory-return|inventory_return/.test(text)) return 'return';
    if (/transfer|inventory-transfer|inventory_transfer/.test(text)) return 'transfer';
    if (/discharge|issue/.test(text)) return 'discharge';
    return /new|request/.test(text) ? 'request' : 'request';
  };

  const getItemDisplayName = (item, specs = {}) => {
    // 1. Check custom_fields first — this is where individual asset names are
    //    stored when items are received via the intake blueprint (e.g. "Dell XPS 15").
    //    getAssetName also checks item.inventory.custom_fields for nested records.
    const customName = getAssetName(item, false); // false = don't fall back to product name yet
    if (customName) return customName;

    // 2. Check specifications JSON (used by user-request items with custom fields)
    const source = typeof specs === 'object' && specs !== null ? specs : normalizeSpecifications(item?.specifications || specs);
    const candidateKeys = ['item_name', 'item name', 'name', 'product_name', 'product name', 'asset_name', 'asset name', 'title', 'label'];

    for (const key of candidateKeys) {
      if (source?.[key]) return String(source[key]);
      const matchedKey = Object.keys(source || {}).find(existing => existing.toLowerCase() === key.toLowerCase());
      if (matchedKey && source[matchedKey]) return String(source[matchedKey]);
    }

    // 3. Direct name fields on the item record itself
    const directName = item?.name || item?.item_name || item?.inventory?.name;
    const productName = item?.product?.name || item?.product_name || source?.name;
    const serial = item?.serial_number || item?.inventory?.serial_number || specs?.serial_number;

    // 4. For movement items that only have a product name + serial, combine them
    //    so each physical item remains uniquely identifiable in the list
    if (!directName && productName && serial) {
      return `${productName} · ${serial}`;
    }

    return directName || productName || 'Item';
  };

  const canShowInventorySelection = (requestData) => {
    const origin = String(
      requestData?.resource_origin ||
      requestData?.request_type ||
      requestData?.transfer_type ||
      requestData?.discharge_type ||
      requestData?.return_type ||
      requestData?.type ||
      'request'
    ).toLowerCase();

    if (['transfer', 'discharge', 'return', 'inventory', 'inventory-returns'].includes(origin)) {
      return false;
    }

    return ['request', 'new'].includes(origin) && (requestData?.items || []).length === 1;
  };

  const handleAction = async (requestId, action) => {

    setProcessing(true);
    try {
      const origin = selectedRequest?.resource_origin || 'request';

      if (origin === 'discharge') {
        if (action === 'approve') {
          await api.post(`/discharge/${requestId}/approve`, { notes: comments });
        } else if (action === 'reject') {
          await api.post(`/discharge/${requestId}/reject`, { reason: comments });
        }
      } else if (origin === 'transfer') {
        if (action === 'acknowledge') {
          await api.post(`/transfers/${requestId}/acknowledge`, { comments });
        } else if (action === 'approve') {
          await api.post(`/transfers/${requestId}/approve`, { comments });
        } else if (action === 'reject') {
          await api.post(`/transfers/${requestId}/reject`, { reason: comments });
        }
      } else if (origin === 'return') {
        if (action === 'acknowledge') {
          await api.post(`/returns/${requestId}/acknowledge`, { condition: comments });
        } else if (action === 'approve') {
          await api.post(`/returns/${requestId}/process`, { notes: comments });
        } else if (action === 'reject') {
          await api.post(`/returns/${requestId}/reject`, { reason: comments });
        }
      } else {
        if (action === 'acknowledge') {
          await api.post(`/requests/${requestId}/acknowledge`, { comments });
        } else if (action === 'approve') {
          // Prefer allocations made in the approval modal, fall back to view-modal allocations
          const payloadAllocations = normalizeAllocations(
            Object.keys(approvalAllocations).length ? approvalAllocations :
            Object.keys(allocations).length ? allocations : savedAllocations
          );
          await requestService.approveRequest(requestId, comments, payloadAllocations);
        } else if (action === 'reject') {
          await requestService.rejectRequest(requestId, comments);
        }
      }

      toast.success(`${origin.charAt(0).toUpperCase() + origin.slice(1)} ${action === 'acknowledge' ? 'Receipt Acknowledged' : action === 'approve' ? 'Approved' : 'Rejected'} successfully`);
      setApprovalModalOpen(false);
      setComments('');
      setAllocations({});
      setSavedAllocations({});
      setApprovalAllocations({});
      setApprovalInventory([]);
      setApprovalRequestDetail(null);
      refetch();
      } catch (error) {
        const backendMsg = error.response?.data?.message;
        const status = error.response?.status;
        let msg = backendMsg || error.message || 'Command execution failed';
        // If authorization failed and we know the required permission, show it
        if (status === 403) {
          const requiredPerm = action === 'approve' ? 'request:approve' : action === 'reject' ? 'request:reject' : null;
          // Prefer backend required permission if available on selected request
          const stepPerm = selectedRequest?.currentStep?.required_permission;
          const perm = stepPerm || requiredPerm;
          if (perm) {
            msg = `${msg} (Missing permission: ${perm})`;
          }
        }
        toast.error(msg);
      } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (item) => {
    const status = item.status?.toLowerCase();
    const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Unknown';

    if (status === 'fulfilled') {
      return <span className="text-xs font-medium text-gray-900 bg-white border border-gray-200 px-3 py-1 rounded-md">Fulfilled / Received</span>;
    }

    if (status === 'pending' || (item.workflow_status && item.workflow_status.toLowerCase().startsWith('pending') && !item.workflow_status.toLowerCase().includes('acknowledgment'))) {
      return <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-md">Pending</span>;
    }

    if (item.workflow_status) {
      const cleanWf = item.workflow_status.replace(/\s*\(.*?\)\s*/g, '').trim();
      return <span className="text-xs font-medium text-gray-900 bg-white border border-gray-200 px-3 py-1 rounded-md">{capitalize(cleanWf)}</span>;
    }

    return <span className="text-xs font-medium text-gray-900 bg-white border border-gray-200 px-3 py-1 rounded-md">{capitalize(status)}</span>;
  };



  return (
    <div className="space-y-4">


      <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-3">
            <div className="w-full max-w-md">
              <Input
                placeholder="Search by ID or Name..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSearch(searchValue);
                  }
                }}
                className="bg-gray-50 border-none shadow-inner"
              />
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-2 ml-2">Press Enter to execute search command</p>
            </div>
          </div>

          {/* ── Type description banner ── */}
          <div className="mb-3 flex items-center gap-3 px-1">
            <div className="flex items-center gap-2 px-4 py-2 bg-primary-50 border border-primary-100 rounded-xl">
              <span className="text-primary-500">{config.icon}</span>
              <span className="text-[11px] font-black text-primary-700 uppercase tracking-widest">{tableDescription}</span>
            </div>
            <span className="text-[10px] text-gray-400 font-bold">{data?.length ?? 0} record{data?.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-green-600 text-white">
                  <th className="p-4 text-sm font-bold">Requester</th>
                  <th className="p-4 text-sm font-bold">Sub-Unit / Branch</th>
                  <th className="p-4 text-sm font-bold">Target User / Node</th>
                  <th className="p-4 text-sm font-bold text-center">Current Status</th>
                  <th className="p-4 text-sm font-bold text-center">Submission Date</th>
                  <th className="p-4 text-sm font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="p-12 text-center"><div className="flex justify-center"></div></td>
                  </tr>
                ) : (!data || data.length === 0) ? (
                  <tr>
                    <td colSpan="6" className="p-12 text-center text-gray-400 italic">No records found for {tableDescription}</td>
                  </tr>
                ) : (
                  data?.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((item) => {
                  const requester = item.requester || item.user || item.creator;
                  const orgNode = item.organizationNode || item.fromNode;
                  const typeLabel = item.request_type || item.transfer_type || item.discharge_type || type;
                  const priority = item.priority || 'normal';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 align-middle">
                        <span className="text-sm font-medium text-slate-900">{requester?.first_name} {requester?.last_name}</span>
                      </td>
                      <td className="p-4 align-middle">
                        <span className="text-sm text-slate-600">{orgNode?.name || 'Institutional Domain'}</span>
                      </td>
                      <td className="p-4 align-middle">
                        {(() => {
                          const origin = item.resource_origin;
                          if (origin === 'transfer') {
                            if (item.toUser) return <span className="text-sm font-medium text-slate-900">{item.toUser.first_name} {item.toUser.last_name}</span>;
                            if (item.toNode) return <span className="text-sm text-slate-600">{item.toNode.name}</span>;
                          }
                          if (origin === 'discharge') {
                            if (item.toUser) return <span className="text-sm font-medium text-slate-900">{item.toUser.first_name} {item.toUser.last_name}</span>;
                            if (item.toNode) return <span className="text-sm text-slate-600">{item.toNode.name}</span>;
                          }
                          if (origin === 'return') {
                            if (item.toNode) return <span className="text-sm text-slate-600">{item.toNode.name}</span>;
                          }
                          if (item.targetUser) {
                            return <span className="text-sm font-medium text-slate-900">{item.targetUser.first_name} {item.targetUser.last_name}</span>;
                          }
                          return <span className="text-sm text-slate-400">N/A</span>;
                        })()}
                      </td>
                      <td className="p-4 align-middle text-center">
                        {getStatusBadge(item)}
                      </td>
                      <td className="p-4 align-middle text-center">
                        <span className="text-sm text-slate-600">{formatDate(item.created_at)}</span>
                      </td>
                      <td className="p-4 align-middle">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={async () => {
                              try {
                                const origin = inferResourceOrigin(item);
                                const endpointCandidates = [
                                  origin === 'discharge' ? `/discharge/${item.id}` : null,
                                  origin === 'transfer' ? `/transfers/${item.id}` : null,
                                  origin === 'return' ? `/returns/${item.id}` : null,
                                  `/requests/${item.id}`,
                                ].filter(Boolean);

                                let response;
                                for (const endpoint of endpointCandidates) {
                                  try {
                                    response = await api.get(endpoint);
                                    break;
                                  } catch (err) {
                                    if (endpoint === endpointCandidates[endpointCandidates.length - 1]) {
                                      throw err;
                                    }
                                  }
                                }

                                const detail = response?.data?.data || response?.data || response;

                                setViewingRequest(detail);
                                setViewingResourceOrigin(origin);
                                setAllocations({});
                                setSavedAllocations({});
                                setAvailableNodeInventory([]);
                                setSerialNameMap({});

                                if (canShowInventorySelection(detail)) {
                                  await loadAvailableInventoryForView(detail);
                                }
                                
                                // For movement types, fetch individual item names from
                                // inventory records by serial number (where custom_fields lives)
                                if (origin !== 'request') {
                                  const items = detail?.items || [];
                                  const nameMap = {};
                                  const serialsToFetch = [];
                                  items.forEach(it => {
                                    if (it.serial_numbers?.length) serialsToFetch.push(...it.serial_numbers);
                                    else if (it.serial_number) serialsToFetch.push(it.serial_number);
                                  });
                                  if (detail?.assignment?.serial_number) {
                                    serialsToFetch.push(detail.assignment.serial_number);
                                  }
                                  await Promise.all(serialsToFetch.map(async (sn) => {
                                    try {
                                      const res = await inventoryService.getAllInventory({ serial_number: sn, limit: 1 });
                                      const list = res?.data?.data || res?.data || [];
                                      if (list.length > 0) {
                                        const resolved = getAssetName(list[0], false);
                                        nameMap[sn] = {
                                          name: resolved || list[0].product?.name || 'Item',
                                          branchName: list[0].organizationNode?.name || 'Authorized Branch'
                                        };
                                      }
                                    } catch (_) {}
                                  }));
                                  setSerialNameMap(nameMap);
                                }

                                setViewModalOpen(true);
                              } catch (e) {
                                console.error('Could not retrieve protocol details', e);
                                toast.error('Could not retrieve protocol details');
                              }
                            }}
                            className="p-2 text-gray-300 hover:text-primary-600 hover:bg-white rounded-xl transition-all shadow-none hover:shadow-md"
                          >
                            <Eye size={18} />
                          </button>

                          {canUserApprove(item) && (
                            <div className="flex gap-1">
                              <button
                                onClick={async () => {
                                  setSelectedRequest(item);
                                  setApprovalAction('approve');
                                  setApprovalAllocations({});
                                  setApprovalInventory([]);
                                  setApprovalRequestDetail(null);
                                  setLoadingApprovalInventory(true);
                                  try {
                                    const origin = inferResourceOrigin(item);
                                    const endpointCandidates = [
                                      origin === 'discharge' ? `/discharge/${item.id}` : null,
                                      origin === 'transfer' ? `/transfers/${item.id}` : null,
                                      origin === 'return' ? `/returns/${item.id}` : null,
                                      `/requests/${item.id}`,
                                    ].filter(Boolean);

                                    let detail = null;
                                    for (const endpoint of endpointCandidates) {
                                      try {
                                        const response = await api.get(endpoint);
                                        detail = response?.data?.data || response?.data || response;
                                        break;
                                      } catch (err) {
                                        if (endpoint === endpointCandidates[endpointCandidates.length - 1]) {
                                          throw err;
                                        }
                                      }
                                    }

                                    if (detail) {
                                      let assignment = detail.assignment;
                                      if (!assignment) {
                                        const assignmentId = detail.assignment_id || (() => {
                                          try {
                                            const parsed = JSON.parse(detail.notes);
                                            return parsed.assignment_id;
                                          } catch (_) {
                                            return null;
                                          }
                                        })();
                                        if (assignmentId) {
                                          try {
                                            const assignRes = await api.get(`/assignments/${assignmentId}`);
                                            assignment = assignRes?.data?.data || assignRes?.data || assignRes;
                                          } catch (e) {
                                            console.error('Failed to fetch assignment details for return request', e);
                                          }
                                        }
                                      }
                                      if (assignment) {
                                        detail.assignment = assignment;
                                      }
                                      setApprovalRequestDetail(detail);

                                      if (isProductRequest(item)) {
                                        await loadInventoryForApproval(detail);
                                      }
                                    }
                                  } catch (e) {
                                    console.error('Failed to load approval details', e);
                                  } finally {
                                    setLoadingApprovalInventory(false);
                                  }
                                  setApprovalModalOpen(true);
                                }}
                                className="bg-primary-600 text-white hover:bg-primary-700 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter shadow-md transform hover:scale-105 transition-all"
                              >
                                Authorize
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedRequest(item);
                                  setApprovalAction('reject');
                                  setApprovalModalOpen(true);
                                }}
                                className="bg-red-500 text-white hover:bg-red-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter shadow-md transform hover:scale-105 transition-all"
                              >
                                Reject
                              </button>
                            </div>
                          )}

                          {item.can_acknowledge && (
                            <button
                              onClick={() => {
                                setSelectedRequest(item);
                                setApprovalAction('acknowledge');
                                setApprovalModalOpen(true);
                              }}
                              className="bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter shadow-md transform hover:scale-105 transition-all animate-pulse"
                            >
                              Acknowledge Receipt
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
               )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.length > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-sm text-slate-500">
                Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, data.length)}–{Math.min(currentPage * PAGE_SIZE, data.length)} of {data.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>
                {Array.from({ length: Math.ceil(data.length / PAGE_SIZE) }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === Math.ceil(data.length / PAGE_SIZE) || Math.abs(p - currentPage) <= 1)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) => p === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 text-sm">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`w-9 h-9 text-sm font-medium rounded-lg border transition-all ${
                        currentPage === p
                          ? 'bg-green-600 text-white border-green-600 shadow-sm'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(data.length / PAGE_SIZE), p + 1))}
                  disabled={currentPage === Math.ceil(data.length / PAGE_SIZE)}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={approvalModalOpen}
        onClose={() => {
          setApprovalModalOpen(false);
          setComments('');
          setApprovalAction(null);
          setApprovalAllocations({});
          setApprovalInventory([]);
          setApprovalRequestDetail(null);
          setStockCounts({});
        }}
        title={`${approvalAction === 'approve' ? 'Authorize' : 'Reject'} Ledger Entry`}
        size="lg"
      >
        <div className="space-y-5 p-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Type</p>
            <p className="font-black text-gray-800 tracking-tighter capitalize">
              {selectedRequest?.request_type ? `${selectedRequest.request_type.replace(/_/g, ' ')} Request` : 'Request'}
            </p>
          </div>

          {/* Item selection — only for product requests when approving */}
          {approvalAction === 'approve' && isProductRequest(selectedRequest) && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] border-b border-gray-100 pb-2">
                Assign Inventory Items — Select one per unit requested
              </h3>
              {loadingApprovalInventory ? (
                <div className="text-center py-6 text-xs text-gray-400 animate-pulse">Loading available inventory…</div>
              ) : (
                (approvalRequestDetail?.items || selectedRequest?.items || []).map((item, idx) => {
                  const specs = normalizeSpecifications(item.specifications);
                  const category = item.product?.category || specs.category || 'General';
                  const qty = item.quantity_requested || 1;
                  const matchingInventory = approvalInventory.filter(inv => {
                    const invCat = inv.product?.category || inv.category || '';
                    return invCat === category || inv.product_id === item.product_id;
                  });
                  // selections is an array of length qty
                  const selections = Array.isArray(approvalAllocations[item.id])
                    ? approvalAllocations[item.id]
                    : Array(qty).fill('');
                  const filledCount = selections.filter(Boolean).length;
                  const allFilled = filledCount === qty;

                  return (
                    <div key={`appr-item-${idx}`} className={`rounded-2xl border p-4 shadow-sm space-y-3 transition-all ${
                      allFilled ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-100 bg-white'
                    }`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-gray-900">{getItemDisplayName(item, specs) || 'Requested Item'}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                            Category: {category} · Qty Requested: {qty}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black px-2 py-1 rounded-full ${
                            (stockCounts[item.id] ?? matchingInventory.length) > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
                          }`}>{stockCounts[item.id] ?? matchingInventory.length} in stock</span>
                          <span className={`text-[10px] font-black px-2 py-1 rounded-full ${
                            allFilled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-50 text-amber-600'
                          }`}>{filledCount}/{qty} selected</span>
                        </div>
                      </div>

                      {matchingInventory.length > 0 ? (
                        <div className="space-y-2">
                          {Array.from({ length: qty }).map((_, unitIdx) => {
                            // exclude items already chosen in OTHER slots of this item
                            const otherSelected = selections.filter((s, i) => i !== unitIdx && s);
                            const availableForUnit = matchingInventory.filter(
                              inv => !otherSelected.includes(String(inv.id))
                            );
                            const unitVal = selections[unitIdx] || '';
                            return (
                              <div key={`unit-${unitIdx}`} className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest w-14 shrink-0">
                                  Unit {unitIdx + 1}
                                </span>
                                <select
                                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-primary-100 ${
                                    unitVal ? 'border-emerald-300 bg-white' : 'border-gray-200 bg-gray-50'
                                  }`}
                                  value={unitVal}
                                  onChange={(e) => {
                                    const newSelections = [...selections];
                                    newSelections[unitIdx] = e.target.value;
                                    setApprovalAllocations(prev => ({ ...prev, [item.id]: newSelections }));
                                  }}
                                >
                                  <option value="">— Select item for unit {unitIdx + 1} —</option>
                                  {availableForUnit.map(inv => (
                                    <option key={inv.id} value={String(inv.id)}>
                                      {inv.product?.name || 'Item'} · SN: {inv.serial_number || 'N/A'} · Qty: {inv.quantity || 1}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-rose-400 font-semibold">⚠ No matching inventory available at this node.</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
          {/* Return item details when approving a return or transfer */}
          {approvalAction === 'approve' && !isProductRequest(selectedRequest) && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] border-b border-gray-100 pb-2">
                Item Details
              </h3>
              {loadingApprovalInventory || !approvalRequestDetail ? (
                <div className="text-center py-6 text-xs text-gray-400 animate-pulse">Loading item details…</div>
              ) : (
                (() => {
                  const assignment = approvalRequestDetail.assignment;
                  const items = approvalRequestDetail.items || [];
                  
                  if (assignment) {
                    return (
                      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-2">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-black text-gray-900">
                              {assignment.product?.name || 'Unknown Product'}
                            </p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                              Serial Number: {assignment.serial_number || 'N/A'}
                            </p>
                          </div>
                          <span className="text-[10px] font-black px-2 py-1 rounded-full bg-blue-50 text-blue-600">
                            Assigned Item
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 border-t border-gray-50 pt-2 space-y-1">
                          <p><span className="font-bold">Assigned Custodian:</span> {assignment.user ? `${assignment.user.first_name} ${assignment.user.last_name}` : 'N/A'}</p>
                          <p><span className="font-bold">Current Node:</span> {assignment.organizationNode?.name || 'N/A'}</p>
                          <p><span className="font-bold">Condition:</span> {assignment.condition_at_assignment || 'Good'}</p>
                        </div>
                      </div>
                    );
                  } else if (items.length > 0) {
                    return items.map((item, idx) => (
                      <div key={`ret-item-${idx}`} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-2">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-black text-gray-900">
                              {item.product?.name || 'Item'}
                            </p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                              Quantity: {item.quantity || 1}
                            </p>
                          </div>
                          <span className="text-[10px] font-black px-2 py-1 rounded-full bg-blue-50 text-blue-600">
                            Stock Item
                          </span>
                        </div>
                        {item.remarks && (
                          <p className="text-xs text-gray-500 italic mt-1">Remarks: {item.remarks}</p>
                        )}
                      </div>
                    ));
                  } else {
                    return <p className="text-xs text-gray-400 italic">No item details available for this request.</p>;
                  }
                })()
              )}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Institutional Comments</label>
            <textarea
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl shadow-inner focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-700"
              placeholder="Provide context for this command decision..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>

          {/* Validation hint */}
          {approvalAction === 'approve' && isProductRequest(selectedRequest) && !loadingApprovalInventory &&
            (approvalRequestDetail?.items || selectedRequest?.items || []).some(item => {
              const specs = normalizeSpecifications(item.specifications);
              const cat = item.product?.category || specs.category || 'General';
              const qty = item.quantity_requested || 1;
              const hasStock = approvalInventory.some(inv => {
                const invCat = inv.product?.category || inv.category || '';
                return invCat === cat || inv.product_id === item.product_id;
              });
              const selections = Array.isArray(approvalAllocations[item.id]) ? approvalAllocations[item.id] : [];
              return hasStock && selections.filter(Boolean).length < qty;
            }) && (
            <p className="text-[10px] text-amber-600 font-black uppercase tracking-widest text-center">
              ⚠ Please select an inventory item for every unit before approving.
            </p>
          )}

          <div className="flex gap-4">
            <Button
              variant="default"
              className="flex-1 py-4 rounded-2xl font-black uppercase text-[11px]"
              onClick={() => {
                setApprovalModalOpen(false);
                setComments('');
                setApprovalAction(null);
                setApprovalAllocations({});
                setApprovalInventory([]);
                setApprovalRequestDetail(null);
                setStockCounts({});
              }}
            >
              Discard Action
            </Button>
            <Button
              className={`flex-1 ${
                approvalAction === 'approve' ? 'bg-primary-600 hover:bg-primary-700' : 'bg-red-500 hover:bg-red-600'
              } text-white py-4 rounded-2xl font-black uppercase text-[11px] shadow-xl disabled:opacity-40 disabled:cursor-not-allowed`}
              onClick={() => handleAction(selectedRequest?.id, approvalAction)}
              disabled={processing || loadingApprovalInventory || (
                approvalAction === 'approve' &&
                isProductRequest(selectedRequest) &&
                (approvalRequestDetail?.items || selectedRequest?.items || []).some(item => {
                  const specs = normalizeSpecifications(item.specifications);
                  const cat = item.product?.category || specs.category || 'General';
                  const qty = item.quantity_requested || 1;
                  const hasStock = approvalInventory.some(inv => {
                    const invCat = inv.product?.category || inv.category || '';
                    return invCat === cat || inv.product_id === item.product_id;
                  });
                  const selections = Array.isArray(approvalAllocations[item.id]) ? approvalAllocations[item.id] : [];
                  return hasStock && selections.filter(Boolean).length < qty;
                })
              )}
            >
              {processing ? 'Processing…' : loadingApprovalInventory ? 'Loading…' : `Execute ${approvalAction?.toUpperCase()}`}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={viewModalOpen}
        onClose={() => { setViewModalOpen(false); setViewingResourceOrigin(null); }}
        title={viewingResourceOrigin === 'request'
          ? `Product Request — ${viewingRequest?.request_type ? viewingRequest.request_type.replace(/_/g, ' ') : 'Details'}`
          : `Asset Intelligence: ${viewingRequest?.request_type ? `${viewingRequest.request_type.charAt(0).toUpperCase() + viewingRequest.request_type.slice(1).replace(/_/g, ' ')} Request` : 'Ledger Details'}`
        }
        size="lg"
      >
        <div className="space-y-6 p-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* ─── USER / PRODUCT REQUEST: show every field the requester filled ─── */}
          {viewingResourceOrigin === 'request' ? (
            <div className="space-y-5">

              {/* Requester info */}
              <div>
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] border-b border-gray-100 pb-2 mb-4">
                  Requester Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Full Name</p>
                    <p className="text-sm font-bold text-gray-800">
                      {viewingRequest?.requester
                        ? `${viewingRequest.requester.first_name} ${viewingRequest.requester.last_name}`
                        : '—'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Employee ID</p>
                    <p className="text-sm font-bold text-gray-800">{viewingRequest?.requester?.employee_id || '—'}</p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Branch / Unit</p>
                    <p className="text-sm font-bold text-gray-800">{viewingRequest?.organizationNode?.name || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Request meta */}
              <div>
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] border-b border-gray-100 pb-2 mb-4">
                  Request Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Purpose / Reason</p>
                    <p className="text-sm font-bold text-gray-800">{viewingRequest?.purpose || viewingRequest?.reason || '—'}</p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Priority</p>
                    <p className={`text-sm font-black capitalize ${
                      viewingRequest?.priority === 'high' ? 'text-red-600' :
                      viewingRequest?.priority === 'medium' ? 'text-amber-600' :
                      'text-emerald-600'
                    }`}>{viewingRequest?.priority || '—'}</p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Expected Delivery Date</p>
                    <p className="text-sm font-bold text-gray-800">
                      {viewingRequest?.expected_delivery_date
                        ? formatDate(viewingRequest.expected_delivery_date)
                        : viewingRequest?.expected_date
                          ? formatDate(viewingRequest.expected_date)
                          : '—'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Request Type</p>
                    <p className="text-sm font-bold text-gray-800 capitalize">{viewingRequest?.request_type?.replace(/_/g, ' ') || '—'}</p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Status</p>
                    <p className="text-sm font-bold text-gray-800 capitalize">{viewingRequest?.status?.replace(/_/g, ' ') || '—'}</p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Submitted On</p>
                    <p className="text-sm font-bold text-gray-800">{viewingRequest?.created_at ? formatDate(viewingRequest.created_at) : '—'}</p>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] border-b border-gray-100 pb-2 mb-4">
                  Requested Items ({(viewingRequest?.items || []).length})
                </h3>
                <div className="space-y-3">
                  {(viewingRequest?.items || []).length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No items recorded.</p>
                  ) : (
                    (viewingRequest?.items || []).map((item, idx) => {
                      const specs = normalizeSpecifications(item.specifications);
                      const category = item.product?.category || specs.category || '—';
                      const subCategory = item.product?.sub_category || specs.sub_category || null;
                      const notes = specs.notes || null;
                      const qty = item.quantity_requested || item.quantity || 1;
                      // Extra custom fields (anything beyond the known keys)
                      const knownKeys = ['category', 'sub_category', 'notes', 'name', 'sku', 'serial_number', 'quantity_requested', 'source_node_id'];
                      const extraFields = Object.entries(specs).filter(([k]) => !knownKeys.includes(k.toLowerCase()));

                      return (
                        <div key={idx} className="rounded-2xl border border-primary-100 bg-white p-4 shadow-sm space-y-3">
                          {/* Item header */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <span className="text-sm font-black text-gray-900">
                                {item.product?.name || getItemDisplayName(item, specs) || `Item #${idx + 1}`}
                              </span>
                            </div>
                            <span className="text-[10px] font-black text-primary-600 bg-primary-50 px-3 py-1 rounded-full shrink-0">
                              Qty: {qty}
                            </span>
                          </div>

                          {/* Core fields grid */}
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Category</p>
                              <p className="text-sm font-semibold text-gray-700 mt-1">{category}</p>
                            </div>
                            {subCategory && (
                              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sub-Category</p>
                                <p className="text-sm font-semibold text-gray-700 mt-1">{subCategory}</p>
                              </div>
                            )}
                            {notes && (
                              <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 col-span-2 md:col-span-1">
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Specifications / Notes</p>
                                <p className="text-sm font-semibold text-blue-700 mt-1">{notes}</p>
                              </div>
                            )}
                            {/* Any extra custom fields */}
                            {extraFields.map(([key, value]) => (
                              <div key={key} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{key.replace(/_/g, ' ')}</p>
                                <p className="text-sm font-semibold text-gray-700 mt-1">{String(value || '—')}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Approval trail */}
              {(viewingRequest?.approvals || []).length > 0 && (
                <div>
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] border-b border-gray-100 pb-2 mb-4">
                    Approval Trail
                  </h3>
                  <div className="space-y-2">
                    {viewingRequest.approvals.map((approval, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-800">
                            {approval.approver ? `${approval.approver.first_name} ${approval.approver.last_name}` : 'System'}
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                            {approval.notes || approval.comments || '—'}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            approval.action === 'approve' ? 'bg-emerald-100 text-emerald-700' :
                            approval.action === 'reject' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>{approval.action || 'actioned'}</span>
                          <span className="text-[10px] text-gray-400">{approval.created_at ? formatDate(approval.created_at) : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ─── MOVEMENT TYPES (transfer / discharge / return): serial table ─── */
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-green-600 text-white">
                        <th className="p-4 text-sm font-bold">Item Name</th>
                        <th className="p-4 text-sm font-bold">ID / Serial Number (QR Code)</th>
                        <th className="p-4 text-sm font-bold">Current Branch</th>
                        <th className="p-4 text-sm font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(() => {
                        const items = (viewingRequest?.items && viewingRequest.items.length > 0)
                          ? viewingRequest.items
                          : (viewingRequest?.assignment
                              ? [{
                                  id: viewingRequest.assignment.id,
                                  product_id: viewingRequest.assignment.product_id,
                                  product: viewingRequest.assignment.product,
                                  serial_number: viewingRequest.assignment.serial_number,
                                  status: viewingRequest.assignment.status || 'Active',
                                  quantity: 1,
                                  quantity_requested: 1,
                                  specifications: viewingRequest.assignment.specifications
                                }]
                              : []);
                        return items.flatMap((item, idx) => {
                          const specs = normalizeSpecifications(item.specifications);
                          const category = item.product?.category || specs.category || 'General';

                          let serials = [];
                          if (item.serial_numbers && item.serial_numbers.length > 0) serials = item.serial_numbers;
                          else if (item.serial_number) serials = [item.serial_number];
                          else if (specs.serial_number) serials = [specs.serial_number];
                          else serials = Array.from({ length: item.quantity || item.quantity_requested || 1 }).map(() => 'PENDING-HANDOVER');

                          return serials.map((sn, sidx) => {
                            const individualName =
                              (serialNameMap[sn] && typeof serialNameMap[sn] === 'object' ? serialNameMap[sn].name : serialNameMap[sn]) ||
                              getItemDisplayName({ ...item, serial_number: sn }, specs) ||
                              `Item #${item.product_id || item.id}`;

                            const currentBranch =
                              (serialNameMap[sn] && typeof serialNameMap[sn] === 'object' ? serialNameMap[sn].branchName : null) ||
                              item.organizationNode?.name ||
                              viewingRequest?.fromNode?.name ||
                              viewingRequest?.organizationNode?.name ||
                              'Central Office';

                            return (
                              <tr key={`${idx}-${sidx}`} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-4 text-sm text-slate-600 align-middle">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-900 text-sm">{individualName}</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Category: {category}</span>
                                  </div>
                                </td>
                                <td className="p-4 text-sm text-slate-600 align-middle">
                                  <div className="flex items-center gap-2">
                                    {sn !== 'PENDING-HANDOVER' ? (
                                      <>
                                        <div
                                          onClick={() => setQrModalItem({
                                            id: item.id,
                                            serial_number: sn,
                                            name: individualName,
                                            product: { ...(item.product || {}), name: individualName, sku: item.product?.sku || specs.sku || 'N/A', category }
                                          })}
                                          className="p-1 bg-white border border-slate-200 rounded shadow-sm hover:border-slate-400 hover:scale-105 transition-all cursor-pointer shrink-0"
                                          title="Click to view QR label"
                                        >
                                          <QRCode value={JSON.stringify({ id: item.id, name: individualName, sku: item.product?.sku || specs.sku || 'N/A', serial: sn })} size={20} level="H" />
                                        </div>
                                        <span className="font-mono text-xs font-bold text-gray-800 bg-gray-50 px-2 py-0.5 border border-slate-200 rounded shadow-sm">{sn}</span>
                                      </>
                                    ) : (
                                      <span className="font-mono text-xs font-semibold text-slate-400 italic">{sn}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-4 text-sm text-slate-600 align-middle">
                                  <span className="bg-slate-100 text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">{currentBranch}</span>
                                </td>
                                <td className="p-4 text-sm text-slate-600 align-middle">
                                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold bg-slate-50 text-slate-655 border border-slate-200">{item.status || 'Selected'}</span>
                                </td>
                              </tr>
                            );
                          });
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Pop-up Identity Tag Modal */}
      {qrModalItem && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setQrModalItem(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-4 text-center bg-slate-50 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Asset Identity Tag</h3>
                <p className="text-xs font-semibold text-slate-505 mt-0.5">{qrModalItem.name || qrModalItem.product?.name || 'Item'}</p>
             </div>
             <div className="p-6 flex flex-col items-center gap-4 bg-white">
                <div className="p-3 bg-white rounded-xl shadow-sm ring-1 ring-slate-100">
                   <QRCode value={JSON.stringify({ id: qrModalItem.id, name: qrModalItem.name || qrModalItem.product?.name || 'Item', sku: qrModalItem.product?.sku || 'N/A', serial: qrModalItem.serial_number })} size={180} level="H" />
                </div>
                <div className="text-center font-mono text-xs font-bold text-slate-900 uppercase tracking-widest mt-2 bg-slate-50 px-3 py-1 rounded border border-slate-200">
                  {qrModalItem.serial_number}
                </div>
             </div>
             <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
                <button onClick={() => window.print()} className="flex-1 h-9 bg-slate-950 text-white font-semibold rounded-lg text-xs hover:bg-slate-900 transition-all shadow-sm">Print</button>
                <button onClick={() => setQrModalItem(null)} className="flex-1 h-9 bg-slate-100 border border-slate-200 text-slate-650 font-semibold rounded-lg text-xs hover:bg-slate-200 transition-all">Close</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalLedgerPage;
