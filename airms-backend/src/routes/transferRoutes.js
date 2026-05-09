const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission, checkAnyPermission } = require('../middleware/permissions');
const { 
    createTransferValidation, 
    approveTransferValidation,
    executeTransferValidation,
    rejectTransferValidation,
    cancelTransferValidation 
} = require('../validations/transferValidation');

// All routes require authentication
router.use(authMiddleware);

// Transfer management routes
router.get('/', checkPermission('transfer:read'), transferController.getAll);
router.get('/approvals', authMiddleware, transferController.getApprovals);
router.get('/:id', checkPermission('transfer:read'), transferController.getById);

// Legacy support & Hierarchical shortcuts
router.get('/statistics', checkPermission('transfer:read'), transferController.getAll);
router.get('/user/:user_id', checkPermission('transfer:read'), transferController.getAll);
router.get('/branch/:branch_id', checkPermission('transfer:read'), transferController.getAll);
router.get('/number/:transfer_number', checkPermission('transfer:read'), transferController.getAll);

router.post('/', 
    checkPermission('transfer:request'), 
    validate(createTransferValidation), 
    transferController.create
);

router.post('/:id/approve', 
    checkAnyPermission(['transfer:approve', 'transfer:update']), 
    validate(approveTransferValidation), 
    transferController.approve
);

router.post('/:id/execute', 
    checkAnyPermission(['transfer:execute', 'transfer:update']), 
    validate(executeTransferValidation), 
    transferController.execute
);

router.post('/:id/reject', 
    checkAnyPermission(['transfer:approve', 'transfer:update']), 
    validate(rejectTransferValidation), 
    transferController.reject
);

router.post('/:id/cancel', 
    checkPermission('transfer:update'), 
    validate(cancelTransferValidation), 
    transferController.cancel
);

module.exports = router;