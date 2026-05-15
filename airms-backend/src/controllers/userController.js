const { User, Role, OrganizationNode, ActivityLog, Permission } = require('../models');
const { Op } = require('sequelize');
const userService = require('../services/userService');
const hierarchyService = require('../services/hierarchyService');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');
const { getEffectivePermissions } = require('../middleware/permissions');

const userController = {
    /**
     * Get all users, scoped to company and user subtree.
     */
    async getAll(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 10, 
                search, 
                role_id, 
                org_node_id, 
                is_active,
                only_mine
            } = req.query;
            
            const companyId = req.user.company_id;
            const filters = { company_id: companyId };

            // Registered by super admin filter
            const permissions = req.userPermissions || await getEffectivePermissions(req.user);
            // Dynamic administrative scoping
            const roleLevel = req.user.role?.level || 0;
            const isSuperAdmin = roleLevel >= 50 || 
                                 permissions.includes('system:manage') || 
                                 permissions.includes('workflow:process');
            
            // 1. Efficiently get authorized nodes (with resilient fallback)
            const allowedNodes = req.getAuthorizedNodes 
                ? await req.getAuthorizedNodes() 
                : await hierarchyService.getAllowedNodes(req.user, permissions);

            // Hierarchical Scoping Logic
            const hasGlobalRead = permissions.includes('user:read:all') || 
                                  permissions.includes('workflow:process') || 
                                  isSuperAdmin;

            if (!hasGlobalRead) {
                // Determine target scope: Specified node or user's allowed branch
                const targetNodeId = req.query.org_node_id || req.user.org_node_id;
                
                if (targetNodeId && allowedNodes !== null) {
                    const numTargetNodeId = Number(targetNodeId);
                    // Verify the user has access to the node they are trying to view
                    if (allowedNodes.includes(numTargetNodeId)) {
                        // Resolve entire subtree (Recursive visibility - Downward)
                        const descendants = await hierarchyService.getDescendants(numTargetNodeId);
                        filters.org_node_id = { [Op.in]: descendants };
                    } else {
                        // Outside scope - restrict to an impossible ID
                        filters.org_node_id = -1; 
                    }
                } else if (allowedNodes !== null) {
                    // Fallback to all allowed nodes (usually their branch and below)
                    filters.org_node_id = { [Op.in]: allowedNodes };
                } else if (allowedNodes === null) {
                    // Global visibility: if targetNodeId is specified, show its subtree, else show all
                    if (targetNodeId) {
                        const descendants = await hierarchyService.getDescendants(targetNodeId);
                        filters.org_node_id = { [Op.in]: descendants };
                    }
                } else {
                    // No node assignment = see no operational users
                    filters.org_node_id = -1;
                }
            } else if (req.query.org_node_id) {
                // High level admin viewing a specific node
                const descendants = await hierarchyService.getDescendants(req.query.org_node_id);
                filters.org_node_id = { [Op.in]: descendants };
            }
            // Note: If isSuperAdmin and no org_node_id in query, filters.org_node_id is not set, 
            // allowing them to see all users in the company.

            const result = await userService.getAllUsers(companyId, page, limit, search, filters);
            
            res.json({
                success: true,
                data: result.users,
                pagination: result.pagination
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get user by ID (Secured by companyId).
     */
    async getById(req, res, next) {
        try {
            const { id } = req.params;
            const companyId = req.user.company_id;
            
            const user = await userService.getUserById(companyId, id);
            
            if (!user) return res.status(404).json({ success: false, message: 'User not found' });

            // Scoping check
            const permissions = req.userPermissions || await getEffectivePermissions(req.user);
            const isCreator = user.created_by === req.user.id;
            const isSelf = user.id === req.user.id;
            const isSuperAdmin = (req.user.role && req.user.role.level >= 100) || permissions.includes('system:manage');

            if (!isCreator && !isSelf && !isSuperAdmin) {
                // If not self/creator/super, check if within visibility subtree
                const allowedNodes = req.getAuthorizedNodes 
                    ? await req.getAuthorizedNodes() 
                    : await hierarchyService.getAllowedNodes(req.user, permissions);
                    
                const isAuthorized = allowedNodes === null || allowedNodes.includes(Number(user.org_node_id));
                if (!isAuthorized) {
                    return res.status(403).json({ success: false, message: 'Access denied: Target personnel is outside your visibility scope' });
                }
            }

            res.json({ success: true, data: user });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Create a user (Secured by companyId).
     */
    async create(req, res, next) {
        const startTime = Date.now();
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const userData = req.body;
            const companyId = req.user.company_id;
            const permissions = await getEffectivePermissions(req.user);
            const hasFullManagePower = permissions.includes('user:manage:all') || permissions.includes('system:manage');
            const isSuperAdmin = hasFullManagePower;

            logger.info(`Starting manual user creation for email: ${userData.email} by user: ${req.user.id}`);

            // Ensure the target org_node_id is within the creator's visibility scope
            // BYPASS for Super Admins: They can onboard staff anywhere
            if (!isSuperAdmin) {
                const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
                
                // Safety check for null (global access)
                if (allowedNodes !== null) {
                    if (userData.org_node_id && !allowedNodes.includes(Number(userData.org_node_id))) {
                        return res.status(403).json({ success: false, message: 'Access denied: Cannot onboard staff outside your visibility scope' });
                    }
                }
            }

            // Role escalation guard: prevent assigning a role at or above your own level unless authorized
            const hasHighLevelPower = permissions.includes('role:manage:all') || permissions.includes('system:manage');
            if (userData.role_id && !hasHighLevelPower) {
                const targetRole = await Role.findByPk(userData.role_id);
                if (targetRole && targetRole.level >= (req.user.role?.level || 0)) {
                    return res.status(403).json({ success: false, message: 'Access denied: Cannot assign a role with equal or higher authority than your own' });
                }
            }

            const user = await userService.createUser(companyId, userData, req.user.id);

            logger.debug(`User record created in ${Date.now() - startTime}ms. Finalizing in background...`);

            // FIRE AND FORGET Activity Log
            ActivityLog.create({
                company_id: companyId,
                user_id: req.user.id,
                action: 'CREATE',
                resource: 'users',
                resource_id: user.id,
                details: { employee_id: user.employee_id, email: user.email },
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
            }).catch(err => logger.error(`Background activity logging failed for manual user creation:`, err));

            const totalTime = Date.now() - startTime;
            logger.info(`Manual user creation completed in ${totalTime}ms for user ID: ${user.id}`);

            res.status(201).json({
                success: true,
                message: 'User created successfully',
                data: user
            });
        } catch (error) {
            logger.error(`Manual user creation failed after ${Date.now() - startTime}ms: ${error.message}`);
            next(error);
        }
    },

    /**
     * Update a user (Secured by companyId).
     */
    async update(req, res, next) {
        try {
            const { id } = req.params;
            const userData = req.body;
            const companyId = req.user.company_id;

            const targetUser = await User.findOne({ where: { id, company_id: companyId } });
            if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });

            const permissions = await getEffectivePermissions(req.user);
            const hasFullManagePower = permissions.includes('user:manage:all') || permissions.includes('system:manage');
            const isSuperAdmin = hasFullManagePower;

            // MANAGEMENT AUTHORITY: Self OR Permission-based Authority
            const isSelf = targetUser.id === req.user.id;
            const hasPermissionToUpdate = permissions.includes('user:update') || 
                                          permissions.includes('user:manage:all') || 
                                          permissions.includes('user:manage:node') || 
                                          permissions.includes('system:manage');

            if (!isSelf && !isSuperAdmin) {
                const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
                const isWithinScope = allowedNodes.includes(targetUser.org_node_id);

                if (!(hasPermissionToUpdate && isWithinScope)) {
                    return res.status(403).json({ 
                        success: false, 
                        message: 'Access Denied: You do not have authority to update this user record' 
                    });
                }

                // Prevent shifting users out of boundary unless you have global reach
                if (userData.org_node_id && !allowedNodes.includes(Number(userData.org_node_id))) {
                    return res.status(403).json({ success: false, message: 'Access denied: Cannot move users outside your visibility scope' });
                }
            }

            // Role escalation guard on updates
            const hasHighLevelPower = permissions.includes('role:manage:all') || permissions.includes('system:manage');
            if (userData.role_id && !hasHighLevelPower) {
                const targetRole = await Role.findByPk(userData.role_id);
                if (targetRole && targetRole.level >= (req.user.role?.level || 0)) {
                    return res.status(403).json({ success: false, message: 'Access denied: Cannot assign a role with equal or higher authority than your own' });
                }
            }

            const user = await userService.updateUser(companyId, id, userData, req.user.id);

            // Background logging
            ActivityLog.create({
                company_id: companyId,
                user_id: req.user.id,
                action: 'UPDATE',
                resource: 'users',
                resource_id: user.id,
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
            }).catch(err => logger.error(`Background activity logging failed for user update:`, err));

            res.json({ success: true, message: 'User updated successfully', data: user });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Delete a user (Secured by companyId).
     */
    async delete(req, res, next) {
        try {
            const { id } = req.params;
            const companyId = req.user.company_id;

            const targetUser = await User.findOne({ where: { id, company_id: companyId } });
            if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });

            const permissions = await getEffectivePermissions(req.user);

            // MANAGEMENT AUTHORITY: Permission-based Authority within scope
            const hasDeletePower = permissions.includes('user:delete') || 
                                   permissions.includes('user:manage:all') || 
                                   permissions.includes('system:manage');
            
            const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
            const isWithinScope = allowedNodes.includes(targetUser.org_node_id);

            if (!hasDeletePower || !isWithinScope) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Access Denied: You do not have authority to delete this user' 
                });
            }

            await userService.deleteUser(companyId, id);

            // Background logging
            ActivityLog.create({
                company_id: companyId,
                user_id: req.user.id,
                action: 'DELETE',
                resource: 'users',
                resource_id: id,
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
            }).catch(err => logger.error(`Background activity logging failed for user deletion:`, err));

            res.json({ success: true, message: 'User deleted successfully' });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Toggle active status.
     */
    async toggleStatus(req, res, next) {
        try {
            const { id } = req.params;
            const companyId = req.user.company_id;
            
            const user = await User.findByPk(id);
            if (!user) return res.status(404).json({ success: false, message: 'User not found' });

            const permissions = await getEffectivePermissions(req.user);

            // MANAGEMENT AUTHORITY: Creator OR Admin with specific permissions
            const isCreator = user.created_by === req.user.id;
            const hasManagePower = permissions.includes('user:manage:node') || permissions.includes('user:manage:all') || permissions.includes('system:manage');

            if (!isCreator && !hasManagePower) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Access Denied: You do not have authority to change the status of this user' 
                });
            }
            
            await user.update({ is_active: !user.is_active });

            // Background logging
            ActivityLog.create({
                company_id: companyId,
                user_id: req.user.id,
                action: 'UPDATE',
                resource: 'users',
                resource_id: id,
                details: { is_active: user.is_active }
            }).catch(err => logger.error(`Background activity logging failed for user status toggle:`, err));

            res.json({ success: true, data: user });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Permission management.
     */
    /**
     * Permission management.
     */
    async getUserPermissions(req, res, next) {
        try {
            const { id } = req.params;
            const companyId = req.user.company_id;
            
            const user = await User.findOne({
                where: { id, company_id: companyId },
                include: ['permissions', 'role']
            });

            if (!user) return res.status(404).json({ success: false, message: 'User not found' });

            res.json({ success: true, data: user.permissions });
        } catch (error) {
            next(error);
        }
    },

    async assignPermissions(req, res, next) {
        try {
            const { id } = req.params;
            const { permission_ids } = req.body;
            const companyId = req.user.company_id;
            
            await userService.assignPermissions(companyId, id, permission_ids, req.user.id);

            res.json({ success: true, message: 'Permissions assigned successfully' });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = userController;