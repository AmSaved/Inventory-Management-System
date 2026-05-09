const reportService = require('../services/reportService');
const logger = require('../config/logger');

const reportController = {
    /**
     * Get report templates available for the company.
     */
    async getTemplates(req, res, next) {
        try {
            res.json({
                success: true,
                data: [
                    { id: 'inventory-valuation', name: 'Inventory Valuation' },
                    { id: 'asset-utilization', name: 'Asset Utilization' },
                    { id: 'low-stock', name: 'Low Stock Alert' },
                    { id: 'overdue-assets', name: 'Overdue Assets' }
                ]
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get inventory valuation report.
     */
    async inventoryValuation(req, res, next) {
        try {
            const { unit_id, format = 'json' } = req.query;
            const company_id = req.user.company_id;
            
            const data = await reportService.getInventoryValuation(company_id, unit_id);
            
            if (format === 'excel') {
                const workbook = await reportService.generateInventoryExcel(data);
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename=inventory-valuation.xlsx');
                await workbook.xlsx.write(res);
            } else {
                res.json({ success: true, data });
            }
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get asset utilization report.
     */
    async assetUtilization(req, res, next) {
        try {
            const { unit_id, from_date, to_date } = req.query;
            const company_id = req.user.company_id;
            
            const data = await reportService.getAssetUtilization(company_id, unit_id, from_date, to_date);
            res.json({ success: true, data });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Stubs for hierarchical report handlers that will be further refined in the next phase.
     */
    async lowStockReport(req, res, next) {
        try { res.json({ success: true, message: "Multi-tenant mapping active. Report logic refining.", data: [] }); } catch (e) { next(e); }
    },

    async overdueAssets(req, res, next) {
        try { res.json({ success: true, message: "Multi-tenant mapping active. Report logic refining.", data: [] }); } catch (e) { next(e); }
    },

    async requestAnalytics(req, res, next) {
        try { res.json({ success: true, message: "Multi-tenant mapping active. Report logic refining.", data: [] }); } catch (e) { next(e); }
    },

    async dischargeReport(req, res, next) {
        try { res.json({ success: true, message: "Multi-tenant mapping active. Report logic refining.", data: [] }); } catch (e) { next(e); }
    },

    async returnReport(req, res, next) {
        try { res.json({ success: true, message: "Multi-tenant mapping active. Report logic refining.", data: [] }); } catch (e) { next(e); }
    },

    async transferReport(req, res, next) {
        try { res.json({ success: true, message: "Multi-tenant mapping active. Report logic refining.", data: [] }); } catch (e) { next(e); }
    },

    async issueReport(req, res, next) {
        try { res.json({ success: true, message: "Multi-tenant mapping active. Report logic refining.", data: [] }); } catch (e) { next(e); }
    },

    async userActivityReport(req, res, next) {
        try { res.json({ success: true, message: "Multi-tenant mapping active. Report logic refining.", data: [] }); } catch (e) { next(e); }
    },

    async branchPerformance(req, res, next) {
        try { res.json({ success: true, message: "Multi-tenant mapping active. Report logic refining.", data: [] }); } catch (e) { next(e); }
    },

    async customReport(req, res, next) {
        try { res.json({ success: true, message: "Multi-tenant mapping active. Custom generation engine refactoring.", data: [] }); } catch (e) { next(e); }
    },

    async scheduleReport(req, res, next) {
        try { res.json({ success: true, message: "Report scheduler for the new hierarchy is initializing." }); } catch (e) { next(e); }
    }
};

module.exports = reportController;