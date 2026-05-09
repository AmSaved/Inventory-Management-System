const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { upload } = require('../middleware/upload');
const { 
    createProductValidation, 
    updateProductValidation,
    bulkImportValidation 
} = require('../validations/productValidation');

// All routes require authentication
router.use(authMiddleware);

// Product management routes
router.get('/', checkPermission(['product:read', 'request:create', 'item:request']), productController.getAll);
router.get('/categories', checkPermission(['product:read', 'request:create', 'item:request']), productController.getCategories);
router.get('/brands', checkPermission(['product:read', 'request:create', 'item:request']), productController.getBrands);
router.get('/:id', checkPermission(['product:read', 'request:create', 'item:request']), productController.getById);

// Legacy support & SKU/Barcode shortcuts
router.get('/sku/:sku', checkPermission('product:read'), productController.getAll);
router.get('/barcode/:barcode', checkPermission('product:read'), productController.getAll);

router.post('/', 
    checkPermission('product:create'), 
    validate(createProductValidation), 
    productController.create
);

router.post('/bulk-import', 
    checkPermission('product:create'), 
    upload.single('file'),
    validate(bulkImportValidation), 
    productController.getAll // Stub
);

router.put('/:id', 
    checkPermission('product:update'), 
    validate(updateProductValidation), 
    productController.update
);

router.delete('/:id', 
    checkPermission('product:delete'), 
    productController.delete
);

router.patch('/:id/toggle-status', 
    checkPermission('product:update'), 
    productController.toggleStatus
);

module.exports = router;