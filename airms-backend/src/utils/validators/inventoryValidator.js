const { body, param, query } = require('express-validator');

// Validate create inventory
const validateCreateInventory = [
    body('product_id')
        .notEmpty().withMessage('Product ID is required')
        .isInt().withMessage('Product ID must be an integer'),
    
    body('branch_id')
        .notEmpty().withMessage('Branch ID is required')
        .isInt().withMessage('Branch ID must be an integer'),
    
    body('quantity')
        .notEmpty().withMessage('Quantity is required')
        .isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
    
    body('minimum_quantity')
        .optional()
        .isInt({ min: 0 }).withMessage('Minimum quantity must be a non-negative integer'),
    
    body('maximum_quantity')
        .optional()
        .isInt({ min: 1 }).withMessage('Maximum quantity must be a positive integer')
        .custom((value, { req }) => !req.body.minimum_quantity || value > req.body.minimum_quantity)
        .withMessage('Maximum quantity must be greater than minimum quantity'),
    
    body('location_details')
        .optional()
        .isLength({ max: 100 }).withMessage('Location details cannot exceed 100 characters')
];

// Validate update inventory
const validateUpdateInventory = [
    param('id')
        .isInt().withMessage('Inventory ID must be an integer'),
    
    body('quantity')
        .optional()
        .isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
    
    body('minimum_quantity')
        .optional()
        .isInt({ min: 0 }).withMessage('Minimum quantity must be a non-negative integer'),
    
    body('maximum_quantity')
        .optional()
        .isInt({ min: 1 }).withMessage('Maximum quantity must be a positive integer'),
    
    body('location_details')
        .optional()
        .isLength({ max: 100 }).withMessage('Location details cannot exceed 100 characters')
];

// Validate inventory ID parameter
const validateInventoryId = [
    param('id')
        .isInt().withMessage('Inventory ID must be an integer')
];

// Validate inventory query parameters
const validateInventoryQuery = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    
    query('branch_id')
        .optional()
        .isInt().withMessage('Branch ID must be an integer'),
    
    query('product_id')
        .optional()
        .isInt().withMessage('Product ID must be an integer'),
    
    query('low_stock')
        .optional()
        .isBoolean().withMessage('low_stock must be a boolean'),
    
    query('search')
        .optional()
        .isString().withMessage('Search must be a string')
];

// Validate inventory adjustment
const validateAdjustInventory = [
    param('id')
        .isInt().withMessage('Inventory ID must be an integer'),
    
    body('adjustment')
        .notEmpty().withMessage('Adjustment value is required')
        .isInt().withMessage('Adjustment must be an integer'),
    
    body('type')
        .notEmpty().withMessage('Adjustment type is required')
        .isIn(['add', 'subtract', 'set']).withMessage('Invalid adjustment type'),
    
    body('reason')
        .optional()
        .isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters')
];

// Validate inventory transfer
const validateTransferInventory = [
    body('from_branch_id')
        .notEmpty().withMessage('Source branch ID is required')
        .isInt().withMessage('Source branch ID must be an integer'),
    
    body('to_branch_id')
        .notEmpty().withMessage('Destination branch ID is required')
        .isInt().withMessage('Destination branch ID must be an integer')
        .custom((value, { req }) => value !== req.body.from_branch_id)
        .withMessage('Source and destination branches must be different'),
    
    body('product_id')
        .notEmpty().withMessage('Product ID is required')
        .isInt().withMessage('Product ID must be an integer'),
    
    body('quantity')
        .notEmpty().withMessage('Quantity is required')
        .isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    
    body('notes')
        .optional()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
];

// Validate inventory count
const validateCountInventory = [
    param('id')
        .isInt().withMessage('Inventory ID must be an integer'),
    
    body('actual_quantity')
        .notEmpty().withMessage('Actual quantity is required')
        .isInt({ min: 0 }).withMessage('Actual quantity must be a non-negative integer'),
    
    body('notes')
        .optional()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
];

// Validate product and branch parameters
const validateProductAndBranch = [
    param('product_id')
        .isInt().withMessage('Product ID must be an integer'),
    
    param('branch_id')
        .isInt().withMessage('Branch ID must be an integer')
];

module.exports = {
    validateCreateInventory,
    validateUpdateInventory,
    validateInventoryId,
    validateInventoryQuery,
    validateAdjustInventory,
    validateTransferInventory,
    validateCountInventory,
    validateProductAndBranch
};