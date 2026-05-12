const { Workflow, WorkflowStep, WorkflowStatus, WorkflowRoute, Approval, ActivityLog, Role, OrganizationNode, Request } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const inventoryService = require('./inventoryService');

class WorkflowService {
    /**
     * Finds the active workflow for a specific resource type and node scope.
     */
    async getActiveWorkflow(companyId, orgNodeId, resourceType) {
        // Hierarchical Resolution: Find the most specific workflow in the ancestry chain
        let ancestorIds = [];
        if (orgNodeId) {
            const node = await OrganizationNode.findByPk(orgNodeId);
            if (node && node.path) {
                // Parse path "/1/5/12/" into [1, 5, 12]
                ancestorIds = node.path.split('/').filter(id => id !== '').map(id => Number(id));
            } else if (node) {
                ancestorIds = [node.id];
            }
        }

        return await Workflow.findOne({
            where: {
                company_id: companyId,
                resource_type: resourceType,
                is_active: true,
                [Op.or]: [
                    { org_node_id: { [Op.in]: ancestorIds } },
                    { org_node_id: null }
                ]
            },
            include: [
                {
                    model: WorkflowStep,
                    as: 'steps',
                    include: [
                        { model: Role, as: 'requiredRole' },
                        { model: WorkflowStatus, as: 'statusLabel' }
                    ]
                },
                {
                    model: WorkflowRoute,
                    as: 'routes'
                }
            ],
            order: [
                // Priority logic:
                // 1. Specific node/ancestor workflows vs Global (null)
                // 2. Among ancestors, order by specificity (deepest node first)
                // We achieve this by ordering by org_node_id descending (nulls last) 
                // and then potentially by a secondary metric if we need more precision.
                // For materialized paths, deeper nodes have IDs that appear later in the ancestry list.
                ['org_node_id', 'DESC NULLS LAST'], 
                [{ model: WorkflowStep, as: 'steps' }, 'step_order', 'ASC']
            ]
        });
    }

    /**
     * Initialize a resource with a workflow if applicable.
     */
    async initializeWorkflow(resource, resourceType, options = {}) {
        const t = options.transaction || null;
        try {
            const nodeId = resource.org_node_id || resource.from_node_id || resource.to_node_id;
            const workflow = await this.getActiveWorkflow(resource.company_id, nodeId, resourceType);

            if (!workflow || !workflow.steps || workflow.steps.length === 0) {
                await resource.update({ 
                    status: 'approved',
                    workflow_status: 'Approved (No Workflow Defined)'
                }, { transaction: t });
                return null;
            }

            // First try to find a route with no source_step_id (explicit entry point)
            const entryRoute = workflow.routes.find(r => r.source_step_id === null);
            let firstStep = null;
            
            if (entryRoute && entryRoute.target_step_id) {
                firstStep = workflow.steps.find(s => s.id === entryRoute.target_step_id);
            } else {
                // Find the first step by ordering them and taking the first one
                const sortedSteps = [...workflow.steps].sort((a, b) => a.step_order - b.step_order);
                firstStep = sortedSteps[0];
            }

            if (!firstStep) throw new Error('No starting step found for workflow');

            const roleName = firstStep.requiredRole ? firstStep.requiredRole.name : 'Authorized Personnel';
            const labelName = firstStep.status_label_override || (firstStep.statusLabel ? firstStep.statusLabel.name : `Pending ${roleName}`);

            await resource.update({
                workflow_id: workflow.id,
                current_step_id: firstStep.id,
                status: 'pending',
                workflow_status: labelName
            }, { transaction: t });

            return workflow;
        } catch (error) {
            logger.error('Workflow initialization error:', error);
            throw error;
        }
    }

