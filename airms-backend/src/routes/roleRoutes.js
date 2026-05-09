const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { 
    createRoleValidation, 
    updateRoleValidation,
    assignPermissionsToRoleValidation 
} = require('../validations/roleValidation');

// All routes require authentication
router.use(authMiddleware);

// Role management routes
router.get('/', checkPermission('role:read'), roleController.getAll);
router.get('/:id', checkPermission('role:read'), roleController.getById);

// Legacy support & Permissions shortcut
router.get('/:id/permissions', checkPermission('role:read'), roleController.getById);

router.post('/', 
    checkPermission('role:create'), 
    validate(createRoleValidation), 
    roleController.create
);

router.put('/:id', 
    checkPermission('role:update'), 
    validate(updateRoleValidation), 
    roleController.update
);

router.delete('/:id', 
    checkPermission('role:delete'), 
    roleController.delete
);

router.post('/:id/template', 
    checkPermission('role:update'), 
    roleController.applyTemplate
);

router.post('/:id/permissions', 
    checkPermission('permission:assign'), 
    validate(assignPermissionsToRoleValidation), 
    roleController.getById // Stub for permission assignment
);

module.exports = router;