import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  ArrowRightLeft,
  User as UserIcon,
  Package,
  MessageSquare,
  ArrowRight,
  ChevronLeft,
} from 'lucide-react';

const TransferAssetPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [assignmentId, setAssignmentId] = useState(searchParams.get('assignment_id') || '');
  const [toUserId, setToUserId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  const isEdit = searchParams.get('edit') === 'true';
  const requestId = searchParams.get('id');

  const { data: assignments } = useFetch('/assignments/my-assignments');
  const { data: usersData } = useFetch('/users');
  const users = Array.isArray(usersData?.data) ? usersData.data : (Array.isArray(usersData) ? usersData : []);
  const assignmentsList = Array.isArray(assignments?.data) ? assignments.data : (Array.isArray(assignments) ? assignments : []);

  // Load request data for edit mode
  useEffect(() => {
    if (isEdit && requestId) {
      const fetchRequestForEdit = async () => {
        try {
          const res = await api.get(`/requests/${requestId}`);
          const request = res.data.data;

          let parsedNotes = {};
          if (request.notes) {
            try { parsedNotes = JSON.parse(request.notes); } catch (e) {}
          }

          const loadedAssignmentId = parsedNotes.assignment_id || '';
          const loadedToUserId = parsedNotes.transfer_to_user_id || parsedNotes.target_user_id || '';

          setAssignmentId(loadedAssignmentId);
          setToUserId(loadedToUserId);

          let reasonText = '';
          if (parsedNotes.justification) {
            reasonText = parsedNotes.justification;
          } else if (request.purpose?.includes('Justification: ')) {
            reasonText = request.purpose.split('Justification: ')[1];
          } else {
            reasonText = request.purpose || '';
          }
          setReason(reasonText);

          // Directly fetch the assignment by ID as fallback for edit mode
          if (loadedAssignmentId) {
            try {
              const aRes = await api.get(`/assignments/${loadedAssignmentId}`);
              const aData = aRes.data?.data || aRes.data;
              if (aData) setSelectedAssignment(aData);
            } catch (aErr) {
              console.warn('Could not fetch assignment directly, will try from list:', aErr);
            }
          }
        } catch (err) {
          toast.error('Failed to load transfer request details');
        }
      };
      fetchRequestForEdit();
    }
  }, [isEdit, requestId]);

  // Resolve selectedAssignment from the list whenever assignmentId or assignments list changes
  useEffect(() => {
    if (!assignmentId) {
      if (!isEdit) setSelectedAssignment(null);
      return;
    }
    const found = assignmentsList.find(a => String(a.id) === String(assignmentId));
    if (found) setSelectedAssignment(found);
  }, [assignmentId, assignmentsList]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assignmentId || !toUserId) {
      return toast.error('Please select an asset and a recipient');
    }

    setSubmitting(true);
    try {
      const resolvedAssignment = selectedAssignment || assignmentsList.find(a => String(a.id) === String(assignmentId));

      const payload = {
        purpose: `Hierarchical Transfer: ${resolvedAssignment?.product?.name || 'Asset'} to user ID ${toUserId}. Justification: ${reason}`,
        priority: 'medium',
        items: [{
          product_id: resolvedAssignment?.product_id,
          quantity_requested: 1,
          notes: `Transfer from ${user?.first_name} ${user?.last_name} to target user ID: ${toUserId}`
        }],
        notes: JSON.stringify({ transfer_to_user_id: toUserId, assignment_id: assignmentId, justification: reason })
      };

      if (isEdit && requestId) {
        await api.put(`/requests/${requestId}`, payload);
        toast.success('Transfer request updated successfully');
      } else {
        await api.post('/requests', {
          request_type: 'transfer',
          requester_id: resolvedAssignment?.user_id,
          org_node_id: resolvedAssignment?.org_node_id,
          ...payload
        });
        toast.success('Transfer request submitted');
      }
      navigate('/dashboard');
    } catch (error) {
      toast.error(isEdit ? 'Failed to update transfer request' : 'Failed to submit transfer request');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass = "w-full h-9 bg-gray-50 border border-gray-200 rounded-lg px-3 text-sm font-medium text-gray-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-all";
  const labelClass = "block text-xs font-semibold text-gray-500 mb-1.5";

  return (
    <div className="max-w-4xl mx-auto py-2 px-4 space-y-5">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-blue-600 transition-colors"
          >
            <ChevronLeft size={14} />
            Back
          </button>
          <span className="text-gray-200">|</span>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <ArrowRightLeft className="text-white" size={14} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">
                {isEdit ? 'Edit Transfer Request' : 'Transfer Asset'}
              </h1>
              <p className="text-xs text-gray-400">Personnel-to-personnel asset handover</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Form Card */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">

          {/* Section: Asset Selection */}
          <div className="px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2 mb-3">
              <Package size={13} className="text-blue-500" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Asset to Transfer</span>
            </div>

            <select
              className={fieldClass}
              value={assignmentId}
              onChange={(e) => setAssignmentId(e.target.value)}
              required
            >
              <option value="">Select an asset...</option>
              {assignmentsList.map(a => (
                <option key={a.id} value={a.id}>
                  {a.product?.name} — {a.serial_number}
                </option>
              ))}
            </select>

            {/* Asset details chip */}
            {selectedAssignment && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedAssignment.product?.brand && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">
                    {selectedAssignment.product.brand}
                  </span>
                )}
                {selectedAssignment.product?.sku && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs font-medium">
                    SKU: {selectedAssignment.product.sku}
                  </span>
                )}
                {selectedAssignment.product?.processor && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs font-medium">
                    {selectedAssignment.product.processor}
                  </span>
                )}
                {selectedAssignment.product?.ram && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs font-medium">
                    {selectedAssignment.product.ram} RAM
                  </span>
                )}
                {selectedAssignment.product?.storage && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs font-medium">
                    {selectedAssignment.product.storage}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs font-medium">
                  {selectedAssignment.condition || 'Good'}
                </span>
              </div>
            )}
          </div>

          {/* Section: Recipient */}
          <div className="px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2 mb-3">
              <UserIcon size={13} className="text-blue-500" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Transfer To</span>
            </div>
            <label className={labelClass}>New Custodian</label>
            <select
              className={fieldClass}
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              required
            >
              <option value="">Select recipient...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name} — {u.employee_id}
                </option>
              ))}
            </select>
          </div>

          {/* Section: Justification */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={13} className="text-blue-500" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Justification</span>
            </div>
            <label className={labelClass}>Reason for Transfer</label>
            <textarea
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-all resize-none"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the reason for this asset transfer..."
              required
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-all shadow-sm"
          >
            {submitting ? 'Submitting...' : isEdit ? 'Save Changes' : 'Submit Transfer'}
            {!submitting && <ArrowRight size={14} />}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TransferAssetPage;
