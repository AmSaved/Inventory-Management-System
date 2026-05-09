import api from './api';

const roleService = {
  // Get all roles
  getAllRoles: async () => {
    const response = await api.get('/roles');
    return response.data;
  },

  // Get role by ID
  getRoleById: async (id) => {
    const response = await api.get(`/roles/${id}`);
    return response.data.data;
  },

  // Get role permissions
  getRolePermissions: async (id) => {
    const response = await api.get(`/roles/${id}/permissions`);
    return response.data.data;
  },

  // Create role
  createRole: async (roleData) => {
    const response = await api.post('/roles', roleData);
    return response.data.data;
  },

  // Update role
  updateRole: async (id, roleData) => {
    const response = await api.put(`/roles/${id}`, roleData);
    return response.data.data;
  },

  // Delete role
  deleteRole: async (id) => {
    const response = await api.delete(`/roles/${id}`);
    return response.data;
  },

  // Assign permissions to role
  assignPermissions: async (id, permissionIds) => {
    const response = await api.post(`/roles/${id}/permissions`, { permission_ids: permissionIds });
    return response.data;
  },

  // Remove permission from role
  removePermission: async (id, permissionId) => {
    const response = await api.delete(`/roles/${id}/permissions/${permissionId}`);
    return response.data;
  },
};

export default roleService;