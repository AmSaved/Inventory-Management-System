const { body, param, query } = require('express-validator');

const createPermissionValidation = [
    body('name')
        .notEmpty().withMessage('Permission name is required')
        .isLength({ min: 3, max: 100 }).withMessage('Permission name must be between 3 and 100 characters')
        .matches(/^[a-z:]+$/).withMessage('Permission name can only contain lowercase letters and colons'),
    
    body('resource')
        .notEmpty().withMessage('Resource is required')
        .isLength({ max: 50 }).withMessage('Resource cannot exceed 50 characters')
        .matches(/^[a-z_]+$/).withMessage('Resource can only contain lowercase letters and underscores'),
    
    body('action')
        .notEmpty().withMessage('Action is required')
        .isLength({ max: 20 }).withMessage('Action cannot exceed 20 characters')
        .matches(/^[a-z_]+$/).withMessage('Action can only contain lowercase letters and underscores'),
    
    body('description')
        .optional()
        .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters')
];

const updatePermissionValidation = [
    param('id')
        .isInt().withMessage('Permission ID must be an integer'),
    
    body('name')
        .optional()
        .isLength({ min: 3, max: 100 }).withMessage('Permission name must be between 3 and 100 characters')
        .matches(/^[a-z:]+$/).withMessage('Permission name can only contain lowercase letters and colons'),
    
    body('resource')
        .optional()
        .isLength({ max: 50 }).withMessage('Resource cannot exceed 50 characters')
        .matches(/^[a-z_]+$/).withMessage('Resource can only contain lowercase letters and underscores'),
    
    body('action')
        .optional()
        .isLength({ max: 20 }).withMessage('Action cannot exceed 20 characters')
        .matches(/^[a-z_]+$/).withMessage('Action can only contain lowercase letters and underscores'),
    
    body('description')
        .optional()
        .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters')
];

const permissionIdValidation = [
    param('id')
        .isInt().withMessage('Permission ID must be an integer')
];

const permissionQueryValidation = [
    query('resource')
        .optional()
        .isString().withMessage('Resource must be a string'),
    
    query('action')
        .optional()
        .isString().withMessage('Action must be a string')
];

module.exports = {
    createPermissionValidation,
    updatePermissionValidation,
    permissionIdValidation,
    permissionQueryValidation
};