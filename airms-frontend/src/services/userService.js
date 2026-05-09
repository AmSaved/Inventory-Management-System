import api from './api';

const userService = {
  // Get all users
  getAllUsers: async (params = {}) => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  // Get user by ID
  getUserById: async (id) => {
    const response = await api.get(`/users/${id}`);
    return response.data.data;
  },

  // Create user
  createUser: async (userData) => {
    const response = await api.post('/users', userData);
    return response.data.data;
  },

  // Update user
  updateUser: async (id, userData) => {
    const response = await api.put(`/users/${id}`, userData);
    return response.data.data;
  },

  // Delete user
  deleteUser: async (id) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },

  // Toggle user status
  toggleUserStatus: async (id) => {
    const response = await api.patch(`/users/${id}/toggle-status`);
    return response.data.data;
  },

  // Get user permissions
  getUserPermissions: async (id) => {
    const response = await api.get(`/users/${id}/permissions`);
    return response.data.data;
  },

  // Assign permissions to user
  assignPermissions: async (id, permissionIds) => {
    const response = await api.post(`/users/${id}/permissions`, { permission_ids: permissionIds });
    return response.data;
  },
};

export default userService;