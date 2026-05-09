import React, { useState } from 'react';
import Card, { CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import { useFetch } from '../hooks/useFetch';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const ReturnsPage = () => {
  const { user } = useAuth();
  const { data: returns, refresh } = useFetch('/returns');
  const { data: myAssignments } = useFetch('/assignments/my-assignments');
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [notes, setNotes] = useState('');

  const handleApplyReturn = async () => {
    try {
      await api.post('/returns', {
        assignment_id: selectedAssignment.id,
        notes
      });
      toast.success('Return request submitted');
      setShowApplyModal(false);
      refresh();
    } catch (error) {
      toast.error('Failed to submit return request');
    }
  };

  const handleProcessReturn = async (id, action) => {
    try {
      if (action === 'accept') {
        await api.post(`/returns/${id}/process`, { condition: 'good' });
        toast.success('Return accepted and inventory updated');
      } else {
        await api.post(`/returns/${id}/reject`, { reason: 'Invalid return request' });
        toast.success('Return rejected');
      }
      refresh();
    } catch (error) {
      toast.error('Failed to process return');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return <Badge variant="warning">Pending</Badge>;
      case 'completed': return <Badge variant="success">Completed</Badge>;
      case 'rejected': return <Badge variant="danger">Rejected</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Returns Management</h1>
        <Button onClick={() => setShowApplyModal(true)}>Request Return</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Return Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Item</th>
                <th>Requester</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {returns?.data?.map((r) => (
                <tr key={r.id}>
                  <td>{r.return_number}</td>
                  <td>{r.assignment?.product?.name}</td>
                  <td>{r.user?.first_name} {r.user?.last_name}</td>
                  <td>{getStatusBadge(r.status)}</td>
                  <td>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td>
                    {r.status === 'pending' && user.role?.name === 'storage_manager' && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleProcessReturn(r.id, 'accept')}>Accept</Button>
                        <Button size="sm" variant="danger" onClick={() => handleProcessReturn(r.id, 'reject')}>Reject</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      {showApplyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Request Asset Return</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Select Asset</label>
                <select
                  className="w-full mt-1 border border-gray-300 rounded-md p-2"
                  onChange={(e) => setSelectedAssignment(myAssignments?.data?.find(a => a.id === parseInt(e.target.value)))}
                >
                  <option value="">Select an active assignment</option>
                  {myAssignments?.data?.filter(a => a.status === 'active').map(a => (
                    <option key={a.id} value={a.id}>{a.product?.name} ({a.serial_number})</option>
                  ))}
                </select>
              </div>
              <Input
                placeholder="Reason for return/Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setShowApplyModal(false)}>Cancel</Button>
                <Button onClick={handleApplyReturn} disabled={!selectedAssignment}>Submit</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ReturnsPage;
