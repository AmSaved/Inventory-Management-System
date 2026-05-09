const { body, param } = require('express-validator');

const approvalValidation = [
    param('id')
        .isInt().withMessage('Request ID must be an integer'),
    
    body('comments')
        .optional()
        .isLength({ max: 500 }).withMessage('Comments cannot exceed 500 characters')
];

const rejectionValidation = [
    param('id')
        .isInt().withMessage('Request ID must be an integer'),
    
    body('comments')
        .notEmpty().withMessage('Rejection reason is required')
        .isLength({ max: 500 }).withMessage('Comments cannot exceed 500 characters')
];

const approvalLevelValidation = [
    param('request_id')
        .isInt().withMessage('Request ID must be an integer')
];

module.exports = {
    approvalValidation,
    rejectionValidation,
    approvalLevelValidation
};