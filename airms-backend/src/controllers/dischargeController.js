const { DischargeForm, DischargeItem, Assignment, Request, User, OrganizationNode, Product, Inventory, ActivityLog, WorkflowStep, Approval, Role, Workflow, sequelize } = require('../models');
const { validationResult } = require('express-validator');
const inventoryService = require('../services/inventoryService');
const barcodeService = require('../services/barcodeService');
const hierarchyService = require('../services/hierarchyService');
const workflowService = require('../services/workflowService');
const approvalService = require('../services/approvalService');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const { getEffectivePermissions } = require('../middleware/permissions');

const dischargeController = {
    /**
     * Get all discharge forms scoped to company and user's organizational scope.
     */
    async getAll(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 10, 
                node_id, 
                status,
                discharge_type,
                from_date,
                to_date,
                search
            } = req.query;
            
            const company_id = req.user.company_id;
            const where = { company_id };

            const permissions = await getEffectivePermissions(req.user);
            const offset = (page - 1) * limit;
            const baseAllowedNodes = req.getAuthorizedNodes ? await req.getAuthorizedNodes() : await hierarchyService.getAllowedNodes(req.user, permissions);
            // Expand to include archived nodes merged into our allowed branches
            const allowedNodes = await hierarchyService.expandWithMergedSources(baseAllowedNodes, company_id);

            // Hierarchical Scoping: show discharges where the user is SOURCE *or* TARGET branch
            if (node_id) {
                const targetNodeId = Number(node_id);
                if (allowedNodes !== null && !allowedNodes.includes(targetNodeId)) {
                    return res.status(403).json({ success: false, message: 'Access denied: Targeted node is outside your visibility scope' });
                }
                const nodeIds = await hierarchyService.getDescendants(targetNodeId);
                // Show forms where this node is either the source OR the destination
                where[Op.or] = [
                    { from_node_id: { [Op.in]: nodeIds } },
                    { to_node_id: { [Op.in]: nodeIds } }
                ];
            } else if (allowedNodes !== null) {
                // Show forms where user's allowed nodes (incl. merged sources) appear as source OR destination
                where[Op.or] = [
                    { from_node_id: { [Op.in]: allowedNodes } },
                    { to_node_id: { [Op.in]: allowedNodes } }
                ];
            }

            if (status) where.status = status;
            if (discharge_type) where.discharge_type = discharge_type;
            
            if (search) {
                // Use Op.and so this doesn't overwrite the node-visibility Op.or above
                where[Op.and] = where[Op.and] || [];
                where[Op.and].push({
                    [Op.or]: [
                        { discharge_number: { [Op.like]: `%${search}%` } },
                        { status: { [Op.like]: `%${search}%` } },
                        { discharge_type: { [Op.like]: `%${search}%` } }
                    ]
                });
            }
            
            if (from_date || to_date) {
                where.created_at = {};
                if (from_date) where.created_at[Op.gte] = new Date(from_date);
                if (to_date) where.created_at[Op.lte] = new Date(to_date);
            }

            const { count, rows } = await DischargeForm.findAndCountAll({
                where,
                include: [
                    { model: OrganizationNode, as: 'fromNode', attributes: ['id', 'name', 'code'] },
                    { model: OrganizationNode, as: 'toNode', attributes: ['id', 'name', 'code'] },
                    { model: User, as: 'toUser', attributes: ['id', 'employee_id', 'first_name', 'last_name'] },
                    { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] },
                    { model: Request, as: 'request', attributes: ['id', 'request_number'] },
                    { 
                        model: WorkflowStep, 
                        as: 'currentStep',
                        include: [
                            { model: Role, as: 'requiredRole' },
                            { model: Workflow, as: 'workflow' }
                        ]
                    },
                    { model: Approval, as: 'approvals', attributes: ['id', 'approver_id'] }
                ],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['created_at', 'DESC']],
                distinct: true
            });

            const taggedRows = await Promise.all(rows.map(async (row) => {
                const plain = row.get({ plain: true });
                plain.can_action = false;
                plain.can_acknowledge = false;
                
                // Tag can_action for approvers (pending workflow steps)
                if (plain.status?.startsWith('pending') && plain.currentStep) {
                    plain.can_action = await workflowService.userCanApproveStep(req.user, row, plain.currentStep, permissions);

                    // Branch-level source node enforcement: Approve/Reject buttons display ONLY at source node
                    const sourceNodeId = plain.from_node_id || plain.org_node_id;
                    if (sourceNodeId && req.user.org_node_id && Number(req.user.org_node_id) !== Number(sourceNodeId)) {
                        plain.can_action = false;
                    }
                }

                // Tag can_acknowledge for the TARGET BRANCH:
                // When discharge is completed (items dispatched), the receiving branch must confirm receipt.
                if (plain.status === 'completed' && plain.to_node_id) {
                    const isRecipient = plain.to_user_id && Number(plain.to_user_id) === Number(req.user.id);
                    const isSuperAdmin = req.user.role && req.user.role.level >= 100;
                    const hasNodeAuthority = plain.to_node_id && (allowedNodes === null || allowedNodes.includes(Number(plain.to_node_id)));
                    const isAtSourceBranch = req.user.org_node_id && Number(req.user.org_node_id) === Number(plain.from_node_id);
                    
                    let canAck = (isRecipient || isSuperAdmin || hasNodeAuthority) && !isAtSourceBranch;
                    // Branch-level target node enforcement: Acknowledge Receipt button displays ONLY at target node
                    const targetNodeId = plain.to_node_id || plain.target_node_id;
                    if (targetNodeId && req.user.org_node_id && Number(req.user.org_node_id) !== Number(targetNodeId)) {
                        canAck = false;
                    }
                    plain.can_acknowledge = canAck;
                } else {
                    plain.can_acknowledge = false;
                }
                
                return plain;
            }));

            res.json({
                success: true,
                data: taggedRows,
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
     * Get discharges awaiting approval or visible for monitoring.
     */
    async getApprovals(req, res, next) {
        try {
            const company_id = req.user.company_id;
            const includeAll = req.query.all === 'true';
            
            const results = await approvalService.getDischargeApprovals(company_id, req.user, includeAll);
            
            res.json({
                success: true,
                data: results
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Create discharge form.
     */
    async create(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

            const { items, ...dischargeData } = req.body;
            const company_id = req.user.company_id;
            
            // Validate source node permission
            const fromNodeId = dischargeData.from_node_id || req.user.org_node_id;
            const permissions = await getEffectivePermissions(req.user);
            const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
            if (!allowedNodes.includes(Number(fromNodeId))) {
                await t.rollback();
                return res.status(403).json({ success: false, message: 'Access denied: Cannot issue items from a unit outside your visibility scope' });
            }

            // Group items by to_node_id to create separate forms per destination
            const groupedItems = items.reduce((acc, item) => {
                const target = item.to_node_id || dischargeData.to_node_id || 'default';
                if (!acc[target]) acc[target] = [];
                acc[target].push(item);
                return acc;
            }, {});

            const createdForms = [];

            for (const [toNodeId, groupItems] of Object.entries(groupedItems)) {
                // Check inventory availability for the whole group
                for (const item of groupItems) {
                    const availability = await inventoryService.checkAvailability(company_id, fromNodeId, item.product_id, item.quantity);
                    if (!availability.available) {
                        throw new Error(`Insufficient inventory for product ID ${item.product_id}`);
                    }
                }

                const form = await DischargeForm.create({
                    ...dischargeData,
                    company_id,
                    created_by: req.user.id,
                    from_node_id: fromNodeId,
                    to_node_id: toNodeId === 'default' ? null : toNodeId,
                    status: 'pending'
                }, { transaction: t });

                await Promise.all(groupItems.map(item => DischargeItem.create({
                    ...item,
                    discharge_form_id: form.id
                }, { transaction: t })));

                const workflow = await workflowService.initializeWorkflow(form, 'inventory_discharge', { transaction: t });

                if (!form.current_step_id) {
                    await inventoryService.executeDischarge(form, req.user, { transaction: t });
                    await form.update({ status: 'completed' }, { transaction: t });
                    if (form.request_id) {
                        await Request.update({ status: 'fulfilled', completed_date: new Date() }, { where: { id: form.request_id, company_id }, transaction: t });
                    }
                }

                await ActivityLog.create({
                    company_id,
                    user_id: req.user.id,
                    action: 'CREATE_DISCHARGE',
                    resource: 'discharge_forms',
                    resource_id: form.id,
                    details: { discharge_number: form.discharge_number, result: form.current_step_id ? 'pending_approval' : 'auto-executed' }
                }, { transaction: t });

                createdForms.push(form);
            }

            await t.commit();
            return res.status(201).json({ success: true, message: 'Discharge forms created successfully', data: createdForms });
        } catch (error) {
            if (t) await t.rollback();
            next(error);
        }
    },

    /**
     * Execute discharge (process inventory and create assignments).
     */
    async execute(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;

            const dischargeForm = await DischargeForm.findOne({
                where: { id, company_id },
                include: ['items'],
                transaction: t
            });

            if (!dischargeForm) throw new Error('Discharge form not found');
            if (dischargeForm.status === 'completed') throw new Error('Discharge already completed');
            if (dischargeForm.status !== 'approved') throw new Error('Discharge must be approved first');

            // Deep Scoping Check
            const permissions = await getEffectivePermissions(req.user);
            const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
            if (allowedNodes !== null && !allowedNodes.includes(dischargeForm.from_node_id)) {
                await t.rollback();
                return res.status(403).json({ success: false, message: 'Access denied: You are not authorized to execute discharges for this unit' });
            }

            // Perform physical movement using central service
            await inventoryService.executeDischarge(dischargeForm, req.user, { transaction: t });

            await dischargeForm.update({ status: 'completed' }, { transaction: t });

            if (dischargeForm.request_id) {
                await Request.update(
                    { status: 'fulfilled', completed_date: new Date() },
                    { where: { id: dischargeForm.request_id, company_id }, transaction: t }
                );
            }

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'EXECUTE',
                resource: 'discharge_forms',
                resource_id: id
            }, { transaction: t });

            await t.commit();
            res.json({ success: true, message: 'Discharge executed successfully' });
        } catch (error) {
            if (t) await t.rollback();
            next(error);
        }
    },

    /**
     * Approve discharge form.
     */
    async approve(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;

            const form = await DischargeForm.findOne({ where: { id, company_id }, transaction: t });
            if (!form) {
                await t.rollback();
                return res.status(404).json({ success: false, message: 'Not found' });
            }

            // Deep Scoping Check
            const permissions = await getEffectivePermissions(req.user);
            const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
            if (allowedNodes !== null && !allowedNodes.includes(form.from_node_id)) {
                await t.rollback();
                return res.status(403).json({ success: false, message: 'Access denied: Target unit is outside your visibility scope' });
            }

            if (form.status === 'completed' || form.status === 'approved') {
                await t.rollback();
                return res.status(400).json({ success: false, message: 'Form is already approved or completed' });
            }

            const result = await workflowService.advanceWorkflow(
                form, 
                'inventory_discharge', 
                req.user, 
                req.body.notes || 'Step approved',
                'approve',
                { transaction: t }
            );

            await t.commit();
            res.json({ 
                success: true, 
                message: result?.isFinalStep ? 'Discharge workflow complete: Ready for execution' : 'Workflow step approved',
                data: form 
            });
        } catch (error) {
            if (t) await t.rollback();
            // Return the correct HTTP status from the error if provided (e.g. 409 for stale inventory)
            if (error.statusCode) {
                return res.status(error.statusCode).json({ success: false, message: error.message });
            }
            next(error);
        }
    },

    /**
     * Get discharge form by ID.
     */
    async getById(req, res, next) {
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;
            
            const form = await DischargeForm.findOne({
                where: { id, company_id },
                include: [
                    { model: OrganizationNode, as: 'fromNode' },
                    { model: OrganizationNode, as: 'toNode' },
                    { model: User, as: 'toUser' },
                    { model: DischargeItem, as: 'items', include: ['product'] }
                ]
            });

            if (!form) return res.status(404).json({ success: false, message: 'Not found' });

            // Deep Scoping Check — follow merged_into chain so users on consolidated
            // branch can view discharge records that referenced old archived source/target branches
            const permissions = await getEffectivePermissions(req.user);
            const baseAllowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
            const allowedNodes = await hierarchyService.expandWithMergedSources(baseAllowedNodes, company_id);
            
            const isAuthorized = allowedNodes === null || 
                                 (form.from_node_id && allowedNodes.includes(Number(form.from_node_id))) || 
                                 (form.to_node_id && allowedNodes.includes(Number(form.to_node_id))) || 
                                 (form.to_user_id && Number(form.to_user_id) === Number(req.user.id));

            if (!isAuthorized) {
                return res.status(403).json({ success: false, message: 'Access denied: Form is outside your visibility scope' });
            }

            res.json({ success: true, data: form });
        } catch (error) {
            next(error);
        }
    },

    async reject(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;
            const notes = req.body.notes || req.body.reason;

            const form = await DischargeForm.findOne({ where: { id, company_id }, transaction: t });
            if (!form) {
                await t.rollback();
                return res.status(404).json({ success: false, message: 'Not found' });
            }

            if (form.status === 'completed' || form.status === 'rejected') {
                await t.rollback();
                return res.status(400).json({ success: false, message: 'Form is already finalized' });
            }

            await workflowService.rejectWorkflow(form, 'inventory_discharge', req.user, notes || 'Rejected via Ledger', { transaction: t });

            await t.commit();
            res.json({ success: true, message: "Discharge protocol rejected." });
        } catch (e) {
            if (t) await t.rollback();
            next(e);
        }
    },

    async cancel(req, res, next) {
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;

            const form = await DischargeForm.findOne({ where: { id, company_id } });
            if (!form) return res.status(404).json({ success: false, message: 'Not found' });

            if (form.status === 'completed' || form.status === 'cancelled') {
                return res.status(400).json({ success: false, message: 'Cannot cancel finalized form' });
            }

            await form.update({ status: 'cancelled', current_step_id: null });

            res.json({ success: true, message: "Transaction cancelled." });
        } catch (e) {
            next(e);
        }
    },

    /**
     * Acknowledge physical receipt of a discharge (target branch confirms items arrived).
     * Only users at the receiving (to_node_id) branch can acknowledge.
     */
    async acknowledge(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;

            const form = await DischargeForm.findOne({
                where: { id, company_id },
                include: ['items'],
                transaction: t
            });

            if (!form) {
                await t.rollback();
                return res.status(404).json({ success: false, message: 'Discharge form not found' });
            }

            if (form.status !== 'completed') {
                await t.rollback();
                return res.status(400).json({ 
                    success: false, 
                    message: 'Only completed discharges can be acknowledged. The source branch must execute the discharge first.' 
                });
            }

            if (!form.to_node_id) {
                await t.rollback();
                return res.status(400).json({ 
                    success: false, 
                    message: 'This discharge has no designated target branch to acknowledge from.' 
                });
            }

            // Security: recipient, super admin, or anyone with authority over destination node can acknowledge
            const isRecipient = form.to_user_id && Number(form.to_user_id) === Number(req.user.id);
            const isSuperAdmin = req.user.role && req.user.role.level >= 100;
            
            const permissions = await getEffectivePermissions(req.user);
            const allowedNodes = req.getAuthorizedNodes 
                ? await req.getAuthorizedNodes() 
                : await hierarchyService.getAllowedNodes(req.user, permissions);
            const hasNodeAuthority = form.to_node_id && (allowedNodes === null || allowedNodes.includes(Number(form.to_node_id)));

            const isAtSourceBranch = req.user.org_node_id && Number(req.user.org_node_id) === Number(form.from_node_id);
            if (isAtSourceBranch) {
                await t.rollback();
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: Personnel at the dispatching source branch cannot acknowledge physical receipt of this discharge.'
                });
            }

            if (!isRecipient && !isSuperAdmin && !hasNodeAuthority) {
                await t.rollback();
                return res.status(403).json({ 
                    success: false, 
                    message: 'Only authorized personnel for the receiving branch can acknowledge this discharge receipt.' 
                });
            }

            // Move status to acknowledged
            await form.update({ 
                status: 'acknowledged',
                workflow_status: 'Receipt Acknowledged by Target Branch'
            }, { transaction: t });

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'ACKNOWLEDGE_RECEIPT',
                resource: 'discharge_forms',
                resource_id: id,
                details: { 
                    message: 'Target branch acknowledged physical receipt of discharged items.',
                    acknowledged_at: new Date()
                }
            }, { transaction: t });

            await t.commit();
            res.json({ 
                success: true, 
                message: 'Receipt acknowledged. Items have been formally received by the target branch.' 
            });
        } catch (e) {
            if (t) await t.rollback();
            next(e);
        }
    }
};

module.exports = dischargeController;