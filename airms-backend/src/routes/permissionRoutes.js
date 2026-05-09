const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { 
    createPermissionValidation, 
    updatePermissionValidation 
} = require('../validations/permissionValidation');

// All routes require authentication
router.use(authMiddleware);

// Permission management routes
router.get('/', checkPermission('permission:read'), permissionController.getAll);
router.get('/resource/:resource', checkPermission('permission:read'), permissionController.getByResource);
router.get('/:id', checkPermission('permission:read'), permissionController.getById);

router.post('/', 
    checkPermission('permission:create'), 
    validate(createPermissionValidation), 
    permissionController.create
);

router.put('/:id', 
    checkPermission('permission:update'), 
    validate(updatePermissionValidation), 
    permissionController.update
);

router.delete('/:id', 
    checkPermission('permission:delete'), 
    permissionController.delete
);

module.exports = router;