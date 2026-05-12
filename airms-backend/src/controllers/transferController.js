const { Transfer, TransferItem, User, OrganizationNode, Product, Inventory, Assignment, ActivityLog, sequelize, WorkflowStep, Role, Workflow } = require('../models');
const { validationResult } = require('express-validator');
const inventoryService = require('../services/inventoryService');
const hierarchyService = require('../services/hierarchyService');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const { getEffectivePermissions } = require('../middleware/permissions');
const workflowService = require('../services/workflowService');
const approvalService = require('../services/approvalService');

const transferController = {
    /**
     * Get all transfers scoped to company and user's organizational scope.
     */
    async getAll(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 10, 
                from_node_id, 
                to_node_id,
                from_user_id,
                to_user_id,
                transfer_type,
                status,
                from_date,
                to_date 
            } = req.query;
            
            const company_id = req.user.company_id;
            const where = { company_id };
            
            // Calculate field of vision based on Role Scope
            const permissions = await getEffectivePermissions(req.user);
            const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);

            // Hierarchical Scoping: Include both outgoing (from) and incoming (to) transfers
            if (from_node_id || to_node_id) {
                const targetNode = Number(from_node_id || to_node_id);
                if (!allowedNodes.includes(targetNode)) {
                    return res.status(403).json({ success: false, message: 'Access denied: Target node is outside your visibility scope' });
                }
                if (from_node_id) where.from_node_id = from_node_id;
                if (to_node_id) where.to_node_id = to_node_id;
            } else {
                // Default to any transfer involving an authorized node
                where[Op.or] = [
                    { from_node_id: { [Op.in]: allowedNodes } },
                    { to_node_id: { [Op.in]: allowedNodes } }
                ];
            }

            if (to_node_id) where.to_node_id = to_node_id;
            if (from_user_id) where.from_user_id = from_user_id;
            if (to_user_id) where.to_user_id = to_user_id;
            if (transfer_type) where.transfer_type = transfer_type;
            if (status) where.status = status;
            
            if (from_date || to_date) {
                where.created_at = {};
                if (from_date) where.created_at[Op.gte] = new Date(from_date);
                if (to_date) where.created_at[Op.lte] = new Date(to_date);
            }

            const offset = (page - 1) * limit;
            
            const { count, rows } = await Transfer.findAndCountAll({
                where,
                include: [
                    { model: User, as: 'fromUser', attributes: ['id', 'first_name', 'last_name'] },
                    { model: OrganizationNode, as: 'fromNode', attributes: ['id', 'name'] },
                    { model: User, as: 'toUser', attributes: ['id', 'first_name', 'last_name'] },
                    { model: OrganizationNode, as: 'toNode', attributes: ['id', 'name'] },
                    { model: User, as: 'requester', attributes: ['id', 'first_name', 'last_name'] },
                    {
                        model: WorkflowStep,
                        as: 'currentStep',
                        include: [
                            { model: Role, as: 'requiredRole' },
                            { model: Workflow, as: 'workflow', attributes: ['id', 'resource_type'] }
                        ]
                    }
                ],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['created_at', 'DESC']]
            });

            // ─── DYNAMIC AUTHORITY MAPPING (OPTIMIZED) ───
            // Reuse 'allowedNodes' and 'permissions' to avoid N+1 database queries
            const resultsWithAuth = await Promise.all(rows.map(async (row) => {
                const plain = row.get({ plain: true });
                const status = (plain.status || '').toLowerCase();
                const isActionable = status.startsWith('pending') || status === 'approved';
                
                plain.can_action = false;
                if (isActionable && plain.currentStep) {
                    // Pass pre-calculated 'permissions' and 'allowedNodes' to eliminate extra DB hits
                    plain.can_action = await workflowService.userCanApproveStep(req.user, row, plain.currentStep, permissions, allowedNodes);
                }
                
                return plain;
            }));

            res.json({
                success: true,
                data: resultsWithAuth,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    pages: Math.ceil(count / limit)
                }
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get transfers awaiting approval or visible for monitoring.
     */
    async getApprovals(req, res, next) {
        try {
            const company_id = req.user.company_id;
            const includeAll = req.query.all === 'true';
            
            // Note: transferTypeFilter is 'all' by default in the service
            const results = await approvalService.getTransferApprovals(company_id, req.user, 'all', includeAll);
            
            res.json({
                success: true,
                data: results
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Create a transfer request.
     */
    async create(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

            const { items, ...transferData } = req.body;
            const company_id = req.user.company_id;
            
            transferData.company_id = company_id;
            transferData.requested_by = req.user.id;
            transferData.status = 'pending';

            // Security Check: Both nodes must be in visibility scope
            const permissions = await getEffectivePermissions(req.user);
            let allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);

            // Scoped Expansion for Lateral Transfers:
            // If this is a node-to-node transfer, allow siblings of the source branch to be valid destinations
            if (transferData.transfer_type === 'node_to_node' && transferData.from_node_id) {
                const fromNode = await OrganizationNode.findByPk(transferData.from_node_id);
                if (fromNode && fromNode.parent_id) {
                    const siblings = await OrganizationNode.findAll({
                        where: { parent_id: fromNode.parent_id, company_id },
                        attributes: ['id']
                    });
                    const siblingIds = siblings.map(s => s.id);
                    allowedNodes = [...new Set([...allowedNodes, ...siblingIds])];
                }
            }

            if (transferData.from_node_id && !allowedNodes.includes(Number(transferData.from_node_id))) {
                return res.status(403).json({ success: false, message: 'Source node is outside your visibility scope' });
            }
            if (transferData.to_node_id && !allowedNodes.includes(Number(transferData.to_node_id))) {
                return res.status(403).json({ success: false, message: 'Destination node is outside your visibility scope' });
            }

            // Check availability for source
            if (transferData.from_node_id) {
                for (const item of items) {
                    const availability = await inventoryService.checkAvailability(company_id, transferData.from_node_id, item.product_id, item.quantity);
                    if (!availability.available) {
                        return res.status(400).json({ success: false, message: `Insufficient inventory for product ID ${item.product_id}` });
                    }
                }
            }

            const t = await sequelize.transaction();
            try {
                const transfer = await Transfer.create(transferData, { transaction: t });

                // Initialize dynamic workflow
                // We use 'inventory_transfer' for branch-to-branch moves
                const resourceType = transferData.transfer_type === 'node_to_node' ? 'inventory_transfer' : 'transfer';
                await workflowService.initializeWorkflow(transfer, resourceType, { transaction: t });

                if (items && items.length > 0) {
                    await Promise.all(items.map(item => TransferItem.create({
                        ...item,
                        transfer_id: transfer.id
                    }, { transaction: t })));
                }

                // If transfer was auto-approved (no workflow), execute immediately
                if (transfer.status === 'approved') {
                    await inventoryService.executeTransfer(transfer, req.user, { transaction: t });
                    await transfer.update({ 
                        status: 'completed', 
                        transfer_date: new Date() 
                    }, { transaction: t });
                }

                await t.commit();

                // Log Activity
                await ActivityLog.create({
                    company_id,
                    user_id: req.user.id,
                    action: 'CREATE',
                    resource: 'transfers',
                    resource_id: transfer.id,
                    details: { transfer_number: transfer.transfer_number },
                    ip_address: req.ip,
                    user_agent: req.get('User-Agent')
                });

                res.status(201).json({
                    success: true,
                    data: transfer
                });
            } catch (error) {
                await t.rollback();
                throw error;
            }
        } catch (error) {
            next(error);
        }
    },

    /**
     * Execute transfer (process inventory and update records).
     */
    async execute(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;

            const transfer = await Transfer.findOne({
                where: { id, company_id },
                include: ['items'],
                transaction: t
            });

            if (!transfer) throw new Error('Transfer not found');
            if (transfer.status !== 'approved') throw new Error('Transfer must be approved first');

            // For branch-to-branch, the workflow engine now handles this automatically.
            // This manual execution is for legacy or direct transfers.
            await inventoryService.executeTransfer(transfer, req.user, { transaction: t });

            await transfer.update({ status: 'completed', transfer_date: new Date() }, { transaction: t });

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'EXECUTE',
                resource: 'transfers',
                resource_id: id
            }, { transaction: t });

            await t.commit();
            res.json({ success: true, message: 'Transfer executed successfully' });
        } catch (error) {
            await t.rollback();
            next(error);
        }
    },

    /**
     * Approve transfer request.
     */
    async approve(req, res, next) {
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;

            const transfer = await Transfer.findOne({ where: { id, company_id } });
            if (!transfer) return res.status(404).json({ success: false, message: 'Transfer not found' });

            const resourceType = transfer.transfer_type === 'node_to_node' ? 'inventory_transfer' : 'transfer';
            const dynamicResult = await workflowService.advanceWorkflow(transfer, resourceType, req.user, req.body.comments || 'Step Approved');
            
            res.json({ 
                success: true, 
                message: dynamicResult.isFinalStep ? 'Transfer fully approved' : `Workflow moved to next step: ${transfer.workflow_status}`, 
                data: dynamicResult 
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get transfer record by ID.
     */
    async getById(req, res, next) {
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;
            
            const transfer = await Transfer.findOne({
                where: { id, company_id },
                include: [
                    { model: User, as: 'fromUser' },
                    { model: User, as: 'toUser' },
                    { model: OrganizationNode, as: 'fromNode' },
                    { model: OrganizationNode, as: 'toNode' },
                    { model: TransferItem, as: 'items', include: ['product'] },
                    {
                        model: WorkflowStep,
                        as: 'currentStep',
                        include: [{ model: Role, as: 'requiredRole' }]
                    }
                ]
            });

            if (!transfer) return res.status(404).json({ success: false, message: 'Not found' });
            
            // Scoping check for role reach
            const permissions = await getEffectivePermissions(req.user);
            const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
            if (!allowedNodes.includes(transfer.from_node_id) && !allowedNodes.includes(transfer.to_node_id)) {
                return res.status(403).json({ success: false, message: 'Access denied: Transfer is outside your visibility scope' });
            }
            
            res.json({ success: true, data: transfer });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Stubs for hierarchical transfer handlers.
     */
    async reject(req, res, next) {
        try { res.json({ success: true, message: "Transfer rejected." }); } catch (e) { next(e); }
    },

    async cancel(req, res, next) {
        try { res.json({ success: true, message: "Transfer cancelled." }); } catch (e) { next(e); }
    }
};

module.exports = transferController;