const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { 
    createAssignmentValidation, 
    updateAssignmentValidation,
    returnAssignmentValidation,
    markLostValidation 
} = require('../validations/assignmentValidation');

// All routes require authentication
router.use(authMiddleware);

// Assignment management routes
router.get('/', checkPermission('assignment:view'), assignmentController.getAll);

// Legacy support & Hierarchical shortcuts
router.get('/overdue', checkPermission('assignment:view'), assignmentController.getAll);
router.get('/statistics', checkPermission('assignment:view'), assignmentController.getAll);
router.get('/my-assignments', checkPermission('assignment:view'), assignmentController.getAll);
router.get('/user/:user_id', checkPermission('assignment:view'), assignmentController.getAll);
router.get('/number/:assignment_number', checkPermission('assignment:view'), assignmentController.getAll);

// ID-based lookup must be placed AFTER all static shortcut routes to prevent parameter trapping
router.get('/:id', checkPermission('assignment:view'), assignmentController.getById);

// Assignment creation is typically automated via Discharge process. 
// Standard creation is redirected to getAll (stub) if used directly.
router.post('/', 
    checkPermission('assignment:update'), 
    validate(createAssignmentValidation), 
    assignmentController.getAll
);

router.put('/:id', 
    checkPermission('assignment:update'), 
    validate(updateAssignmentValidation), 
    assignmentController.update
);

// Returns are handled by returnRoutes/returnController
router.post('/:id/return', 
    checkPermission('assignment:update'), 
    validate(returnAssignmentValidation), 
    assignmentController.getAll
);

router.post('/:id/mark-lost', 
    checkPermission('assignment:update'), 
    validate(markLostValidation), 
    assignmentController.markLost
);

module.exports = router;