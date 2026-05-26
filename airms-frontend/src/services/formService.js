import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const formService = {
  /**
   * Fetches the dynamic form template for a specific module and key.
   */
  getTemplate: async (module, key) => {
    try {
      const response = await axios.get(`${API_URL}/form-templates/module/${module}/key/${key}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
      });
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch form template:', error);
      return null;
    }
  },

  /**
   * Fetches templates by category (e.g. for specific product types).
   */
  getTemplateByCategory: async (category) => {
    try {
      const response = await axios.get(`${API_URL}/form-templates/category/${category}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
      });
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch category template:', error);
      return null;
    }
  },

  /**
   * Fetches all form templates for the current company.
   */
  getAllTemplates: async () => {
    try {
      const response = await axios.get(`${API_URL}/form-templates`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
      });
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch all templates:', error);
      return [];
    }
  },

  /**
   * Creates a new form template.
   */
  createTemplate: async (templateData) => {
    const response = await axios.post(`${API_URL}/form-templates`, templateData, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
    });
    return response.data.data;
  },

  /**
   * Updates an existing form template.
   */
  updateTemplate: async (id, templateData) => {
    const response = await axios.put(`${API_URL}/form-templates/${id}`, templateData, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
    });
    return response.data.data;
  },

  /**
   * Deletes a form template.
   */
  deleteTemplate: async (id) => {
    const response = await axios.delete(`${API_URL}/form-templates/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
    });
    return response.data.data;
  }
};

export default formService;
