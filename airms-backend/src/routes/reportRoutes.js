const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { 
    dateRangeValidation,
    scheduleReportValidation 
} = require('../validations/reportValidation');

// All routes require authentication
router.use(authMiddleware);

// Report templates
router.get('/templates', checkPermission('report:view'), reportController.getTemplates);

// Inventory reports
router.get('/inventory-valuation', 
    checkPermission('report:view'), 
    validate(dateRangeValidation), 
    reportController.inventoryValuation
);

router.get('/low-stock', 
    checkPermission('report:view'), 
    reportController.lowStockReport
);

// Asset reports
router.get('/asset-utilization', 
    checkPermission('report:view'), 
    validate(dateRangeValidation), 
    reportController.assetUtilization
);

router.get('/overdue-assets', 
    checkPermission('report:view'), 
    reportController.overdueAssets
);

// Transaction reports
router.get('/request-analytics', 
    checkPermission('report:view'), 
    validate(dateRangeValidation), 
    reportController.requestAnalytics
);

router.get('/discharge-report', 
    checkPermission('report:view'), 
    validate(dateRangeValidation), 
    reportController.dischargeReport
);

router.get('/return-report', 
    checkPermission('report:view'), 
    validate(dateRangeValidation), 
    reportController.returnReport
);

router.get('/transfer-report', 
    checkPermission('report:view'), 
    validate(dateRangeValidation), 
    reportController.transferReport
);

router.get('/issue-report', 
    checkPermission('report:view'), 
    validate(dateRangeValidation), 
    reportController.issueReport
);

// User activity reports
router.get('/user-activity', 
    checkPermission('report:view'), 
    validate(dateRangeValidation), 
    reportController.userActivityReport
);

// Branch performance reports
router.get('/branch-performance', 
    checkPermission('report:view'), 
    validate(dateRangeValidation), 
    reportController.branchPerformance
);

// Custom report
router.post('/custom', 
    checkPermission('report:generate'), 
    reportController.customReport
);

// Scheduled reports
router.post('/schedule', 
    checkPermission('report:generate'), 
    validate(scheduleReportValidation), 
    reportController.scheduleReport
);

module.exports = router;