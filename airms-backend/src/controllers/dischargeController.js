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
                to_date 
            } = req.query;
            
            const company_id = req.user.company_id;
            const where = { company_id };

            const permissions = await getEffectivePermissions(req.user);
            const offset = (page - 1) * limit;
            const allowedNodes = req.getAuthorizedNodes ? await req.getAuthorizedNodes() : await hierarchyService.getAllowedNodes(req.user, permissions);

            // Hierarchical Scoping
            if (node_id) {
                const targetNodeId = Number(node_id);
                // Security check: Is the requested node within the user's field of vision?
                if (allowedNodes !== null && !allowedNodes.includes(targetNodeId)) {
                    return res.status(403).json({ success: false, message: 'Access denied: Targeted node is outside your visibility scope' });
                }
                
                const nodeIds = await hierarchyService.getDescendants(targetNodeId);
                where.from_node_id = { [Op.in]: nodeIds };
            } else if (allowedNodes !== null) {
                // Default to user's authorized field of vision
                where.from_node_id = { [Op.in]: allowedNodes };
            }

            if (status) where.status = status;
            if (discharge_type) where.discharge_type = discharge_type;
            
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
                order: [['created_at', 'DESC']]
            });

            const taggedRows = await Promise.all(rows.map(async (row) => {
                const plain = row.get({ plain: true });
                plain.can_action = false;
                
                if (plain.status?.startsWith('pending') && plain.currentStep) {
                    const userRoleId = Number(req.user.role?.id || req.user.role_id);
                    const requiredRoleId = Number(plain.currentStep.required_role_id);
                    
                    // Simple logic: if the user's role matches the step's role, show the button.
                    if (requiredRoleId && userRoleId === requiredRoleId) {
                        plain.can_action = true;
                    } else {
                        // Fallback to service check for administrators/overrides
                        plain.can_action = await workflowService.userCanApproveStep(req.user, row, plain.currentStep, permissions);
                    }
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
            
            dischargeData.company_id = company_id;
            dischargeData.created_by = req.user.id;
            const fromNodeId = dischargeData.from_node_id || req.user.org_node_id;
            dischargeData.from_node_id = fromNodeId;
            dischargeData.status = 'pending';

            // Deep Scoping Check
            const permissions = await getEffectivePermissions(req.user);
            const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
            if (!allowedNodes.includes(Number(fromNodeId))) {
                await t.rollback();
                return res.status(403).json({ success: false, message: 'Access denied: Cannot issue items from a unit outside your visibility scope' });
            }

            // Check inventory availability
            for (const item of items) {
                const availability = await inventoryService.checkAvailability(
                    company_id, 
                    dischargeData.from_node_id, 
                    item.product_id, 
                    item.quantity
                );
                if (!availability.available) {
                    await t.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient inventory for product ID ${item.product_id}`
                    });
                }
            }

            // Smart Destination Mapping: Pick from first item if header is empty
            if (items && items.length > 0) {
                if (items[0].to_node_id) dischargeData.to_node_id = items[0].to_node_id;
                if (items[0].to_user_id) dischargeData.to_user_id = items[0].to_user_id;
            }

            // 1. Create the form (defaults to pending)
            const dischargeForm = await DischargeForm.create(dischargeData, { transaction: t });

            // 2. Create the items
            if (items && items.length > 0) {
                await Promise.all(items.map(item => DischargeItem.create({
                    ...item,
                    discharge_form_id: dischargeForm.id
                }, { transaction: t })));
            }

            // 3. Initialize dynamic workflow
            const workflow = await workflowService.initializeWorkflow(dischargeForm, 'inventory_discharge', { transaction: t });

            // 4. LOGIC: If no workflow exists (steps = 0 or no workflow record), execute IMMEDIATELY
            let executionResult = null;
            if (!dischargeForm.current_step_id) {
                // Perform physical movement (Subtract from source, Add to target)
                await inventoryService.executeDischarge(dischargeForm, req.user, { transaction: t });
                
                // Finalize status
                await dischargeForm.update({ status: 'completed' }, { transaction: t });
                
                // If linked to a request, fulfill it
                if (dischargeForm.request_id) {
                    await Request.update(
                        { status: 'fulfilled', completed_date: new Date() },
                        { where: { id: dischargeForm.request_id, company_id }, transaction: t }
                    );
                }
                executionResult = 'auto-executed';
            }

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'CREATE_DISCHARGE',
                resource: 'discharge_forms',
                resource_id: dischargeForm.id,
                details: { 
                    discharge_number: dischargeForm.discharge_number,
                    workflow_id: dischargeForm.workflow_id,
                    current_step_id: dischargeForm.current_step_id,
                    result: executionResult || 'pending_approval'
                }
            }, { transaction: t });

            await t.commit();
            
            const isPending = !!dischargeForm.current_step_id;
            return res.status(201).json({ 
                success: true, 
                message: isPending ? 'Discharge initialized: Pending workflow authorization' : 'Discharge authorized and executed successfully (No Workflow)', 
                data: dischargeForm 
            });
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
            if (!allowedNodes.includes(dischargeForm.from_node_id)) {
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
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;

            const form = await DischargeForm.findOne({ where: { id, company_id } });
            if (!form) return res.status(404).json({ success: false, message: 'Not found' });

            // Deep Scoping Check
            const permissions = await getEffectivePermissions(req.user);
            const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
            if (!allowedNodes.includes(form.from_node_id)) {
                return res.status(403).json({ success: false, message: 'Access denied: Target unit is outside your visibility scope' });
            }

            if (form.status === 'completed' || form.status === 'approved') {
                return res.status(400).json({ success: false, message: 'Form is already approved or completed' });
            }

            const result = await workflowService.advanceWorkflow(
                form, 
                'inventory_discharge', 
                req.user, 
                req.body.notes || 'Step approved'
            );

            res.json({ 
                success: true, 
                message: result?.isFinalStep ? 'Discharge workflow complete: Ready for execution' : 'Workflow step approved',
                data: form 
            });
        } catch (error) {
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

            // Deep Scoping Check
            const permissions = await getEffectivePermissions(req.user);
            const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
            if (!allowedNodes.includes(form.from_node_id) && form.to_user_id !== req.user.id) {
                return res.status(403).json({ success: false, message: 'Access denied: Form is outside your visibility scope' });
            }

            res.json({ success: true, data: form });
        } catch (error) {
            next(error);
        }
    },

    async reject(req, res, next) {
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;
            const { notes } = req.body;

            const form = await DischargeForm.findOne({ where: { id, company_id } });
            if (!form) return res.status(404).json({ success: false, message: 'Not found' });

            if (form.status === 'completed' || form.status === 'rejected') {
                return res.status(400).json({ success: false, message: 'Form is already finalized' });
            }

            await workflowService.rejectWorkflow(form, 'inventory_discharge', req.user, notes || 'Rejected via Ledger');

            res.json({ success: true, message: "Discharge protocol rejected." });
        } catch (e) {
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
    }
};

module.exports = dischargeController;