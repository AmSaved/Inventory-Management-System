import api from './api';

const roleService = {
  
  getAllRoles: async () => {
    const response = await api.get('/roles');
    return response.data;
  },

  getRoleById: async (id) => {
    const response = await api.get(`/roles/${id}`);
    return response.data.data;
  },

  getRolePermissions: async (id) => {
    const response = await api.get(`/roles/${id}/permissions`);
    return response.data.data;
  },

  createRole: async (roleData) => {
    const response = await api.post('/roles', roleData);
    return response.data.data;
  },

  updateRole: async (id, roleData) => {
    const response = await api.put(`/roles/${id}`, roleData);
    return response.data.data;
  },

  deleteRole: async (id) => {
    const response = await api.delete(`/roles/${id}`);
    return response.data;
  },
  
  assignPermissions: async (id, permissionIds) => {
    const response = await api.post(`/roles/${id}/permissions`, { permission_ids: permissionIds });
    return response.data;
  },
  removePermission: async (id, permissionId) => {
    const response = await api.delete(`/roles/${id}/permissions/${permissionId}`);
    return response.data;
  },

  applyTemplate: async (id, templateName) => {
    const response = await api.post(`/roles/${id}/template`, { template_name: templateName });
    return response.data;
  },
};

export default roleService;