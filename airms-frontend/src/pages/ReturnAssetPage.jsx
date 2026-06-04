import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { RotateCcw, Package, MessageSquare, ShieldCheck, ArrowRight, ChevronLeft } from 'lucide-react';

const ReturnAssetPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [assignmentId, setAssignmentId] = useState(searchParams.get('assignment_id') || '');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  const isEdit = searchParams.get('edit') === 'true';
  const requestId = searchParams.get('id');

  const { data: assignments } = useFetch('/assignments/my-assignments');
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
          const loadedAssignmentId = parsedNotes.assignment_id || '';
          setAssignmentId(loadedAssignmentId);
          let reasonText = parsedNotes.justification
            || (request.purpose?.includes('Justification: ') ? request.purpose.split('Justification: ')[1] : '')
            || request.purpose || '';
          setReason(reasonText);

          if (loadedAssignmentId) {
            try {
              const aRes = await api.get(`/assignments/${loadedAssignmentId}`);
              const aData = aRes.data?.data || aRes.data;
              if (aData) setSelectedAssignment(aData);
            } catch {}
          }
        } catch {
          toast.error('Failed to load return request details');
        }
      };
      fetchRequestForEdit();
    }
  }, [isEdit, requestId]);

  useEffect(() => {
    if (!assignmentId) { if (!isEdit) setSelectedAssignment(null); return; }
    const found = assignmentsList.find(a => String(a.id) === String(assignmentId));
    if (found) setSelectedAssignment(found);
  }, [assignmentId, assignmentsList]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assignmentId) return toast.error('Please select an asset to return');
    setSubmitting(true);
    try {
      const resolved = selectedAssignment || assignmentsList.find(a => String(a.id) === String(assignmentId));
      const payload = {
        purpose: `Return: ${resolved?.product?.name || 'Asset'} (SN: ${resolved?.serial_number || 'N/A'}). Justification: ${reason}`,
        priority: 'medium',
        items: [{ product_id: resolved?.product_id, quantity_requested: 1 }],
        notes: JSON.stringify({ assignment_id: assignmentId, justification: reason })
      };
      if (isEdit && requestId) {
        await api.put(`/requests/${requestId}`, payload);
        toast.success('Return request updated');
      } else {
        await api.post('/requests', { request_type: 'return', ...payload });
        toast.success('Return request submitted');
      }
      navigate('/dashboard');
    } catch {
      toast.error(isEdit ? 'Failed to update return request' : 'Failed to submit return request');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass = "w-full h-9 bg-gray-50 border border-gray-200 rounded-lg px-3 text-sm font-medium text-gray-800 outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-50 transition-all";
  const labelClass = "block text-xs font-semibold text-gray-500 mb-1.5";

  return (
    <div className="max-w-2xl mx-auto py-2 px-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-emerald-600 transition-colors">
          <ChevronLeft size={14} /> Back
        </button>
        <span className="text-gray-200">|</span>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center">
            <RotateCcw className="text-white" size={13} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900">{isEdit ? 'Edit Return Request' : 'Return Asset'}</h1>
            <p className="text-xs text-gray-400">Submit an asset return to storage</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {/* Asset */}
          <div className="px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2 mb-3">
              <Package size={13} className="text-emerald-500" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Asset to Return</span>
            </div>
            <label className={labelClass}>Your Assigned Assets</label>
            <select className={fieldClass} value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)} required>
              <option value="">Select asset to return...</option>
              {assignmentsList.map(a => (
                <option key={a.id} value={a.id}>{a.product?.name} — {a.serial_number}</option>
              ))}
            </select>

            {selectedAssignment && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedAssignment.product?.brand && (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium">{selectedAssignment.product.brand}</span>
                )}
                {selectedAssignment.product?.sku && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs font-medium">SKU: {selectedAssignment.product.sku}</span>
                )}
                {selectedAssignment.condition && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs font-medium">Condition: {selectedAssignment.condition}</span>
                )}
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={13} className="text-emerald-500" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Reason for Return</span>
            </div>
            <label className={labelClass}>Justification</label>
            <textarea
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-50 transition-all resize-none"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe why you're returning this asset..."
              required
            />
          </div>
        </div>

        {/* Notice */}
        <div className="flex items-start gap-3 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl">
          <ShieldCheck size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-700 leading-relaxed">
            Return requests require physical verification. Once approved, return the hardware to your Regional Hub or Supply Manager.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all">
            Cancel
          </button>
          <button type="submit" disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-all shadow-sm">
            {submitting ? 'Submitting...' : isEdit ? 'Save Changes' : 'Submit Return'}
            {!submitting && <ArrowRight size={14} />}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReturnAssetPage;
