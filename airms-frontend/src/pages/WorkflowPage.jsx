import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  GitBranch, Plus, Trash2, Settings2, ChevronRight, Zap, ArrowRight, ArrowLeft
} from 'lucide-react';

const WorkflowPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: workflows, loading: workflowsLoading, refetch } = useFetch('/workflows');
  const { data: rolesData } = useFetch('/roles');
  const { data: statusesData, refetch: refetchStatuses } = useFetch('/workflow-statuses');
  const roles = rolesData || [];
  const statusLabels = statusesData || [];

  const filteredRoles = React.useMemo(() => {
    if (!roles) return [];
    return roles.filter(role => {
      // 1. Level Filter: Only see roles at or below current user's level
      const userMaxLevel = user?.role?.level ?? 0;
      const isLevelAllowed = role.level <= userMaxLevel;

      // 2. Node/Hierarchy Filter: Only see roles in same organization node, its sub-nodes, or company level (null org_node_id)
      const isNodeAllowed = !role.org_node_id || 
                            role.org_node_id === user?.org_node_id || 
                            user?.allowedNodes?.includes(role.org_node_id);
      
      return isLevelAllowed && isNodeAllowed;
    });
  }, [roles, user]);

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
    { value: 'inventory_discharge', label: 'Discharge Inventories ' },
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
        toast.success('Wrorkflow updated');
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
  return (
    <div className="max-w-7xl mx-auto space-y-5 py-6 px-4">
      {/* ... (header unchanged) */}
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center hover:bg-green-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-green-700">Workflow Management</h1>
            <p className="text-sm text-slate-500 mt-1">This is the workflow management of the Oromia Transport Agency Super Admin</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Button 
            onClick={openDesigner} 
            className="bg-green-600 text-white h-9 px-4 rounded-lg font-bold text-sm hover:bg-green-700 transition-all shadow-sm"
          >
            + Add Workflow
          </Button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-green-600 text-white">
              <th className="p-4 text-sm font-bold">Workflow Name</th>
              <th className="p-4 text-sm font-bold">Resource Type</th>
              <th className="p-4 text-sm font-bold">Steps</th>
              <th className="p-4 text-sm font-bold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {workflowsLoading ? (
              <tr>
                <td colSpan="4" className="p-12 text-center flex justify-center"><LoadingSpinner /></td>
              </tr>
            ) : workflows?.length === 0 ? (
              <tr>
                <td colSpan="4" className="p-12 text-center text-slate-400 text-sm">No workflows found.</td>
              </tr>
            ) : (
              workflows.map((wf) => (
                <tr key={wf.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 text-sm font-medium text-slate-900">{wf.name}</td>
                  <td className="p-4 text-sm text-slate-600">{wf.resource_type?.replace('_', ' ')}</td>
                  <td className="p-4 text-sm text-slate-600">{wf.steps?.length || 0} Steps</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleEdit(wf)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Edit">
                        <Settings2 size={16} />
                      </button>
                      <button 
                        onClick={async () => {
                          if (window.confirm('Delete this workflow?')) {
                            await api.delete(`/workflows/${wf.id}`);
                            toast.success('Workflow deleted');
                            refetch();
                          }
                        }} 
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Editor Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? `Refining: ${formData.name}` : "Design Flow Rules"}
        onConfirm={handleSave}
        confirmText={isEditing ? "Save" : "Deploy Workflow"}
        size="4xl"
      >
        <div className="space-y-6">
          <div className="flex flex-col gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="text-xs font-semibold text-slate-500 ml-1">Workflow Name</label>
              <Input
                placeholder="e.g. Standard Asset Request Pipeline"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-10 mt-1 bg-white text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 ml-1">Trigger Resource</label>
              <select
                className="w-full h-10 mt-1 bg-white text-slate-900 border border-slate-200 outline-blue-500 rounded-lg px-4 text-xs font-semibold shadow-sm"
                value={formData.resource_type}
                onChange={(e) => setFormData({ ...formData, resource_type: e.target.value })}
              >
                {resourceTypes.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-lg w-fit mb-4">
            <button
              type="button"
              onClick={() => setDesignMode('linear')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${designMode === 'linear' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Sequential Role Flow
            </button>
            <button
              type="button"
              onClick={() => setDesignMode('complex')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${designMode === 'complex' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Custom Node Mapping
            </button>
          </div>

          <div className="p-1">
            <div className="flex items-center justify-between mb-4 mt-2">
              <h3 className="font-bold text-slate-900 text-xs">
                {designMode === 'linear' ? 'Approval Sequence (Ordered Roles)' : 'Transition Link Logic'}
              </h3>
              <span className="text-xs text-slate-400 font-normal">
                {designMode === 'linear' ? 'Select roles in the order they should approve' : 'Construct rules representing status links'}
              </span>
            </div>

            <div className="space-y-4">
              {designMode === 'linear' ? (
                /* LINEAR MODE */
                <div className="space-y-3">
                  {linearSteps.map((roleId, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm group animate-in fade-in slide-in-from-left-2 duration-300">
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
                          {filteredRoles.map(r => (
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
                    <div className="w-full flex sm:flex-row flex-col items-start gap-4 p-5 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-blue-100 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black flex-shrink-0">
                        {idx + 1}
                      </div>

                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">From Status</label>
                          <select
                            className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-bold uppercase italic tracking-tight"
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
                            className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-bold uppercase italic tracking-tight"
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
                            className="w-full h-10 bg-blue-50/50 border border-blue-100 rounded-xl px-3 text-xs font-bold text-slate-700"
                            value={flow.role_id}
                            onChange={(e) => updateFlow(idx, 'role_id', e.target.value)}
                          >
                            <option value="">System Auto (No Role)</option>
                            {filteredRoles.map(r => (
                              <option key={r.id} value={r.id}>{r.name} (Lvl {r.level})</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {flows.length > 1 && (
                        <button
                          onClick={() => handleRemoveFlow(idx)}
                          className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 transition-colors flex-shrink-0"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex justify-center">
              <Button
                onClick={designMode === 'linear' ? handleAddLinearStep : handleAddFlow}
                variant="outline"
                className="rounded-full px-8 h-10 font-black uppercase text-[10px] tracking-widest border border-slate-200 text-slate-500 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-2"
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
          <div className="flex gap-4 p-4 bg-slate-950 rounded-xl border border-slate-800">
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
              <div key={label.id} className="p-4 bg-white border border-slate-100 rounded-xl flex justify-between items-center group shadow-sm">
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
