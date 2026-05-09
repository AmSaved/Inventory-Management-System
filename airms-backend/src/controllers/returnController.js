const { Return, ReturnItem, Assignment, User, OrganizationNode, Product, Inventory, ActivityLog, sequelize } = require('../models');
const { validationResult } = require('express-validator');
const inventoryService = require('../services/inventoryService');
const hierarchyService = require('../services/hierarchyService');
const workflowService = require('../services/workflowService');
const { Op } = require('sequelize');
const returnService = require('../services/returnService');
const approvalService = require('../services/approvalService');
const logger = require('../config/logger');
const { getEffectivePermissions } = require('../middleware/permissions');

const returnController = {
    /**
     * Smart Ledger: Get Returns needing approval
     */
    async getApprovals(req, res, next) {
        try {
            const { all, type } = req.query;
            const returns = await approvalService.getReturnApprovals(req.user.company_id, req.user, all === 'true', type);
            res.json({ success: true, data: returns });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get all return records scoped to company and user's organizational scope.
     */
    async getAll(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 10, 
                unit_id, 
                user_id,
                status,
                from_date,
                to_date 
            } = req.query;
            
            const company_id = req.user.company_id;
            const where = { company_id };

            // Calculate field of vision based on Role Scope
            const permissions = await getEffectivePermissions(req.user);
            const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);

            // Hierarchical Scoping
            if (unit_id) {
                // Verify specific node requested is within visibility scope
                if (!allowedNodes.includes(Number(unit_id))) {
                    return res.status(403).json({ success: false, message: 'Access denied: Target node is outside your visibility scope' });
                }
                where.to_node_id = unit_id;
            } else {
                // Default to all authorized nodes
                where.to_node_id = { [Op.in]: allowedNodes };
            }

            if (user_id) where.user_id = user_id;
            if (status) where.status = status;
            
            if (from_date || to_date) {
                where.created_at = {};
                if (from_date) where.created_at[Op.gte] = new Date(from_date);
                if (to_date) where.created_at[Op.lte] = new Date(to_date);
            }

            const offset = (page - 1) * limit;
            
            const { count, rows } = await Return.findAndCountAll({
                where,
                include: [
                    { model: User, as: 'user', attributes: ['id', 'first_name', 'last_name'] },
                    { model: User, as: 'receiver', attributes: ['id', 'first_name', 'last_name'] },
                    { model: OrganizationNode, as: 'fromNode', attributes: ['id', 'name'] },
                    { model: OrganizationNode, as: 'toNode', attributes: ['id', 'name'] },
                    { model: Assignment, as: 'assignment', include: ['product'] }
                ],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['created_at', 'DESC']]
            });

            res.json({
                success: true,
                data: rows,
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
     * Create a return request.
     */
    async create(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

            const { assignment_id, items, return_type, notes } = req.body;
            const company_id = req.user.company_id;

            const assignment = await Assignment.findOne({
                where: { id: assignment_id, company_id },
                include: ['product']
            });

            if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

            const returnRecord = await Return.create({
                company_id,
                assignment_id,
                user_id: req.user.id,
                from_node_id: assignment.org_node_id,
                to_node_id: assignment.org_node_id, 
                return_type: return_type || 'normal',
                status: 'pending',
                notes
            });

            // Initialize dynamic workflow
            await workflowService.initializeWorkflow(returnRecord, 'return');

            if (items && items.length > 0) {
                await Promise.all(items.map(item => ReturnItem.create({
                    ...item,
                    return_id: returnRecord.id
                })));
            }

            // Legacy direct creation
            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'CREATE',
                resource: 'returns',
                resource_id: returnRecord.id,
                details: { return_number: returnRecord.return_number }
            });

            res.status(201).json({ success: true, message: 'Return request created successfully (Ready for processing)', data: returnRecord });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Create an inventory-level return (Branch to Parent)
     */
    async createInventoryReturn(req, res, next) {
        try {
            const { from_node_id, to_node_id, items, request_id, notes } = req.body;
            const company_id = req.user.company_id;

            // Security: Check if user is authorized to initiate return for this node
            const permissions = await getEffectivePermissions(req.user);
            const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
            if (!allowedNodes.includes(Number(from_node_id))) {
                return res.status(403).json({ success: false, message: 'Access denied: Source node is outside your visibility scope' });
            }

            const returnRecord = await returnService.createInventoryReturn(
                { from_node_id, to_node_id, items, request_id, notes },
                company_id,
                req.user
            );

            // Initialize dynamic workflow
            await workflowService.initializeWorkflow(returnRecord, 'inventory_return');

            res.status(201).json({ success: true, message: 'Inventory return initiated successfully', data: returnRecord });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get items available for return from discharge history
     */
    async getDischargeHistory(req, res, next) {
        try {
            const { node_id } = req.query;
            const company_id = req.user.company_id;

            if (!node_id) return res.status(400).json({ success: false, message: 'node_id is required' });

            const history = await returnService.getDischargeHistoryForReturn(node_id, company_id);
            res.json({ success: true, data: history });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Process return (receive items back into inventory).
     */
    async process(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const { id } = req.params;
            const { condition } = req.body;
            const company_id = req.user.company_id;

            const returnRecord = await Return.findOne({
                where: { id, company_id },
                include: ['items', 'assignment'],
                transaction: t
            });

            if (!returnRecord) return res.status(404).json({ success: false, message: 'Return record not found' });
            
            // Advance dynamic workflow
            const advanceResult = await workflowService.advanceWorkflow(returnRecord, 'return', req.user, req.body.notes || 'Step approved');
            
            if (!advanceResult.isFinalStep) {
                await t.commit();
                return res.json({ 
                    success: true, 
                    message: `Workflow advanced: ${returnRecord.workflow_status || returnRecord.status}`, 
                    data: advanceResult 
                });
            }
            
            // If it IS the final step, continue to execution
            if (returnRecord.return_type === 'inventory') {
                // Bulk Inventory Logic
                await returnService.approveInventoryReturn(id, company_id, req.user.id);
            } else {
                // User Asset Logic (Legacy)
                await returnRecord.update({
                    status: 'completed',
                    received_by: req.user.id,
                    received_at: new Date()
                }, { transaction: t });

                if (returnRecord.assignment) {
                    await returnRecord.assignment.update({
                        status: 'returned',
                        condition_at_return: condition || returnRecord.assignment.condition_at_assignment,
                        actual_return_date: new Date()
                    }, { transaction: t });
                }

                for (const item of returnRecord.items) {
                    await inventoryService.addToInventory(
                        company_id,
                        returnRecord.to_node_id,
                        item.product_id,
                        item.quantity,
                        {
                            userId: req.user.id,
                            reference: `RETURN-${returnRecord.return_number}`,
                            transaction: t
                        }
                    );
                }
            }

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'PROCESS',
                resource: 'returns',
                resource_id: id
            }, { transaction: t });

            await t.commit();
            res.json({ success: true, message: 'Return finalized and inventory synchronized' });
        } catch (error) {
            if (t) await t.rollback();
            next(error);
        }
    },
    
    /**
     * Get return record by ID.
     */
    async getById(req, res, next) {
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;
            
            const returnRecord = await Return.findOne({
                where: { id, company_id },
                include: [
                    { model: User, as: 'user' },
                    { model: OrganizationNode, as: 'fromNode' },
                    { model: OrganizationNode, as: 'toNode' },
                    { model: ReturnItem, as: 'items', include: ['product'] }
                ]
            });

            if (!returnRecord) return res.status(404).json({ success: false, message: 'Not found' });

            // Scoping check for role reach
            const permissions = await getEffectivePermissions(req.user);
            const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
            if (!allowedNodes.includes(returnRecord.from_node_id) && !allowedNodes.includes(returnRecord.to_node_id)) {
                return res.status(403).json({ success: false, message: 'Access denied: Return record is outside your visibility scope' });
            }

            res.json({ success: true, data: returnRecord });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Reject return request
     */
    async reject(req, res, next) {
        try { 
            const { id } = req.params;
            const { reason } = req.body;
            const company_id = req.user.company_id;

            await returnService.rejectInventoryReturn(id, company_id, req.user.id, reason);
            res.json({ success: true, message: "Return rejected." }); 
        } catch (e) { 
            next(e); 
        }
    },

    async cancel(req, res, next) {
        try { 
            const { id } = req.params;
            await Return.update({ status: 'cancelled' }, { where: { id, company_id: req.user.company_id } });
            res.json({ success: true, message: "Return cancelled." }); 
        } catch (e) { 
            next(e); 
        }
    }
};

module.exports = returnController;