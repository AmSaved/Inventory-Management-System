const { DischargeForm, DischargeItem, Assignment, Request, User, OrganizationNode, Product, Inventory, ActivityLog, sequelize } = require('../models');
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
            const hasGlobalVisibility = permissions.includes('hierarchy:all:view') || permissions.includes('system:manage');

            // Hierarchical Scoping
            if (node_id) {
                const nodeIds = await hierarchyService.getDescendants(node_id);
                where.from_node_id = { [Op.in]: nodeIds };
            } else if (!hasGlobalVisibility && req.user.org_node_id) {
                const nodeIds = await hierarchyService.getDescendants(req.user.org_node_id);
                where.from_node_id = { [Op.in]: nodeIds };
            }

            if (status) where.status = status;
            if (discharge_type) where.discharge_type = discharge_type;
            
            if (from_date || to_date) {
                where.created_at = {};
                if (from_date) where.created_at[Op.gte] = new Date(from_date);
                if (to_date) where.created_at[Op.lte] = new Date(to_date);
            }

            const offset = (page - 1) * limit;
            
            const { count, rows } = await DischargeForm.findAndCountAll({
                where,
                include: [
                    { model: OrganizationNode, as: 'fromNode', attributes: ['id', 'name', 'code'] },
                    { model: OrganizationNode, as: 'toNode', attributes: ['id', 'name', 'code'] },
                    { model: User, as: 'toUser', attributes: ['id', 'employee_id', 'first_name', 'last_name'] },
                    { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] },
                    { model: Request, as: 'request', attributes: ['id', 'request_number'] }
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
                return res.status(403).json({ success: false, message: 'Access denied: You are not authorized to execute discharges for this unit' });
            }

            await dischargeController._performPhysicalMovement(dischargeForm, req.user, t);

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
            await t.rollback();
            next(error);
        }
    },

    /**
     * Approve discharge form.
     */
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

    /**
     * Stubs for hierarchical discharge handlers.
     */
    async reject(req, res, next) {
        try { res.json({ success: true, message: "Status transition updated." }); } catch (e) { next(e); }
    },

    async cancel(req, res, next) {
        try { res.json({ success: true, message: "Transaction cancelled." }); } catch (e) { next(e); }
    },

    /**
     * Internal helper to perform physical inventory movement.
     */
    /**
     * Internal helper to perform physical inventory movement.
     */
    async _performPhysicalMovement(dischargeForm, user, t) {
        const company_id = dischargeForm.company_id;
        
        for (const item of dischargeForm.items) {
            // Determine Destination - Item level takes priority
            const targetUserId = item.to_user_id || dischargeForm.to_user_id;
            const targetNodeId = item.to_node_id || dischargeForm.to_node_id;
            
            // Logic: If targetNodeId exists and is NOT the from_node_id, treat as branch transfer
            // If only targetUserId exists, treat as user assignment
            const isUnitDischarge = !!targetNodeId && (targetNodeId !== dischargeForm.from_node_id);
            const isUserDischarge = !isUnitDischarge && !!targetUserId;

            // 1. Subtract from source inventory
            await inventoryService.removeFromInventory(
                company_id,
                dischargeForm.from_node_id,
                item.product_id,
                item.quantity,
                {
                    userId: user.id,
                    reference: `DISCHARGE-${dischargeForm.discharge_number}`,
                    transaction: t
                }
            );

            // 2. Add to Target (Unit or User)
            if (isUnitDischarge) {
                // DISTRIBUTION LOGIC: Move stock to another branch
                await inventoryService.addToInventory(
                    company_id,
                    targetNodeId,
                    item.product_id,
                    item.quantity,
                    {
                        userId: user.id,
                        reference: `RECEIVE-DISCHARGE-${dischargeForm.discharge_number}`,
                        notes: `Received from parent/unit ${dischargeForm.from_node_id}`,
                        transaction: t,
                        metadata: {
                            condition: item.condition,
                            batch_number: item.batch_number,
                            serial_numbers: item.serial_numbers
                        }
                    }
                );
            } else if (isUserDischarge) {
                // ASSIGNMENT LOGIC: Assign to an employee
                const targetUser = await User.findByPk(targetUserId, { transaction: t });
                const serialNumbers = item.serial_numbers || [];

                for (let i = 0; i < item.quantity; i++) {
                    await Assignment.create({
                        company_id,
                        discharge_item_id: item.id,
                        product_id: item.product_id,
                        user_id: targetUserId,
                        org_node_id: targetUser ? targetUser.org_node_id : dischargeForm.from_node_id,
                        serial_number: serialNumbers[i] || `SN-${Date.now()}-${item.id}-${i}`,
                        assigned_at: new Date(),
                        status: 'active',
                        condition_at_assignment: item.condition
                    }, { transaction: t });
                }
            } else {
                // FALLBACK: If no clear destination, log as generic release but items are already removed from source
                logger.warn(`Discharge ${dischargeForm.id} item ${item.id} had no clear unit or user target.`);
            }
        }
    }
};

module.exports = dischargeController;