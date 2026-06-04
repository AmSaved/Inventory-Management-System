import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GitMerge, 
  ShieldAlert, 
  ArrowRight, 
  CheckCircle2, 
  Layers,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Card, { CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';

const BranchMergePage = () => {
  const navigate = useNavigate();
  const [nodes, setNodes] = useState([]);
  const [orgTypes, setOrgTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSources, setSelectedSources] = useState([]);
  const [preview, setPreview] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  const [mergeMode, setMergeMode] = useState('new'); // 'new' or 'existing'
  const [targetNodeId, setTargetNodeId] = useState('');

  const [formData, setFormData] = useState({
    newBranchName: '',
    org_type_id: '',
    parent_id: ''
  });

  const getRootNodeId = (node) => {
    if (!node) return null;
    if (!node.path) return node.id;
    const parts = node.path.split('/').filter(Boolean);
    return parts.length > 0 ? parseInt(parts[0]) : node.id;
  };

  const firstSelectedNode = nodes.find(n => n.id === selectedSources[0]);
  const allowedRootId = firstSelectedNode ? getRootNodeId(firstSelectedNode) : null;

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    const minRequired = mergeMode === 'existing' ? 1 : 2;
    if (selectedSources.length >= minRequired) {
      fetchPreview();
    } else {
      setPreview(null);
    }
  }, [selectedSources, mergeMode]);

  // Reset target node selection if it gets chosen as a source branch
  useEffect(() => {
    if (selectedSources.map(Number).includes(Number(targetNodeId))) {
      setTargetNodeId('');
    }
  }, [selectedSources, targetNodeId]);

  const fetchInitialData = async () => {
    try {
      const [nodesRes, typesRes] = await Promise.all([
        api.get('/organization/nodes/merge/all'),
        api.get('/organization/types')
      ]);
      const types = typesRes.data.data || [];
      setNodes(nodesRes.data.data || []);
      setOrgTypes(types);
      // Auto-select the 'Branch' type so the user never needs to pick it
      const branchType = types.find(t => t.name?.toLowerCase().includes('branch')) || types[0];
      if (branchType) {
        setFormData(prev => ({ ...prev, org_type_id: branchType.id }));
      }
    } catch (error) {
      toast.error('Failed to load organizational structure');
    } finally {
      setLoading(false);
    }
  };

  const fetchPreview = async () => {
    try {
      const res = await api.get('/organization/nodes/merge/preview', {
        params: { sourceNodeIds: JSON.stringify(selectedSources) }
      });
      setPreview(res.data.data);
    } catch (error) {
      console.error('Preview fetch error:', error);
    }
  };

  const toggleSourceSelection = (id) => {
    setSelectedSources(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  // Auto-generate a short code from the branch name (e.g. "United Central Branch" → "UCB-1234")
  const generateCode = (name) => {
    const initials = name
      .split(' ')
      .filter(Boolean)
      .map(w => w[0].toUpperCase())
      .join('');
    const suffix = Date.now().toString().slice(-4);
    return `${initials}-${suffix}`;
  };

  const handleMerge = async () => {
    setSubmitting(true);
    try {
      if (mergeMode === 'new') {
        const code = generateCode(formData.newBranchName);
        await api.post('/organization/nodes/merge', {
          sourceNodeIds: selectedSources,
          ...formData,
          code
        });
        toast.success(`Consolidation Successful: ${formData.newBranchName} is now active.`);
      } else {
        const targetNode = nodes.find(n => n.id === Number(targetNodeId));
        await api.post('/organization/nodes/merge', {
          sourceNodeIds: selectedSources,
          targetNodeId
        });
        toast.success(`Consolidation Successful: Branches merged into ${targetNode?.name || 'selected branch'}.`);
      }
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Merge operation failed');
    } finally {
      setSubmitting(false);
      setShowConfirmModal(false);
    }
  };

  const [expandedNodes, setExpandedNodes] = useState([]);

  const toggleExpand = (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedNodes(prev => 
      prev.includes(id) ? prev.filter(nodeId => nodeId !== id) : [...prev, id]
    );
  };

  const TreeNode = ({ node, level = 0 }) => {
    const children = nodes.filter(n => n.parent_id === node.id);
    const isExpanded = expandedNodes.includes(node.id);
    const isSelected = selectedSources.includes(node.id);

    const isDifferentRoot = allowedRootId !== null && getRootNodeId(node) !== allowedRootId;

    return (
      <div className="space-y-1">
        <div 
          className={`flex items-center gap-3 p-3 rounded-xl transition-all border-2 ${
            isDifferentRoot 
              ? 'opacity-40 cursor-not-allowed bg-slate-50 border-transparent' 
              : isSelected 
              ? 'bg-primary-50 border-primary-500 shadow-sm cursor-pointer' 
              : 'bg-white border-transparent hover:bg-slate-50 cursor-pointer'
          }`}
          style={{ marginLeft: `${level * 20}px` }}
          onClick={() => !isDifferentRoot && toggleSourceSelection(node.id)}
        >
          <div 
            onClick={(e) => {
              if (children.length > 0) toggleExpand(node.id, e);
            }}
            className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${
              children.length > 0 ? 'hover:bg-slate-200 text-slate-400' : 'opacity-0 cursor-default'
            }`}
          >
            {children.length > 0 && (
              <ChevronRight size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
            )}
          </div>

          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
            isDifferentRoot
              ? 'bg-slate-100 border-slate-200'
              : isSelected ? 'bg-primary-600 border-primary-600' : 'bg-white border-slate-200'
          }`}>
            {isSelected && !isDifferentRoot && <CheckCircle2 size={12} className="text-white" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-medium text-slate-700 text-sm truncate">{node.name}</div>
          </div>
        </div>

        {isExpanded && children.map(child => (
          <TreeNode key={child.id} node={child} level={level + 1} />
        ))}
      </div>
    );
  };


  const rootNodes = nodes.filter(n => !n.parent_id && n.status === 'active');
  const availableTargets = nodes.filter(n => 
    n.status === 'active' && 
    !selectedSources.includes(n.id) &&
    (!allowedRootId || getRootNodeId(n) === allowedRootId)
  );

  return (
    <div className="max-w-7xl mx-auto space-y-5 py-2 px-4 animate-in fade-in duration-500">
      {/* Header Pipeline */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-primary-600 transition-colors"
          >
            <ChevronLeft size={14} /> Back to Dashboard
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-600/20">
              <GitMerge className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-sans">Merge Branches</h1>
              <p className="text-xs font-medium text-slate-500 ml-1">Structural Re-Parenting Engine</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Step 1: Selection */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100">
                  <span className="font-semibold text-primary-600 text-sm">01</span>
                </div>
                <CardTitle className="text-sm font-semibold text-slate-700 font-sans">Select Source Branches</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {loading ? (
                  <div className="p-12 text-center flex justify-center"><LoadingSpinner /></div>
                ) : rootNodes.length > 0 ? (
                  rootNodes.map(node => (
                    <TreeNode key={node.id} node={node} />
                  ))
                ) : (
                  <div className="text-center py-10 opacity-45">
                    <Layers size={32} className="mx-auto mb-2 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-500">No Root Organizations Found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Step 2: Target Configuration */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-none shadow-xl bg-white h-fit">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100">
                  <span className="font-semibold text-primary-600 text-sm">02</span>
                </div>
                <CardTitle className="text-sm font-semibold text-slate-700 font-sans">Target Configuration</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              {/* Modern Glassmorphic Toggle */}
              <div className="flex bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/50 backdrop-blur-sm gap-2">
                <button
                  type="button"
                  onClick={() => setMergeMode('new')}
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                    mergeMode === 'new'
                      ? 'bg-white text-primary-600 shadow-md shadow-primary-600/5 transform scale-[1.02]'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                  }`}
                >
                  <Layers size={14} /> Merge into New Branch
                </button>
                <button
                  type="button"
                  onClick={() => setMergeMode('existing')}
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                    mergeMode === 'existing'
                      ? 'bg-white text-primary-600 shadow-md shadow-primary-600/5 transform scale-[1.02]'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                  }`}
                >
                  <GitMerge size={14} /> Merge into Existing
                </button>
              </div>

              <div className="space-y-6 pt-2">
                {mergeMode === 'new' ? (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-2 ml-1">New Branch Name</label>
                      <Input 
                        placeholder="United Central Branch"
                        value={formData.newBranchName}
                        onChange={(e) => setFormData({...formData, newBranchName: e.target.value})}
                        className="h-14 rounded-2xl bg-slate-50 border-none shadow-inner font-medium text-slate-800 focus:bg-white transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-2 ml-1">Parent Placement</label>
                      <select 
                        className="w-full h-14 rounded-2xl bg-slate-50 border-none shadow-inner font-medium px-4 text-sm focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all text-slate-800"
                        value={formData.parent_id}
                        onChange={(e) => setFormData({...formData, parent_id: e.target.value})}
                      >
                        <option value="">-- Choose Parent Node --</option>
                        {nodes
                          .filter(n => n.status === 'active' && (!allowedRootId || getRootNodeId(n) === allowedRootId))
                          .map(node => (
                            <option key={node.id} value={node.id}>{node.name}</option>
                          ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-2 ml-1">Select Target Branch</label>
                      <select 
                        className="w-full h-14 rounded-2xl bg-slate-50 border-none shadow-inner font-medium px-4 text-sm focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all text-slate-800"
                        value={targetNodeId}
                        onChange={(e) => setTargetNodeId(e.target.value)}
                      >
                        <option value="">-- Choose Existing Target Branch --</option>
                        {availableTargets.map(node => (
                          <option key={node.id} value={node.id}>
                            {node.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-400 font-medium mt-2 ml-1">
                        Active branches selected as sources in Step 1 are excluded from this list.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="bg-amber-50 p-6 rounded-[32px] border-2 border-amber-100 flex items-start gap-4">
            <ShieldAlert className="text-amber-600 shrink-0 mt-1" size={24} />
            <div className="space-y-1">
              <h4 className="text-amber-950 font-bold text-sm font-sans">System-Wide Impact Warning</h4>
              <p className="text-xs text-amber-900/80 font-medium leading-relaxed">
                This operation will dissolve the selected source branches and permanently move all sub-units, employees, and stock to the target identity. This process is irreversible.
              </p>
            </div>
          </div>

          {/* Execute Button */}
          <div className="flex justify-end">
            <Button
              onClick={() => setShowConfirmModal(true)}
              disabled={
                selectedSources.length < (mergeMode === 'existing' ? 1 : 2) || 
                (mergeMode === 'new' ? (!formData.newBranchName || !formData.org_type_id || !formData.parent_id) : !targetNodeId)
              }
              className="px-6 h-10 bg-primary-600 hover:bg-primary-700 text-white rounded-xl shadow-sm flex items-center gap-2 group disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none transition-all"
            >
              <span className="font-semibold text-sm">Execute Merge</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>

      </div>

      <Modal 
        isOpen={showConfirmModal} 
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Branch Merging"
      >
        <div className="space-y-6">
          <div className="bg-red-50 p-6 rounded-3xl border-2 border-red-100">
            <h3 className="text-red-950 font-bold text-base font-sans mb-2 flex items-center gap-2">
              <ShieldAlert size={18} /> Destructive Operation Warning
            </h3>
            <p className="text-sm text-red-900/80 leading-relaxed font-medium">
              You are about to dissolve <span className="underline font-bold">{selectedSources.length} branch{selectedSources.length > 1 ? 'es' : ''}</span> into <span className="underline font-bold">{mergeMode === 'new' ? formData.newBranchName : nodes.find(n => n.id === Number(targetNodeId))?.name || 'the selected branch'}</span>. 
              All data will be re-parented and the source entities will be archived forever. 
              This command cannot be revoked once the database transaction begins.
            </p>
          </div>

          <div className="space-y-3">
             <div className="flex justify-between items-center text-sm font-semibold px-2 pb-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Target Node</span>
                <span className="text-slate-900 font-bold">
                  {mergeMode === 'new' ? formData.newBranchName : nodes.find(n => n.id === Number(targetNodeId))?.name || 'Selected Branch'}
                </span>
             </div>
             {preview && (
               <div className="grid grid-cols-2 gap-2 pt-1">
                 {[
                   { label: 'Employees', value: preview.users, color: 'text-slate-800' },
                   { label: 'Inventory Items', value: preview.inventory_items, color: 'text-slate-800' },
                   { label: 'Pending Requests', value: preview.pending_requests, color: preview.pending_requests > 0 ? 'text-amber-600' : 'text-slate-800' },
                   { label: 'Pending Transfers', value: preview.pending_transfers, color: preview.pending_transfers > 0 ? 'text-amber-600' : 'text-slate-800' },
                   { label: 'Pending Discharges', value: preview.pending_discharges, color: preview.pending_discharges > 0 ? 'text-amber-600' : 'text-slate-800' },
                   { label: 'Pending Returns', value: preview.pending_returns, color: preview.pending_returns > 0 ? 'text-amber-600' : 'text-slate-800' },
                   { label: 'Sub-units', value: preview.sub_units, color: 'text-slate-800' },
                 ].map(({ label, value, color }) => (
                   <div key={label} className="bg-slate-50 rounded-xl px-3 py-2 flex justify-between items-center">
                     <span className="text-xs font-medium text-slate-500">{label}</span>
                     <span className={`text-sm font-bold ${color}`}>{value ?? '—'}</span>
                   </div>
                 ))}
               </div>
             )}
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => setShowConfirmModal(false)}
              className="flex-1 h-12 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm hover:bg-slate-200 transition-all"
            >
              Cancel Merge
            </button>
            <button 
              onClick={handleMerge}
              disabled={submitting}
              className="flex-1 h-12 rounded-xl bg-primary-600 text-white font-semibold text-sm hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-all"
            >
              {submitting ? 'Consolidating...' : 'Confirm & Execute'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BranchMergePage;
