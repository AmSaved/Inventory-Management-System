const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission, checkAnyPermission } = require('../middleware/permissions');
const { branchScope } = require('../middleware/branchScope');
const { 
    createRequestValidation, 
    updateRequestValidation,
    cancelRequestValidation 
} = require('../validations/requestValidation');

// All routes require authentication
router.use(authMiddleware);

// Request management routes
router.get('/', checkPermission('request:read'), requestController.getAll);
router.get('/pending-approvals', checkPermission('request:read'), requestController.getPendingApprovals);
router.get('/:id', checkPermission('request:read'), requestController.getById);

// Legacy support & Hierarchical shortcuts
router.get('/status/:status', checkPermission('request:read'), requestController.getAll);
router.get('/statistics', checkPermission('request:read'), requestController.getAll);
router.get('/number/:request_number', checkPermission('request:read'), requestController.getAll);

router.post('/', 
    checkPermission('request:create'), 
    requestController.create
);

router.put('/:id', 
    checkPermission('request:update'), 
    validate(updateRequestValidation), 
    requestController.update
);

router.post('/:id/cancel', 
    checkPermission('request:update'), 
    validate(cancelRequestValidation), 
    requestController.cancel
);

router.post('/:id/workflow-action', 
    checkAnyPermission(['request:update', 'request:approve']), 
    requestController.processWorkflowAction
);

router.post('/:id/fulfill',
    checkPermission('request:update'), 
    requestController.fulfill
);

router.delete('/:id', 
    checkPermission('request:delete'), 
    requestController.getAll // Stub
);

module.exports = router;