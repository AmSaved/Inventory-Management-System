const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

// All routes require authentication
router.use(authMiddleware);

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get unified statistics for the user's current organizational scope
 * @access  Private (dashboard:*)
 */
router.get('/stats', 
    checkPermission('dashboard'), 
    dashboardController.getDashboardStats
);

/**
 * @route   GET /api/dashboard/user
 * @desc    Get personal dashboard for the logged-in user
 * @access  Private (Authenticated)
 */
router.get('/user', dashboardController.getUserDashboard);

// ============================================
// Legacy Mapping (For Backward Compatibility)
// ============================================
router.get('/executive', checkPermission('dashboard'), dashboardController.getDashboardStats);
router.get('/chairman', checkPermission('dashboard'), dashboardController.getDashboardStats);
router.get('/storage', checkPermission('dashboard'), dashboardController.getDashboardStats);
router.get('/branch/:branch_id?', checkPermission('dashboard'), dashboardController.getDashboardStats);
router.get('/analytics', checkPermission('dashboard'), dashboardController.getDashboardStats);

module.exports = router;