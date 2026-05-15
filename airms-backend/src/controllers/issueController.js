const { Issue, Assignment, User, Product, OrganizationNode, ActivityLog, sequelize } = require('../models');
const { validationResult } = require('express-validator');
const hierarchyService = require('../services/hierarchyService');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const workflowService = require('../services/workflowService');
const { getEffectivePermissions } = require('../middleware/permissions');

const issueController = {
    /**
     * Get all issues scoped to company and user's organizational scope.
     */
    async getAll(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 10, 
                org_node_id, 
                user_id,
                status,
                severity,
                issue_type,
                from_date,
                to_date 
            } = req.query;
            
            const company_id = req.user.company_id;
            const where = { company_id };

            const permissions = await getEffectivePermissions(req.user);
            const hasGlobalVisibility = permissions.includes('hierarchy:all:view') || permissions.includes('system:manage');

            // Hierarchical Scoping
            if (org_node_id) {
                const targetNodeId = Number(org_node_id);
                const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
                
                if (allowedNodes !== null && !allowedNodes.includes(targetNodeId)) {
                    return res.status(403).json({ success: false, message: 'Access denied: Target node is outside your visibility scope' });
                }
                
                const nodeIds = await hierarchyService.getDescendants(targetNodeId);
                where.org_node_id = { [Op.in]: nodeIds };
            } else if (!hasGlobalVisibility) {
                const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
                if (allowedNodes !== null) {
                    where.org_node_id = { [Op.in]: allowedNodes };
                }
            }

            if (user_id) where.user_id = user_id;
            if (status) where.status = status;
            if (severity) where.severity = severity;
            if (issue_type) where.issue_type = issue_type;
            
            if (from_date || to_date) {
                where.created_at = {};
                if (from_date) where.created_at[Op.gte] = new Date(from_date);
                if (to_date) where.created_at[Op.lte] = new Date(to_date);
            }

            const offset = (page - 1) * limit;
            
            const { count, rows } = await Issue.findAndCountAll({
                where,
                include: [
                    { model: User, as: 'user', attributes: ['id', 'employee_id', 'first_name', 'last_name'] },
                    { model: User, as: 'reporter', attributes: ['id', 'first_name', 'last_name'] },
                    { model: User, as: 'assignee', attributes: ['id', 'first_name', 'last_name'] },
                    { model: User, as: 'resolver', attributes: ['id', 'first_name', 'last_name'] },
                    { model: Product, as: 'product' },
                    { model: OrganizationNode, as: 'organizationNode', attributes: ['id', 'name', 'code'] },
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
     * Get issue by ID (Secured by companyId).
     */
    async getById(req, res, next) {
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;
            
            const issue = await Issue.findOne({
                where: { id, company_id },
                include: [
                    { model: User, as: 'user' },
                    { model: User, as: 'reporter' },
                    { model: User, as: 'assignee' },
                    { model: User, as: 'resolver' },
                    { model: Product, as: 'product' },
                    { model: OrganizationNode, as: 'organizationNode' },
                    { model: Assignment, as: 'assignment', include: ['product', 'user'] }
                ]
            });

            if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

            // Scoping check
            const permissions = await getEffectivePermissions(req.user);
            const hasGlobalVisibility = permissions.includes('hierarchy:all:view') || permissions.includes('system:manage');
            
            if (!hasGlobalVisibility) {
                const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
                const isAuthorized = allowedNodes === null || (issue.org_node_id && allowedNodes.includes(Number(issue.org_node_id)));
                if (!isAuthorized) {
                    return res.status(403).json({ success: false, message: 'Access denied: Issue is outside your visibility scope' });
                }
            }

            res.json({ success: true, data: issue });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Create a new issue.
     */
    async create(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

            const issueData = req.body;
            const company_id = req.user.company_id;
            
            issueData.company_id = company_id;
            issueData.reported_by = req.user.id;
            
            if (issueData.assignment_id) {
                const assignment = await Assignment.findOne({
                    where: { id: issueData.assignment_id, company_id },
                    include: ['product', 'user']
                });
                if (assignment) {
                    issueData.user_id = assignment.user_id;
                    issueData.product_id = assignment.product_id;
                    issueData.org_node_id = assignment.org_node_id;
                }
            } else {
                issueData.org_node_id = issueData.org_node_id || req.user.org_node_id;
            }

            const issue = await Issue.create(issueData);

            // Attempt to trigger workflow if one is defined for 'issue'
            const dynamicResult = await workflowService.advanceWorkflow(issue, 'issue', req.user, 'Initial reporting');
            if (dynamicResult) {
                // If workflow exists, the advanceWorkflow will have set the first pending status
                await issue.reload();
            }

            // Background logging
            ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'CREATE',
                resource: 'issues',
                resource_id: issue.id,
                details: { issue_number: issue.issue_number, severity: issue.severity }
            }).catch(err => logger.error(`Background activity logging failed for issue creation:`, err));

            res.status(201).json({ success: true, message: 'Issue reported and workflow initiated', data: issue });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Assign issue to someone for resolution.
     */
    async assign(req, res, next) {
        try {
            const { id } = req.params;
            const { assigned_to, notes } = req.body;
            const company_id = req.user.company_id;

            const issue = await Issue.findOne({ where: { id, company_id } });
            if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

            await issue.update({
                assigned_to,
                status: 'in_progress',
                notes: notes ? `${issue.notes || ''} [ASSIGNED: ${notes}]`.trim() : issue.notes
            });

            // Background logging
            ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'ASSIGN',
                resource: 'issues',
                resource_id: id,
                details: { assigned_to }
            }).catch(err => logger.error(`Background activity logging failed for issue assignment:`, err));

            res.json({ success: true, message: 'Issue assigned successfully', data: issue });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Resolve issue.
     */
    async resolve(req, res, next) {
        try {
            const { id } = req.params;
            const { resolution_notes } = req.body;
            const company_id = req.user.company_id;

            const issue = await Issue.findOne({ where: { id, company_id } });
            if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

            const dynamicResult = await workflowService.advanceWorkflow(
                issue, 
                'issue', 
                req.user, 
                resolution_notes || 'Resolved'
            );

            res.json({ 
                success: true, 
                message: dynamicResult.isFinalStep ? 'Issue fully resolved' : `Workflow moved to next step: ${issue.workflow_status}`, 
                data: dynamicResult 
            });
        } catch (error) {
            next(error);
        }
    },

    async approve(req, res, next) {
        try {
            const { id } = req.params;
            const issue = await require('../models').Issue.findByPk(id);
            if (!issue) return res.status(404).json({ message: 'Issue not found' });

            const result = await workflowService.advanceWorkflow(
                issue, 
                'issue', 
                req.user, 
                req.body.resolution_notes || 'Approved'
            );

            res.json({ success: true, message: 'Workflow advanced', data: result });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = issueController;