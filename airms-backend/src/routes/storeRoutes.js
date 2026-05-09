const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission, checkAnyPermission } = require('../middleware/permissions');
const { 
    createStoreValidation, 
    updateStoreValidation 
} = require('../validations/storeValidation');

// All routes require authentication
router.use(authMiddleware);

// Store management routes
router.get('/', checkAnyPermission(['store:read', 'stock:intake']), storeController.getAll);
router.get('/:id', checkAnyPermission(['store:read', 'stock:intake']), storeController.getById);

// Legacy support
router.get('/statistics', checkPermission('store:read'), storeController.getAll);
router.get('/branch/:branch_id', checkPermission('store:read'), storeController.getAll);
router.get('/number/:store_number', checkPermission('store:read'), storeController.getAll);

router.post('/', 
    checkAnyPermission(['store:create', 'stock:intake']), 
    validate(createStoreValidation), 
    storeController.create
);

router.post('/:id/approve', 
    checkAnyPermission(['store:create', 'stock:intake']), // Or a specialized permission if exists
    storeController.approve
);

router.put('/:id', 
    checkPermission('store:update'), 
    validate(updateStoreValidation), 
    storeController.getAll // Placeholder/Stub for update if not yet implemented
);

router.delete('/:id', 
    checkPermission('store:delete'), 
    storeController.delete
);

module.exports = router;