    /**
     * Checks if a user has the authority to approve a specific step for a given resource.
     * Respects branch scoping and hierarchical node authority.
     */
    async userCanApproveStep(user, resource, step, providedPermissions = null, providedAllowedNodes = null) {
        if (!user || !resource || !step) {
            return false;
        }

        // ─── PRIORITY 0: ALREADY ACTED CHECK ───
        // If the user has already approved any part of this request, they shouldn't action it again
        // in a multi-step workflow (enforces 4-eyes principle)
        const hasAlreadyActed = await Approval.findOne({
            where: {
                [Op.or]: [
                    { request_id: resource.id },
                    { discharge_form_id: resource.id },
                    { store_form_id: resource.id }
                ],
                approver_id: user.id
            }
        });

        if (hasAlreadyActed) {
            return false;
        }
        
        const permissions = providedPermissions || await require('../middleware/permissions').getEffectivePermissions(user);
        
        // ─── PRIORITY 1: GLOBAL OVERRIDES ───
        const isGlobalAdmin = permissions.includes('system:manage') || permissions.includes('workflow:process');
        if (isGlobalAdmin) return true;

        // ─── PRIORITY 2: RESOURCE IDENTITY CHECK (Receiver Bypass) ───
        const isTargetUser = (resource.target_user_id && Number(resource.target_user_id) === Number(user.id)) || 
                             (resource.to_user_id && Number(resource.to_user_id) === Number(user.id));
        
        if (isTargetUser) {
            return true;
        }

        // ─── PRIORITY 3: PERMISSION & ROLE VALIDATION ───
        const userRoleId = Number(user.role?.id || user.role_id);
        const isAssignedRole = step.required_role_id && userRoleId === Number(step.required_role_id);

        // If the user is specifically assigned to this step by role, GRANT immediately
        if (isAssignedRole) {
            return true;
        }

        // Branch-scoped check for general approval permissions
        const resourceTag = (step.workflow?.resource_type || 'request').replace('inventory_', '');
        const hasApprovePower = permissions.some(p => 
            p === step.required_permission || 
            p === `${resourceTag}:approve` || 
            p === `${resourceTag}:execute` ||
            p === 'request:approve' || 
            p === 'transfer:approve' ||
            p === 'inventory:manage'
        );

        if (hasApprovePower) {
            try {
                // Optimization: Use provided allowedNodes to avoid N+1 queries
                const allowedNodes = providedAllowedNodes || await require('./hierarchyService').getAllowedNodes(user, permissions);
                
                const nodeIds = [
                    resource.from_node_id,
                    resource.to_node_id,
                    resource.org_node_id,
                    resource.target_node_id
                ].filter(id => id !== null && id !== undefined).map(Number);
                
                if (nodeIds.some(nodeId => allowedNodes.includes(nodeId))) {
                    return true;
                }
            } catch (error) {
                logger.error('[AuthTrace] Branch check error:', error);
            }
        }

        return false;
    }

