const { Workflow, WorkflowStep, WorkflowRoute, ActivityLog, Role } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const workflowService = require('../services/workflowService');
const hierarchyService = require('../services/hierarchyService');
const { getEffectivePermissions } = require('../middleware/permissions');

const workflowController = {
    async getAll(req, res, next) {
        try {
            const company_id = req.user.company_id;
            
            // SECURITY: Strict multi-tenancy enforcement
            if (!company_id) {
                return res.json({ success: true, data: [] });
            }

            const permissions = await getEffectivePermissions(req.user);
            const isSuperAdmin = req.user.role?.level >= 100;
            
            let where = { company_id };

            // If not a Super Admin, restrict to allowed nodes
            if (!isSuperAdmin) {
                const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
                where[Op.or] = [
                    { org_node_id: { [Op.in]: allowedNodes } },
                    { org_node_id: null } // Include global company workflows
                ];
            }

            const workflows = await Workflow.findAll({
                where,
                include: [
                    { model: WorkflowStep, as: 'steps' },
                    { model: WorkflowRoute, as: 'routes' }
                ],
                order: [['created_at', 'DESC']]
            });
            res.json({ success: true, data: workflows });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get the currently active workflow for a given resource type and organization node.
     * Used by the frontend client to display the exact approval steps defined in Process Designer.
     */
    async getActiveConfiguration(req, res, next) {
        try {
            const { resource_type } = req.query;
            if (!resource_type) {
                return res.status(400).json({ success: false, message: 'resource_type query parameter is required' });
            }

            const company_id = req.user.company_id;
            const org_node_id = req.user.org_node_id;

            const workflow = await workflowService.getActiveWorkflow(company_id, org_node_id, resource_type);

            if (!workflow) {
                return res.json({ success: true, data: null, message: 'No active workflow defined for this scope' });
            }

            res.json({ success: true, data: workflow });
        } catch (error) {
            next(error);
        }
    },

    async create(req, res, next) {
        // Now supporting 'nodes' and 'edges' from React Flow
        const { name, resource_type, org_node_id, nodes, edges } = req.body;
        const company_id = req.user.company_id;
        
        try {
            // ─── DUPLICATE PREVENTION ───
            // Ensure only one master workflow exists per resource type per node
            const existing = await Workflow.findOne({
                where: { 
                    company_id, 
                    resource_type, 
                    org_node_id: org_node_id || null 
                }
            });

            if (existing) {
                return res.status(409).json({ 
                    success: false, 
                    message: `A workflow for "${resource_type}" already exists. Please edit the existing configuration.`,
                    existing_id: existing.id
                });
            }

            const workflow = await Workflow.create({
                company_id,
                org_node_id: org_node_id || null,
                name,
                resource_type,
                created_by: req.user.id
            });

            const stepIdMap = {}; // Maps UI Node ID to Database Step ID

            if (nodes && nodes.length > 0) {
                for (const node of nodes) {
                    const step = await WorkflowStep.create({
                        workflow_id: workflow.id,
                        step_order: 0, // No longer strictly linear
                        required_role_id: node.data.required_role_id || null,
                        status_id: node.data.status_id || null,
                        action_name: node.data.action_name || 'approval_step'
                    });
                    stepIdMap[node.id] = step.id;
                }
            }

            if (edges && edges.length > 0) {
                await Promise.all(edges.map(edge => WorkflowRoute.create({
                    workflow_id: workflow.id,
                    source_step_id: stepIdMap[edge.source] || null,
                    target_step_id: stepIdMap[edge.target] || null,
                    action_trigger: edge.sourceHandle || 'approve' // E.g., 'approve_handle', 'reject_handle'
                })));
            }

            // Sequential Step Processing (User-friendly list mode)
            if (req.body.steps && req.body.steps.length > 0) {
                const createdSteps = [];
                for (let i = 0; i < req.body.steps.length; i++) {
                    const roleId = req.body.steps[i];
                    const role = await Role.findByPk(roleId);
                    const roleName = role ? role.name : 'Authorized Personnel';

                    const step = await WorkflowStep.create({
                        workflow_id: workflow.id,
                        step_order: i + 1,
                        required_role_id: roleId,
                        action_name: `approve_${roleName.toLowerCase().replace(/\s+/g, '_')}`,
                        status_label_override: `Pending ${roleName}`
                    });
                    
                    createdSteps.push(step);

                    // Auto-link to the previous step in the chain
                    if (i > 0) {
                        await WorkflowRoute.create({
                            workflow_id: workflow.id,
                            source_step_id: createdSteps[i - 1].id,
                            target_step_id: step.id,
                            action_trigger: 'approve'
                        });
                    } else {
                        // First step: Create an explicit entry route
                        await WorkflowRoute.create({
                            workflow_id: workflow.id,
                            source_step_id: null,
                            target_step_id: step.id,
                            action_trigger: 'approve'
                        });
                    }
                }
            }

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'CREATE',
                resource: 'workflows',
                resource_id: workflow.id,
                details: { name, resource_type }
            });

            const fullWorkflow = await Workflow.findByPk(workflow.id, { 
                include: [
                    { model: WorkflowStep, as: 'steps' },
                    { model: WorkflowRoute, as: 'routes' }
                ] 
            });
            res.status(201).json({ success: true, data: fullWorkflow });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Update existing workflow.
     * Uses a wipe-and-rebuild strategy for steps and routes for atomic consistency.
     */
    async update(req, res, next) {
        const { id } = req.params;
        const { name, nodes, edges, steps } = req.body;
        const company_id = req.user.company_id;

        try {
            const workflow = await Workflow.findOne({ where: { id, company_id } });
            if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

            // Update basic details
            await workflow.update({ name });

            // Clear existing logic to rebuild
            await WorkflowRoute.destroy({ where: { workflow_id: id } });
            await WorkflowStep.destroy({ where: { workflow_id: id } });

            const stepIdMap = {};

            // Rebuild from Flow Data (Complex Mode)
            if (nodes && nodes.length > 0) {
                for (const node of nodes) {
                    const step = await WorkflowStep.create({
                        workflow_id: id,
                        step_order: 0,
                        required_role_id: node.data.required_role_id || null,
                        status_id: node.data.status_id || null,
                        action_name: node.data.action_name || 'approval_step'
                    });
                    stepIdMap[node.id] = step.id;
                }

                if (edges && edges.length > 0) {
                    await Promise.all(edges.map(edge => WorkflowRoute.create({
                        workflow_id: id,
                        source_step_id: stepIdMap[edge.source] || null,
                        target_step_id: stepIdMap[edge.target] || null,
                        action_trigger: edge.sourceHandle || 'approve'
                    })));
                }
            }

            // Rebuild from List Data (Linear Mode)
            if (steps && steps.length > 0) {
                const createdSteps = [];
                for (let i = 0; i < steps.length; i++) {
                    const roleId = steps[i];
                    const role = await Role.findByPk(roleId);
                    const roleName = role ? role.name : 'Authorized Personnel';

                    const step = await WorkflowStep.create({
                        workflow_id: id,
                        step_order: i + 1,
                        required_role_id: roleId,
                        action_name: `approve_${roleName.toLowerCase().replace(/\s+/g, '_')}`,
                        status_label_override: `Pending ${roleName}`
                    });
                    createdSteps.push(step);

                    if (i > 0) {
                        await WorkflowRoute.create({
                            workflow_id: id,
                            source_step_id: createdSteps[i - 1].id,
                            target_step_id: step.id,
                            action_trigger: 'approve'
                        });
                    } else {
                        await WorkflowRoute.create({
                            workflow_id: id,
                            source_step_id: null,
                            target_step_id: step.id,
                            action_trigger: 'approve'
                        });
                    }
                }
            }

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'UPDATE',
                resource: 'workflows',
                resource_id: id,
                details: { name }
            });

            const fullWorkflow = await Workflow.findByPk(id, { 
                include: [
                    { model: WorkflowStep, as: 'steps' },
                    { model: WorkflowRoute, as: 'routes' }
                ] 
            });
            res.json({ success: true, data: fullWorkflow });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Delete workflow.
     */
    async delete(req, res, next) {
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;
            const workflow = await Workflow.findOne({ where: { id, company_id } });
            if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

            await workflow.destroy();
            res.json({ success: true, message: 'Workflow deleted' });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = workflowController;
