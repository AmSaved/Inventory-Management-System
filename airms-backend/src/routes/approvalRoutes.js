const express = require('express');
const router = express.Router();
const approvalController = require('../controllers/approvalController');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { 
    approvalValidation,
    rejectionValidation 
} = require('../validations/approvalValidation');

// All routes require authentication
router.use(authMiddleware);

// Approval routes
router.get('/pending/:type', approvalController.getPendingByType);
router.get('/request/:request_id', checkPermission('request:read'), approvalController.getApprovalHistory);
router.get('/status/:request_id', checkPermission('request:read'), approvalController.checkApprovalStatus);

router.post('/:id/approve', 
    validate(approvalValidation), 
    approvalController.approve
);

router.post('/:id/reject', 
    validate(rejectionValidation), 
    approvalController.reject
);

module.exports = router;