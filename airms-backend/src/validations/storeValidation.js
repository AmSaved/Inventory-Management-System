const { body, param, query } = require('express-validator');

const createStoreValidation = [
    body('branch_id')
        .optional()
        .isInt().withMessage('Branch ID must be an integer'),
    
    body('supplier')
        .optional()
        .isLength({ max: 200 }).withMessage('Supplier name cannot exceed 200 characters'),
    
    body('invoice_number')
        .optional()
        .isLength({ max: 100 }).withMessage('Invoice number cannot exceed 100 characters'),
    
    body('invoice_date')
        .optional()
        .isISO8601().withMessage('Invalid invoice date format'),
    
    body('notes')
        .optional()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
    
    body('items')
        .isArray().withMessage('Items must be an array')
        .notEmpty().withMessage('At least one item is required'),
    
    body('items.*.product_id')
        .optional({ nullable: true })
        .isInt().withMessage('Product ID must be an integer'),
        
    body('items.*.new_product')
        .optional({ nullable: true })
        .isObject().withMessage('new_product must be an object'),
    
    body('items.*.new_product.name')
        .if((value, { req, path }) => {
            const index = path.match(/items\[(\d+)\]/)[1];
            const item = req.body.items[index];
            return item && item.new_product && typeof item.new_product === 'object';
        })
        .notEmpty().withMessage('Asset Name is required when generating a new product blueprint'),
        
    body('items.*.new_product.sku')
        .if((value, { req, path }) => {
            const index = path.match(/items\[(\d+)\]/)[1];
            const item = req.body.items[index];
            return item && item.new_product && typeof item.new_product === 'object';
        })
        .notEmpty().withMessage('SKU is required when generating a new product blueprint'),
    
    body('items.*.quantity')
        .isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    
    body('items.*.unit_price')
        .optional()
        .isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
    
    body('items.*.batch_number')
        .optional()
        .isLength({ max: 100 }).withMessage('Batch number cannot exceed 100 characters'),
    
    body('items.*.expiry_date')
        .optional()
        .isISO8601().withMessage('Invalid expiry date format'),
    
    body('items.*.notes')
        .optional()
        .isString().withMessage('Notes must be a string')
];

const updateStoreValidation = [
    param('id')
        .isInt().withMessage('Store form ID must be an integer'),
    
    body('supplier')
        .optional()
        .isLength({ max: 200 }).withMessage('Supplier name cannot exceed 200 characters'),
    
    body('invoice_number')
        .optional()
        .isLength({ max: 100 }).withMessage('Invoice number cannot exceed 100 characters'),
    
    body('invoice_date')
        .optional()
        .isISO8601().withMessage('Invalid invoice date format'),
    
    body('notes')
        .optional()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
];

const storeIdValidation = [
    param('id')
        .isInt().withMessage('Store form ID must be an integer')
];

const storeNumberValidation = [
    param('store_number')
        .notEmpty().withMessage('Store number is required')
        .matches(/^STR-\d{4}-\d{6}$/).withMessage('Invalid store number format')
];

const storeQueryValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    
    query('branch_id')
        .optional()
        .isInt().withMessage('Branch ID must be an integer'),
    
    query('from_date')
        .optional()
        .isISO8601().withMessage('Invalid from_date format'),
    
    query('to_date')
        .optional()
        .isISO8601().withMessage('Invalid to_date format'),
    
    query('supplier')
        .optional()
        .isString().withMessage('Supplier must be a string')
];

module.exports = {
    createStoreValidation,
    updateStoreValidation,
    storeIdValidation,
    storeNumberValidation,
    storeQueryValidation
};
