const express = require('express');
const router = express.Router();
const workflowStatusController = require('../controllers/workflowStatusController');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

router.use(authMiddleware);

router.get('/', workflowStatusController.getAll);
router.post('/', checkPermission('workflow:manage'), workflowStatusController.create);
router.delete('/:id', checkPermission('workflow:manage'), workflowStatusController.delete);

module.exports = router;
