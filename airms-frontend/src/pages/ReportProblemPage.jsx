import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import api from '../services/api';
import toast from 'react-hot-toast';
import { AlertTriangle, Package, FileText, ChevronLeft, ArrowRight, ShieldAlert } from 'lucide-react';

const ReportProblemPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [assignmentId, setAssignmentId] = useState(searchParams.get('assignment_id') || '');
  const [inventoryId, setInventoryId] = useState(searchParams.get('inventory_id') || '');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState('medium');
  const [submitting, setSubmitting] = useState(false);

  const isEdit = searchParams.get('edit') === 'true';
  const requestId = searchParams.get('id');

  const { data: assignments } = useFetch('/assignments/my-assignments');
  const { data: inventoryItem } = useFetch(inventoryId ? `/inventory/${inventoryId}` : null);
  const assignmentsList = Array.isArray(assignments?.data) ? assignments.data : (Array.isArray(assignments) ? assignments : []);

  useEffect(() => {
    if (isEdit && requestId) {
      const fetchRequestForEdit = async () => {
        try {
          const res = await api.get(`/requests/${requestId}`);
          const request = res.data.data;
          let parsedNotes = {};
          if (request.notes) {
            try { parsedNotes = JSON.parse(request.notes); } catch {}
          }
          setAssignmentId(parsedNotes.assignment_id || '');
          setInventoryId(parsedNotes.inventory_id || '');
          setUrgency(parsedNotes.urgency || request.priority || 'medium');
          let loadedDescription = '';
          if (request.items?.length > 0) {
            const itemNotes = request.items[0].notes || '';
            loadedDescription = itemNotes.startsWith('Problem reported: ') ? itemNotes.replace('Problem reported: ', '') : itemNotes;
          }
          setDescription(loadedDescription);
        } catch {
          toast.error('Failed to load problem report details');
        }
      };
      fetchRequestForEdit();
    }
  }, [isEdit, requestId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assignmentId && !inventoryId) return toast.error('Please select an asset or stock item');
    setSubmitting(true);
    try {
      const selectedAssignment = assignmentsList.find(a => String(a.id) === String(assignmentId));
      const payload = {
        purpose: inventoryId
          ? `Issue Report for Inventory: ${inventoryItem?.product?.name || 'Stock'}. Details: ${description}`
          : `Issue Report for asset: ${selectedAssignment?.product?.name || 'Asset'} (SN: ${selectedAssignment?.serial_number || 'N/A'}). Details: ${description}`,
        priority: urgency,
        items: [{
          product_id: inventoryId ? inventoryItem?.product_id : selectedAssignment?.product_id,
          quantity_requested: 1,
          notes: `Problem reported: ${description}`
        }],
        notes: JSON.stringify({ assignment_id: assignmentId || null, inventory_id: inventoryId || null, urgency, description })
      };
      if (isEdit && requestId) {
        await api.put(`/requests/${requestId}`, payload);
        toast.success('Problem report updated successfully');
      } else {
        await api.post('/requests', { request_type: 'report', ...payload });
        toast.success('Problem report submitted');
      }
      navigate('/dashboard');
    } catch {
      toast.error(isEdit ? 'Failed to update problem report' : 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass = "w-full h-9 bg-gray-50 border border-gray-200 rounded-lg px-3 text-sm font-medium text-gray-800 outline-none focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-50 transition-all";
  const labelClass = "block text-xs font-semibold text-gray-500 mb-1.5";

  return (
    <div className="max-w-2xl mx-auto py-2 px-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-rose-600 transition-colors">
          <ChevronLeft size={14} /> Back
        </button>
        <span className="text-gray-200">|</span>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-rose-600 rounded-lg flex items-center justify-center">
            <AlertTriangle className="text-white" size={13} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900">{isEdit ? 'Edit Problem Report' : 'Report a Problem'}</h1>
            <p className="text-xs text-gray-400">Report an issue with an asset or stock item</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {/* Asset selection */}
          <div className="px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2 mb-3">
              <Package size={13} className="text-rose-500" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Affected Resource</span>
            </div>

            {inventoryId ? (
              <div>
                <label className={labelClass}>Stock Item</label>
                <div className="w-full h-9 bg-gray-50 border border-gray-200 rounded-lg px-3 flex items-center text-sm font-medium text-gray-700">
                  {inventoryItem?.product?.name || <span className="text-gray-400 italic">Loading...</span>}
                </div>
              </div>
            ) : (
              <div>
                <label className={labelClass}>Your Assigned Asset <span className="text-red-400">*</span></label>
                <select className={fieldClass} value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)} required>
                  <option value="">Select asset with issue...</option>
                  {assignmentsList.map(a => (
                    <option key={a.id} value={a.id}>{a.product?.name} — {a.serial_number}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Urgency */}
          <div className="px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert size={13} className="text-rose-500" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Urgency Level</span>
            </div>
            <label className={labelClass}>How urgent is this issue?</label>
            <select className={fieldClass} value={urgency} onChange={(e) => setUrgency(e.target.value)} required>
              <option value="low">Low – Minor issue, not blocking work</option>
              <option value="medium">Medium – Affecting productivity</option>
              <option value="high">High – Total breakdown / urgent replacement needed</option>
            </select>
          </div>

          {/* Description */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={13} className="text-rose-500" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Problem Description</span>
            </div>
            <label className={labelClass}>Describe the issue <span className="text-red-400">*</span></label>
            <textarea
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 outline-none focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-50 transition-all resize-none"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what is wrong. Be specific, e.g. 'Screen stays black after turning on'..."
              required
            />
          </div>
        </div>

        {/* Notice */}
        <div className="flex items-start gap-3 px-4 py-3 bg-rose-50 border border-rose-100 rounded-xl">
          <AlertTriangle size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700 leading-relaxed">
            Reporting a problem creates an official maintenance request. It will be reviewed by the backend team and storage manager.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all">
            Cancel
          </button>
          <button type="submit" disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-all shadow-sm">
            {submitting ? 'Submitting...' : isEdit ? 'Save Changes' : 'Submit Report'}
            {!submitting && <ArrowRight size={14} />}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReportProblemPage;
