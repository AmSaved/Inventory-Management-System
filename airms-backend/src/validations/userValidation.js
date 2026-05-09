const { body, param, query } = require('express-validator');

const createUserValidation = [
    body('employee_id')
        .notEmpty().withMessage('Employee ID is required')
        .isLength({ min: 1, max: 100 }).withMessage('Employee ID must be between 1 and 100 characters'),
    
    body('email')
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    
    body('password')
        .notEmpty().withMessage('Password is required'),
    
    body('first_name')
        .notEmpty().withMessage('First name is required'),
    
    body('last_name')
        .notEmpty().withMessage('Last name is required'),
    
    body('phone')
        .optional({ values: 'falsy' })
        .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/).withMessage('Invalid phone number format'),
    
    body('role_id')
        .optional({ values: 'falsy' })
        .isInt().withMessage('Role ID must be an integer'),
    
    body('org_node_id')
        .optional({ values: 'null' })
        .custom((value) => {
            if (value === '' || value === undefined) return true;
            if (isNaN(parseInt(value))) throw new Error('Organization node ID must be an integer');
            return true;
        }),
    
    body('is_active')
        .optional({ values: 'falsy' })
        .isBoolean().withMessage('is_active must be a boolean')
];

const updateUserValidation = [
    param('id')
        .isInt().withMessage('User ID must be an integer'),
    
    body('employee_id')
        .optional({ values: 'falsy' }),
    
    body('email')
        .optional({ values: 'falsy' })
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    
    body('first_name')
        .optional({ values: 'falsy' }),
    
    body('last_name')
        .optional({ values: 'falsy' }),
    
    body('phone')
        .optional({ values: 'falsy' })
        .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/).withMessage('Invalid phone number format'),
    
    body('role_id')
        .optional({ values: 'falsy' })
        .isInt().withMessage('Role ID must be an integer'),
    
    body('org_node_id')
        .optional({ values: 'null' })
        .custom((value) => {
            if (value === '' || value === undefined || value === null) return true;
            if (isNaN(parseInt(value))) throw new Error('Organization node ID must be an integer');
            return true;
        }),
    
    body('is_active')
        .optional({ values: 'falsy' })
        .isBoolean().withMessage('is_active must be a boolean')
];

const userIdValidation = [
    param('id')
        .isInt().withMessage('User ID must be an integer')
];

const userQueryValidation = [
    query('page')
        .optional({ values: 'falsy' })
        .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional({ values: 'falsy' })
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    
    query('search')
        .optional({ values: 'falsy' })
        .isString().withMessage('Search must be a string'),
    
    query('role_id')
        .optional()
        .isInt().withMessage('Role ID must be an integer'),
    
    query('org_node_id')
        .optional()
        .isInt().withMessage('Organization node ID must be an integer'),
    
    query('is_active')
        .optional()
        .isBoolean().withMessage('is_active must be a boolean')
];

const assignPermissionsValidation = [
    param('id')
        .isInt().withMessage('User ID must be an integer'),
    
    body('permission_ids')
        .isArray().withMessage('Permission IDs must be an array')
        .notEmpty().withMessage('Permission IDs cannot be empty'),
    
    body('permission_ids.*')
        .isInt().withMessage('Each permission ID must be an integer')
];

const bulkCreateUsersValidation = [
    body('users')
        .isArray().withMessage('Users must be an array')
        .notEmpty().withMessage('Users array cannot be empty'),
    
    body('users.*.employee_id')
        .notEmpty().withMessage('Employee ID is required for each user')
        .isLength({ min: 3, max: 50 }),
    
    body('users.*.email')
        .notEmpty().withMessage('Email is required for each user')
        .isEmail(),
    
    body('users.*.first_name')
        .notEmpty().withMessage('First name is required for each user'),
    
    body('users.*.last_name')
        .notEmpty().withMessage('Last name is required for each user')
];

module.exports = {
    createUserValidation,
    updateUserValidation,
    userIdValidation,
    userQueryValidation,
    assignPermissionsValidation,
    bulkCreateUsersValidation
};