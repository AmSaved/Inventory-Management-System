import api from './api';

const organizationService = {
  // --- Types ---
  getTypes: async () => {
    const response = await api.get('/organization/types');
    return response.data.data;
  },

  createType: async (typeData) => {
    const response = await api.post('/organization/types', typeData);
    return response.data.data;
  },

  updateType: async (id, typeData) => {
    const response = await api.put(`/organization/types/${id}`, typeData);
    return response.data.data;
  },

  deleteType: async (id) => {
    const response = await api.delete(`/organization/types/${id}`);
    return response.data;
  },

  // --- Nodes ---
  getNodes: async (params) => {
    const response = await api.get('/organization/nodes', { params });
    return response.data.data;
  },

  getNodeTree: async (params) => {
    const response = await api.get('/organization/nodes/tree', { params });
    return response.data.data;
  },

  getNodeById: async (id) => {
    const response = await api.get(`/organization/nodes/${id}`);
    return response.data.data;
  },

  createNode: async (nodeData) => {
    const response = await api.post('/organization/nodes', nodeData);
    return response.data.data;
  },

  updateNode: async (id, nodeData) => {
    const response = await api.put(`/organization/nodes/${id}`, nodeData);
    return response.data.data;
  },

  deleteNode: async (id) => {
    const response = await api.delete(`/organization/nodes/${id}`);
    return response.data;
  }
};

export default organizationService;
