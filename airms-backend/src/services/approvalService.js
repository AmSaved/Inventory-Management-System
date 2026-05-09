const { Request, RequestItem, Product, Approval, User, OrganizationNode, ActivityLog, WorkflowStep, WorkflowStatus, DischargeForm, DischargeItem } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const workflowService = require('./workflowService');
const hierarchyService = require('./hierarchyService');

class ApprovalService {
    /**
     * Process a generic workflow action (Approve/Reject).
     * Replacing hardcoded roles (Chairman/Storage) with dynamic Processing Design.
     */
    async processAction(companyId, requestId, resourceType, user, action, comments = '') {
        try {
            const models = require('../models');
            const modelMap = {
                'request': models.Request,
                'transfer': models.Transfer,
                'inventory_transfer': models.Transfer,
                'return': models.Return,
                'inventory_return': models.Return,
                'discharge': models.DischargeForm,
                'inventory_discharge': models.DischargeForm
            };

            const Model = modelMap[resourceType] || models.Request;
            const resource = await Model.findOne({
                where: { id: requestId, company_id: companyId }
            });
            
            if (!resource) {
                throw new Error(`${resourceType || 'Resource'} not found`);
            }

            if (action === 'approve') {
                return await workflowService.advanceWorkflow(resource, resourceType || 'request', user, comments);
            } else if (action === 'reject') {
                return await workflowService.rejectWorkflow(resource, resourceType || 'request', user, comments);
            } else {
                throw new Error('Invalid workflow action');
            }
        } catch (error) {
            logger.error(`Workflow process action error (${action}):`, error);
            throw error;
        }
    }

