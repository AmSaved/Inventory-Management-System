import api from './api';

const dashboardService = {
  /**
   * Get unified dashboard statistics for the current company.
   * Supports hierarchical scoping via unitId.
   */
  getStats: async (params = {}) => {
    // Current params can include: org_unit_id, period
    const response = await api.get('/dashboard/stats', { params });
    return response.data;
  },

  /**
   * Get detailed analytics for a specific unit or the whole company.
   */
  getAnalytics: async (params = {}) => {
    const response = await api.get('/dashboard/analytics', { params });
    return response.data;
  },

  /**
   * Get personal dashboard statistics for the logged-in user.
   */
  getUserStats: async () => {
    const response = await api.get('/dashboard/user');
    return response.data;
  }
};

export default dashboardService;