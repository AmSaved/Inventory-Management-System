const { body, param, query } = require('express-validator');

const createReturnValidation = [
    body('assignment_id')
        .notEmpty().withMessage('Assignment ID is required')
        .isInt().withMessage('Assignment ID must be an integer'),
    
    body('return_type')
        .optional()
        .isIn(['normal', 'damage', 'maintenance']).withMessage('Invalid return type'),
    
    body('notes')
        .optional()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
    
    body('items')
        .optional()
        .isArray().withMessage('Items must be an array'),
    
    body('items.*.product_id')
        .optional()
        .isInt().withMessage('Product ID must be an integer'),
    
    body('items.*.quantity')
        .optional()
        .isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    
    body('items.*.condition')
        .optional()
        .isIn(['good', 'used', 'damaged']).withMessage('Invalid condition')
];

const processReturnValidation = [
    param('id')
        .isInt().withMessage('Return ID must be an integer'),
    
    body('condition')
        .optional()
        .isIn(['good', 'used', 'damaged']).withMessage('Invalid condition'),
    
    body('notes')
        .optional()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
];

const rejectReturnValidation = [
    param('id')
        .isInt().withMessage('Return ID must be an integer'),
    
    body('reason')
        .notEmpty().withMessage('Rejection reason is required')
        .isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters')
];

const cancelReturnValidation = [
    param('id')
        .isInt().withMessage('Return ID must be an integer'),
    
    body('reason')
        .optional()
        .isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters')
];

const returnIdValidation = [
    param('id')
        .isInt().withMessage('Return ID must be an integer')
];

const returnNumberValidation = [
    param('return_number')
        .notEmpty().withMessage('Return number is required')
        .matches(/^RET-\d{4}-\d{6}$/).withMessage('Invalid return number format')
];

const returnQueryValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    
    query('branch_id')
        .optional()
        .isInt().withMessage('Branch ID must be an integer'),
    
    query('user_id')
        .optional()
        .isInt().withMessage('User ID must be an integer'),
    
    query('status')
        .optional()
        .isIn(['pending', 'completed', 'rejected', 'cancelled']).withMessage('Invalid status'),
    
    query('return_type')
        .optional()
        .isIn(['normal', 'damage', 'maintenance']).withMessage('Invalid return type'),
    
    query('from_date')
        .optional()
        .isISO8601().withMessage('Invalid from_date format'),
    
    query('to_date')
        .optional()
        .isISO8601().withMessage('Invalid to_date format')
];

module.exports = {
    createReturnValidation,
    processReturnValidation,
    rejectReturnValidation,
    cancelReturnValidation,
    returnIdValidation,
    returnNumberValidation,
    returnQueryValidation
};