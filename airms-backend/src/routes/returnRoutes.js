const express = require('express');
const router = express.Router();
const returnController = require('../controllers/returnController');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission, checkAnyPermission } = require('../middleware/permissions');
const { 
    createReturnValidation, 
    processReturnValidation,
    rejectReturnValidation,
    cancelReturnValidation 
} = require('../validations/returnValidation');

// All routes require authentication
router.use(authMiddleware);

// Return management routes
router.get('/', checkPermission('return:view'), returnController.getAll);
router.get('/approvals', returnController.getApprovals);

// Legacy support & Hierarchical shortcuts
router.get('/statistics', checkPermission('return:view'), returnController.getAll);
router.get('/my-returns', checkPermission('return:view'), returnController.getAll);
router.get('/user/:user_id', checkPermission('return:view'), returnController.getAll);
router.get('/number/:return_number', checkPermission('return:view'), returnController.getAll);
router.get('/history/discharge', checkPermission('stock:return'), returnController.getDischargeHistory);

// ID-based lookup must be AFTER all static shortcut routes
router.get('/:id', checkPermission('return:view'), returnController.getById);

router.post('/', 
    checkPermission('return:request'), 
    validate(createReturnValidation), 
    returnController.create
);

router.post('/inventory',
    checkPermission('stock:return'),
    returnController.createInventoryReturn
);

router.post('/:id/process', 
    checkAnyPermission(['return:process', 'return:update', 'stock:return:approve']), 
    validate(processReturnValidation), 
    returnController.process
);

router.post('/:id/reject', 
    checkAnyPermission(['return:process', 'return:update', 'stock:return:reject']), 
    validate(rejectReturnValidation), 
    returnController.reject
);

router.post('/:id/cancel', 
    checkPermission('return:update'), 
    validate(cancelReturnValidation), 
    returnController.cancel
);

module.exports = router;