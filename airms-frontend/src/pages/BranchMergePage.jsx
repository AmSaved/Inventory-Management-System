import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GitMerge, 
  Users, 
  Package, 
  ShieldAlert, 
  ArrowRight, 
  Info, 
  CheckCircle2, 
  AlertTriangle,
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

  const [formData, setFormData] = useState({
    newBranchName: '',
    code: '',
    org_type_id: '',
    parent_id: ''
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedSources.length >= 2) {
      fetchPreview();
    } else {
      setPreview(null);
    }
  }, [selectedSources]);

  const fetchInitialData = async () => {
    try {
      const [nodesRes, typesRes] = await Promise.all([
        api.get('/organization/nodes/merge/all'),
        api.get('/organization/types')
      ]);
      setNodes(nodesRes.data.data || []);
      setOrgTypes(typesRes.data.data || []);
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

  const handleMerge = async () => {
    setSubmitting(true);
    try {
      await api.post('/organization/nodes/merge', {
        sourceNodeIds: selectedSources,
        ...formData
      });
      toast.success(`Consolidation Successful: ${formData.newBranchName} is now active.`);
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

    return (
      <div className="space-y-1">
        <div 
          className={`flex items-center gap-3 p-3 rounded-xl transition-all border-2 cursor-pointer ${
            isSelected 
              ? 'bg-primary-50 border-primary-500 shadow-sm' 
              : 'bg-white border-transparent hover:bg-slate-50'
          }`}
          style={{ marginLeft: `${level * 20}px` }}
          onClick={() => toggleSourceSelection(node.id)}
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
            isSelected ? 'bg-primary-600 border-primary-600' : 'bg-white border-slate-200'
          }`}>
            {isSelected && <CheckCircle2 size={12} className="text-white" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-800 text-xs truncate">{node.name}</div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{node.code}</div>
          </div>
        </div>

        {isExpanded && children.map(child => (
          <TreeNode key={child.id} node={child} level={level + 1} />
        ))}
      </div>
    );
  };

  if (loading) return <LoadingSpinner />;

  const rootNodes = nodes.filter(n => !n.parent_id && n.status === 'active');

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-8 px-4 animate-in fade-in duration-500">
      {/* Header Pipeline */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-primary-600 transition-colors"
          >
            <ChevronLeft size={14} /> Back to Dashboard
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-600/20">
              <GitMerge className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Branch Consolidation Hub</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">Structural Re-Parenting Engine</p>
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
                  <span className="font-black text-primary-600 text-sm">01</span>
                </div>
                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-600">Explore Hierarchy</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {rootNodes.length > 0 ? (
                  rootNodes.map(node => (
                    <TreeNode key={node.id} node={node} />
                  ))
                ) : (
                  <div className="text-center py-10 opacity-40">
                    <Layers size={32} className="mx-auto mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No Root Organizations Found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Step 2: Target Configuration */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-none shadow-xl bg-white h-fit">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100">
                  <span className="font-black text-primary-600 text-sm">02</span>
                </div>
                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-600">Consolidated Branch Identity</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">New Branch Legal Name</label>
                  <Input 
                    placeholder="e.g. United Central Branch"
                    value={formData.newBranchName}
                    onChange={(e) => setFormData({...formData, newBranchName: e.target.value})}
                    className="h-14 rounded-2xl bg-slate-50 border-none shadow-inner font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Unique Branch Code</label>
                  <Input 
                    placeholder="e.g. UCB-2026"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    className="h-14 rounded-2xl bg-slate-50 border-none shadow-inner font-mono font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Entity Type</label>
                    <select 
                      className="w-full h-14 rounded-2xl bg-slate-50 border-none shadow-inner font-bold px-4 text-sm focus:ring-2 focus:ring-primary-500"
                      value={formData.org_type_id}
                      onChange={(e) => setFormData({...formData, org_type_id: e.target.value})}
                    >
                      <option value="">Select Type</option>
                      {orgTypes.map(type => (
                        <option key={type.id} value={type.id}>{type.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Parent Placement</label>
                    <select 
                      className="w-full h-14 rounded-2xl bg-slate-50 border-none shadow-inner font-bold px-4 text-sm focus:ring-2 focus:ring-primary-500"
                      value={formData.parent_id}
                      onChange={(e) => setFormData({...formData, parent_id: e.target.value})}
                    >
                      <option value="">Top Level (Root)</option>
                      {nodes.filter(n => n.status === 'active').map(node => (
                        <option key={node.id} value={node.id}>{node.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="bg-amber-50 p-6 rounded-[32px] border-2 border-amber-100 flex items-start gap-4">
            <ShieldAlert className="text-amber-600 shrink-0 mt-1" size={24} />
            <div className="space-y-1">
              <h4 className="text-amber-900 font-black text-xs uppercase tracking-tight">System-Wide Impact Warning</h4>
              <p className="text-[11px] text-amber-800/80 font-bold leading-relaxed">
                This operation will dissolve the selected source branches and permanently move all sub-units, employees, and stock to the new identity. This process is irreversible.
              </p>
            </div>
          </div>
        </div>

        {/* Step 3: Preview & Execution */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden h-full">
            <CardHeader className="bg-white/5 border-b border-white/10 p-6">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400">Impact Intelligence</CardTitle>
            </CardHeader>
            <CardContent className="p-8 flex flex-col h-full">
              {preview ? (
                <div className="space-y-8 flex-1">
                  <div className="grid grid-cols-1 gap-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Users className="text-primary-400" size={18} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Employees</span>
                      </div>
                      <span className="text-xl font-black italic">{preview.users}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Package className="text-amber-400" size={18} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stock Assets</span>
                      </div>
                      <span className="text-xl font-black italic">{preview.inventory_items}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Layers className="text-blue-400" size={18} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Authority Roles</span>
                      </div>
                      <span className="text-xl font-black italic">{preview.roles}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="text-red-400" size={18} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pending Req.</span>
                      </div>
                      <span className="text-xl font-black italic">{preview.pending_requests}</span>
                    </div>
                  </div>
                  
                  <div className="bg-white/5 p-6 rounded-3xl border border-white/10 text-center">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Target Volume Shift</div>
                    <div className="text-4xl font-black text-primary-400 tracking-tighter">+{preview.users + preview.inventory_items}</div>
                    <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase italic">Total Active Records</div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                  <Info size={40} />
                  <p className="text-xs font-bold uppercase tracking-widest leading-loose">Select at least two branches to analyze impact</p>
                </div>
              )}

              <div className="pt-10 mt-auto">
                <Button 
                  onClick={() => setShowConfirmModal(true)}
                  disabled={selectedSources.length < 2 || !formData.newBranchName || !formData.code || !formData.org_type_id}
                  className="w-full h-16 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl shadow-2xl shadow-primary-900/50 flex items-center justify-center gap-3 group disabled:bg-slate-700 disabled:shadow-none"
                >
                  <span className="font-black uppercase tracking-widest text-xs">Execute Merge</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal 
        isOpen={showConfirmModal} 
        onClose={() => setShowConfirmModal(false)}
        title="Final Authorization Protocol"
      >
        <div className="space-y-6">
          <div className="bg-red-50 p-6 rounded-3xl border-2 border-red-100">
            <h3 className="text-red-900 font-black uppercase text-sm mb-2 flex items-center gap-2">
              <ShieldAlert size={18} /> Destructive Operation Warning
            </h3>
            <p className="text-xs text-red-800 leading-relaxed font-bold">
              You are about to dissolve <span className="underline font-black">{selectedSources.length} branches</span> into <span className="underline font-black">{formData.newBranchName}</span>. 
              All data will be re-parented and the source entities will be archived forever. 
              This command cannot be revoked once the database transaction begins.
            </p>
          </div>

          <div className="space-y-4">
             <div className="flex justify-between items-center text-xs font-bold px-2">
                <span className="text-slate-400 uppercase tracking-widest">Target Node</span>
                <span className="text-slate-900 uppercase italic font-black">{formData.newBranchName}</span>
             </div>
             <div className="flex justify-between items-center text-xs font-bold px-2">
                <span className="text-slate-400 uppercase tracking-widest">Consolidation Volume</span>
                <span className="text-primary-600 font-black italic">{preview?.users + preview?.inventory_items} Records</span>
             </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => setShowConfirmModal(false)}
              className="flex-1 h-14 rounded-2xl bg-slate-100 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
            >
              Abort Mission
            </button>
            <button 
              onClick={handleMerge}
              disabled={submitting}
              className="flex-1 h-14 rounded-2xl bg-primary-600 text-white font-black uppercase text-[10px] tracking-widest hover:bg-primary-700 shadow-xl shadow-primary-600/20 transition-all"
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
