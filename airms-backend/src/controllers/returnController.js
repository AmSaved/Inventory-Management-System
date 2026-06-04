const { Return, ReturnItem, Assignment, User, OrganizationNode, Product, Inventory, ActivityLog, sequelize, Workflow, WorkflowStep, WorkflowStatus, Approval } = require('../models');
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
            const baseAllowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
            // Expand allowed nodes to include archived nodes that were merged into our branches
            const allowedNodes = await hierarchyService.expandWithMergedSources(baseAllowedNodes, company_id);

            // Hierarchical Scoping
            if (unit_id) {
                const targetUnitId = Number(unit_id);
                // Verify specific node requested is within visibility scope
                if (allowedNodes !== null && !allowedNodes.includes(targetUnitId)) {
                    return res.status(403).json({ success: false, message: 'Access denied: Target node is outside your visibility scope' });
                }
                where[Op.or] = [
                    { to_node_id: targetUnitId },
                    { from_node_id: targetUnitId }
                ];
            } else if (allowedNodes !== null) {
                // Default to all authorized nodes (including merged-source archived nodes)
                where[Op.or] = [
                    { to_node_id: { [Op.in]: allowedNodes } },
                    { from_node_id: { [Op.in]: allowedNodes } }
                ];
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
                    { model: Assignment, as: 'assignment', include: ['product'] },
                    { 
                        model: WorkflowStep, 
                        as: 'currentStep', 
                        include: [
                            { model: WorkflowStatus, as: 'statusLabel' },
                            { model: Workflow, as: 'workflow', attributes: ['id', 'resource_type'] }
                        ] 
                    }
                ],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['created_at', 'DESC']]
            });

            // Pre-compute user approvals and step lists to avoid N+1 queries when mapping
            const [authorizedStepIds, userApprovals] = await Promise.all([
                workflowService.getAuthorizedStepIds(company_id, req.user, permissions),
                Approval.findAll({ where: { approver_id: req.user.id }, raw: true })
            ]);

            const rowsWithCanAction = await Promise.all(rows.map(async (r) => {
                const plain = r.get({ plain: true });
                const currentStepId = plain.current_step_id ? Number(plain.current_step_id) : null;
                const isAuthorized = authorizedStepIds.map(Number).includes(currentStepId);

                if (plain.status !== 'pending' || !currentStepId || !isAuthorized) {
                    plain.can_action = false;
                } else {
                    plain.can_action = await workflowService.userCanApproveStep(req.user, plain, plain.currentStep, permissions, allowedNodes, userApprovals);
                }

                // Add Acknowledgment Check
                if (plain.status === 'pending_acknowledgment') {
                    const hasNodeAuthority = plain.to_node_id && (allowedNodes === null || allowedNodes.includes(Number(plain.to_node_id)));
                    plain.can_acknowledge = !!hasNodeAuthority;
                } else {
                    plain.can_acknowledge = false;
                }

                return plain;
            }));

            res.json({
                success: true,
                data: rowsWithCanAction,
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

            // Find the parent node of the branch as the target receiving branch X
            const branch = await OrganizationNode.findByPk(assignment.org_node_id);
            const parentNodeId = (branch && branch.parent_id) ? branch.parent_id : assignment.org_node_id;

            const returnRecord = await Return.create({
                company_id,
                assignment_id,
                user_id: req.user.id,
                from_node_id: assignment.org_node_id,
                to_node_id: parentNodeId, 
                return_type: return_type || 'normal',
                status: 'pending',
                notes
            });

            // Initialize dynamic workflow based on return type
            const workflowResourceType = (return_type === 'inventory' || returnRecord.return_type === 'inventory') ? 'inventory_return' : 'return';
            await workflowService.initializeWorkflow(returnRecord, workflowResourceType);

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
            if (allowedNodes !== null && !allowedNodes.includes(Number(from_node_id))) {
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
     * Process return (advance workflow step).
     */
    async process(req, res, next) {
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;

            const returnRecord = await Return.findOne({
                where: { id, company_id },
                include: ['items', 'assignment']
            });

            if (!returnRecord) return res.status(404).json({ success: false, message: 'Return record not found' });
            
            // Advance dynamic workflow
            const workflowResourceType = returnRecord.return_type === 'inventory' ? 'inventory_return' : 'return';
            const advanceResult = await workflowService.advanceWorkflow(returnRecord, workflowResourceType, req.user, req.body.notes || 'Step approved');
            
            const { isFinalStep } = advanceResult;
            
            res.json({ 
                success: true, 
                message: `Workflow advanced successfully`,
                data: {
                    id: returnRecord.id,
                    status: returnRecord.status,
                    workflow_status: returnRecord.workflow_status,
                    current_step_id: returnRecord.current_step_id,
                    is_final_step: isFinalStep
                }
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Acknowledge physical receipt of a return (destination branch receiver restocks items).
     */
    async acknowledge(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const { id } = req.params;
            const { condition } = req.body || {};
            const company_id = req.user.company_id;

            const returnRecord = await Return.findOne({
                where: { id, company_id },
                include: ['items', 'assignment'],
                transaction: t
            });

            if (!returnRecord) {
                await t.rollback();
                return res.status(404).json({ success: false, message: 'Return record not found' });
            }
            if (returnRecord.status !== 'pending_acknowledgment') {
                await t.rollback();
                return res.status(400).json({ success: false, message: 'Return is not in pending_acknowledgment state' });
            }

            const permissions = req.userPermissions || await getEffectivePermissions(req.user);
            const allowedNodes = req.getAuthorizedNodes 
                ? await req.getAuthorizedNodes() 
                : await hierarchyService.getAllowedNodes(req.user, permissions);
            const hasNodeAuthority = returnRecord.to_node_id && (allowedNodes === null || allowedNodes.includes(Number(returnRecord.to_node_id)));

            if (!hasNodeAuthority) {
                await t.rollback();
                return res.status(403).json({ success: false, message: 'Only authorized personnel for the receiving branch can acknowledge this return.' });
            }

            // Execute physical inventory restock
            if (returnRecord.return_type === 'inventory') {
                // Must commit the current transaction because approveInventoryReturn manages its own transaction
                await t.commit();
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

                let inventoryItem = null;
                if (returnRecord.assignment) {
                    inventoryItem = await Inventory.findOne({
                        where: {
                            company_id,
                            [Op.or]: [
                                { id: returnRecord.assignment.inventory_id || 0 },
                                { serial_number: returnRecord.assignment.serial_number }
                            ]
                        },
                        transaction: t
                    });
                }

                if (inventoryItem) {
                    await inventoryItem.update({
                        status: 'available',
                        assigned_to: null,
                        assigned_at: null,
                        org_node_id: returnRecord.to_node_id,
                        condition: condition || inventoryItem.condition
                    }, { transaction: t });
                } else {
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
                    action: 'ACKNOWLEDGE',
                    resource: 'returns',
                    resource_id: id,
                    details: { message: 'Recipient acknowledged physical receipt of returned items.' }
                }, { transaction: t });

                await t.commit();
            }

            res.json({ success: true, message: 'Return receipt acknowledged and items restocked' });
        } catch (error) {
            try { await t.rollback(); } catch (e) {}
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
                    { model: ReturnItem, as: 'items', include: ['product'] },
                    { model: Assignment, as: 'assignment', include: ['product'] }
                ]
            });

            if (!returnRecord) return res.status(404).json({ success: false, message: 'Not found' });

            // Scoping check for role reach — also follow merged_into chain so that
            // users on the consolidated branch can view records from source branches
            const permissions = await getEffectivePermissions(req.user);
            const baseAllowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
            const allowedNodes = await hierarchyService.expandWithMergedSources(baseAllowedNodes, company_id);
            
            const isAuthorized = allowedNodes === null || 
                                 allowedNodes.includes(Number(returnRecord.from_node_id)) || 
                                 allowedNodes.includes(Number(returnRecord.to_node_id));
                                 
            if (!isAuthorized) {
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