const express = require('express');
const router = express.Router();
const dischargeController = require('../controllers/dischargeController');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission, checkAnyPermission } = require('../middleware/permissions');
const { 
    createDischargeValidation, 
    executeDischargeValidation,
    approveDischargeValidation,
    rejectDischargeValidation 
} = require('../validations/dischargeValidation');

// All routes require authentication
router.use(authMiddleware);

// Discharge management routes
router.get('/', checkAnyPermission(['discharge:read', 'discharge:create', 'stock:discharge']), dischargeController.getAll);
router.get('/approvals', authMiddleware, dischargeController.getApprovals);
router.get('/:id', checkAnyPermission(['discharge:read', 'discharge:create', 'stock:discharge']), dischargeController.getById);

// Legacy support
router.get('/statistics', checkPermission('discharge:read'), dischargeController.getAll);
router.get('/branch/:branch_id', checkPermission('discharge:read'), dischargeController.getAll);
router.get('/user/:user_id', checkPermission('discharge:read'), dischargeController.getAll);
router.get('/number/:discharge_number', checkPermission('discharge:read'), dischargeController.getAll);

router.post('/', 
    checkAnyPermission(['discharge:create', 'stock:discharge']), 
    validate(createDischargeValidation), 
    dischargeController.create
);

router.post('/:id/approve', 
    checkPermission('discharge:execute'), 
    validate(approveDischargeValidation), 
    dischargeController.approve
);

router.post('/:id/execute', 
    checkPermission('discharge:execute'), 
    validate(executeDischargeValidation), 
    dischargeController.execute
);

router.post('/:id/reject', 
    checkPermission('discharge:execute'), 
    validate(rejectDischargeValidation), 
    dischargeController.reject
);

router.post('/:id/cancel', 
    checkPermission('discharge:update'), 
    dischargeController.cancel
);

module.exports = router;
