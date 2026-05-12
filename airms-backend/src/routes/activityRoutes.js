const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission, checkHierarchyScope } = require('../middleware/permissions');

// Protect all activity routes with authentication
router.use(authMiddleware);

// Get recent activity logs
// Uses checkPermission with 'user:read' or a base level access to view logs
// checkHierarchyScope ensures they only pull data for their allowed nodes
router.get('/', checkPermission('user:read'), checkHierarchyScope, activityController.getRecentActivity);

module.exports = router;
