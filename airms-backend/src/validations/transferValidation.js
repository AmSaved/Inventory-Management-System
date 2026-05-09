const { body, param, query } = require('express-validator');

const createTransferValidation = [
    body('from_user_id')
        .optional()
        .isInt().withMessage('Source user ID must be an integer'),
    
    body('from_node_id')
        .optional()
        .isInt().withMessage('Source node ID must be an integer'),
    
    body('to_user_id')
        .optional()
        .isInt().withMessage('Destination user ID must be an integer'),
    
    body('to_node_id')
        .optional()
        .isInt().withMessage('Destination node ID must be an integer'),
    
    body('transfer_type')
        .notEmpty().withMessage('Transfer type is required')
        .isIn(['user_to_user', 'user_to_node', 'node_to_user', 'node_to_node'])
        .withMessage('Invalid transfer type'),
    
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
    
    body('items.*.condition')
        .optional()
        .isIn(['new', 'good', 'used', 'damaged']).withMessage('Invalid condition'),
    
    body().custom((value, { req }) => {
        const type = req.body.transfer_type;
        
        if (type === 'user_to_user' && (!req.body.from_user_id || !req.body.to_user_id)) {
            throw new Error('Both source and destination user IDs are required for user to user transfer');
        }
        if (type === 'user_to_node' && (!req.body.from_user_id || !req.body.to_node_id)) {
            throw new Error('Source user ID and destination node ID are required for user to node transfer');
        }
        if (type === 'node_to_user' && (!req.body.from_node_id || !req.body.to_user_id)) {
            throw new Error('Source node ID and destination user ID are required for node to user transfer');
        }
        if (type === 'node_to_node' && (!req.body.from_node_id || !req.body.to_node_id)) {
            throw new Error('Both source and destination node IDs are required for node to node transfer');
        }
        return true;
    })
];

const approveTransferValidation = [
    param('id')
        .isInt().withMessage('Transfer ID must be an integer'),
    
    body('notes')
        .optional()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
];

const executeTransferValidation = [
    param('id')
        .isInt().withMessage('Transfer ID must be an integer'),
    
    body('notes')
        .optional()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
];

const rejectTransferValidation = [
    param('id')
        .isInt().withMessage('Transfer ID must be an integer'),
    
    body('reason')
        .notEmpty().withMessage('Rejection reason is required')
        .isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters')
];

const cancelTransferValidation = [
    param('id')
        .isInt().withMessage('Transfer ID must be an integer'),
    
    body('reason')
        .optional()
        .isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters')
];

const transferIdValidation = [
    param('id')
        .isInt().withMessage('Transfer ID must be an integer')
];

const transferNumberValidation = [
    param('transfer_number')
        .notEmpty().withMessage('Transfer number is required')
        .matches(/^TRF-\d{4}-\d{6}$/).withMessage('Invalid transfer number format')
];

const transferQueryValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    
    query('from_node_id')
        .optional()
        .isInt().withMessage('Source node ID must be an integer'),
    
    query('to_node_id')
        .optional()
        .isInt().withMessage('Destination node ID must be an integer'),
    
    query('from_user_id')
        .optional()
        .isInt().withMessage('Source user ID must be an integer'),
    
    query('to_user_id')
        .optional()
        .isInt().withMessage('Destination user ID must be an integer'),
    
    query('transfer_type')
        .optional()
        .isIn(['user_to_user', 'user_to_node', 'node_to_user', 'node_to_node'])
        .withMessage('Invalid transfer type'),
    
    query('status')
        .optional()
        .isIn(['pending', 'approved', 'completed', 'rejected', 'cancelled'])
        .withMessage('Invalid status'),
    
    query('from_date')
        .optional()
        .isISO8601().withMessage('Invalid from_date format'),
    
    query('to_date')
        .optional()
        .isISO8601().withMessage('Invalid to_date format')
];

module.exports = {
    createTransferValidation,
    approveTransferValidation,
    executeTransferValidation,
    rejectTransferValidation,
    cancelTransferValidation,
    transferIdValidation,
    transferNumberValidation,
    transferQueryValidation
};