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
                    workflow_status: 'Approved'
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
    async userCanApproveStep(user, resource, step, providedPermissions = null, providedAllowedNodes = undefined, userApprovals = null) {
        if (!user || !resource || !step) {
            return false;
        }

        const status = (resource.status || '').toLowerCase();
        if (status !== 'pending' && !status.startsWith('pending')) {
            return false;
        }

        const permissions = providedPermissions || await require('../middleware/permissions').getEffectivePermissions(user);
        
        // Determine the exact column matching the resource type to avoid cross-resource ID clashes (4-Eyes Principle)
        let resourceCol = 'request_id';
        if (resource.discharge_number !== undefined || resource.discharge_type !== undefined || resource.constructor.name === 'DischargeForm' || resource.resource_origin === 'discharge' || step.workflow?.resource_type === 'discharge' || step.workflow?.resource_type === 'inventory_discharge') {
            resourceCol = 'discharge_form_id';
        } else if (resource.store_number !== undefined || resource.store_type !== undefined || resource.constructor.name === 'StoreForm' || resource.resource_origin === 'store' || step.workflow?.resource_type === 'store' || step.workflow?.resource_type === 'inventory_store') {
            resourceCol = 'store_form_id';
        } else if (resource.transfer_number !== undefined || resource.transfer_type !== undefined || resource.constructor.name === 'Transfer' || resource.resource_origin === 'transfer' || step.workflow?.resource_type === 'transfer' || step.workflow?.resource_type === 'inventory_transfer') {
            resourceCol = 'transfer_id';
        } else if (resource.return_number !== undefined || resource.return_type !== undefined || resource.constructor.name === 'Return' || resource.resource_origin === 'return' || step.workflow?.resource_type === 'return' || step.workflow?.resource_type === 'inventory_return') {
            resourceCol = 'return_id';
        }

        // ─── PRIORITY 2: ALREADY ACTED CHECK (4-Eyes Principle) ───
        let hasAlreadyActed = false;
        if (Array.isArray(userApprovals)) {
            hasAlreadyActed = userApprovals.some(app => 
                app[resourceCol] && Number(app[resourceCol]) === Number(resource.id)
            );
        } else {
            const approvalRecord = await Approval.findOne({
                where: {
                    [resourceCol]: resource.id,
                    approver_id: user.id
                }
            });
            hasAlreadyActed = !!approvalRecord;
        }

        if (hasAlreadyActed) {
            return false;
        }

        // ─── PRIORITY 3: TARGET USER / RECEIVER SCOPING FOR TRANSFERS ───
        // If the current user is the designated recipient of this request or transfer,
        // they are ALWAYS authorized to approve/action their own step — regardless of
        // what role name is assigned to the workflow step. Workflow steps are assigned
        // to the INITIATOR's approval chain; the recipient must not be blocked just
        // because their role doesn't match the step's required role.
        const isTargetUser = (resource.target_user_id && Number(resource.target_user_id) === Number(user.id)) || 
                             (resource.to_user_id && Number(resource.to_user_id) === Number(user.id));
        
        if (isTargetUser) {
            return true;
        }

        // ─── PRIORITY 4: AUTHORIZATION VALIDATION (Strict Role + Admin Bypass) ───
        const userRoleIds = new Set();
        if (user.role_id) userRoleIds.add(Number(user.role_id));
        if (user.role?.id) userRoleIds.add(Number(user.role.id));

        // Load secondary roles from UserRole table
        try {
            const UserRoleModel = require('../models').UserRole;
            if (UserRoleModel) {
                const assignedUserRoles = await UserRoleModel.findAll({
                    where: { user_id: user.id },
                    attributes: ['role_id'],
                    raw: true
                });
                assignedUserRoles.forEach(ur => userRoleIds.add(Number(ur.role_id)));
            }
        } catch (e) {
            logger.error('[WorkflowService] Failed to load secondary roles in userCanApproveStep:', e);
        }

        const isAssignedRole = step.required_role_id && userRoleIds.has(Number(step.required_role_id));
        const isSuperAdminOrGlobal = (user.role?.level >= 100) || permissions.includes('system:manage') || permissions.includes('hierarchy:all:view');

        // Only assigned roles or Super Admin / System Manager / Global Viewer can approve
        const hasApprovePower = isAssignedRole || isSuperAdminOrGlobal;

        if (hasApprovePower) {
            try {
                if (isSuperAdminOrGlobal) {
                    return true;
                }

                // Hierarchical Enforcement: User must be in the branch hierarchy of the resource.
                // We resolve the user's allowed nodes strictly by their assigned branch structure,
                // completely ignoring system-wide global visibility overrides (so Super Admins
                // or Global Managers cannot approve steps unless they are explicitly assigned to the branch hierarchy).
                let allowedNodes = [];
                if (providedAllowedNodes !== undefined && providedAllowedNodes !== null) {
                    allowedNodes = providedAllowedNodes;
                }
                
                // If allowedNodes is null or undefined, calculate the user's allowed nodes strictly
                // by their assigned branch structure, completely ignoring system-wide global visibility overrides.
                if (providedAllowedNodes === null || providedAllowedNodes === undefined) {
                    const seedPaths = [];
                    if (user.organizationNode && user.organizationNode.path) {
                        seedPaths.push(user.organizationNode.path);
                    } else if (user.org_node_id) {
                        const node = await OrganizationNode.findByPk(user.org_node_id, { attributes: ['path'] });
                        if (node && node.path) seedPaths.push(node.path);
                    }
                    if (user.authorizedNodes && user.authorizedNodes.length > 0) {
                        user.authorizedNodes.forEach(node => {
                            if (node.path && !seedPaths.includes(node.path)) {
                                seedPaths.push(node.path);
                            }
                        });
                    }

                    if (seedPaths.length > 0) {
                        const descendants = await OrganizationNode.findAll({
                            where: {
                                [Op.or]: seedPaths.map(p => ({
                                    path: { [Op.like]: `${p}%` }
                                })),
                                status: { [Op.ne]: 'archived' }
                            },
                            attributes: ['id'],
                            raw: true
                        });
                        allowedNodes = [...new Set(descendants.map(d => d.id))];
                    }
                }
                
                const isTransfer = (step.workflow?.resource_type === 'inventory_transfer' || step.workflow?.resource_type === 'transfer' || resource.request_type === 'transfer');
                const isReturn = (step.workflow?.resource_type === 'inventory_return' || step.workflow?.resource_type === 'return' || resource.request_type === 'return' || resource.return_type !== undefined);
                const isDischarge = (step.workflow?.resource_type === 'inventory_discharge' || step.workflow?.resource_type === 'discharge' || resource.constructor.name === 'DischargeForm' || resource.discharge_type !== undefined);

                if (isReturn) {
                    // ─── RETURN-SPECIFIC BRANCH CHECK ───
                    // Two kinds of "return" resources reach this path:
                    //
                    // (A) Return table records (POST /returns) — have from_node_id & to_node_id.
                    //     Approver can be at EITHER the FROM or TO node branch.
                    //
                    // (B) Request table records (POST /requests, request_type='return') from
                    //     ReturnAssetPage — have ONLY org_node_id, no from/to node IDs.
                    //     Fall back to the standard allowedNodes scope check.

                    const fromNodeId = resource.from_node_id ? Number(resource.from_node_id) : null;
                    const toNodeId   = resource.to_node_id   ? Number(resource.to_node_id)   : null;

                    const userNodeId = user.org_node_id ? Number(user.org_node_id) : null;
                    if (!userNodeId) return false;

                    // ── Case B: Request-based return (org_node_id only) ──
                    // ReturnAssetPage posts to /requests with request_type='return'.
                    // Those records only have org_node_id (the requester's branch).
                    // Treat org_node_id as the TARGET node — an approver is authorized
                    // when their node IS the target node, or when the target node falls
                    // within their allowed scope (i.e. they manage that branch).
                    if (!fromNodeId && !toNodeId) {
                        const orgNodeId = resource.org_node_id ? Number(resource.org_node_id) : null;
                        if (!orgNodeId) return false;

                        // Direct match: approver is AT the same node as the requester
                        if (userNodeId === orgNodeId) return true;

                        // Scope match: approver's authorized scope includes the target node
                        // allowedNodes === null means global/super-admin access → always allowed
                        if (allowedNodes === null) return true;
                        if (Array.isArray(allowedNodes) && allowedNodes.includes(orgNodeId)) return true;

                        return false;
                    }

                    // ── Case A: Return-table record (from_node_id / to_node_id present) ──
                    // Fast exact-match checks
                    if (fromNodeId && userNodeId === fromNodeId) return true;
                    if (toNodeId   && userNodeId === toNodeId)   return true;

                    // Get user's materialized path (one DB hit)
                    let userPath = user.organizationNode?.path || null;
                    if (!userPath) {
                        const uNode = await OrganizationNode.findByPk(userNodeId, { attributes: ['path'] });
                        userPath = uNode?.path || null;
                    }
                    if (!userPath) return false;

                    // Check if user is inside the FROM node's branch hierarchy
                    if (fromNodeId) {
                        const fromNode = await OrganizationNode.findByPk(fromNodeId, { attributes: ['path'] });
                        if (fromNode?.path && userPath.startsWith(fromNode.path)) return true;
                    }

                    // Check if user is inside the TO node's branch hierarchy
                    if (toNodeId) {
                        const toNode = await OrganizationNode.findByPk(toNodeId, { attributes: ['path'] });
                        if (toNode?.path && userPath.startsWith(toNode.path)) return true;
                    }

                    return false;

                } else {
                    // ─── TRANSFER, DISCHARGE & ALL OTHER RESOURCES: existing allowedNodes check ───
                    let nodeIds = [];
                    if (isTransfer || isDischarge) {
                        nodeIds = [
                            resource.from_node_id,
                            resource.org_node_id
                        ].filter(id => id !== null && id !== undefined).map(Number);
                    } else {
                        nodeIds = [
                            resource.from_node_id,
                            resource.to_node_id,
                            resource.org_node_id,
                            resource.target_node_id
                        ].filter(id => id !== null && id !== undefined).map(Number);
                    }

                    if (nodeIds.some(nodeId => allowedNodes.includes(nodeId))) {
                        return true;
                    }
                }
            } catch (error) {
                logger.error('[AuthTrace] Branch check error:', error);
            }
        }

        return false;
    }

    /**
     * Checks if a specific step is the final step in a workflow.
     */
    async isFinalStep(resource, stepId, allRoutes = null, allSteps = null) {
        if (!resource.workflow_id || !stepId) return false;

        if (Array.isArray(allRoutes) && Array.isArray(allSteps)) {
            // Check if there are any routes leaving this step for 'approve'
            const route = allRoutes.find(r => 
                Number(r.workflow_id) === Number(resource.workflow_id) && 
                r.source_step_id && Number(r.source_step_id) === Number(stepId) && 
                r.action_trigger === 'approve'
            );

            if (route && route.target_step_id) return false;

            // Fallback: Check if there's any step with a higher order
            const currentStep = allSteps.find(s => Number(s.id) === Number(stepId));
            if (!currentStep) return false;

            const nextStep = allSteps.find(s => 
                Number(s.workflow_id) === Number(resource.workflow_id) && 
                s.step_order > currentStep.step_order
            );

            return !nextStep;
        }

        // Check if there are any routes leaving this step for 'approve'
        const route = await WorkflowRoute.findOne({
            where: {
                workflow_id: resource.workflow_id,
                source_step_id: stepId,
                action_trigger: 'approve'
            }
        });

        if (route && route.target_step_id) return false;

        // Fallback: Check if there's any step with a higher order
        const currentStep = await WorkflowStep.findByPk(stepId);
        if (!currentStep) return false;

        const nextStep = await WorkflowStep.findOne({
            where: {
                workflow_id: resource.workflow_id,
                step_order: { [Op.gt]: currentStep.step_order }
            }
        });

        return !nextStep;
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
                include: [
                    { model: Role, as: 'requiredRole' },
                    { model: Workflow, as: 'workflow' }
                ]
            });

            if (!currentStep) {
                throw new Error('Current workflow step not found');
            }

            // Pre-load approver's org node if not already loaded, so branch scoping works correctly
            if (!approver.organizationNode && approver.org_node_id) {
                approver.organizationNode = await OrganizationNode.findByPk(approver.org_node_id, { attributes: ['id', 'path'] });
            }

            // Pre-compute permissions and allowedNodes so they are passed explicitly
            const permissionHelper = require('../middleware/permissions');
            const approverPermissions = await permissionHelper.getEffectivePermissions(approver);
            const hierarchyService = require('./hierarchyService');
            const approverAllowedNodes = await hierarchyService.getAllowedNodes(approver, approverPermissions);

            // Security Check
            const authorized = await this.userCanApproveStep(approver, resource, currentStep, approverPermissions, approverAllowedNodes);
            if (!authorized) {
                const roleName = currentStep.requiredRole ? currentStep.requiredRole.name : 'a specific role';
                const error = new Error(`Authorization Failure: Access denied for this branch or permission level (${currentStep.required_permission || 'Generic Approval'}).`);
                error.statusCode = 403;
                throw error;
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
            } else if (modelName === 'Transfer') {
                approvalData.transfer_id = resource.id;
            } else if (modelName === 'Return') {
                approvalData.return_id = resource.id;
            } else {
                // Fallback
                approvalData.request_id = resource.id;
            }

            const approval = await Approval.create(approvalData, { transaction: options.transaction });

            // Find next step using routes
            const route = await WorkflowRoute.findOne({
                where: {
                    workflow_id: resource.workflow_id,
                    source_step_id: currentStep.id,
                    action_trigger: actionTaken
                },
                transaction: options.transaction,
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
                    transaction: options.transaction,
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

                // ── CATCH-ALL: Any Request model at the final step pauses for physical receipt ──
                if (modelName === 'Request') {
                    // Save the selected allocations so the acknowledge step can use them later
                    let existingNotes = {};
                    try { existingNotes = JSON.parse(resource.notes || '{}'); } catch(e) {}
                    await resource.update(
                        { notes: JSON.stringify({ ...existingNotes, _pending_allocations: options.allocations || {} }) },
                        { transaction: options.transaction }
                    );
                    nextStatus = 'pending_acknowledgment';
                    nextWorkflowStatus = 'Pending Receipt Acknowledgment';

                } else if (resourceType === 'inventory_discharge') {
                    await inventoryService.executeDischarge(resource, approver, { transaction: options.transaction });
                    nextStatus = 'completed';
                    nextWorkflowStatus = 'Discharged';

                    // If linked to a request, fulfill it
                    if (resource.request_id) {
                        await Request.update(
                            { status: 'fulfilled', completed_date: new Date() },
                            { where: { id: resource.request_id, company_id: approver.company_id }, transaction: options.transaction }
                        );
                    }
                } else if (resourceType === 'inventory_transfer' || resourceType === 'transfer') {
                    // Pause for physical acknowledgment by the recipient before moving inventory
                    nextStatus = 'pending_acknowledgment';
                    nextWorkflowStatus = 'Pending Recipient Acknowledgment';
                } else if (resourceType === 'inventory_return' || resourceType === 'return') {
                    // Pause for physical acknowledgment by the recipient at destination branch
                    nextStatus = 'pending_acknowledgment';
                    nextWorkflowStatus = 'Pending Receipt Acknowledgment';
                }
            }

            await resource.update({
                status: nextStatus,
                workflow_status: nextWorkflowStatus,
                current_step_id: nextStepId
            }, { transaction: options.transaction });

            await ActivityLog.create({
                company_id: approver.company_id,
                user_id: approver.id,
                action: `WORKFLOW_APPROVE`,
                resource: resourceType + 's',
                resource_id: resource.id,
                details: { comments, step_order: currentStep.step_order, isFinalStep, label: currentStep.statusLabel?.name }
            }, { transaction: options.transaction });

            return { resource, approval, isFinalStep };
        } catch (error) {
            logger.error('Workflow advance error:', error);
            throw error;
        }
    }

    /**
     * Reject a workflow step or the entire resource.
     */
    async rejectWorkflow(resource, resourceType, rejecter, reason = '', options = {}) {
        try {
            if (!resource.current_step_id) {
                throw new Error('Not currently in a workflow step');
            }

            const currentStep = await WorkflowStep.findByPk(resource.current_step_id);

            // Pre-load rejecter's org node if not already loaded, so branch scoping works correctly
            if (!rejecter.organizationNode && rejecter.org_node_id) {
                rejecter.organizationNode = await OrganizationNode.findByPk(rejecter.org_node_id, { attributes: ['id', 'path'] });
            }

            // Pre-compute permissions and allowedNodes so they are passed explicitly
            const permissionHelper = require('../middleware/permissions');
            const rejecterPermissions = await permissionHelper.getEffectivePermissions(rejecter);
            const hierarchyService = require('./hierarchyService');
            const rejecterAllowedNodes = await hierarchyService.getAllowedNodes(rejecter, rejecterPermissions);

            // Security Check: Approver/Rejecter must have authority over this branch/step
            const authorized = await this.userCanApproveStep(rejecter, resource, currentStep, rejecterPermissions, rejecterAllowedNodes);
            if (!authorized) {
                const error = new Error(`Authorization Failure: Access denied for this branch or permission level.`);
                error.statusCode = 403;
                throw error;
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

            const approval = await Approval.create(approvalData, { transaction: options.transaction });

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
                }],
                transaction: options.transaction
            });

            // The user explicitly requested that all rejections automatically transition the request's status to 'rejected'
            // and terminate the workflow, rather than rolling back to a previous reviewer in a pending state.
            await resource.update({
                status: 'rejected',
                workflow_status: 'Rejected',
                current_step_id: null
            }, { transaction: options.transaction });

            await ActivityLog.create({
                company_id: rejecter.company_id,
                user_id: rejecter.id,
                action: `WORKFLOW_REJECT`,
                resource: resourceType + 's',
                resource_id: resource.id,
                details: { reason, step_order: currentStep?.step_order }
            }, { transaction: options.transaction });

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
    async getAuthorizedStepIds(companyId, user, providedPermissions = null) {
        if (!user) return [];
        
        const permissionHelper = require('../middleware/permissions');
        const permissions = providedPermissions || await permissionHelper.getEffectivePermissions(user);
        const userRoleIds = new Set();
        if (user.role_id) userRoleIds.add(Number(user.role_id));
        if (user.role?.id) userRoleIds.add(Number(user.role.id));

        try {
            const UserRoleModel = require('../models').UserRole;
            if (UserRoleModel) {
                const assignedUserRoles = await UserRoleModel.findAll({
                    where: { user_id: user.id },
                    attributes: ['role_id'],
                    raw: true
                });
                assignedUserRoles.forEach(ur => userRoleIds.add(Number(ur.role_id)));
            }
        } catch (e) {
            logger.error('[WorkflowService] Failed to load secondary roles in getAuthorizedStepIds:', e);
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
            
            if (stepRoleId) {
                // If a specific role is required, the user must match that role
                return userRoleIds.has(stepRoleId);
            }

            if (step.required_permission) {
                return permissions.some(p => 
                    p === step.required_permission || 
                    p.startsWith(`${step.required_permission}-`) || 
                    p.startsWith(`${step.required_permission}:`) ||
                    (p.includes(':*') && step.required_permission.startsWith(p.split(':*')[0]))
                );
            }

            return false;
        });

        return authorizedSteps.map(s => s.id);
    }
}

module.exports = new WorkflowService();
