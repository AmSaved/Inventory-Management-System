import api from './api';

const inventoryService = {
  // Get all inventory scoped by company and optional unit hierarchy
  getAllInventory: async (params = {}) => {
    const response = await api.get('/inventory', { params });
    return response.data;
  },

  // Get inventory for a specific unit (including descendants if handled by backend)
  getInventoryByUnit: async (unitId, params = {}) => {
    const response = await api.get(`/inventory/unit/${unitId}`, { params });
    return response.data;
  },

  // Get inventory by ID
  getInventoryById: async (id) => {
    const response = await api.get(`/inventory/${id}`);
    return response.data.data;
  },

  // Create store intake form (into a specific unit)
  createStoreForm: async (data) => {
    const response = await api.post('/store', data);
    return response.data;
  },

  // Create discharge distribution form (from one unit to another/user)
  createDischargeForm: async (data) => {
    const response = await api.post('/discharge', data);
    return response.data;
  },

  // Update inventory record
  updateInventory: async (id, data) => {
    const response = await api.put(`/inventory/${id}`, data);
    return response.data.data;
  },

  // Adjust inventory quantity
  adjustQuantity: async (id, adjustment, type, reason) => {
    const response = await api.post(`/inventory/${id}/adjust`, {
      adjustment,
      type,
      reason,
    });
    return response.data.data;
  },

  // Get low stock items
  getLowStock: async (unitId = null) => {
    const params = unitId ? { org_node_id: unitId } : {};
    const response = await api.get('/inventory/low-stock', { params });
    return response.data.data;
  },

  // Count inventory
  countInventory: async (id, actualQuantity, notes) => {
    const response = await api.post(`/inventory/${id}/count`, {
      actual_quantity: actualQuantity,
      notes,
    });
    return response.data.data;
  },

  // Split inventory item
  splitItem: async (id, data) => {
    const response = await api.post(`/inventory/${id}/split`, data);
    return response.data;
  },

  // Merge inventory items
  mergeItems: async (targetId, sourceIds) => {
    const response = await api.post('/inventory/merge', {
      target_id: targetId,
      source_ids: sourceIds,
    });
    return response.data;
  },

  // Transfer inventory between nodes
  transferItems: async (data) => {
    const response = await api.post('/inventory/transfer', data);
    return response.data;
  },

  // Decommission inventory record
  decommissionItem: async (id, reason) => {
    const response = await api.post(`/inventory/${id}/decommission`, { reason });
    return response.data;
  },

  // Bulk delete by product and node
  bulkDelete: async (productId, orgNodeId) => {
    const response = await api.post('/inventory/bulk-delete', {
      product_id: productId,
      org_node_id: orgNodeId
    });
    return response.data;
  }
};

export default inventoryService;