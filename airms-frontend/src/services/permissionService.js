import api from './api';

const permissionService = {
  // Get all permissions
  getAllPermissions: async () => {
    const response = await api.get('/permissions');
    return response.data.data;
  },

  // Get permissions by resource
  getPermissionsByResource: async (resource) => {
    const response = await api.get(`/permissions/resource/${resource}`);
    return response.data.data;
  },

  // Get permission by ID
  getPermissionById: async (id) => {
    const response = await api.get(`/permissions/${id}`);
    return response.data.data;
  },

  // Create permission
  createPermission: async (data) => {
    const response = await api.post('/permissions', data);
    return response.data.data;
  },

  // Update permission
  updatePermission: async (id, data) => {
    const response = await api.put(`/permissions/${id}`, data);
    return response.data.data;
  },

  // Delete permission
  deletePermission: async (id) => {
    const response = await api.delete(`/permissions/${id}`);
    return response.data;
  }
};

export default permissionService;
