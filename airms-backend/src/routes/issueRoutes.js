const express = require('express');
const router = express.Router();
const issueController = require('../controllers/issueController');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission, checkAnyPermission } = require('../middleware/permissions');
const { 
    createIssueValidation, 
    updateIssueValidation,
    assignIssueValidation,
    resolveIssueValidation,
    closeIssueValidation,
    reopenIssueValidation 
} = require('../validations/issueValidation');

// All routes require authentication
router.use(authMiddleware);

// Issue management routes
router.get('/', checkPermission('issue:view'), issueController.getAll);
router.get('/:id', checkPermission('issue:view'), issueController.getById);

// Legacy support & Hierarchical shortcuts
router.get('/statistics', checkPermission('issue:view'), issueController.getAll);
router.get('/my-issues', checkPermission('issue:view'), issueController.getAll);
router.get('/user/:user_id', checkPermission('issue:view'), issueController.getAll);
router.get('/assignment/:assignment_id', checkPermission('issue:view'), issueController.getAll);
router.get('/number/:issue_number', checkPermission('issue:view'), issueController.getAll);

router.post('/', 
    checkPermission('issue:report'), 
    validate(createIssueValidation), 
    issueController.create
);

router.put('/:id', 
    checkPermission('issue:update'), 
    validate(updateIssueValidation), 
    issueController.getAll // Stub
);

router.post('/:id/assign', 
    checkPermission('issue:resolve'), 
    validate(assignIssueValidation), 
    issueController.assign
);

router.post('/:id/resolve', 
    checkAnyPermission(['issue:resolve', 'issue:update']), 
    validate(resolveIssueValidation), 
    issueController.resolve
);

router.post('/:id/approve', 
    checkAnyPermission(['issue:resolve', 'issue:update']), 
    issueController.approve
);

router.post('/:id/close', 
    checkPermission('issue:resolve'), 
    validate(closeIssueValidation), 
    issueController.getAll // Stub
);

router.post('/:id/reopen', 
    checkPermission('issue:update'), 
    validate(reopenIssueValidation), 
    issueController.getAll // Stub
);

module.exports = router;