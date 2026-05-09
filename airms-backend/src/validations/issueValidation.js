const { body, param, query } = require('express-validator');

const createIssueValidation = [
    body('assignment_id')
        .optional()
        .isInt().withMessage('Assignment ID must be an integer'),
    
    body('product_id')
        .optional()
        .isInt().withMessage('Product ID must be an integer'),
    
    body('user_id')
        .optional()
        .isInt().withMessage('User ID must be an integer'),
    
    body('branch_id')
        .optional()
        .isInt().withMessage('Branch ID must be an integer'),
    
    body('issue_type')
        .notEmpty().withMessage('Issue type is required')
        .isIn(['damage', 'fault', 'lost', 'maintenance']).withMessage('Invalid issue type'),
    
    body('severity')
        .optional()
        .isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity'),
    
    body('description')
        .notEmpty().withMessage('Description is required')
        .isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
    
    body().custom((value, { req }) => {
        if (!req.body.assignment_id && !req.body.product_id) {
            throw new Error('Either assignment_id or product_id must be provided');
        }
        return true;
    })
];

const updateIssueValidation = [
    param('id')
        .isInt().withMessage('Issue ID must be an integer'),
    
    body('description')
        .optional()
        .isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
    
    body('severity')
        .optional()
        .isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity')
];

const assignIssueValidation = [
    param('id')
        .isInt().withMessage('Issue ID must be an integer'),
    
    body('assigned_to')
        .notEmpty().withMessage('Assignee ID is required')
        .isInt().withMessage('Assignee ID must be an integer'),
    
    body('notes')
        .optional()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
];

const resolveIssueValidation = [
    param('id')
        .isInt().withMessage('Issue ID must be an integer'),
    
    body('resolution_notes')
        .optional()
        .isLength({ max: 1000 }).withMessage('Resolution notes cannot exceed 1000 characters')
];

const closeIssueValidation = [
    param('id')
        .isInt().withMessage('Issue ID must be an integer'),
    
    body('closure_notes')
        .optional()
        .isLength({ max: 500 }).withMessage('Closure notes cannot exceed 500 characters')
];

const reopenIssueValidation = [
    param('id')
        .isInt().withMessage('Issue ID must be an integer'),
    
    body('reason')
        .optional()
        .isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters')
];

const issueIdValidation = [
    param('id')
        .isInt().withMessage('Issue ID must be an integer')
];

const issueNumberValidation = [
    param('issue_number')
        .notEmpty().withMessage('Issue number is required')
        .matches(/^ISS-\d{4}-\d{6}$/).withMessage('Invalid issue number format')
];

const issueQueryValidation = [
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
        .isIn(['open', 'in_progress', 'resolved', 'closed']).withMessage('Invalid status'),
    
    query('severity')
        .optional()
        .isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity'),
    
    query('issue_type')
        .optional()
        .isIn(['damage', 'fault', 'lost', 'maintenance']).withMessage('Invalid issue type'),
    
    query('from_date')
        .optional()
        .isISO8601().withMessage('Invalid from_date format'),
    
    query('to_date')
        .optional()
        .isISO8601().withMessage('Invalid to_date format')
];

module.exports = {
    createIssueValidation,
    updateIssueValidation,
    assignIssueValidation,
    resolveIssueValidation,
    closeIssueValidation,
    reopenIssueValidation,
    issueIdValidation,
    issueNumberValidation,
    issueQueryValidation
};