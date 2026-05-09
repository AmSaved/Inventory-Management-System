const { body, param, query } = require('express-validator');

const createBranchValidation = [
    body('name')
        .notEmpty().withMessage('Branch name is required')
        .isLength({ min: 3, max: 100 }).withMessage('Branch name must be between 3 and 100 characters'),
    
    body('code')
        .notEmpty().withMessage('Branch code is required')
        .isLength({ min: 1, max: 100 }).withMessage('Branch code must be between 1 and 100 characters'),
    
    body('type')
        .optional({ values: 'falsy' })
        .isIn(['central', 'branch', 'warehouse']).withMessage('Invalid branch type'),
    
    body('address')
        .optional({ values: 'falsy' })
        .isLength({ max: 500 }).withMessage('Address cannot exceed 500 characters'),
    
    body('city')
        .optional({ values: 'falsy' })
        .isLength({ max: 100 }).withMessage('City cannot exceed 100 characters'),
    
    body('state')
        .optional({ values: 'falsy' })
        .isLength({ max: 50 }).withMessage('State cannot exceed 50 characters'),
    
    body('country')
        .optional({ values: 'falsy' })
        .isLength({ max: 50 }).withMessage('Country cannot exceed 50 characters'),
    
    body('phone')
        .optional({ values: 'falsy' })
        .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/).withMessage('Invalid phone number format'),
    
    body('email')
        .optional({ values: 'falsy' })
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    
    body('is_active')
        .optional({ values: 'falsy' })
        .isBoolean().withMessage('is_active must be a boolean'),
    
    body('parent_branch_id')
        .optional({ values: 'falsy' })
        .isInt().withMessage('Parent branch ID must be an integer')
];

const updateBranchValidation = [
    param('id')
        .isInt().withMessage('Branch ID must be an integer'),
    
    body('name')
        .optional({ values: 'falsy' })
        .isLength({ min: 3, max: 100 }).withMessage('Branch name must be between 3 and 100 characters'),
    
    body('code')
        .optional({ values: 'falsy' })
        .isLength({ min: 1, max: 100 }).withMessage('Branch code must be between 1 and 100 characters'),
    
    body('type')
        .optional({ values: 'falsy' })
        .isIn(['central', 'branch', 'warehouse']).withMessage('Invalid branch type'),
    
    body('address')
        .optional({ values: 'falsy' })
        .isLength({ max: 500 }).withMessage('Address cannot exceed 500 characters'),
    
    body('city')
        .optional({ values: 'falsy' })
        .isLength({ max: 100 }).withMessage('City cannot exceed 100 characters'),
    
    body('state')
        .optional({ values: 'falsy' })
        .isLength({ max: 50 }).withMessage('State cannot exceed 50 characters'),
    
    body('country')
        .optional({ values: 'falsy' })
        .isLength({ max: 50 }).withMessage('Country cannot exceed 50 characters'),
    
    body('phone')
        .optional({ values: 'falsy' })
        .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/).withMessage('Invalid phone number format'),
    
    body('email')
        .optional({ values: 'falsy' })
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    
    body('is_active')
        .optional({ values: 'falsy' })
        .isBoolean().withMessage('is_active must be a boolean'),
    
    body('parent_branch_id')
        .optional({ values: 'falsy' })
        .isInt().withMessage('Parent branch ID must be an integer')
];

const branchIdValidation = [
    param('id')
        .isInt().withMessage('Branch ID must be an integer')
];

const branchQueryValidation = [
    query('is_active')
        .optional({ values: 'falsy' })
        .isBoolean().withMessage('is_active must be a boolean'),
    
    query('type')
        .optional({ values: 'falsy' })
        .isIn(['central', 'branch', 'warehouse']).withMessage('Invalid branch type'),
    
    query('search')
        .optional({ values: 'falsy' })
        .isString().withMessage('Search must be a string')
];

module.exports = {
    createBranchValidation,
    updateBranchValidation,
    branchIdValidation,
    branchQueryValidation
};