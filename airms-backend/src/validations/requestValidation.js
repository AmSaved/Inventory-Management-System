const { body, param, query } = require('express-validator');

const createRequestValidation = [
    body('request_type')
        .optional()
        .isIn(['new', 'return', 'transfer', 'maintenance']).withMessage('Invalid request type'),
    
    body('priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
    
    body('purpose')
        .optional()
        .isLength({ max: 1000 }).withMessage('Purpose cannot exceed 1000 characters'),
    
    body('expected_delivery_date')
        .optional()
        .isISO8601().withMessage('Invalid date format')
        .custom(value => new Date(value) > new Date())
        .withMessage('Expected delivery date must be in the future'),
    
    body('is_emergency')
        .optional()
        .isBoolean().withMessage('is_emergency must be a boolean'),
    
    body('notes')
        .optional()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
    
    body('items')
        .isArray().withMessage('Items must be an array')
        .notEmpty().withMessage('At least one item is required'),
    
    body('items.*.product_id')
        .isInt().withMessage('Product ID must be an integer'),
    
    body('items.*.quantity_requested')
        .isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    
    body('items.*.specifications')
        .optional()
        .isObject().withMessage('Specifications must be an object'),
    
    body('items.*.notes')
        .optional()
        .isString().withMessage('Notes must be a string')
];

const updateRequestValidation = [
    param('id')
        .isInt().withMessage('Request ID must be an integer'),
    
    body('request_type')
        .optional()
        .isIn(['new', 'return', 'transfer', 'maintenance']).withMessage('Invalid request type'),
    
    body('priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
    
    body('purpose')
        .optional()
        .isLength({ max: 1000 }).withMessage('Purpose cannot exceed 1000 characters'),
    
    body('expected_delivery_date')
        .optional()
        .isISO8601().withMessage('Invalid date format'),
    
    body('is_emergency')
        .optional()
        .isBoolean().withMessage('is_emergency must be a boolean'),
    
    body('notes')
        .optional()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
    
    body('items')
        .optional()
        .isArray().withMessage('Items must be an array'),
    
    body('items.*.product_id')
        .optional()
        .isInt().withMessage('Product ID must be an integer'),
    
    body('items.*.quantity_requested')
        .optional()
        .isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    
    body('items.*.specifications')
        .optional()
        .isObject().withMessage('Specifications must be an object')
];

const requestIdValidation = [
    param('id')
        .isInt().withMessage('Request ID must be an integer')
];

const requestNumberValidation = [
    param('request_number')
        .notEmpty().withMessage('Request number is required')
        .matches(/^REQ-\d{4}-\d{6}$/).withMessage('Invalid request number format')
];

const requestQueryValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    
    query('status')
        .optional()
        .isIn([
            'pending_chairman', 'rejected_chairman', 
            'pending_storage', 'rejected_storage', 
            'pending_discharge', 'approved', 'cancelled'
        ]).withMessage('Invalid status'),
    
    query('priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
    
    query('branch_id')
        .optional()
        .isInt().withMessage('Branch ID must be an integer'),
    
    query('requester_id')
        .optional()
        .isInt().withMessage('Requester ID must be an integer'),
    
    query('from_date')
        .optional()
        .isISO8601().withMessage('Invalid from_date format'),
    
    query('to_date')
        .optional()
        .isISO8601().withMessage('Invalid to_date format')
        .custom((value, { req }) => !req.query.from_date || new Date(value) >= new Date(req.query.from_date))
        .withMessage('to_date must be after from_date'),
    
    query('search')
        .optional()
        .isString().withMessage('Search must be a string')
];

const cancelRequestValidation = [
    param('id')
        .isInt().withMessage('Request ID must be an integer'),
    
    body('reason')
        .optional()
        .isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters')
];

module.exports = {
    createRequestValidation,
    updateRequestValidation,
    requestIdValidation,
    requestNumberValidation,
    requestQueryValidation,
    cancelRequestValidation
};