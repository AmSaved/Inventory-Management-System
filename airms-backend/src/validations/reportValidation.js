const { body, query } = require('express-validator');

const dateRangeValidation = [
    query('from_date')
        .optional()
        .isISO8601().withMessage('Invalid from_date format'),
    
    query('to_date')
        .optional()
        .isISO8601().withMessage('Invalid to_date format')
        .custom((value, { req }) => {
            if (req.query.from_date && new Date(value) < new Date(req.query.from_date)) {
                throw new Error('to_date must be after from_date');
            }
            return true;
        }),
    
    query('branch_id')
        .optional()
        .isInt().withMessage('Branch ID must be an integer'),
    
    query('format')
        .optional()
        .isIn(['json', 'excel', 'pdf', 'csv']).withMessage('Invalid export format')
];

const scheduleReportValidation = [
    body('report_type')
        .notEmpty().withMessage('Report type is required')
        .isIn([
            'inventory-valuation',
            'asset-utilization',
            'request-analytics',
            'discharge-report',
            'return-report',
            'transfer-report',
            'issue-report',
            'user-activity',
            'branch-performance',
            'low-stock',
            'overdue-assets'
        ]).withMessage('Invalid report type'),
    
    body('schedule')
        .notEmpty().withMessage('Schedule is required')
        .isIn(['daily', 'weekly', 'monthly', 'quarterly']).withMessage('Invalid schedule'),
    
    body('recipients')
        .isArray().withMessage('Recipients must be an array')
        .notEmpty().withMessage('At least one recipient is required'),
    
    body('recipients.*')
        .isEmail().withMessage('Invalid email format'),
    
    body('format')
        .optional()
        .isIn(['excel', 'pdf', 'csv']).withMessage('Invalid export format'),
    
    body('filters')
        .optional()
        .isObject().withMessage('Filters must be an object')
];

const customReportValidation = [
    body('report_type')
        .notEmpty().withMessage('Report type is required'),
    
    body('filters')
        .optional()
        .isObject().withMessage('Filters must be an object'),
    
    body('format')
        .optional()
        .isIn(['json', 'excel', 'pdf', 'csv']).withMessage('Invalid export format')
];

module.exports = {
    dateRangeValidation,
    scheduleReportValidation,
    customReportValidation
};