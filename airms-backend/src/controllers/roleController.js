const { Role, Permission, ActivityLog, User, OrganizationNode } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const logger = require('../config/logger');
const { getEffectivePermissions } = require('../middleware/permissions');
const hierarchyService = require('../services/hierarchyService');

/**
 * WISDOM TEMPLATES:
 * Pre-defined functional profiles to accelerate organizational setup.
 * These map to the permission names defined in the database seeds.
 */
const ROLE_TEMPLATES = {
    staff: [
        'request:create', 'request:read', 'dashboard:view', 'assignment:view'
    ],
    approver: [
        'request:read', 'request:approve-chairman', 'request:approve-storage', 
        'dashboard:view', 'report:view', 'workflow:process', 'assignment:view'
    ],
    logistics: [
        'inventory:view', 'inventory:adjust', 'discharge:create', 'discharge:execute',
        'store:create', 'store:execute', 'request:read', 'assignment:view', 'assignment:update'
    ],
    administrator: [
        'user:create', 'user:read', 'user:update', 'user:delete', 
        'role:create', 'role:read', 'role:update', 'role:delete',
        'branch:create', 'branch:read', 'branch:update', 'branch:delete',
        'workflow:manage', 'permission:read'
    ]
};

const roleController = {
    /**
     * Get all roles scoped to company (and global roles).
     */
    async getAll(req, res, next) {
        try {
            const company_id = req.user.company_id;
            const { only_mine } = req.query;
            const permissions = await getEffectivePermissions(req.user);
            const isSuperAdminRole = req.user.role?.name === 'super_admin';
            const hasFullManagePower = isSuperAdminRole || permissions.includes('system:manage') || permissions.includes('role:manage:all');

            let where = { company_id };

            // All Admins see company roles + system roles, but local admins NEVER see the super_admin role
            where = {
                [Op.or]: [
                    { company_id },
                    { company_id: null }
                ]
            };

            if (!isSuperAdminRole) {
                where[Op.and] = [
                    // Case-insensitive exclusion of the super_admin role
                    sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('Role.name')),
                        { [Op.ne]: 'super_admin' }
                    )
                ];
            }

            const roles = await Role.findAll({
                where,
                order: [['level', 'DESC']],
                include: [
                    {
                        model: Permission,
                        as: 'permissions',
                        through: { attributes: [] }
                    },
                    {
                        model: User,
                        as: 'roleRegistrar',
                        attributes: ['id', 'first_name', 'last_name'],
                        include: [{
                            model: OrganizationNode,
                            as: 'organizationNode',
                            attributes: ['id', 'name']
                        }]
                    }
                ]
            });

            res.json({ success: true, data: roles });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get role by ID (scoped to company).
     */
    async getById(req, res, next) {
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;
            
            const role = await Role.findOne({
                where: {
                    id,
                    [Op.or]: [{ company_id }, { company_id: null }]
                },
                include: [{
                    model: Permission,
                    as: 'permissions',
                    through: { attributes: [] }
                }]
            });

            if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

            res.json({ success: true, data: role });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Create a new custom role for the company.
     */
    async create(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

            const { name, description, level, visibility_scope, permission_ids, org_node_id } = req.body;
            const company_id = req.user.company_id;
            const permissions = await getEffectivePermissions(req.user);
            const isSuperAdmin = permissions.includes('role:manage:all') || permissions.includes('system:manage');

            // Security: Cannot grant broader visibility than you possess
            const scopeHierarchy = { 'own_node': 1, 'sub_units': 2, 'global': 3 };
            const myScope = req.user.role?.visibility_scope || 'own_node';
            const requestedScope = visibility_scope || 'own_node';

            // Permission-based visibility bypass
            const hasGlobalScopePower = permissions.includes('role:visibility:global') || isSuperAdmin;
            const hasSubUnitScopePower = permissions.includes('role:visibility:sub_units') || isSuperAdmin || hasGlobalScopePower;

            if (scopeHierarchy[requestedScope] > scopeHierarchy[myScope]) {
                if (requestedScope === 'global' && !hasGlobalScopePower) {
                    return res.status(403).json({ success: false, message: 'Insufficient permission to create global-visibility roles' });
                }
                if (requestedScope === 'sub_units' && !hasSubUnitScopePower) {
                    return res.status(403).json({ success: false, message: 'Insufficient permission to create multi-unit visibility roles' });
                }
            }

            // Security: Cannot create a role with a higher level than your own unless authorized
            const hasHighLevelPower = permissions.includes('role:manage:all') || isSuperAdmin;
            if (level && level >= (req.user.role?.level || 0) && !hasHighLevelPower) {
                return res.status(403).json({ success: false, message: 'Cannot create a role with equal or higher authority level than your own' });
            }

            const role = await Role.create({
                company_id,
                name,
                description,
                visibility_scope: requestedScope,
                level: level || 10,
                created_by_id: req.user.id
            });

            if (permission_ids && permission_ids.length > 0) {
                await role.setPermissions(permission_ids);
            }

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'CREATE',
                resource: 'roles',
                resource_id: role.id,
                details: { name, level }
            });

            res.status(201).json({ success: true, message: 'Role created successfully', data: role });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Update role.
     */
    async update(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;
            const company_id = req.user.company_id;

            const role = await Role.findOne({ where: { id, company_id } });
            if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

            const permissions = await getEffectivePermissions(req.user);
            const isSuperAdminRole = req.user.role?.name === 'super_admin';
            
            // MANAGEMENT AUTHORITY: Creator OR specific management permissions
            const isCreator = role.created_by_id === req.user.id;
            const hasManagePower = isSuperAdminRole || permissions.includes('role:update') || permissions.includes('system:manage');
            
            if (!isCreator && !hasManagePower) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Access Denied: You do not have authority to modify this role' 
                });
            }

            const isSuperAdmin = isSuperAdminRole || permissions.includes('system:manage');

            // Security check for scope escalation
            const scopeHierarchy = { 'own_node': 1, 'sub_units': 2, 'global': 3 };
            const myScope = req.user.role?.visibility_scope || 'own_node';
            
            // Only validate escalation if we are changing the scope to something higher than the user owns
            if (updates.visibility_scope && updates.visibility_scope !== role.visibility_scope) {
                if (scopeHierarchy[updates.visibility_scope] > scopeHierarchy[myScope]) {
                    const hasGlobalScopePower = permissions.includes('role:visibility:global') || isSuperAdmin;
                    const hasSubUnitScopePower = permissions.includes('role:visibility:sub_units') || isSuperAdmin || hasGlobalScopePower;

                    if (updates.visibility_scope === 'global' && !hasGlobalScopePower) {
                        return res.status(403).json({ success: false, message: 'Insufficient permission to escalate to global visibility' });
                    }
                    if (updates.visibility_scope === 'sub_units' && !hasSubUnitScopePower) {
                        return res.status(403).json({ success: false, message: 'Insufficient permission to escalate to multi-unit visibility' });
                    }
                }
            }

            // Security: Cannot elevate a role to reach your level or higher unless authorized
            const hasHighLevelPower = permissions.includes('role:manage:all') || isSuperAdmin;
            if (updates.level && updates.level >= (req.user.role?.level || 0) && !hasHighLevelPower) {
                return res.status(403).json({ success: false, message: 'Cannot elevate a role level beyond your own authority' });
            }

            // Auto-anchor orphaned global roles to the organization of the admin refining them
            if (!role.org_node_id && req.user.org_node_id && !isSuperAdminRole) {
                updates.org_node_id = req.user.org_node_id;
            }

            await role.update(updates);

            if (updates.permission_ids) {
                await role.setPermissions(updates.permission_ids);
            }

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'UPDATE',
                resource: 'roles',
                resource_id: id,
                details: updates
            });

            res.json({ success: true, message: 'Role updated successfully', data: role });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Delete role (scoped to company).
     */
    async delete(req, res, next) {
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;

            const role = await Role.findOne({ where: { id, company_id } });
            if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

            const permissions = await getEffectivePermissions(req.user);
            const isSuperAdminRole = req.user.role?.name === 'super_admin';

            // MANAGEMENT AUTHORITY: Creator OR specific management permissions
            const isCreator = role.created_by_id === req.user.id;
            const hasManagePower = isSuperAdminRole || permissions.includes('role:delete') || permissions.includes('system:manage');

            if (!isCreator && !hasManagePower) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Access Denied: You do not have authority to delete this role' 
                });
            }

            // Check for users
            const userCount = await User.count({ where: { role_id: id, company_id } });
            if (userCount > 0) return res.status(400).json({ success: false, message: 'Cannot delete role with assigned users' });

            await role.destroy();

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'DELETE',
                resource: 'roles',
                resource_id: id
            });

            res.json({ success: true, message: 'Role deleted successfully' });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Apply a pre-defined permission template to a role.
     * Use this to quickly set up common role profiles.
     */
    async applyTemplate(req, res, next) {
        try {
            const { id } = req.params;
            const { template_name } = req.body;
            const company_id = req.user.company_id;

            if (!ROLE_TEMPLATES[template_name]) {
                return res.status(400).json({ success: false, message: 'Invalid template name. Options: staff, approver, logistics, administrator' });
            }

            const role = await Role.findOne({ where: { id, company_id } });
            if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

            // Resolve permission keys to dynamic IDs from the database
            const targetPermissionKeys = ROLE_TEMPLATES[template_name];
            const permissions = await Permission.findAll({
                where: { name: { [Op.in]: targetPermissionKeys } }
            });

            const permissionIds = permissions.map(p => p.id);
            await role.setPermissions(permissionIds);

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'UPDATE',
                resource: 'roles',
                resource_id: id,
                details: { applied_template: template_name, count: permissionIds.length }
            });

            res.json({
                success: true,
                message: `Wisdom Template \"${template_name}\" applied successfully`,
                data: { permission_ids: permissionIds }
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = roleController;