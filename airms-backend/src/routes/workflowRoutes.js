const express = require('express');
const router = express.Router();
const workflowController = require('../controllers/workflowController');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

router.use(authMiddleware);

router.get('/active', workflowController.getActiveConfiguration);

router.get('/', checkPermission('workflow:manage'), workflowController.getAll);
router.post('/', checkPermission('workflow:manage'), workflowController.create);
router.put('/:id', checkPermission('workflow:manage'), workflowController.update);
router.delete('/:id', checkPermission('workflow:manage'), workflowController.delete);

module.exports = router;
