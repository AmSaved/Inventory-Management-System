const { body, param, query } = require('express-validator');

const createProductValidation = [
    body('sku')
        .notEmpty().withMessage('SKU is required')
        .isLength({ min: 1, max: 100 }).withMessage('SKU must be between 1 and 100 characters'),
    
    body('name')
        .notEmpty().withMessage('Product name is required')
        .isLength({ max: 200 }).withMessage('Product name cannot exceed 200 characters'),
    
    body('description')
        .optional()
        .isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
    
    body('category')
        .optional()
        .isLength({ max: 50 }).withMessage('Category cannot exceed 50 characters'),
    
    body('sub_category')
        .optional()
        .isLength({ max: 50 }).withMessage('Sub-category cannot exceed 50 characters'),
    
    body('brand')
        .optional()
        .isLength({ max: 100 }).withMessage('Brand cannot exceed 100 characters'),
    
    body('model')
        .optional()
        .isLength({ max: 100 }).withMessage('Model cannot exceed 100 characters'),
    
    body('unit')
        .optional()
        .isString().withMessage('Unit must be a string'),
    
    body('specifications')
        .optional()
        .isObject().withMessage('Specifications must be an object'),
    
    body('image_url')
        .optional()
        .isURL().withMessage('Invalid image URL'),
    
    body('is_active')
        .optional()
        .isBoolean().withMessage('is_active must be a boolean')
];

const updateProductValidation = [
    param('id')
        .isInt().withMessage('Product ID must be an integer'),
    
    body('sku')
        .optional()
        .isLength({ min: 1, max: 100 }).withMessage('SKU must be between 1 and 100 characters'),
    
    body('name')
        .optional()
        .isLength({ max: 200 }).withMessage('Product name cannot exceed 200 characters'),
    
    body('description')
        .optional()
        .isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
    
    body('category')
        .optional()
        .isLength({ max: 50 }).withMessage('Category cannot exceed 50 characters'),
    
    body('sub_category')
        .optional()
        .isLength({ max: 50 }).withMessage('Sub-category cannot exceed 50 characters'),
    
    body('brand')
        .optional()
        .isLength({ max: 100 }).withMessage('Brand cannot exceed 100 characters'),
    
    body('model')
        .optional()
        .isLength({ max: 100 }).withMessage('Model cannot exceed 100 characters'),
    
    body('unit')
        .optional()
        .isString().withMessage('Unit must be a string'),
    
    body('specifications')
        .optional()
        .isObject().withMessage('Specifications must be an object'),
    
    body('image_url')
        .optional()
        .isURL().withMessage('Invalid image URL'),
    
    body('is_active')
        .optional()
        .isBoolean().withMessage('is_active must be a boolean')
];

const productIdValidation = [
    param('id')
        .isInt().withMessage('Product ID must be an integer')
];

const productSkuValidation = [
    param('sku')
        .notEmpty().withMessage('SKU is required')
        .isLength({ min: 3, max: 50 }).withMessage('SKU must be between 3 and 50 characters')
];

const productBarcodeValidation = [
    param('barcode')
        .notEmpty().withMessage('Barcode is required')
];

const productQueryValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    
    query('search')
        .optional()
        .isString().withMessage('Search must be a string'),
    
    query('category')
        .optional()
        .isString().withMessage('Category must be a string'),
    
    query('brand')
        .optional()
        .isString().withMessage('Brand must be a string'),
    
    query('is_active')
        .optional()
        .isBoolean().withMessage('is_active must be a boolean')
];

const bulkImportValidation = [
    body('products')
        .isArray().withMessage('Products must be an array')
        .notEmpty().withMessage('Products array cannot be empty'),
    
    body('products.*.sku')
        .notEmpty().withMessage('SKU is required for each product'),
    
    body('products.*.name')
        .notEmpty().withMessage('Product name is required for each product')
];

module.exports = {
    createProductValidation,
    updateProductValidation,
    productIdValidation,
    productSkuValidation,
    productBarcodeValidation,
    productQueryValidation,
    bulkImportValidation
};