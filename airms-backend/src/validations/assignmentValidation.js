const { body, param, query } = require('express-validator');

const createAssignmentValidation = [
    body('discharge_item_id')
        .optional()
        .isInt().withMessage('Discharge item ID must be an integer'),
    
    body('product_id')
        .notEmpty().withMessage('Product ID is required')
        .isInt().withMessage('Product ID must be an integer'),
    
    body('user_id')
        .notEmpty().withMessage('User ID is required')
        .isInt().withMessage('User ID must be an integer'),
    
    body('branch_id')
        .optional()
        .isInt().withMessage('Branch ID must be an integer'),
    
    body('serial_number')
        .optional()
        .isLength({ max: 100 }).withMessage('Serial number cannot exceed 100 characters'),
    
    body('expected_return_date')
        .optional()
        .isISO8601().withMessage('Invalid return date format')
        .custom(value => new Date(value) > new Date())
        .withMessage('Expected return date must be in the future'),
    
    body('condition_at_assignment')
        .optional()
        .isIn(['new', 'good', 'used', 'damaged']).withMessage('Invalid condition'),
    
    body('notes')
        .optional()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
];

const updateAssignmentValidation = [
    param('id')
        .isInt().withMessage('Assignment ID must be an integer'),
    
    body('expected_return_date')
        .optional()
        .isISO8601().withMessage('Invalid return date format'),
    
    body('condition_at_assignment')
        .optional()
        .isIn(['new', 'good', 'used', 'damaged']).withMessage('Invalid condition'),
    
    body('notes')
        .optional()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
];

const returnAssignmentValidation = [
    param('id')
        .isInt().withMessage('Assignment ID must be an integer'),
    
    body('condition')
        .optional()
        .isIn(['good', 'used', 'damaged']).withMessage('Invalid condition'),
    
    body('notes')
        .optional()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
];

const markLostValidation = [
    param('id')
        .isInt().withMessage('Assignment ID must be an integer'),
    
    body('notes')
        .optional()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
];

const assignmentIdValidation = [
    param('id')
        .isInt().withMessage('Assignment ID must be an integer')
];

const assignmentNumberValidation = [
    param('assignment_number')
        .notEmpty().withMessage('Assignment number is required')
        .matches(/^ASN-\d{4}-\d{6}$/).withMessage('Invalid assignment number format')
];

const assignmentQueryValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    
    query('user_id')
        .optional()
        .isInt().withMessage('User ID must be an integer'),
    
    query('branch_id')
        .optional()
        .isInt().withMessage('Branch ID must be an integer'),
    
    query('status')
        .optional()
        .isIn(['active', 'returned', 'lost', 'damaged', 'transferred']).withMessage('Invalid status'),
    
    query('product_id')
        .optional()
        .isInt().withMessage('Product ID must be an integer'),
    
    query('overdue')
        .optional()
        .isBoolean().withMessage('overdue must be a boolean')
];

module.exports = {
    createAssignmentValidation,
    updateAssignmentValidation,
    returnAssignmentValidation,
    markLostValidation,
    assignmentIdValidation,
    assignmentNumberValidation,
    assignmentQueryValidation
};