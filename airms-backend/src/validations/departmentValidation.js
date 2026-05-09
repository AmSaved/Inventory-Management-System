const { body, param, query } = require('express-validator');

const createDepartmentValidation = [
    body('name')
        .notEmpty().withMessage('Department name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Department name must be between 2 and 100 characters'),
    
    body('code')
        .notEmpty().withMessage('Department code is required')
        .isLength({ min: 2, max: 20 }).withMessage('Department code must be between 2 and 20 characters')
        .matches(/^[A-Z0-9.\-]+$/).withMessage('Department code can only contain uppercase letters, numbers, hyphens, and dots'),
    
    body('description')
        .optional({ values: 'falsy' })
        .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    
    body('is_active')
        .optional({ values: 'falsy' })
        .isBoolean().withMessage('is_active must be a boolean')
];

const updateDepartmentValidation = [
    param('id')
        .isInt().withMessage('Department ID must be an integer'),
    
    body('name')
        .optional({ values: 'falsy' })
        .isLength({ min: 2, max: 100 }).withMessage('Department name must be between 2 and 100 characters'),
    
    body('code')
        .optional({ values: 'falsy' })
        .isLength({ min: 2, max: 20 }).withMessage('Department code must be between 2 and 20 characters')
        .matches(/^[A-Z0-9.\-]+$/).withMessage('Department code can only contain uppercase letters, numbers, hyphens, and dots'),
    
    body('description')
        .optional({ values: 'falsy' })
        .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    
    body('is_active')
        .optional({ values: 'falsy' })
        .isBoolean().withMessage('is_active must be a boolean')
];

const departmentIdValidation = [
    param('id')
        .isInt().withMessage('Department ID must be an integer')
];

module.exports = {
    createDepartmentValidation,
    updateDepartmentValidation,
    departmentIdValidation
};
