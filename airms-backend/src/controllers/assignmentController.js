const { Assignment, User, Product, OrganizationNode, DischargeItem, Return, Issue, ActivityLog, sequelize } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const hierarchyService = require('../services/hierarchyService');
const logger = require('../config/logger');
const { getEffectivePermissions } = require('../middleware/permissions');

const assignmentController = {
    /**
     * Get all assignments scoped to company and user's organizational scope.
     */
    async getAll(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 10, 
                user_id, 
                org_node_id,
                status,
                product_id,
                overdue 
            } = req.query;
            
            const company_id = req.user.company_id;
            const where = { company_id };
            
            // Calculate Field of Vision (with resilient fallback)
            const permissions = req.userPermissions || await getEffectivePermissions(req.user);
            const isSuperAdmin = (req.user.role && req.user.role.level >= 100) || permissions.includes('system:manage');
            
            const allowedNodes = req.getAuthorizedNodes 
                ? await req.getAuthorizedNodes() 
                : await hierarchyService.getAllowedNodes(req.user, permissions);

            // Hierarchical Scoping
            if (user_id && Number(user_id) === Number(req.user.id)) {
                // PERSONAL SCOPE: A user can ALWAYS see their own assets, regardless of node scoping
                where.user_id = user_id;
            } else if (isSuperAdmin && !org_node_id) {
                // GLOBAL SCOPE: Super admin sees everything
            } else if (org_node_id) {
                // SPECIFIC SCOPE: Verify specific node requested is within visibility scope
                if (!allowedNodes.includes(Number(org_node_id))) {
                    return res.status(403).json({ success: false, message: 'Access denied: Target node is outside your visibility scope' });
                }
                where.org_node_id = org_node_id;
            } else {
                // LOCAL SCOPE: Default to all authorized nodes
                where.org_node_id = { [Op.in]: allowedNodes };
            }

            if (user_id && Number(user_id) !== Number(req.user.id)) {
                where.user_id = user_id;
            }
            
            if (status) where.status = status;
            if (product_id) where.product_id = product_id;
            
            if (overdue === 'true') {
                where.expected_return_date = { [Op.lt]: new Date() };
                where.status = 'active';
            }

            const offset = (page - 1) * limit;
            
            const { count, rows } = await Assignment.findAndCountAll({
                where,
                include: [
                    { model: User, as: 'user', attributes: ['id', 'employee_id', 'first_name', 'last_name', 'email'] },
                    { model: Product, as: 'product' },
                    { model: OrganizationNode, as: 'organizationNode', attributes: ['id', 'name', 'code'] },
                    { model: DischargeItem, as: 'dischargeItem', include: ['dischargeForm'] }
                ],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['assigned_at', 'DESC']]
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
     * Get assignment by ID (Secured by companyId).
     */
    async getById(req, res, next) {
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;
            
            const assignment = await Assignment.findOne({
                where: { id, company_id },
                include: [
                    { model: User, as: 'user' },
                    { model: Product, as: 'product' },
                    { model: OrganizationNode, as: 'organizationNode' },
                    { model: DischargeItem, as: 'dischargeItem', include: ['dischargeForm'] },
                    { model: Return, as: 'returns' },
                    { model: Issue, as: 'issues' }
                ]
            });

            if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
            
            // Deep Scoping Check
            const permissions = req.userPermissions || await getEffectivePermissions(req.user);
            const isSuperAdmin = (req.user.role && req.user.role.level >= 100) || permissions.includes('system:manage');
            
            const allowedNodes = req.getAuthorizedNodes 
                ? await req.getAuthorizedNodes() 
                : await hierarchyService.getAllowedNodes(req.user, permissions);

            if (!isSuperAdmin && !allowedNodes.includes(assignment.org_node_id) && assignment.user_id !== req.user.id) {
                return res.status(403).json({ success: false, message: 'Access denied: Asset is outside your visibility scope' });
            }

            res.json({ success: true, data: assignment });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Update assignment details.
     */
    async update(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;
            const company_id = req.user.company_id;

            const assignment = await Assignment.findOne({ where: { id, company_id } });
            if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

            // Deep Scoping Check
            const permissions = req.userPermissions || await getEffectivePermissions(req.user);
            const isSuperAdmin = (req.user.role && req.user.role.level >= 100) || permissions.includes('system:manage');
            const canManage = permissions.includes('assignment:update') || isSuperAdmin;
            
            const allowedNodes = req.getAuthorizedNodes 
                ? await req.getAuthorizedNodes() 
                : await hierarchyService.getAllowedNodes(req.user, permissions);
            
            if (!canManage || (!isSuperAdmin && !allowedNodes.includes(assignment.org_node_id))) {
                return res.status(403).json({ success: false, message: 'Access denied: Insufficient permissions to modify this assignment' });
            }

            await assignment.update(updates);

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'UPDATE',
                resource: 'assignments',
                resource_id: id,
                details: updates
            });

            res.json({ success: true, message: 'Assignment updated successfully', data: assignment });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Mark an asset as lost (creates an issue).
     */
    async markLost(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;
            const company_id = req.user.company_id;

            const assignment = await Assignment.findOne({ where: { id, company_id } });
            if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

            // Deep Scoping Check
            const permissions = req.userPermissions || await getEffectivePermissions(req.user);
            const isSuperAdmin = (req.user.role && req.user.role.level >= 100) || permissions.includes('system:manage');
            
            const allowedNodes = req.getAuthorizedNodes 
                ? await req.getAuthorizedNodes() 
                : await hierarchyService.getAllowedNodes(req.user, permissions);
            
            if (!isSuperAdmin && !allowedNodes.includes(assignment.org_node_id) && assignment.user_id !== req.user.id) {
                return res.status(403).json({ success: false, message: 'Access denied: Asset is outside your node visibility' });
            }

            await assignment.update({ status: 'lost', notes: notes ? `LOST: ${notes}` : 'LOST' });

            await Issue.create({
                company_id,
                assignment_id: id,
                product_id: assignment.product_id,
                user_id: assignment.user_id,
                org_node_id: assignment.org_node_id,
                issue_type: 'lost',
                severity: 'high',
                description: notes || 'Asset reported as lost',
                reported_by: req.user.id,
                status: 'open'
            });

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'MARK_LOST',
                resource: 'assignments',
                resource_id: id
            });

            res.json({ success: true, message: 'Assignment marked as lost' });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = assignmentController;