import api from './api';

const productService = {
  // Get all products
  getAllProducts: async (params = {}) => {
    const response = await api.get('/products', { params });
    return response.data.data;
  },

  // Get product by ID
  getProductById: async (id) => {
    const response = await api.get(`/products/${id}`);
    return response.data.data;
  },

  // Create new product
  createProduct: async (productData) => {
    const response = await api.post('/products', productData);
    return response.data.data;
  },

  // Update product
  updateProduct: async (id, productData) => {
    const response = await api.put(`/products/${id}`, productData);
    return response.data.data;
  },

  // Delete product
  deleteProduct: async (id) => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  }
};

export default productService;