    /**
     * Advance a resource through its assigned workflow.
     */
    async advanceWorkflow(resource, resourceType, approver, comments = '', actionTaken = 'approve', options = {}) {
        try {
            if (!resource.workflow_id || !resource.current_step_id) {
                // Check if we can initialize it now if it was missed
                const workflow = await this.initializeWorkflow(resource, resourceType);
                if (!workflow) return { resource, isFinalStep: true };
            }

            const currentStep = await WorkflowStep.findByPk(resource.current_step_id, {
                include: [{ model: Role, as: 'requiredRole' }]
            });

            if (!currentStep) {
                throw new Error('Current workflow step not found');
            }

            // Security Check
            const authorized = await this.userCanApproveStep(approver, resource, currentStep);
            if (!authorized) {
                const roleName = currentStep.requiredRole ? currentStep.requiredRole.name : 'a specific role';
                throw new Error(`Authorization Failure: Access denied for this branch or permission level (${currentStep.required_permission || 'Generic Approval'}).`);
            }

            // Record the approval with polymorphic model linking
            const approvalData = {
                company_id: approver.company_id,
                approver_id: approver.id,
                approval_level: currentStep.step_order,
                status: 'approved',
                comments,
                approved_at: new Date()
            };

            // Dynamic ID mapping based on model constructor name (Reliable)
            const modelName = resource.constructor.name;
            if (modelName === 'Request') {
                approvalData.request_id = resource.id;
            } else if (modelName === 'DischargeForm') {
                approvalData.discharge_form_id = resource.id;
            } else if (modelName === 'StoreForm') {
                approvalData.store_form_id = resource.id;
            } else {
                // For all other models (Transfers, Returns etc) that share the Request schema
                approvalData.request_id = resource.id;
            }

            const approval = await Approval.create(approvalData);

            // Find next step using routes
            const route = await WorkflowRoute.findOne({
                where: {
                    workflow_id: resource.workflow_id,
                    source_step_id: currentStep.id,
                    action_trigger: actionTaken
                },
                include: [{
                    model: WorkflowStep,
                    as: 'targetStep',
                    include: [
                        { model: Role, as: 'requiredRole' },
                        { model: WorkflowStatus, as: 'statusLabel' }
                    ]
                }]
            });

            // Legacy fallback if no routes exist
            let nextStep = route ? route.targetStep : null;
            if (!route) {
                nextStep = await WorkflowStep.findOne({
                    where: {
                        workflow_id: resource.workflow_id,
                        step_order: { [Op.gt]: currentStep.step_order }
                    },
                    include: [
                        { model: Role, as: 'requiredRole' },
                        { model: WorkflowStatus, as: 'statusLabel' }
                    ],
                    order: [['step_order', 'ASC']]
                });
            }

            let isFinalStep = false;
            let nextStatus = 'approved';
            let nextWorkflowStatus = 'Approved';
            let nextStepId = null;

            if (nextStep) {
                const nextRoleName = nextStep.requiredRole ? nextStep.requiredRole.name : 'Authorized Personnel';
                nextStatus = 'pending';
                nextWorkflowStatus = nextStep.status_label_override || (nextStep.statusLabel ? nextStep.statusLabel.name : `Pending ${nextRoleName}`);
                nextStepId = nextStep.id;
            } else {
                isFinalStep = true;
                // DYNAMIC EXECUTION: If this is the final step for a discharge, perform physical movement
                if (resourceType === 'inventory_discharge') {
                    await inventoryService.executeDischarge(resource, approver);
                    nextStatus = 'completed';
                    nextWorkflowStatus = 'Discharged (Final)';

                    // If linked to a request, fulfill it
                    if (resource.request_id) {
                        await Request.update(
                            { status: 'fulfilled', completed_date: new Date() },
                            { where: { id: resource.request_id, company_id: approver.company_id } }
                        );
                    }
                } else if (resourceType === 'inventory_transfer' || resourceType === 'transfer') {
                    if (modelName === 'Transfer') {
                        await inventoryService.executeTransfer(resource, approver);
                        nextStatus = 'completed';
                        nextWorkflowStatus = 'Transferred (Final)';
                    } else if (modelName === 'Request') {
                        // For User-to-User requests, use the centralized requestService
                        const requestService = require('./requestService');
                        await requestService.fulfillRequest(resource.id, approver.company_id, approver, { 
                            workflowStatus: 'Fulfilled (Final)',
                            transaction: options.transaction 
                        });
                        nextStatus = 'fulfilled';
                        nextWorkflowStatus = 'Fulfilled (Final)';
                    } else {
                        // Fallback
                        await inventoryService.executeTransfer(resource, approver);
                        nextStatus = 'completed';
                    }
                } else if (resourceType === 'inventory_return' || resourceType === 'return' || resourceType === 'request') {
                    if (modelName === 'Request') {
                         const requestService = require('./requestService');
                         await requestService.fulfillRequest(resource.id, approver.company_id, approver, { 
                            workflowStatus: 'Fulfilled (Final)',
                            transaction: options.transaction 
                         });
                         nextStatus = 'fulfilled';
                         nextWorkflowStatus = 'Fulfilled (Final)';
                    } else {
                        const returnService = require('./returnService');
                        await returnService.approveInventoryReturn(resource.id, resource.company_id, approver.id);
                        nextStatus = 'completed';
                        nextWorkflowStatus = 'Returned & Restocked (Final)';
                    }
                }
            }

            await resource.update({
                status: nextStatus,
                workflow_status: nextWorkflowStatus,
                current_step_id: nextStepId
            });

            await ActivityLog.create({
                company_id: approver.company_id,
                user_id: approver.id,
                action: `WORKFLOW_APPROVE`,
                resource: resourceType + 's',
                resource_id: resource.id,
                details: { comments, step_order: currentStep.step_order, isFinalStep, label: currentStep.statusLabel?.name }
            });

            return { resource, approval, isFinalStep };
        } catch (error) {
            logger.error('Workflow advance error:', error);
            throw error;
        }
    }

