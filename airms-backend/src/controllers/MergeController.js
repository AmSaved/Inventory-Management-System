const mergeService = require('../services/MergeService');
const hierarchyService = require('../services/hierarchyService');
const { getEffectivePermissions } = require('../middleware/permissions');
const { OrganizationNode, OrganizationType } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

const MergeController = {
    /**
     * Get nodes for the company based on user's authority scope
     */
    async getAllNodes(req, res, next) {
        try {
            const permissions = await getEffectivePermissions(req.user);
            const allowedNodeIds = await hierarchyService.getAllowedNodes(req.user, permissions);

            const nodes = await OrganizationNode.findAll({
                where: { 
                    id: { [Op.in]: allowedNodeIds },
                    company_id: req.user.company_id,
                    status: { [Op.ne]: 'archived' }
                },
                include: [{ model: OrganizationType, as: 'type' }]
            });
            res.json({ success: true, data: nodes });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get preview of the merge impact.
     */
    async getPreview(req, res, next) {
        try {
            const { sourceNodeIds } = req.query;
            if (!sourceNodeIds || !Array.isArray(JSON.parse(sourceNodeIds))) {
                return res.status(400).json({ success: false, message: 'Invalid source node IDs' });
            }

            const ids = JSON.parse(sourceNodeIds);
            const stats = await mergeService.getMergePreview(ids, req.user.company_id);

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Execute the branch consolidation.
     */
    async execute(req, res, next) {
        try {
            const { sourceNodeIds, newBranchName, parent_id, org_type_id, code } = req.body;

            if (!sourceNodeIds || !Array.isArray(sourceNodeIds) || sourceNodeIds.length < 2) {
                return res.status(400).json({ success: false, message: 'Select at least two branches to merge' });
            }

            if (!newBranchName || !org_type_id || !code) {
                return res.status(400).json({ success: false, message: 'Missing required branch data' });
            }

            const newBranchData = {
                name: newBranchName,
                code,
                org_type_id,
                parent_id
            };

            const result = await mergeService.executeMerge(
                sourceNodeIds, 
                newBranchData, 
                req.user.company_id, 
                req.user
            );

            res.json({
                success: true,
                message: `Successfully consolidated ${sourceNodeIds.length} branches into ${newBranchName}`,
                data: result
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = MergeController;
