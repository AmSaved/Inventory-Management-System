import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card, { CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useFetch } from '../hooks/useFetch';
import api from '../services/api';
import toast from 'react-hot-toast';

const ReportProblemPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [assignmentId, setAssignmentId] = useState(searchParams.get('assignment_id') || '');
  const [inventoryId, setInventoryId] = useState(searchParams.get('inventory_id') || '');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState('medium');
  
  const { data: assignments } = useFetch('/assignments/my-assignments');
  const { data: inventoryItem } = useFetch(inventoryId ? `/inventory/${inventoryId}` : null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assignmentId && !inventoryId) {
      return toast.error('Please select an asset or stock item with a problem');
    }

    try {
      const selectedAssignment = assignments?.data?.find(a => a.id === parseInt(assignmentId));
      
      const payload = {
        request_type: 'report',
        purpose: inventoryId 
          ? `Issue Report for Inventory Item: ${inventoryItem?.product?.name}. Details: ${description}`
          : `Issue Report for assigned asset: ${selectedAssignment?.product?.name} (SN: ${selectedAssignment?.serial_number}). Details: ${description}`,
        priority: urgency,
        items: [{
          product_id: inventoryId ? inventoryItem?.product_id : selectedAssignment?.product_id,
          quantity_requested: 1,
          notes: `Problem reported: ${description}`
        }],
        notes: JSON.stringify({ 
          assignment_id: assignmentId || null, 
          inventory_id: inventoryId || null,
          urgency 
        })
      };

      await api.post('/requests', payload);
      toast.success('Problem report submitted. A manager will review it soon.');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Failed to submit report');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-2 text-gray-500 mb-4">
         <button onClick={() => navigate(-1)} className="hover:text-primary-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
         </button>
         <span className="text-sm font-medium">Back to Dashboard</span>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 font-display text-center flex items-center justify-center space-x-3">
         <svg className="w-8 h-8 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
         <span>Report Product Issue</span>
      </h1>
      
      <Card className="shadow-lg border-rose-100">
        <CardHeader className="bg-rose-50/30 border-b border-rose-100">
          <CardTitle className="text-rose-800">Problem Details</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Affected Resource</label>
              {inventoryId ? (
                <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 font-bold text-slate-700 flex items-center gap-3">
                   <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                   </div>
                   <span>Stock Item: {inventoryItem?.product?.name || 'Loading...'}</span>
                </div>
              ) : (
                <select 
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-rose-500"
                  value={assignmentId}
                  onChange={(e) => setAssignmentId(e.target.value)}
                  required
                >
                  <option value="">Select an asset...</option>
                  {assignments?.data?.map(a => (
                    <option key={a.id} value={a.id}>{a.product?.name} (SN: {a.serial_number})</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Urgency</label>
              <select 
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-rose-500"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                required
              >
                <option value="low">Low - Minor Issue</option>
                <option value="medium">Medium - Affecting Work</option>
                <option value="high">High - Total Breakdown / Urgent Replacement Needed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Description of Problem</label>
              <textarea 
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-rose-500 h-32"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what is wrong with the product. Be as specific as possible (e.g., 'The screen stays black after turning it on')..."
                required
              />
            </div>

            <Button type="submit" size="lg" className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-4">
               Submit Problem Report
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <div className="text-center bg-gray-50 p-4 rounded-lg">
         <p className="text-xs text-gray-500">
            Reporting a problem creates an official maintenance request that will be reviewed by the backend team and storage manager.
         </p>
      </div>
    </div>
  );
};

export default ReportProblemPage;
