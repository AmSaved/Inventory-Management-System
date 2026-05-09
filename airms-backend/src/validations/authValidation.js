const { body } = require('express-validator');

const registerValidation = [
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
        .optional()
        .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/).withMessage('Invalid phone number format'),
    
    body('role_id')
        .optional()
        .isInt().withMessage('Role ID must be an integer'),
    
    body('branch_id')
        .optional()
        .isInt().withMessage('Branch ID must be an integer')
];

const loginValidation = [
    body('email')
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    
    body('password')
        .notEmpty().withMessage('Password is required')
];

const refreshTokenValidation = [
    body('refresh_token')
        .notEmpty().withMessage('Refresh token is required')
];

const changePasswordValidation = [
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

const forgotPasswordValidation = [
    body('email')
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail()
];

const resetPasswordValidation = [
    body('token')
        .notEmpty().withMessage('Token is required'),
    
    body('new_password')
        .notEmpty().withMessage('New password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/)
        .withMessage('Password must contain at least one letter, one number, and one special character')
];

const verifyEmailValidation = [
    body('token')
        .notEmpty().withMessage('Verification token is required')
];

module.exports = {
    registerValidation,
    loginValidation,
    refreshTokenValidation,
    changePasswordValidation,
    forgotPasswordValidation,
    resetPasswordValidation,
    verifyEmailValidation
};