    /**
     * Reject a workflow step or the entire resource.
     */
    async rejectWorkflow(resource, resourceType, rejecter, reason = '') {
        try {
            if (!resource.current_step_id) {
                throw new Error('Not currently in a workflow step');
            }

            const currentStep = await WorkflowStep.findByPk(resource.current_step_id);

            // Security Check: Approver/Rejecter must have authority over this branch/step
            const authorized = await this.userCanApproveStep(rejecter, resource, currentStep);
            if (!authorized) {
                throw new Error(`Authorization Failure: Access denied for this branch or permission level.`);
            }

            // Record rejection with polymorphic model linking
            const approvalData = {
                company_id: rejecter.company_id,
                approver_id: rejecter.id,
                approval_level: currentStep?.step_order || 0,
                status: 'rejected',
                comments: reason,
                approved_at: new Date()
            };

            const modelName = resource.constructor.name;
            if (modelName === 'Request') {
                approvalData.request_id = resource.id;
            } else if (modelName === 'DischargeForm') {
                approvalData.discharge_form_id = resource.id;
            } else if (modelName === 'StoreForm') {
                approvalData.store_form_id = resource.id;
            } else if (modelName === 'Transfer') {
                approvalData.transfer_id = resource.id;
            } else if (modelName === 'Return') {
                approvalData.return_id = resource.id;
            } else {
                approvalData.request_id = resource.id;
            }

            const approval = await Approval.create(approvalData);

            const route = await WorkflowRoute.findOne({
                where: {
                    workflow_id: resource.workflow_id,
                    source_step_id: currentStep.id,
                    action_trigger: 'reject'
                },
                include: [{
                    model: WorkflowStep,
                    as: 'targetStep',
                    include: [
                        { model: Role, as: 'requiredRole' },
                        { model: WorkflowStatus, as: 'statusLabel' }
                    ]
                }]
            });

            if (route && route.targetStep) {
                const targetStep = route.targetStep;
                const nextRoleName = targetStep.requiredRole ? targetStep.requiredRole.name : 'Authorized Personnel';
                const nextWorkflowStatus = targetStep.statusLabel ? targetStep.statusLabel.name : `Returned to ${nextRoleName}`;

                await resource.update({
                    status: 'pending',
                    workflow_status: nextWorkflowStatus,
                    current_step_id: targetStep.id
                });
            } else {
                // Global rejection if no specific reject route
                await resource.update({
                    status: 'rejected',
                    workflow_status: 'Rejected',
                    current_step_id: null
                });
            }

            await ActivityLog.create({
                company_id: rejecter.company_id,
                user_id: rejecter.id,
                action: `WORKFLOW_REJECT`,
                resource: resourceType + 's',
                resource_id: resource.id,
                details: { reason, step_order: currentStep?.step_order }
            });

            return { resource, approval };
        } catch (error) {
            logger.error('Workflow reject error:', error);
            throw error;
        }
    }

    /**
     * Finds all WorkflowStep IDs that the user is authorized to approve/act upon.
     * This is the engine room for the "Inbox / Pending Approvals" logic.
     */
    async getAuthorizedStepIds(companyId, user) {
        if (!user) return [];
        
        const permissionHelper = require('../middleware/permissions');
        const permissions = await permissionHelper.getEffectivePermissions(user);
        const userRoleId = Number(user.role?.id || user.role_id);
        const roleLevel = user.role?.level || 0;

        // DYNAMIC AUTH: Check for ANY relevant approval power
        const hasAnyApprovalPower = permissions.some(p => 
            p.includes(':approve') || p.includes(':execute') || 
            p === 'system:manage' || p === 'workflow:process'
        );

        if (!hasAnyApprovalPower) {
            return [];
        }

        // 2. Fetch all steps for this company
        const candidateSteps = await WorkflowStep.findAll({
            include: [{
                model: Workflow,
                as: 'workflow',
                where: { company_id: companyId }
            }],
            attributes: ['id', 'required_role_id', 'required_permission']
        });

        // 3. Filter steps using the OR logic for Role and Permission
        const authorizedSteps = candidateSteps.filter(step => {
            const stepRoleId = step.required_role_id ? Number(step.required_role_id) : null;
            
            let roleMatch = false;
            if (stepRoleId && stepRoleId === userRoleId) {
                roleMatch = true;
            }

            let permMatch = false;
            if (step.required_permission) {
                permMatch = permissions.some(p => 
                    p === step.required_permission || 
                    p.startsWith(`${step.required_permission}-`) || 
                    p.startsWith(`${step.required_permission}:`) ||
                    (p.includes(':*') && step.required_permission.startsWith(p.split(':*')[0]))
                );
            }

            if (!stepRoleId && !step.required_permission) return false;

            return roleMatch || permMatch;
        });

        return authorizedSteps.map(s => s.id);
    }
}

module.exports = new WorkflowService();
