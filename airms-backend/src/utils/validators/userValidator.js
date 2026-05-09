const { body, param, query } = require('express-validator');

// Validate user creation
const validateCreateUser = [
    body('employee_id')
        .notEmpty().withMessage('Employee ID is required')
        .isLength({ min: 3, max: 50 }).withMessage('Employee ID must be between 3 and 50 characters')
        .matches(/^[A-Z0-9-]+$/).withMessage('Employee ID can only contain uppercase letters, numbers, and hyphens'),
    
    body('email')
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    
    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/)
        .withMessage('Password must contain at least one letter, one number, and one special character'),
    
    body('first_name')
        .notEmpty().withMessage('First name is required')
        .isLength({ max: 50 }).withMessage('First name cannot exceed 50 characters')
        .matches(/^[a-zA-Z\s]+$/).withMessage('First name can only contain letters and spaces'),
    
    body('last_name')
        .notEmpty().withMessage('Last name is required')
        .isLength({ max: 50 }).withMessage('Last name cannot exceed 50 characters')
        .matches(/^[a-zA-Z\s]+$/).withMessage('Last name can only contain letters and spaces'),
    
    body('phone')
        .optional()
        .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/).withMessage('Invalid phone number format'),
    
    body('role_id')
        .optional()
        .isInt().withMessage('Role ID must be an integer'),
    
    body('branch_id')
        .optional()
        .isInt().withMessage('Branch ID must be an integer'),
    
    body('is_active')
        .optional()
        .isBoolean().withMessage('is_active must be a boolean')
];

// Validate user update
const validateUpdateUser = [
    param('id')
        .isInt().withMessage('User ID must be an integer'),
    
    body('employee_id')
        .optional()
        .isLength({ min: 3, max: 50 }).withMessage('Employee ID must be between 3 and 50 characters')
        .matches(/^[A-Z0-9-]+$/).withMessage('Employee ID can only contain uppercase letters, numbers, and hyphens'),
    
    body('email')
        .optional()
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    
    body('first_name')
        .optional()
        .isLength({ max: 50 }).withMessage('First name cannot exceed 50 characters')
        .matches(/^[a-zA-Z\s]+$/).withMessage('First name can only contain letters and spaces'),
    
    body('last_name')
        .optional()
        .isLength({ max: 50 }).withMessage('Last name cannot exceed 50 characters')
        .matches(/^[a-zA-Z\s]+$/).withMessage('Last name can only contain letters and spaces'),
    
    body('phone')
        .optional()
        .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/).withMessage('Invalid phone number format'),
    
    body('role_id')
        .optional()
        .isInt().withMessage('Role ID must be an integer'),
    
    body('branch_id')
        .optional()
        .isInt().withMessage('Branch ID must be an integer'),
    
    body('is_active')
        .optional()
        .isBoolean().withMessage('is_active must be a boolean')
];

// Validate user ID parameter
const validateUserId = [
    param('id')
        .isInt().withMessage('User ID must be an integer')
];

// Validate user query parameters
const validateUserQuery = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    
    query('search')
        .optional()
        .isString().withMessage('Search must be a string'),
    
    query('role_id')
        .optional()
        .isInt().withMessage('Role ID must be an integer'),
    
    query('branch_id')
        .optional()
        .isInt().withMessage('Branch ID must be an integer'),
    
    query('is_active')
        .optional()
        .isBoolean().withMessage('is_active must be a boolean')
];

// Validate password change
const validatePasswordChange = [
    param('id')
        .isInt().withMessage('User ID must be an integer'),
    
    body('current_password')
        .notEmpty().withMessage('Current password is required'),
    
    body('new_password')
        .notEmpty().withMessage('New password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/)
        .withMessage('Password must contain at least one letter, one number, and one special character')
        .custom((value, { req }) => value !== req.body.current_password)
        .withMessage('New password must be different from current password')
];

// Validate user permissions assignment
const validateAssignPermissions = [
    param('id')
        .isInt().withMessage('User ID must be an integer'),
    
    body('permission_ids')
        .isArray().withMessage('Permission IDs must be an array')
        .notEmpty().withMessage('Permission IDs cannot be empty'),
    
    body('permission_ids.*')
        .isInt().withMessage('Each permission ID must be an integer')
];

module.exports = {
    validateCreateUser,
    validateUpdateUser,
    validateUserId,
    validateUserQuery,
    validatePasswordChange,
    validateAssignPermissions
};