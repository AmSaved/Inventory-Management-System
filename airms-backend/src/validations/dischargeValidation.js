const { body, param, query } = require('express-validator');

const createDischargeValidation = [
    body('from_node_id')
        .optional()
        .isInt().withMessage('Source node ID must be an integer'),
    
    body('request_id')
        .optional({ nullable: true, checkFalsy: true })
        .isInt().withMessage('Request ID must be an integer'),
    
    body('to_user_id')
        .optional()
        .isInt().withMessage('User ID must be an integer'),
    
    body('to_unit_id')
        .optional()
        .isInt().withMessage('Destination unit ID must be an integer'),
    
    body('discharge_type')
        .notEmpty().withMessage('Discharge type is required')
        .isIn(['user', 'unit', 'branch', 'department']).withMessage('Invalid discharge type'),
    
    body('notes')
        .optional()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
    
    body('items')
        .isArray().withMessage('Items must be an array')
        .notEmpty().withMessage('At least one item is required'),
    
    body('items.*.product_id')
        .isInt().withMessage('Product ID must be an integer'),
    
    body('items.*.quantity')
        .isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    
    body('items.*.serial_numbers')
        .optional()
        .isArray().withMessage('Serial numbers must be an array'),
    
    body('items.*.to_unit_id')
        .optional()
        .isInt().withMessage('Target unit ID in items must be an integer'),
    
    body('items.*.condition')
        .optional()
        .isIn(['new', 'good', 'used', 'damaged']).withMessage('Invalid condition'),
    
    body('items.*.notes')
        .optional()
        .isString().withMessage('Notes must be a string'),
    
    body().custom((value, { req }) => {
        if (req.body.discharge_type === 'user' && !req.body.to_user_id) {
            // Check items for user id if not at root
            const hasItemUser = req.body.items?.some(it => it.to_user_id);
            if (!hasItemUser) throw new Error('User ID is required for user discharge');
        }
        if (req.body.discharge_type === 'unit' && !req.body.to_unit_id) {
            // Check items for unit id if not at root
            const hasItemUnit = req.body.items?.some(it => it.to_unit_id);
            if (!hasItemUnit) throw new Error('Specify a Destination Unit at the root or per-item');
        }
        return true;
    })
];

const executeDischargeValidation = [
    param('id')
        .isInt().withMessage('Discharge form ID must be an integer'),
    
    body('notes')
        .optional()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
];

const approveDischargeValidation = [
    param('id')
        .isInt().withMessage('Discharge form ID must be an integer'),
    
    body('notes')
        .optional()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
];

const rejectDischargeValidation = [
    param('id')
        .isInt().withMessage('Discharge form ID must be an integer'),
    
    body('reason')
        .notEmpty().withMessage('Rejection reason is required')
        .isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters')
];

const dischargeIdValidation = [
    param('id')
        .isInt().withMessage('Discharge form ID must be an integer')
];

const dischargeNumberValidation = [
    param('discharge_number')
        .notEmpty().withMessage('Discharge number is required')
        .matches(/^DSC-\d{4}-\d{6}$/).withMessage('Invalid discharge number format')
];

const dischargeQueryValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    
    query('branch_id')
        .optional()
        .isInt().withMessage('Branch ID must be an integer'),
    
    query('status')
        .optional()
        .isIn(['pending', 'approved', 'completed', 'rejected', 'cancelled']).withMessage('Invalid status'),
    
    query('discharge_type')
        .optional()
        .isIn(['user', 'branch', 'department']).withMessage('Invalid discharge type'),
    
    query('from_date')
        .optional()
        .isISO8601().withMessage('Invalid from_date format'),
    
    query('to_date')
        .optional()
        .isISO8601().withMessage('Invalid to_date format')
];

module.exports = {
    createDischargeValidation,
    executeDischargeValidation,
    approveDischargeValidation,
    rejectDischargeValidation,
    dischargeIdValidation,
    dischargeNumberValidation,
    dischargeQueryValidation
};
