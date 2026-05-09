import api from './api';

const requestService = {
  // Get all requests
  getAllRequests: async (params = {}) => {
    const response = await api.get('/requests', { params });
    return response.data;
  },

  // Get request by ID
  getRequestById: async (id) => {
    const response = await api.get(`/requests/${id}`);
    return response.data.data;
  },

  // Get request by number
  getRequestByNumber: async (requestNumber) => {
    const response = await api.get(`/requests/number/${requestNumber}`);
    return response.data.data;
  },

  // Create request
  createRequest: async (data) => {
    const response = await api.post('/requests', data);
    return response.data.data;
  },

  // Update request
  updateRequest: async (id, data) => {
    const response = await api.put(`/requests/${id}`, data);
    return response.data.data;
  },

  // Delete request
  deleteRequest: async (id) => {
    const response = await api.delete(`/requests/${id}`);
    return response.data;
  },

  // Cancel request
  cancelRequest: async (id, reason) => {
    const response = await api.post(`/requests/${id}/cancel`, { reason });
    return response.data;
  },

  // Get requests by status
  getRequestsByStatus: async (status, params = {}) => {
    const response = await api.get(`/requests/status/${status}`, { params });
    return response.data;
  },

  // Get pending approvals
  getPendingApprovals: async () => {
    const response = await api.get('/requests/pending-approvals');
    return response.data.data;
  },

  // Approve request
  approveRequest: async (id, comments) => {
    const response = await api.post(`/requests/${id}/workflow-action`, { action: 'approve', comments });
    return response.data;
  },

  // Reject request
  rejectRequest: async (id, comments) => {
    const response = await api.post(`/requests/${id}/workflow-action`, { action: 'reject', comments });
    return response.data;
  },

  // Get request statistics
  getRequestStatistics: async (params = {}) => {
    const response = await api.get('/requests/statistics', { params });
    return response.data.data;
  },
};

export default requestService;