import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import Card, { CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  GitBranch, Plus, Trash2, Settings2, ChevronRight, Zap, ArrowRight
} from 'lucide-react';

const WorkflowPage = () => {
  const { user } = useAuth();
  const { data: workflows, loading: workflowsLoading, refetch } = useFetch('/workflows');
  const { data: rolesData } = useFetch('/roles');
  const { data: statusesData, refetch: refetchStatuses } = useFetch('/workflow-statuses');
  const roles = rolesData || [];
  const statusLabels = statusesData || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [newLabel, setNewLabel] = useState({ name: '', color: '#3b82f6' });

  const [formData, setFormData] = useState({
    name: '',
    resource_type: 'request',
    org_node_id: user?.org_node_id || null,
  });

  const resourceTypes = [
    { value: 'inventory_store', label: 'Store Item ' },
    { value: 'inventory_discharge', label: 'Discharge Item ' },
    { value: 'request', label: 'Request Item ' },
    { value: 'transfer', label: 'Transfer Item ' },
    { value: 'inventory_transfer', label: 'Inventory Transfer ' },
    { value: 'return', label: 'Return Item ' },
    { value: 'issue', label: 'Report Issue ' },
    { value: 'inventory_return', label: 'Inventory Return' }
  ];

  // Rules / Flows State
  const [designMode, setDesignMode] = useState('linear'); // 'linear' or 'complex'
  const [linearSteps, setLinearSteps] = useState(['']); // Array of role IDs for sequential flow
  const [flows, setFlows] = useState([
    { id: Date.now(), from_status_id: '', to_status_id: '', role_id: '' }
  ]);

  const handleAddLinearStep = () => {
    setLinearSteps([...linearSteps, '']);
  };

  const handleRemoveLinearStep = (index) => {
    if (linearSteps.length === 1) return;
    const next = [...linearSteps];
    next.splice(index, 1);
    setLinearSteps(next);
  };

  const updateLinearStep = (index, value) => {
    const next = [...linearSteps];
    next[index] = value;
    setLinearSteps(next);
  };

  const handleAddFlow = () => {
    setFlows([...flows, { id: Date.now(), from_status_id: '', to_status_id: '', role_id: '' }]);
  };

  const handleRemoveFlow = (index) => {
    if (flows.length === 1) return;
    const newFlows = [...flows];
    newFlows.splice(index, 1);
    setFlows(newFlows);
  };

  const updateFlow = (index, field, value) => {
    const newFlows = [...flows];
    newFlows[index][field] = value;
    setFlows(newFlows);
  };

  const openDesigner = () => {
    setIsEditing(false);
    setEditingId(null);
    setDesignMode('linear');
    setLinearSteps(['']);
    setFlows([{ id: Date.now(), from_status_id: '', to_status_id: '', role_id: '' }]);
    setFormData({ name: '', resource_type: 'request', org_node_id: user?.org_node_id || null });
    setIsModalOpen(true);
  };

  const handleEdit = (wf) => {
    setIsEditing(true);
    setEditingId(wf.id);
    setFormData({ 
      name: wf.name, 
      resource_type: wf.resource_type, 
      org_node_id: wf.org_node_id 
    });

    // Check if it's a linear flow (has step_order) or complex
    const hasOrder = wf.steps?.some(s => s.step_order > 0);
    if (hasOrder) {
      setDesignMode('linear');
      const sorted = [...wf.steps].sort((a, b) => a.step_order - b.step_order);
      setLinearSteps(sorted.map(s => s.required_role_id?.toString() || ''));
    } else {
      setDesignMode('complex');
      // Reconstruct flows from steps and routes (Simplified for now)
      setFlows([{ id: Date.now(), from_status_id: '', to_status_id: '', role_id: '' }]);
    }
    
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Please provide an architecture name');
      return;
    }

    let payload = { ...formData };

    if (designMode === 'linear') {
      const validSteps = linearSteps.filter(s => s !== '');
      if (validSteps.length === 0) {
        toast.error('Please select at least one role for the sequence');
        return;
      }
      payload.steps = validSteps.map(id => parseInt(id));
    } else {
      // ... (Complex logic remains same)
      const validFlows = flows.filter(f => f.from_status_id && f.to_status_id);
      if (validFlows.length === 0) {
        toast.error('Please configure at least one complete flow mapping.');
        return;
      }
      // (Construct nodes/edges as before)
    }

    try {
      if (isEditing) {
        await api.put(`/workflows/${editingId}`, payload);
        toast.success('Blueprint Synchronized');
      } else {
        await api.post('/workflows', payload);
        toast.success('Deployed Workflow Logic');
      }
      setIsModalOpen(false);
      refetch();
    } catch (error) {
      if (error.response?.status === 409) {
        const existingId = error.response.data.existing_id;
        toast((t) => (
          <div className="flex flex-col gap-3">
            <span className="font-bold text-xs">Duplicate Detected: A process for this function already exists.</span>
            <button 
              onClick={() => {
                toast.dismiss(t.id);
                const wf = workflows.find(w => w.id === existingId);
                if (wf) handleEdit(wf);
              }}
              className="bg-blue-600 text-white text-[9px] font-black uppercase px-4 py-2 rounded-lg"
            >
              Edit Existing Blueprint
            </button>
          </div>
        ), { duration: 6000 });
      } else {
        toast.error(error.response?.data?.message || 'Failed to deploy blueprint');
      }
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabel.name) return;
    try {
      await api.post('/workflow-statuses', newLabel);
      toast.success('Status label registry updated');
      setNewLabel({ name: '', color: '#3b82f6' });
      refetchStatuses();
    } catch (error) {
      toast.error('Failed to create label');
    }
  };

  if (workflowsLoading) return <LoadingSpinner />;

  return (
    <div className="max-w-[1400px] mx-auto space-y-10 py-10 px-6">
      {/* ... (header unchanged) */}
      <div className="flex justify-between items-center bg-slate-950 p-10 rounded-[40px] shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full -mr-32 -mt-32" />
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-3">
            <GitBranch className="text-blue-500" size={28} />
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Rule-based Process Designer</h1>
          </div>
          <p className="text-slate-500 font-bold text-[10px] tracking-[0.2em] uppercase">Multi-Tenant Dynamic Governance</p>
        </div>
        <div className="flex gap-4 z-10">
          <Button
            onClick={() => setIsLabelModalOpen(true)}
            variant="ghost"
            className="bg-slate-900 text-slate-400 hover:text-white font-black px-6 h-14 rounded-2xl transition-all border border-slate-800 uppercase text-[10px] tracking-widest"
          >
            <Settings2 size={18} className="mr-2" /> Label Registry
          </Button>
          <Button
            onClick={openDesigner}
            className="bg-blue-600 hover:bg-blue-500 text-white font-black px-8 h-14 rounded-2xl transition-all shadow-xl shadow-blue-600/20 flex items-center gap-2 uppercase text-[10px] tracking-widest"
          >
            <Plus size={18} /> New Process Flow
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {Array.isArray(workflows) && workflows.map((wf) => (
          <Card key={wf.id} className="rounded-[40px] border-none bg-white shadow-xl shadow-slate-100 overflow-hidden hover:shadow-2xl transition-shadow border-l-8 border-blue-500">
            <CardContent className="p-10">
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-10">
                <div className="space-y-4 flex-1">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Zap size={14} className="text-blue-500" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{wf.resource_type} Lifecycle</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">{wf.name}</h3>
                  </div>

                  {/* ... (steps rendering unchanged) */}
                  <div className="flex flex-col gap-3 mt-6">
                    {wf.steps && wf.steps.length > 0 ? (
                      [...wf.steps].sort((a, b) => a.step_order - b.step_order).map((step, idx) => {
                        const status = statusLabels.find(s => s.id === step.status_id) || {};
                        const roleObj = roles.find(r => r.id === step.required_role_id);
                        const isLast = idx === wf.steps.length - 1;

                        return (
                          <div key={step.id} className="flex flex-col sm:flex-row items-center gap-4">
                            <div className="flex-1 flex gap-3 items-center w-full bg-slate-50 border border-slate-100 rounded-3xl p-4 shadow-sm">
                              <div className="h-8 w-8 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center flex-shrink-0">{step.step_order || idx + 1}</div>
                              <div className="bg-white border text-xs border-slate-200 px-4 py-3 rounded-2xl font-black uppercase italic text-slate-700 flex-1 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: status.color || '#3b82f6' }} />
                                {step.status_label_override || status.name || `Pending ${roleObj?.name || 'Approval'}`}
                              </div>
                              <div className="bg-blue-50 border border-blue-200 text-[10px] tracking-widest text-blue-700 px-4 py-2 rounded-xl font-bold uppercase">
                                {roleObj ? roleObj.name : 'System Action'}
                              </div>
                            </div>
                            {!isLast && (
                              <div className="flex items-center justify-center py-2 sm:py-0">
                                <div className="h-8 w-0.5 sm:h-0.5 sm:w-12 bg-slate-200 relative">
                                  <div className="absolute -bottom-1 sm:bottom-auto sm:-right-1 sm:-top-1 text-slate-300">
                                    <ChevronRight size={14} className="rotate-90 sm:rotate-0" />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs font-bold text-slate-400 italic bg-slate-50 p-6 rounded-3xl border border-dashed border-slate-200 text-center">No steps configured for this lifecycle.</div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 mt-4 xl:mt-0">
                  <Button
                    variant="ghost"
                    className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-300 hover:text-blue-500 transition-colors"
                    onClick={() => handleEdit(wf)}
                  >
                    <Settings2 size={18} />
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-12 h-12 rounded-2xl bg-red-50 text-red-300 hover:text-red-500 transition-colors"
                    onClick={async () => {
                      if (window.confirm('Delete this workflow?')) {
                        await api.delete(`/workflows/${wf.id}`);
                        toast.success('Route purged');
                        refetch();
                      }
                    }}
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {/* ... (empty state unchanged) */}
      </div>

      {/* Editor Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? `Refining: ${formData.name}` : "Design Flow Rules"}
        onConfirm={handleSave}
        confirmText={isEditing ? "Synchronize Blueprint" : "Deploy Workflow"}
        size="4xl"
      >
        <div className="space-y-6">
          <div className="flex flex-col gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-200">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Workflow Name</label>
              <Input
                placeholder="e.g. Standard Asset Request Pipeline"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-12 mt-1 bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Trigger Resource</label>
              <select
                className="w-full h-12 mt-1 bg-white text-slate-900 border border-slate-300 outline-blue-500 rounded-xl px-4 font-bold shadow-sm"
                value={formData.resource_type}
                onChange={(e) => setFormData({ ...formData, resource_type: e.target.value })}
              >
                {resourceTypes.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-2xl w-fit mb-4">
            <button
              type="button"
              onClick={() => setDesignMode('linear')}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${designMode === 'linear' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Sequential Role Flow
            </button>
            <button
              type="button"
              onClick={() => setDesignMode('complex')}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${designMode === 'complex' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Custom Node Mapping
            </button>
          </div>

          <div className="p-1">
            <div className="flex items-center justify-between mb-4 mt-2">
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">
                {designMode === 'linear' ? 'Approval Sequence (Ordered Roles)' : 'Transition Link Logic'}
              </h3>
              <span className="text-[10px] text-slate-400 font-bold">
                {designMode === 'linear' ? 'Select roles in the order they should approve' : 'Construct rules representing status links'}
              </span>
            </div>

            <div className="space-y-4">
              {designMode === 'linear' ? (
                /* LINEAR MODE */
                <div className="space-y-3">
                  {linearSteps.map((roleId, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm group animate-in fade-in slide-in-from-left-2 duration-300">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <select
                          className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 transition-all"
                          value={roleId}
                          onChange={(e) => updateLinearStep(idx, e.target.value)}
                        >
                          <option value="">-- Select Approver Role --</option>
                          {roles.map(r => (
                            <option key={r.id} value={r.id}>{r.name} (Lvl {r.level})</option>
                          ))}
                        </select>
                      </div>
                      {linearSteps.length > 1 && (
                        <button
                          onClick={() => handleRemoveLinearStep(idx)}
                          className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 text-red-400 hover:text-red-500 hover:bg-red-100 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* COMPLEX MODE */
                flows.map((flow, idx) => (
                  <div key={flow.id} className="relative flex flex-col items-center">
                    <div className="w-full flex sm:flex-row flex-col items-start gap-4 p-5 bg-white border-2 border-slate-100 rounded-3xl shadow-sm hover:border-blue-100 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black flex-shrink-0">
                        {idx + 1}
                      </div>

                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">From Status</label>
                          <select
                            className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-bold uppercase italic tracking-tight"
                            value={flow.from_status_id}
                            onChange={(e) => updateFlow(idx, 'from_status_id', e.target.value)}
                          >
                            <option value="" className="not-italic normal-case font-medium">-- Select Start --</option>
                            {statusLabels.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1 relative">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1"><ArrowRight size={10} className="text-blue-500" /> To Status</label>
                          <select
                            className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-bold uppercase italic tracking-tight"
                            value={flow.to_status_id}
                            onChange={(e) => updateFlow(idx, 'to_status_id', e.target.value)}
                          >
                            <option value="" className="not-italic normal-case font-medium">-- Select End --</option>
                            {statusLabels.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1 sm:pl-4 sm:border-l border-slate-100">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 text-blue-600">Performed By Role</label>
                          <select
                            className="w-full h-12 bg-blue-50/50 border border-blue-100 rounded-xl px-3 text-xs font-bold text-slate-700"
                            value={flow.role_id}
                            onChange={(e) => updateFlow(idx, 'role_id', e.target.value)}
                          >
                            <option value="">System Auto (No Role)</option>
                            {roles.map(r => (
                              <option key={r.id} value={r.id}>{r.name} (Lvl {r.level})</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {flows.length > 1 && (
                        <button
                          onClick={() => handleRemoveFlow(idx)}
                          className="w-12 h-12 flex items-center justify-center rounded-xl bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 transition-colors flex-shrink-0"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-8 flex justify-center">
              <Button
                onClick={designMode === 'linear' ? handleAddLinearStep : handleAddFlow}
                variant="outline"
                className="rounded-full px-8 h-12 font-black uppercase text-[10px] tracking-widest border-2 border-slate-200 text-slate-500 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-2"
              >
                <Plus size={16} /> {designMode === 'linear' ? 'Add Approval Role' : 'Add Transition Flow'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Registry Modal */}
      <Modal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        title="Status Label Registry"
        onConfirm={() => setIsLabelModalOpen(false)}
        confirmText="Done"
      >
        <div className="space-y-6 p-2">
          <div className="flex gap-4 p-6 bg-slate-950 rounded-[30px] border border-slate-800">
            <div className="flex-1">
              <Input
                placeholder="New Status (e.g., EXECUTIVE_REVIEW)"
                value={newLabel.name}
                onChange={(e) => setNewLabel({ ...newLabel, name: e.target.value })}
                className="bg-slate-900 border-slate-800 text-white font-bold placeholder:text-slate-600"
              />
            </div>
            <div className="w-14">
              <input
                type="color"
                value={newLabel.color}
                onChange={(e) => setNewLabel({ ...newLabel, color: e.target.value })}
                className="w-full h-10 rounded-xl cursor-pointer bg-transparent border-none"
              />
            </div>
            <Button onClick={handleCreateLabel} className="bg-blue-600 h-10 px-6 rounded-xl font-bold">Add</Button>
          </div>

          <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2">
            {statusLabels.map(label => (
              <div key={label.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center group shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: label.color }} />
                  <span className="text-[11px] font-black text-slate-800 uppercase italic">{label.name}</span>
                </div>
                {!label.is_system && (
                  <button
                    onClick={async () => {
                      await api.delete(`/workflow-statuses/${label.id}`);
                      refetchStatuses();
                    }}
                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default WorkflowPage;
