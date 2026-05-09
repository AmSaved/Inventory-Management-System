import api from './api';

const reportService = {
  // Get inventory valuation
  getInventoryValuation: async (params = {}) => {
    const response = await api.get('/reports/inventory-valuation', { params });
    return response.data;
  },

  // Get asset utilization
  getAssetUtilization: async (params = {}) => {
    const response = await api.get('/reports/asset-utilization', { params });
    return response.data;
  },

  // Get request analytics
  getRequestAnalytics: async (params = {}) => {
    const response = await api.get('/reports/request-analytics', { params });
    return response.data;
  },

  // Get discharge report
  getDischargeReport: async (params = {}) => {
    const response = await api.get('/reports/discharge-report', { params });
    return response.data;
  },

  // Get return report
  getReturnReport: async (params = {}) => {
    const response = await api.get('/reports/return-report', { params });
    return response.data;
  },

  // Get transfer report
  getTransferReport: async (params = {}) => {
    const response = await api.get('/reports/transfer-report', { params });
    return response.data;
  },

  // Get issue report
  getIssueReport: async (params = {}) => {
    const response = await api.get('/reports/issue-report', { params });
    return response.data;
  },

  // Get user activity report
  getUserActivityReport: async (params = {}) => {
    const response = await api.get('/reports/user-activity', { params });
    return response.data;
  },

  // Get branch performance report
  getBranchPerformance: async (params = {}) => {
    const response = await api.get('/reports/branch-performance', { params });
    return response.data;
  },

  // Get low stock report
  getLowStockReport: async (params = {}) => {
    const response = await api.get('/reports/low-stock', { params });
    return response.data;
  },

  // Get overdue assets report
  getOverdueAssets: async (params = {}) => {
    const response = await api.get('/reports/overdue-assets', { params });
    return response.data;
  },

  // Get custom report
  getCustomReport: async (data) => {
    const response = await api.post('/reports/custom', data);
    return response.data;
  },

  // Schedule report
  scheduleReport: async (data) => {
    const response = await api.post('/reports/schedule', data);
    return response.data;
  },

  // Get report templates
  getReportTemplates: async () => {
    const response = await api.get('/reports/templates');
    return response.data.data;
  },
};

export default reportService;