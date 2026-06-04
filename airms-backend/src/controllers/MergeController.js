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

            // Safely resolve company_id — it can be undefined if the auth cache is stale
            const companyId = req.user.company_id || (
                allowedNodeIds.length > 0
                    ? (await OrganizationNode.findByPk(allowedNodeIds[0], { attributes: ['company_id'] }))?.company_id
                    : null
            );

            const whereClause = { 
                id: { [Op.in]: allowedNodeIds },
                status: { [Op.ne]: 'archived' }
            };
            if (companyId) whereClause.company_id = companyId;

            const nodes = await OrganizationNode.findAll({
                where: whereClause,
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

    async execute(req, res, next) {
        try {
            const { sourceNodeIds, targetNodeId, newBranchName, parent_id, org_type_id, code } = req.body;

            if (!sourceNodeIds || !Array.isArray(sourceNodeIds) || sourceNodeIds.length < 1) {
                return res.status(400).json({ success: false, message: 'Select at least one branch to merge' });
            }

            // 1. Fetch source nodes to verify organizational boundaries
            const sourceNodes = await OrganizationNode.findAll({
                where: { id: { [Op.in]: sourceNodeIds } }
            });

            if (sourceNodes.length !== sourceNodeIds.length) {
                return res.status(400).json({ success: false, message: 'One or more source branches were not found' });
            }

            const getRootId = (node) => {
                if (!node.path) return node.id;
                const parts = node.path.split('/').filter(Boolean);
                return parts.length > 0 ? parseInt(parts[0]) : node.id;
            };

            const firstRootId = getRootId(sourceNodes[0]);
            const sameRoot = sourceNodes.every(node => getRootId(node) === firstRootId);

            if (!sameRoot) {
                return res.status(400).json({ success: false, message: 'All source branches must belong to the same organization' });
            }

            if (targetNodeId) {
                if (sourceNodeIds.map(Number).includes(Number(targetNodeId))) {
                    return res.status(400).json({ success: false, message: 'Target branch cannot be one of the source branches' });
                }
                const targetNode = await OrganizationNode.findByPk(targetNodeId);
                if (!targetNode) {
                    return res.status(400).json({ success: false, message: 'Target branch not found' });
                }
                if (getRootId(targetNode) !== firstRootId) {
                    return res.status(400).json({ success: false, message: 'Target branch must belong to the same organization' });
                }
            } else {
                if (!newBranchName || !org_type_id || !code) {
                    return res.status(400).json({ success: false, message: 'Missing required branch data' });
                }
                if (!parent_id) {
                    return res.status(400).json({ success: false, message: 'Parent placement is required. You cannot create a root organization node from a merge.' });
                }
                const parentNode = await OrganizationNode.findByPk(parent_id);
                if (!parentNode) {
                    return res.status(400).json({ success: false, message: 'Parent branch not found' });
                }
                if (getRootId(parentNode) !== firstRootId) {
                    return res.status(400).json({ success: false, message: 'Parent branch must belong to the same organization' });
                }
            }

            // Resolve company_id — prefer user's own, fall back to the source node's company
            let companyId = req.user.company_id;
            if (!companyId) {
                const sourceNode = await OrganizationNode.findByPk(sourceNodeIds[0], {
                    attributes: ['company_id']
                });
                companyId = sourceNode?.company_id;
            }
            if (!companyId) {
                return res.status(400).json({ success: false, message: 'Unable to determine company context. Please re-login.' });
            }

            const newBranchData = targetNodeId ? {} : {
                name: newBranchName,
                code,
                org_type_id,
                parent_id: parent_id || null
            };

            const result = await mergeService.executeMerge(
                sourceNodeIds, 
                newBranchData, 
                companyId, 
                req.user,
                targetNodeId || null
            );

            res.json({
                success: true,
                message: `Successfully consolidated branches into ${result.name}`,
                data: result
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = MergeController;
