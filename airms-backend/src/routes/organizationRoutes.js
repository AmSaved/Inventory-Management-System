const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

// Types Management
router.get('/types', authMiddleware, organizationController.getTypes);
router.post('/types', authMiddleware, checkPermission('organization:manage'), organizationController.createType);
router.put('/types/:id', authMiddleware, checkPermission('organization:manage'), organizationController.updateType);
router.delete('/types/:id', authMiddleware, checkPermission('organization:manage'), organizationController.deleteType);

const MergeController = require('../controllers/MergeController');

// Nodes Management
router.get('/nodes', authMiddleware, organizationController.getNodes);
router.get('/nodes/tree', authMiddleware, organizationController.getNodeTree);
router.get('/nodes/merge/all', authMiddleware, checkPermission('organization:manage'), MergeController.getAllNodes);
router.get('/nodes/merge/preview', authMiddleware, checkPermission('organization:manage'), MergeController.getPreview);
router.post('/nodes/merge', authMiddleware, checkPermission('organization:manage'), MergeController.execute);
router.post('/nodes', authMiddleware, checkPermission('organization:manage'), organizationController.createNode);
router.get('/nodes/:id', authMiddleware, organizationController.getNodeById);
router.put('/nodes/:id', authMiddleware, checkPermission('organization:manage'), organizationController.updateNode);
router.patch('/nodes/:id/status', authMiddleware, checkPermission('organization:manage'), organizationController.toggleStatus);
router.delete('/nodes/:id', authMiddleware, checkPermission('organization:manage'), organizationController.deleteNode);

module.exports = router;