    /**
     * Get pending approvals for a user based on the organization's Processing Design (Workflows).
     * This replaces legacy role-based filtering with dynamic, branch-scoped authority.
     */
    async getPendingApprovals(companyId, user) {
        try {
            const authorizedStepIds = await workflowService.getAuthorizedStepIds(companyId, user);
            if (authorizedStepIds.length === 0) return [];
            
            const allowedNodes = await hierarchyService.getAllowedNodes(user);

            // 1. Fetch standard/legacy requests (excluding types handled by specialized tables)
            const requests = await Request.findAll({
                where: {
                    company_id: companyId,
                    status: 'pending',
                    current_step_id: { [Op.in]: authorizedStepIds },
                    org_node_id: { [Op.in]: allowedNodes },
                    request_type: { [Op.notIn]: ['discharge', 'issue', 'transfer', 'return'] }
                },
                include: [
                    { model: User, as: 'requester', attributes: ['id', 'first_name', 'last_name', 'employee_id'] },
                    { model: OrganizationNode, as: 'organizationNode', attributes: ['id', 'name', 'code', 'path'] },
                    { model: WorkflowStep, as: 'currentStep', include: [{ model: WorkflowStatus, as: 'statusLabel' }] },
                    { model: RequestItem, as: 'items', include: ['product'] },
                    { model: require('../models').Workflow, as: 'workflow', attributes: ['id', 'name', 'resource_type'] }
                ],
                order: [['priority', 'DESC'], ['created_at', 'ASC']]
            });

            // 2. Aggregate results from specialized modules
            const [discharges, transfers, returns, inventoryReturns] = await Promise.all([
                this.getDischargeApprovals(companyId, user),
                this.getTransferApprovals(companyId, user),
                this.getReturnApprovals(companyId, user, false, 'returns'),
                this.getReturnApprovals(companyId, user, false, 'inventory-returns')
            ]);

            // 3. Process standard requests into plain objects
            const standardResults = await Promise.all(requests.map(async (item) => {
                const plain = item.get({ plain: true });
                plain.resource_origin = 'request';
                plain.can_action = await workflowService.userCanApproveStep(user, item, item.currentStep);
                return plain;
            }));

            // 4. Combine all approval streams into a Unified Command Queue
            return [
                ...standardResults,
                ...discharges,
                ...transfers,
                ...returns,
                ...inventoryReturns
            ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
        } catch (error) {
            logger.error('Universal fetch error: Dashboard Sync Failed', error);
            throw error;
        }
    }

    /**
     * Get discharge forms that require approval or are visible to the user.
     * Merges DischargeForm table and legacy Request table (type='discharge' or 'issue').
     */
    async getDischargeApprovals(companyId, user, includeAll = false) {
        try {
            const { DischargeForm, DischargeItem, Request, RequestItem } = require('../models');
            const authorizedStepIds = await workflowService.getAuthorizedStepIds(companyId, user);
            const allowedNodes = await hierarchyService.getAllowedNodes(user);

            const where = {
                company_id: companyId,
                from_node_id: { [Op.in]: allowedNodes }
            };

            // If not including all, filter specifically for items waiting for this user's authorized steps
            if (!includeAll) {
                where.status = 'pending';
                where.current_step_id = { [Op.in]: authorizedStepIds };
            }

            // 1. Fetch from DischargeForm table
            const discharges = await DischargeForm.findAll({
                where,
                include: [
                    { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name', 'employee_id'] },
                    { model: User, as: 'toUser', attributes: ['id', 'first_name', 'last_name'] },
                    { model: OrganizationNode, as: 'fromNode', attributes: ['id', 'name', 'code'] },
                    { model: OrganizationNode, as: 'toNode', attributes: ['id', 'name', 'code'] },
                    {
                        model: WorkflowStep,
                        as: 'currentStep',
                        include: [{ model: WorkflowStatus, as: 'statusLabel' }]
                    },
                    {
                        model: require('../models').Workflow,
                        as: 'workflow',
                        attributes: ['id', 'name', 'resource_type']
                    },
                    {
                        model: DischargeItem,
                        as: 'items',
                        include: ['product']
                    }
                ],
                order: [['created_at', 'DESC']]
            });

            // 2. Fetch from Request table (type='discharge' or 'issue')
            const legacyRequests = await Request.findAll({
                where: {
                    company_id: companyId,
                    request_type: { [Op.in]: ['discharge', 'issue'] },
                    org_node_id: { [Op.in]: allowedNodes },
                    ...(includeAll ? {} : { status: 'pending', current_step_id: { [Op.in]: authorizedStepIds } })
                },
                include: [
                    { model: User, as: 'requester', attributes: ['id', 'first_name', 'last_name', 'employee_id'] },
                    { model: OrganizationNode, as: 'organizationNode', attributes: ['id', 'name', 'code'] },
                    { model: WorkflowStep, as: 'currentStep', include: [{ model: WorkflowStatus, as: 'statusLabel' }] },
                    { model: require('../models').Workflow, as: 'workflow', attributes: ['id', 'name', 'resource_type'] },
                    { model: RequestItem, as: 'items', include: ['product'] }
                ]
            });

            const allResults = [
                ...discharges.map(d => {
                    const plain = d.get({ plain: true });
                    plain.resource_origin = 'discharge';
                    return plain;
                }),
                ...legacyRequests.map(r => {
                    const plain = r.get({ plain: true });
                    plain.resource_origin = 'request';
                    // Map organizationNode to fromNode for consistency
                    plain.fromNode = plain.organizationNode;
                    return plain;
                })
            ];

            // Dynamically tag which ones the user can actually action right now
            const modelsObj = require('../models');
            const results = await Promise.all(allResults.map(async (item) => {
                const currentStepId = item.current_step_id ? Number(item.current_step_id) : null;
                const isAuthorized = authorizedStepIds.map(Number).includes(currentStepId);

                // If it's not pending or user has no matching step, can't action
                if (item.status !== 'pending' || !currentStepId || !isAuthorized) {
                    item.can_action = false;
                } else {
                    const modelMap = {
                        'discharge': modelsObj.DischargeForm,
                        'return': modelsObj.Return,
                        'transfer': modelsObj.Transfer,
                        'request': modelsObj.Request
                    };
                    const Model = modelMap[item.resource_origin] || modelsObj.Request;
                    const instance = await Model.findByPk(item.id);
                    item.can_action = await workflowService.userCanApproveStep(user, instance, item.currentStep);
                }
                return item;
            }));

            return results;
        } catch (error) {
            logger.error('Get discharge approvals error:', error);
            throw error;
        }
    }

    /**
     * Get transfers (Inventory or Item) awaiting approval.
     * Merges results from Transfer table and legacy Request table (type='transfer').
     */
    async getTransferApprovals(companyId, user, transferTypeFilter = 'all', includeAll = false) {
        try {
            const { Transfer, TransferItem, Request, RequestItem } = require('../models');
            const authorizedStepIds = await workflowService.getAuthorizedStepIds(companyId, user);
            const allowedNodes = await hierarchyService.getAllowedNodes(user);

            const where = {
                company_id: companyId,
                [Op.or]: [
                    { from_node_id: { [Op.in]: allowedNodes } },
                    { to_node_id: { [Op.in]: allowedNodes } }
                ]
            };

            if (transferTypeFilter !== 'all') {
                if (Array.isArray(transferTypeFilter)) {
                    where.transfer_type = { [Op.in]: transferTypeFilter };
                } else {
                    where.transfer_type = transferTypeFilter;
                }
            }

            if (!includeAll) {
                where.status = 'pending';
                where.current_step_id = { [Op.in]: authorizedStepIds };
            }

            // 1. Fetch from Transfers table
            const transfers = await Transfer.findAll({
                where,
                include: [
                    { model: OrganizationNode, as: 'fromNode', attributes: ['id', 'name', 'code'] },
                    { model: OrganizationNode, as: 'toNode', attributes: ['id', 'name', 'code'] },
                    { model: User, as: 'requester', attributes: ['id', 'first_name', 'last_name', 'employee_id'] },
                    { model: WorkflowStep, as: 'currentStep', include: [{ model: WorkflowStatus, as: 'statusLabel' }] },
                    { model: require('../models').Workflow, as: 'workflow', attributes: ['id', 'name', 'resource_type'] },
                    { model: TransferItem, as: 'items', include: ['product'] }
                ],
                order: [['created_at', 'DESC']]
            });

            // 2. If filtering for item transfers, also fetch from Request table (type='transfer')
            let legacyRequests = [];
            if (transferTypeFilter === 'all' || (Array.isArray(transferTypeFilter) && transferTypeFilter.includes('user_to_node'))) {
                legacyRequests = await Request.findAll({
                    where: {
                        company_id: companyId,
                        request_type: 'transfer',
                        org_node_id: { [Op.in]: allowedNodes },
                        ...(includeAll ? {} : { status: 'pending', current_step_id: { [Op.in]: authorizedStepIds } })
                    },
                    include: [
                        { model: User, as: 'requester', attributes: ['id', 'first_name', 'last_name', 'employee_id'] },
                        { model: OrganizationNode, as: 'organizationNode', attributes: ['id', 'name', 'code'] },
                        { model: WorkflowStep, as: 'currentStep', include: [{ model: WorkflowStatus, as: 'statusLabel' }] },
                        { model: require('../models').Workflow, as: 'workflow', attributes: ['id', 'name', 'resource_type'] },
                        { model: RequestItem, as: 'items', include: ['product'] }
                    ]
                });
            }

            // Combine and unify properties for frontend
            const allResults = [
                ...transfers.map(t => {
                    const plain = t.get({ plain: true });
                    plain.resource_origin = 'transfer';
                    return plain;
                }),
                ...legacyRequests.map(r => {
                    const plain = r.get({ plain: true });
                    plain.resource_origin = 'request';
                    // Map organizationNode to fromNode for frontend consistency
                    plain.fromNode = plain.organizationNode;
                    return plain;
                })
            ];

            return await Promise.all(allResults.map(async (item) => {
                const currentStepId = item.current_step_id ? Number(item.current_step_id) : null;
                const isAuthorized = authorizedStepIds.map(Number).includes(currentStepId);

                if (item.status !== 'pending' || !currentStepId || !isAuthorized) {
                    item.can_action = false;
                } else {
                    // Re-instantiate model for complex check if needed
                    const Model = item.resource_origin === 'transfer' ? Transfer : Request;
                    const instance = await Model.findByPk(item.id);
                    item.can_action = await workflowService.userCanApproveStep(user, instance, item.currentStep);
                }
                return item;
            }));
        } catch (error) {
            logger.error('Get transfer approvals error:', error);
            throw error;
        }
    }

    /**
     * Get return requests awaiting approval.
     */
    async getReturnApprovals(companyId, user, includeAll = false, type = 'returns') {
        try {
            const { Return, ReturnItem, Request, RequestItem } = require('../models');
            const authorizedStepIds = await workflowService.getAuthorizedStepIds(companyId, user);
            const allowedNodes = await hierarchyService.getAllowedNodes(user);

            const returnWhere = {
                company_id: companyId,
                return_type: type === 'inventory-returns' ? 'inventory' : 'normal',
                [Op.or]: [
                    { from_node_id: { [Op.in]: allowedNodes } },
                    { to_node_id: { [Op.in]: allowedNodes } }
                ]
            };

            const requestWhere = {
                company_id: companyId,
                request_type: 'return',
                org_node_id: { [Op.in]: allowedNodes }
            };

            if (!includeAll) {
                returnWhere.status = 'pending';
                returnWhere.current_step_id = { [Op.in]: authorizedStepIds };
                requestWhere.status = 'pending';
                requestWhere.current_step_id = { [Op.in]: authorizedStepIds };
            }

            // 1. Fetch from Return table (Uses fromNode/toNode and user)
            const returns = await Return.findAll({
                where: returnWhere,
                include: [
                    { model: OrganizationNode, as: 'fromNode', attributes: ['id', 'name', 'code'] },
                    { model: OrganizationNode, as: 'toNode', attributes: ['id', 'name', 'code'] },
                    { model: User, as: 'user', attributes: ['id', 'first_name', 'last_name', 'employee_id'] },
                    { model: WorkflowStep, as: 'currentStep', include: [{ model: WorkflowStatus, as: 'statusLabel' }] },
                    { model: require('../models').Workflow, as: 'workflow', attributes: ['id', 'name', 'resource_type'] },
                    { model: ReturnItem, as: 'items', include: ['product'] }
                ],
                order: [['created_at', 'DESC']]
            });

            let legacyRequests = [];
            // Legacy requests only apply to normal item returns, not bulk inventory returns
            if (type !== 'inventory-returns') {
                legacyRequests = await Request.findAll({
                    where: requestWhere,
                    include: [
                        { model: User, as: 'requester', attributes: ['id', 'first_name', 'last_name', 'employee_id'] },
                        { model: OrganizationNode, as: 'organizationNode', attributes: ['id', 'name', 'code'] },
                        { model: WorkflowStep, as: 'currentStep', include: [{ model: WorkflowStatus, as: 'statusLabel' }] },
                        { model: require('../models').Workflow, as: 'workflow', attributes: ['id', 'name', 'resource_type'] },
                        { model: RequestItem, as: 'items', include: ['product'] }
                    ]
                });
            }

            const allResults = [
                ...returns.map(r => {
                    const plain = r.get({ plain: true });
                    plain.resource_origin = 'return';
                    return plain;
                }),
                ...legacyRequests.map(r => {
                    const plain = r.get({ plain: true });
                    plain.resource_origin = 'request';
                    return plain;
                })
            ];

            return await Promise.all(allResults.map(async (item) => {
                const currentStepId = item.current_step_id ? Number(item.current_step_id) : null;
                const isAuthorized = authorizedStepIds.map(Number).includes(currentStepId);

                if (item.status !== 'pending' || !currentStepId || !isAuthorized) {
                    item.can_action = false;
                } else {
                    const Model = item.resource_origin === 'return' ? Return : Request;
                    const instance = await Model.findByPk(item.id);
                    item.can_action = await workflowService.userCanApproveStep(user, instance, item.currentStep);
                }
                return item;
            }));
        } catch (error) {
            logger.error('Get return approvals error:', error);
            throw error;
        }
    }

    /**
     * Get approval history for a request.
     */
    async getApprovalHistory(companyId, requestId) {
        try {
            return await Approval.findAll({
                where: { 
                    request_id: requestId,
                    company_id: companyId 
                },
                include: [{
                    model: User,
                    as: 'approver',
                    attributes: ['id', 'first_name', 'last_name']
                }],
                order: [['approval_level', 'ASC'], ['created_at', 'ASC']]
            });
        } catch (error) {
            logger.error('Get approval history error:', error);
            throw error;
        }
    }
}

module.exports = new ApprovalService();