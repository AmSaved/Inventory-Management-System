const { body, param, query } = require('express-validator');

const createRoleValidation = [
    body('name')
        .notEmpty().withMessage('Role name is required')
        .isLength({ min: 1, max: 100 }).withMessage('Role name must be between 1 and 100 characters'),
    
    body('visibility_scope')
        .optional()
        .isIn(['own_node', 'sub_units', 'global']).withMessage('Invalid visibility scope'),
    
    body('description')
        .optional()
        .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    
    body('level')
        .optional()
        .isInt({ min: 0, max: 100 }).withMessage('Level must be between 0 and 100'),
    
    body('permission_ids')
        .optional()
        .isArray().withMessage('Permission IDs must be an array'),
    
    body('permission_ids.*')
        .optional()
        .isInt().withMessage('Each permission ID must be an integer')
];

const updateRoleValidation = [
    param('id')
        .isInt().withMessage('Role ID must be an integer'),
    
    body('name')
        .optional()
        .isLength({ min: 1, max: 100 }).withMessage('Role name must be between 1 and 100 characters'),
    
    body('visibility_scope')
        .optional()
        .isIn(['own_node', 'sub_units', 'global']).withMessage('Invalid visibility scope'),
    
    body('description')
        .optional()
        .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    
    body('level')
        .optional()
        .isInt({ min: 0, max: 100 }).withMessage('Level must be between 0 and 100')
];

const roleIdValidation = [
    param('id')
        .isInt().withMessage('Role ID must be an integer')
];

const assignPermissionsToRoleValidation = [
    param('id')
        .isInt().withMessage('Role ID must be an integer'),
    
    body('permission_ids')
        .isArray().withMessage('Permission IDs must be an array')
        .notEmpty().withMessage('Permission IDs cannot be empty'),
    
    body('permission_ids.*')
        .isInt().withMessage('Each permission ID must be an integer')
];

module.exports = {
    createRoleValidation,
    updateRoleValidation,
    roleIdValidation,
    assignPermissionsToRoleValidation
};