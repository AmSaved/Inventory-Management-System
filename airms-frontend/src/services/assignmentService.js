import api from './api';

const assignmentService = {
  // Get all assignments
  getAllAssignments: async (params = {}) => {
    const response = await api.get('/assignments', { params });
    return response.data;
  },

  // Get assignment by ID
  getAssignmentById: async (id) => {
    const response = await api.get(`/assignments/${id}`);
    return response.data.data;
  },

  // Get assignment by number
  getAssignmentByNumber: async (assignmentNumber) => {
    const response = await api.get(`/assignments/number/${assignmentNumber}`);
    return response.data.data;
  },

  // Get my assignments
  getMyAssignments: async (params = {}) => {
    const response = await api.get('/assignments/my-assignments', { params });
    return response.data;
  },

  // Get assignments by user
  getAssignmentsByUser: async (userId, params = {}) => {
    const response = await api.get(`/assignments/user/${userId}`, { params });
    return response.data;
  },

  // Create assignment
  createAssignment: async (data) => {
    const response = await api.post('/assignments', data);
    return response.data.data;
  },

  // Update assignment
  updateAssignment: async (id, data) => {
    const response = await api.put(`/assignments/${id}`, data);
    return response.data.data;
  },

  // Return assignment
  returnAssignment: async (id, condition, notes) => {
    const response = await api.post(`/assignments/${id}/return`, { condition, notes });
    return response.data;
  },

  // Mark as lost
  markAsLost: async (id, notes) => {
    const response = await api.post(`/assignments/${id}/mark-lost`, { notes });
    return response.data;
  },

  // Get overdue assignments
  getOverdueAssignments: async (unitId = null) => {
    const params = unitId ? { org_unit_id: unitId } : {};
    const response = await api.get('/assignments/overdue', { params });
    return response.data;
  },

  // Get assignment statistics
  getAssignmentStatistics: async (unitId = null) => {
    const params = unitId ? { org_unit_id: unitId } : {};
    const response = await api.get('/assignments/statistics', { params });
    return response.data;
  },
};

export default assignmentService;