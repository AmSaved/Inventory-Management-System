const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { 
    createInventoryValidation, 
    updateInventoryValidation,
    adjustInventoryValidation,
    transferInventoryValidation,
    countInventoryValidation
} = require('../validations/inventoryValidation');

// All routes require authentication
router.use(authMiddleware);

// Inventory aggregation routes (Hierarchy-aware)
router.get('/', checkPermission(['inventory:view', 'request:create']), inventoryController.getAll);
router.get('/low-stock', checkPermission('inventory:view'), inventoryController.getLowStock);
router.get('/availability', checkPermission('inventory:view'), inventoryController.getAvailability);
router.get('/:id', checkPermission('inventory:view'), inventoryController.getById);

// Legacy support mappings (Redirected to the unified lister)
router.get('/branch/:branch_id', checkPermission('inventory:view'), inventoryController.getAll);
router.get('/product/:product_id/branch/:branch_id', checkPermission('inventory:view'), inventoryController.getAll);

// Inventory mutation routes
router.post('/', 
    checkPermission('inventory:adjust'), 
    validate(createInventoryValidation), 
    inventoryController.create
);

router.put('/:id', 
    checkPermission('inventory:adjust'), 
    validate(updateInventoryValidation), 
    inventoryController.update
);

router.post('/:id/adjust', 
    checkPermission('inventory:adjust'), 
    validate(adjustInventoryValidation), 
    inventoryController.adjustQuantity
);

router.post('/:id/count', 
    checkPermission('inventory:adjust'), 
    validate(countInventoryValidation), 
    inventoryController.countInventory
);

router.post('/transfer', 
    checkPermission('inventory:adjust'), 
    validate(transferInventoryValidation), 
    inventoryController.transfer
);

router.post('/:id/split', 
    checkPermission('inventory:split'), 
    inventoryController.split
);

router.post('/merge', 
    checkPermission('inventory:merge'), 
    inventoryController.merge
);

router.post('/:id/decommission', 
    checkPermission('inventory:adjust'), 
    inventoryController.decommission
);

router.post('/bulk-delete', 
    checkPermission('inventory:adjust'), 
    inventoryController.bulkDelete
);

// Note: Direct deletion of inventory records is restricted to maintain hierarchical integrity.
// Adjust quantity to zero or mark as inactive via updates instead.
// router.delete('/:id', checkPermission('inventory:adjust'), inventoryController.delete);

module.exports = router;