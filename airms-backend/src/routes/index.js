const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const roleRoutes = require('./roleRoutes');
const permissionRoutes = require('./permissionRoutes');
const organizationRoutes = require('./organizationRoutes');
const productRoutes = require('./productRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const requestRoutes = require('./requestRoutes');
const approvalRoutes = require('./approvalRoutes');
const storeRoutes = require('./storeRoutes');
const dischargeRoutes = require('./dischargeRoutes');
const assignmentRoutes = require('./assignmentRoutes');
const returnRoutes = require('./returnRoutes');
const transferRoutes = require('./transferRoutes');
const issueRoutes = require('./issueRoutes');
const workflowRoutes = require('./workflowRoutes');
const workflowStatusRoutes = require('./workflowStatusRoutes');
const reportRoutes = require('./reportRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const activityRoutes = require('./activityRoutes');
// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'AIRMS API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});

// API version
router.get('/version', (req, res) => {
    res.json({
        success: true,
        version: '1.0.0',
        name: 'AIRMS Backend API'
    });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/permissions', permissionRoutes);
router.use('/organization', organizationRoutes);
router.use('/products', productRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/requests', requestRoutes);
router.use('/approvals', approvalRoutes);
router.use('/store', storeRoutes);
router.use('/discharge', dischargeRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/returns', returnRoutes);
router.use('/transfers', transferRoutes);
router.use('/issues', issueRoutes);
router.use('/asset-issues', issueRoutes); // Healing Alias for legacy frontend paths
router.use('/workflows', workflowRoutes);
router.use('/workflow-statuses', workflowStatusRoutes);
router.use('/reports', reportRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/activity', activityRoutes);

module.exports = router;