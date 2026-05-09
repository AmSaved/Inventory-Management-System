const { Request, RequestItem, Approval, User, OrganizationNode, Product, ActivityLog, WorkflowStep, Role, Assignment, Workflow, sequelize } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const approvalService = require('../services/approvalService');
const hierarchyService = require('../services/hierarchyService');
const workflowService = require('../services/workflowService');
const inventoryService = require('../services/inventoryService');
const requestService = require('../services/requestService');
const logger = require('../config/logger');
const { getEffectivePermissions } = require('../middleware/permissions');

const requestController = {
    /**
     * Get all requests, scoped to company and user's organizational scope.
     */
    async getAll(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 10, 
                status, 
                priority,
                org_node_id,
                requester_id,
                from_date,
                to_date,
                search 
            } = req.query;
            
            const company_id = req.user.company_id;
            const where = { company_id };
            
            // DYNAMIC SCOPING: Field of vision is pre-calculated by the permission middleware.
            const permissions = req.userPermissions || await getEffectivePermissions(req.user);
            const isSuperAdmin = (req.user.role && req.user.role.level >= 100) || permissions.includes('system:manage');
            
            const allowedNodes = req.getAuthorizedNodes 
                ? await req.getAuthorizedNodes() 
                : await hierarchyService.getAllowedNodes(req.user, permissions);

            // Hierarchical Scoping
            if (req.query.org_node_id) {
                const targetNode = Number(req.query.org_node_id);
                if (!isSuperAdmin && !allowedNodes.includes(targetNode)) {
                    return res.status(403).json({ success: false, message: 'Access denied: Target node is outside your visibility scope' });
                }
                where.org_node_id = targetNode;
            } else if (!isSuperAdmin) {
                where.org_node_id = { [Op.in]: allowedNodes };
            }

            if (status) where.status = status;
            if (priority) where.priority = priority;
            if (requester_id) where.requester_id = requester_id;
            
            // Unified Type Filtering for Specialized Sidebars
            if (req.query.type) {
                const type = req.query.type.toLowerCase();
                if (['procurement', 'new', 'requisition'].includes(type)) {
                    where.request_type = { [Op.in]: ['new', 'requisition', 'procurement'] };
                } else if (type === 'items' || type === 'transfer') {
                    where.request_type = 'transfer';
                } else if (type === 'returns' || type === 'return') {
                    where.request_type = 'return';
                } else if (type === 'issue') {
                    where.request_type = 'issue';
                }
            }
            
            if (from_date || to_date) {
                where.created_at = {};
                if (from_date) where.created_at[Op.gte] = new Date(from_date);
                if (to_date) where.created_at[Op.lte] = new Date(to_date);
            }

            const offset = (page - 1) * limit;
            
            const { count, rows } = await Request.findAndCountAll({
                where,
                include: [
                    {
                        model: User,
                        as: 'requester',
                        attributes: ['id', 'employee_id', 'first_name', 'last_name', 'email']
                    },
                    {
                        model: OrganizationNode,
                        as: 'organizationNode',
                        attributes: ['id', 'name', 'code']
                    },
                    {
                        model: Workflow,
                        as: 'workflow',
                        attributes: ['id', 'name', 'resource_type']
                    },
                    {
                        model: RequestItem,
                        as: 'items',
                        include: ['product']
                    },
                    {
                        model: WorkflowStep,
                        as: 'currentStep',
                        include: [{ model: Role, as: 'requiredRole' }]
                    },
                    {
                        model: User,
                        as: 'targetUser',
                        attributes: ['id', 'first_name', 'last_name', 'employee_id']
                    }
                ],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['created_at', 'DESC']]
            });

            // Dynamic Action Tagging: Check if user can approve/reject each item
            const taggedRows = await Promise.all(rows.map(async (row) => {
                const plain = row.get({ plain: true });
                const status = (plain.status || '').toLowerCase();
                // Show buttons for ANY active status (not finished/rejected/cancelled)
                const isActionable = !['fulfilled', 'completed', 'rejected', 'cancelled'].includes(status);
                
                if (isActionable) {
                    // AUTO-REPAIR: If currentStep is missing but it's an active return, try to initialize it once
                    if (!plain.currentStep && (plain.request_type === 'return' || plain.request_type === 'returns')) {
                        try {
                            await workflowService.initializeWorkflow(row, 'return');
                            // Reload the row to get the new currentStep
                            const reloaded = await Request.findByPk(row.id, {
                                include: [{ model: WorkflowStep, as: 'currentStep', include: [{ model: Role, as: 'requiredRole' }] }]
                            });
                            if (reloaded && reloaded.currentStep) {
                                plain.currentStep = reloaded.currentStep.get({ plain: true });
                            }
                        } catch (e) {
                            console.error('[AutoRepair] Failed to initialize return workflow for ID:', row.id);
                        }
                    }

                    if (plain.currentStep) {
                        plain.can_action = await workflowService.userCanApproveStep(req.user, row, plain.currentStep, permissions);
                    }
                } else {
                    plain.can_action = false;
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
     * Get request by ID (Security: company_id scoped)
     */
    async getById(req, res, next) {
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;
            
            const request = await Request.findOne({
                where: { id, company_id },
                include: [
                    { model: User, as: 'requester', attributes: ['id', 'employee_id', 'first_name', 'last_name', 'email'] },
                    { model: OrganizationNode, as: 'organizationNode' },
                    { model: RequestItem, as: 'items', include: ['product'] },
                    {
                        model: Approval,
                        as: 'approvals',
                        include: [{
                            model: User,
                            as: 'approver',
                            attributes: ['id', 'first_name', 'last_name']
                        }]
                    },
                    {
                        model: WorkflowStep,
                        as: 'currentStep',
                        include: [{ model: Role, as: 'requiredRole' }]
                    }
                ]
            });

            if (!request) {
                return res.status(404).json({ success: false, message: 'Request not found' });
            }

            // Security Scoping Check
            const permissions = req.userPermissions || await getEffectivePermissions(req.user);
            const isSuperAdmin = (req.user.role && req.user.role.level >= 100) || permissions.includes('system:manage');
            
            const allowedNodes = req.getAuthorizedNodes 
                ? await req.getAuthorizedNodes() 
                : await hierarchyService.getAllowedNodes(req.user, permissions);

            if (!isSuperAdmin && !allowedNodes.includes(request.org_node_id) && request.requester_id !== req.user.id) {
                return res.status(403).json({ success: false, message: 'Access denied: Request is outside your visibility scope' });
            }

            res.json({ success: true, data: request });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Create a new request.
     */
    async create(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { items, ...requestData } = req.body;
            const company_id = req.user.company_id;
            
            requestData.company_id = company_id;
            // Use provided requester_id (e.g. from an admin form) or fall back to current user
            requestData.requester_id = req.body.requester_id || req.user.id;
            // Capture target user for transfers from the body
            if (requestData.request_type === 'transfer' && req.body.target_user_id) {
                requestData.target_user_id = req.body.target_user_id;
            } else if (requestData.request_type === 'transfer' && req.body.notes) {
                // Fallback for current frontend JSON notes format
                try {
                    const parsed = JSON.parse(req.body.notes);
                    if (parsed.transfer_to_user_id) requestData.target_user_id = parsed.transfer_to_user_id;
                } catch (e) { /* ignore */ }
            }

            // Use the node ID provided in the body (e.g. the asset's branch) or fallback to user's node
            requestData.org_node_id = requestData.org_node_id || req.user.org_node_id;
            
            const request = await Request.create(requestData);

            // Initialize dynamic workflow based on request type
            // Maps: 'new' or 'requisition' -> 'request'
            // Maps: 'transfer' -> 'transfer'
            // Maps: 'return' -> 'return' etc.
            const typeMap = {
                'new': 'request',
                'requisition': 'request',
                'transfer': 'transfer',
                'return': 'return',
                'issue': 'issue'
            };
            const workflowType = typeMap[request.request_type?.toLowerCase()] || (request.request_type?.toLowerCase() || 'request');
            await workflowService.initializeWorkflow(request, workflowType);

            if (items && items.length > 0) {
                const requestItems = items.map(item => ({
                    ...item,
                    request_id: request.id
                }));
                await RequestItem.bulkCreate(requestItems);
            }

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'CREATE',
                resource: 'requests',
                resource_id: request.id,
                details: { request_number: request.request_number, items },
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
            });

            const createdRequest = await Request.findByPk(request.id, { include: ['items'] });

            res.status(201).json({
                success: true,
                message: 'Request created successfully',
                data: createdRequest
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Update request details.
     */
    async update(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;
            const company_id = req.user.company_id;

            const request = await Request.findOne({ where: { id, company_id } });
            if (!request) {
                return res.status(404).json({ success: false, message: 'Request not found' });
            }

            await request.update(updates);

            await ActivityLog.create({
                company_id,
                org_node_id: request.org_node_id,
                user_id: req.user.id,
                action: 'UPDATE',
                resource: 'requests',
                resource_id: id,
                details: updates,
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
            });

            res.json({ success: true, message: 'Request updated successfully', data: request });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Cancel a request.
     */
    async cancel(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const company_id = req.user.company_id;

            const request = await Request.findOne({ where: { id, company_id } });
            if (!request) {
                return res.status(404).json({ success: false, message: 'Request not found' });
            }

            if (!['pending_chairman', 'pending_storage'].includes(request.status)) {
                return res.status(400).json({ success: false, message: 'Cannot cancel request at current status' });
            }

            const permissions = await getEffectivePermissions(req.user);
            const canManageAll = permissions.includes('request:manage:all') || permissions.includes('system:manage');

            if (request.requester_id !== req.user.id && !canManageAll && !permissions.includes('request:delete')) {
                return res.status(403).json({ success: false, message: 'Not authorized to cancel this request' });
            }

            await request.update({
                status: 'cancelled',
                cancelled_at: new Date(),
                cancelled_by: req.user.id,
                notes: reason
            });

            await ActivityLog.create({
                company_id,
                org_node_id: request.org_node_id,
                user_id: req.user.id,
                action: 'CANCEL',
                resource: 'requests',
                resource_id: id,
                details: { reason },
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
            });

            res.json({ success: true, message: 'Request cancelled successfully' });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get pending approvals for the current user.
     */
    async getPendingApprovals(req, res, next) {
        try {
            const requests = await approvalService.getPendingApprovals(req.user.company_id, req.user);
            res.json({ success: true, data: requests });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Process Dynamic Workflow Action (Approve / Reject)
     */
    async processWorkflowAction(req, res, next) {
        try {
            const { id } = req.params;
            const { action, comments } = req.body; // action expected: 'approve' or 'reject'
            const company_id = req.user.company_id;

            const request = await Request.findOne({ where: { id, company_id } });
            if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

            const workflowType = request.request_type === 'new' ? 'request' : (request.request_type || 'request');

            if (action === 'approve') {
                const result = await workflowService.advanceWorkflow(request, workflowType, req.user, comments);
                
                // Transfer workflows will now pause at 'approved'
                // so the Target Custodian MUST manually 'Acknowledge Receipt' 
                // from their dashboard to finalize custody transfer.

                return res.json({ 
                    success: true, 
                    message: result?.isFinalStep ? 'Request fully approved via workflow' : `Workflow moved to next phase: ${request.workflow_status}`, 
                    data: request 
                });
            } else if (action === 'reject') {
                const result = await workflowService.rejectWorkflow(request, workflowType, req.user, comments);
                return res.json({ 
                    success: true, 
                    message: `Request rejected and moved to status: ${request.workflow_status}`, 
                    data: request 
                });
            } else {
                return res.status(400).json({ success: false, message: 'Invalid workflow action' });
            }
        } catch (error) {
            next(error);
        }
    },

    async fulfill(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;

            // Delegate all fulfillment logic to RequestService
            await requestService.fulfillRequest(id, company_id, req.user, { transaction: t });

            await t.commit();
            res.json({ success: true, message: 'Request fulfilled successfully' });
        } catch (error) {
            await t.rollback();
            next(error);
        }
    }
};

module.exports = requestController;