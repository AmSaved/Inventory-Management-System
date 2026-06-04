import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner';
import organizationService from '../../services/organizationService';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  Network,
  Layers,
  Plus,
  Trash2,
  ChevronRight,
  Building2,
  MapPin,
  ShieldCheck,
  Edit3,
  GitMerge,
  Box,
  LayoutGrid,
  Activity,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import Badge from '../ui/Badge';

const OrganizationManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [types, setTypes] = useState([]);

  const isSuperAdmin = user?.role?.level >= 100 || user?.role?.name?.toLowerCase().includes('super');
  const isOrgAdmin = user?.role?.level >= 90;

  const [nodeTree, setNodeTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [navigationStack, setNavigationStack] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [typeModalView, setTypeModalView] = useState('list');
  const [editingType, setEditingType] = useState(null);
  const [editingNode, setEditingNode] = useState(null);
  const [modalParentNode, setModalParentNode] = useState(null);
  const [formData, setFormData] = useState({});
  const [deletingNodeId, setDeletingNodeId] = useState(null);
  const [deletePreview, setDeletePreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [typesData, treeData] = await Promise.all([
        organizationService.getTypes(),
        organizationService.getNodeTree()
      ]);
      setTypes(typesData);
      setNodeTree(treeData);

      const findNodeInTree = (nodes, id) => {
        for (const n of nodes) {
          if (n.id === id) return n;
          if (n.children?.length) {
            const found = findNodeInTree(n.children, id);
            if (found) return found;
          }
        }
        return null;
      };

      if (navigationStack.length > 0) {
        const updatedStack = [];
        for (const stackItem of navigationStack) {
          const freshNode = findNodeInTree(treeData, stackItem.id);
          if (freshNode) updatedStack.push(freshNode);
          else break;
        }
        setNavigationStack(updatedStack);
      }
    } catch (error) {
      toast.error('Protocol Error: Hierarchy Sync Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDrillDown = (node) => setNavigationStack([...navigationStack, node]);

  const handleBreadcrumbClick = (index) => {
    if (index === -1) setNavigationStack([]);
    else setNavigationStack(navigationStack.slice(0, index + 1));
  };

  const handleOpenNodeModal = (parent = null, node = null) => {
    setEditingNode(node);
    const currentParent = parent || (navigationStack.length > 0 ? navigationStack[navigationStack.length - 1] : null);
    setModalParentNode(currentParent);
    const isRoot = node ? !node.parent_id : !currentParent;

    const defaultType = isRoot
      ? (types.find(t => t.name.toLowerCase().includes('headquarters') || t.name.toLowerCase().includes('root')) || types[0])
      : (types.find(t => t.name.toLowerCase() === 'branch') || types.find(t => t.name.toLowerCase().includes('branch')) || types[0]);

    if (node) {
      setFormData({
        ...node,
        org_type_id: defaultType?.id || node.org_type_id
      });
    } else {
      setFormData({
        parent_id: currentParent?.id || (user?.role?.level < 100 ? (user?.org_node_id || null) : null),
        org_type_id: defaultType?.id || '',
        can_store_inventory: true,
        name: ''
      });
    }
    setModalOpen(true);
  };

  const handleOpenRootModal = () => {
    setEditingNode(null);
    setModalParentNode(null);
    const defaultType = types.find(t => t.name.toLowerCase().includes('headquarters') || t.name.toLowerCase().includes('root')) || types[0];
    setFormData({
      parent_id: null,
      org_type_id: defaultType?.id || '',
      can_store_inventory: true,
      name: ''
    });
    setModalOpen(true);
  };


  const handleTypeSubmit = async (e) => {
    e?.preventDefault();
    const loadingToast = toast.loading('Calibrating Blueprint...');
    try {
      const payload = {
        ...formData,
        is_storage_allowed: formData.is_storage_allowed || false,
        is_department: formData.is_department || false,
        is_approval_unit: formData.is_approval_unit || false
      };

      if (editingType) {
        await organizationService.updateType(editingType.id, payload);
        toast.success('Blueprint Refined', { id: loadingToast });
      } else {
        await organizationService.createType(payload);
        toast.success('Blueprint Defined', { id: loadingToast });
      }

      setTypeModalView('list');
      setEditingType(null);
      fetchData();
    } catch (error) {
      toast.error('Calibration Failed', { id: loadingToast });
    }
  };

  const handleDeleteType = async (id) => {
    if (!window.confirm('Terminate this classification blueprint?')) return;
    try {
      await organizationService.deleteType(id);
      toast.success('Blueprint Expunged');
      fetchData();
    } catch (error) {
      toast.error('Termination Aborted: Node Dependencies Detected');
    }
  };

  const handleNodeSubmit = async () => {
    const loadingToast = toast.loading('Committing Node Geometry...');
    try {
      if (editingNode) {
        await organizationService.updateNode(editingNode.id, formData);
        toast.success(`Node Updated`, { id: loadingToast });
      } else {
        await organizationService.createNode(formData);
        toast.success(`Node Added`, { id: loadingToast });
      }
      setModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Protocol Failure', { id: loadingToast });
    }
  };

  const handleDeleteClick = async (id) => {
    setDeletingNodeId(id);
    setLoadingPreview(true);
    setDeletePreview(null);
    try {
      const previewData = await organizationService.getDeletePreview(id);
      setDeletePreview(previewData);
    } catch (error) {
      toast.error('Error fetching deletion preview data');
      setDeletingNodeId(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirmDelete = async (id) => {
    const loadingToast = toast.loading('Decommissioning Node and all contents...');
    try {
      await organizationService.deleteNode(id);
      toast.success('Node and sub-hierarchy contents successfully expunged', { id: loadingToast });
      setDeletingNodeId(null);
      setDeletePreview(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete node', { id: loadingToast });
    }
  };

  const handleCancelDelete = () => {
    setDeletingNodeId(null);
    setDeletePreview(null);
  };

  const handleToggleNodeStatus = async (id) => {
    const loadingToast = toast.loading('Toggling Node Status...');
    try {
      await organizationService.toggleNodeStatus(id);
      toast.success('Node status updated successfully', { id: loadingToast });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to toggle node status', { id: loadingToast });
    }
  };

  const currentNodes = navigationStack.length === 0
    ? nodeTree
    : navigationStack[navigationStack.length - 1].children || [];


  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
            <Network size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-blue-700">Hierarchy Management</h1>
            <p className="text-sm text-slate-500 mt-1">Manage the organizational structure and nodes of the company</p>
          </div>
        </div>
        {isSuperAdmin && (
          <Button
            onClick={handleOpenRootModal}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all"
          >
            <Plus size={16} />
            <span>Create Root Org</span>
          </Button>
        )}
      </div>


      {/* BREADCRUMB COMMAND BAR */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex items-center overflow-x-auto no-scrollbar gap-2">
        <button
          onClick={() => handleBreadcrumbClick(-1)}
          className={`flex items-center px-4 py-2 rounded-lg transition-all font-bold text-xs uppercase tracking-wider ${navigationStack.length === 0 ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <LayoutGrid size={14} className="mr-2" /> {isSuperAdmin ? 'Institutional Root' : 'Main Level'}
        </button>
        {navigationStack.map((node, i) => (
          <React.Fragment key={node.id}>
            <div className="w-1.5 h-1.5 bg-slate-300 rounded-full flex-shrink-0" />
            <button
              onClick={() => handleBreadcrumbClick(i)}
              className={`flex items-center px-4 py-2 rounded-lg transition-all font-bold text-xs uppercase tracking-wider whitespace-nowrap ${i === navigationStack.length - 1 ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-550'}`}
            >
              <MapPin size={14} className="mr-2" /> {node.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* NODE INSIGHT GRID */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-5 bg-blue-600 rounded-full" />
            <h3 className="text-base font-bold text-slate-800">Branches</h3>
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {currentNodes.length} Active Nodes
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {loading ? (
            <div className="p-12 text-center flex justify-center"><LoadingSpinner /></div>
          ) : currentNodes.map((node) => {
            if (deletingNodeId === node.id) {
              return (
                <div
                  key={node.id}
                  className="bg-rose-50 border-2 border-rose-200 rounded-xl p-5 shadow-sm animate-in slide-in-from-top-4 duration-300 flex flex-col gap-4 w-full"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center shrink-0">
                      <ShieldAlert size={22} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <h4 className="text-sm font-bold text-rose-900 uppercase tracking-wide">Decommission Node: {node.name}</h4>
                      {loadingPreview ? (
                        <div className="flex items-center gap-2 text-rose-700 text-xs mt-1">
                          <span className="animate-spin rounded-full h-3 w-3 border-2 border-rose-600 border-t-transparent mr-2"></span>
                          <span>Scanning node contents and dependencies...</span>
                        </div>
                      ) : deletePreview ? (
                        <div className="text-xs text-rose-800 space-y-2 mt-1">
                          <p className="font-semibold leading-relaxed">
                            Warning: Deleting this node will permanently delete all of its sub-hierarchy content:
                          </p>
                          <ul className="list-disc pl-5 space-y-1 font-medium">
                            <li><strong>{deletePreview.subNodesCount}</strong> Descendant Sub-nodes (will be deleted)</li>
                            <li><strong>{deletePreview.inventoryCount}</strong> Inventory items (will be deleted)</li>
                            <li><strong>{deletePreview.usersCount}</strong> Users (will be deleted along with their assignments, requests, and roles)</li>
                            <li><strong>{deletePreview.rolesCount}</strong> Roles scoped to these nodes (will be deleted)</li>
                            <li><strong>{deletePreview.templatesCount}</strong> Form Templates scoped to these nodes (will be deleted)</li>
                          </ul>
                          <p className="font-bold text-rose-900 mt-2">
                            This action is destructive and CANNOT be undone. Are you sure you want to proceed?
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-rose-700 font-medium">
                          Failed to load dependency scanner. You can still cancel or try to proceed.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end mt-2">
                    <button
                      onClick={handleCancelDelete}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                    >
                      Cancel Deletion
                    </button>
                    <button
                      onClick={() => handleConfirmDelete(node.id)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
                      disabled={loadingPreview}
                    >
                      Continue Deletion
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={node.id}
                className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col md:flex-row items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 w-full md:w-auto">
                  {/* Status Toggle Button in Front of Every Node */}
                  <button
                    onClick={() => handleToggleNodeStatus(node.id)}
                    className={`px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer ${node.status === 'active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-305 hover:bg-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200'}`}
                    title="Click to toggle status"
                  >
                    {node.status === 'active' ? 'Active' : 'Inactive'}
                  </button>

                  <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center shrink-0 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors duration-300">
                    <Building2 size={20} />
                  </div>
                  <div className="flex-1 cursor-pointer group/name" onClick={() => navigate(`/dashboard?unit=${node.id}`)} title={`Switch to ${node.name} Dashboard`}>
                    <div className="flex items-center gap-2.5">
                      <h4 className="text-sm font-semibold text-slate-900 group-hover/name:text-blue-600 transition-colors">{node.name}</h4>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                  <button
                    onClick={() => handleDrillDown(node)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 text-white rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-blue-600 transition-all shadow-sm group/btn"
                  >
                    <span>Drill Down</span> <ArrowRight size={12} className="group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleOpenNodeModal(node, null)} className="w-8 h-8 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all" title="Add Child Node"><Plus size={16} /></button>
                    <button onClick={() => handleOpenNodeModal(null, node)} className="w-8 h-8 flex items-center justify-center bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-600 hover:text-white transition-all" title="Edit Node"><Edit3 size={16} /></button>
                    <button onClick={() => handleDeleteClick(node.id)} className="w-8 h-8 flex items-center justify-center bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all" title="Delete Node"><Trash2 size={16} /></button>
                  </div>
                </div>
              </div>
            );
          })}

          {!loading && currentNodes.length === 0 && (
            <div className="p-20 bg-white rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-xl shadow-inner flex items-center justify-center text-slate-400 mb-6">
                <GitMerge size={32} />
              </div>
              <h4 className="text-lg font-bold text-slate-900 uppercase">Layer Initialized</h4>
              <p className="text-slate-400 text-sm font-medium max-w-sm mt-1">This hierarchy layer is currently empty. Ready for node deployment.</p>
              <Button
                onClick={() => handleOpenNodeModal()}
                className="mt-6 bg-blue-600 text-white px-6 h-11 rounded-lg font-bold text-sm hover:bg-blue-700 transition-all shadow-sm"
              >
                {navigationStack.length > 0 ? 'Deploy First Sub-Node' : (isSuperAdmin ? 'Deploy First Root Org' : 'Deploy First Sub-Unit')}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* NODE DEPLOYMENT MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingNode ? "RECONFIGURE NODE" : "DEPLOY NODE"}
        onConfirm={handleNodeSubmit}
        confirmText="Create"
        cancelText="Cancel"
      >
        <div className="space-y-8 p-2">
          {modalParentNode && !editingNode && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
              <span className="text-xs font-semibold text-blue-800">
                Creating under parent node: <span className="font-bold underline">{modalParentNode.name}</span>
              </span>
            </div>
          )}

          <div>
            <Input
              label="Operational Name"
              placeholder="e.g. Strategic Hub"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-slate-50 border-none rounded-2xl h-14 font-black placeholder:text-slate-300"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 italic">Layer Classification</label>
            <div className="w-full h-14 bg-slate-100 text-slate-900 rounded-2xl px-6 flex items-center font-black text-xs uppercase tracking-widest border border-slate-200 shadow-inner">
              {!formData.parent_id ? 'Root Org' : 'Branch'}
            </div>
          </div>

          <div className="bg-slate-950 rounded-[2.5rem] p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-transparent"></div>
            <div className="relative z-10 flex items-center gap-6">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-blue-400 border border-white/10">
                <ShieldCheck size={24} />
              </div>
              <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest leading-relaxed">
                Node will be under <span className="text-white italic">{navigationStack.length > 0 ? navigationStack[navigationStack.length - 1].name : 'System Root'}</span>
              </p>
            </div>
          </div>
        </div>
      </Modal>

      {/* TYPES MODAL OVERHAUL */}
      <Modal
        isOpen={typeModalOpen}
        onClose={() => setTypeModalOpen(false)}
        title="LAYER BLUEPRINTS"
        onConfirm={typeModalView === 'list' ? () => { setFormData({}); setTypeModalView('form'); } : handleTypeSubmit}
        confirmText={typeModalView === 'list' ? "CREATE NEW BLUEPRINT" : "SAVE DEFINITION"}
      >
        <div className="space-y-6">
          {typeModalView === 'list' ? (
            <div className="grid grid-cols-1 gap-3">
              <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100 flex items-start gap-4 mb-4">
                <ShieldAlert className="text-blue-600 mt-1" size={20} />
                <p className="text-[11px] text-slate-500 font-medium italic leading-relaxed">
                  Manage the global blueprints that define your hierarchy levels. Editing a type updates all nodes using it.
                </p>
              </div>
              {types.map(t => (
                <div key={t.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group hover:bg-slate-950 hover:text-white transition-all">
                  <div>
                    <div className="font-black uppercase italic text-xs">{t.name}</div>
                    <div className="text-[9px] font-black text-blue-500 uppercase tracking-widest opacity-60">ID CODE: {t.code_prefix}</div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingType(t); setFormData(t); setTypeModalView('form'); }} className="p-2 bg-white/10 rounded-lg hover:bg-blue-600 transition-colors"><Edit3 size={14} /></button>
                    <button onClick={() => handleDeleteType(t.id)} className="p-2 bg-white/10 rounded-lg hover:bg-rose-600 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-right-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Blueprint Name" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="bg-slate-50 border-none rounded-xl font-black" />
                <Input label="ID Prefix" value={formData.code_prefix || ''} onChange={e => setFormData({ ...formData, code_prefix: e.target.value.toUpperCase() })} className="bg-slate-50 border-none rounded-xl font-black" />
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Capabilities</h4>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-3 p-4 border rounded-2xl cursor-pointer hover:bg-slate-50 group">
                    <input type="checkbox" checked={formData.is_storage_allowed || false} onChange={e => setFormData({ ...formData, is_storage_allowed: e.target.checked })} className="w-4 h-4 accent-blue-600" />
                    <span className="text-xs font-black text-slate-700 uppercase tracking-tighter group-hover:text-blue-600 transition-colors">Storage</span>
                  </label>
                  <label className="flex items-center gap-3 p-4 border rounded-2xl cursor-pointer hover:bg-slate-50 group">
                    <input type="checkbox" checked={formData.is_department || false} onChange={e => setFormData({ ...formData, is_department: e.target.checked })} className="w-4 h-4 accent-blue-600" />
                    <span className="text-xs font-black text-slate-700 uppercase tracking-tighter group-hover:text-blue-600 transition-colors">Logical Unit</span>
                  </label>
                </div>
              </div>

              <Button onClick={() => setTypeModalView('list')} variant="ghost" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Back to Library</Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default OrganizationManagement;
