const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { 
    createUserValidation, 
    updateUserValidation,
    assignPermissionsValidation 
} = require('../validations/userValidation');

// All routes require authentication
router.use(authMiddleware);

// User management routes
router.get('/', checkPermission('user:read'), userController.getAll);
router.get('/:id', checkPermission('user:read'), userController.getById);
router.get('/:id/permissions', checkPermission('user:read'), userController.getUserPermissions);

// Legacy support
router.get('/branch/:branch_id', checkPermission('user:read'), userController.getAll);

router.post('/', 
    checkPermission('user:create'), 
    validate(createUserValidation), 
    userController.create
);

router.put('/:id', 
    checkPermission('user:update'), 
    validate(updateUserValidation), 
    userController.update
);

router.delete('/:id', 
    checkPermission('user:delete'), 
    userController.delete
);

router.patch('/:id/toggle-status', 
    checkPermission('user:update'), 
    userController.toggleStatus
);

router.post('/:id/permissions', 
    checkPermission('permission:assign'), 
    validate(assignPermissionsValidation), 
    userController.assignPermissions
);

module.exports = router;