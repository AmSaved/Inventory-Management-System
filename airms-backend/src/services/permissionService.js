const { Permission, Role, User } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

class PermissionService {
    // Check if user has permission
    async userHasPermission(userId, permissionName) {
        try {
            const user = await User.findByPk(userId, {
                include: [
                    {
                        model: Permission,
                        as: 'permissions',
                        through: { attributes: [] }
                    },
                    {
                        model: Permission,
                        as: 'directPermissions',
                        through: { 
                            attributes: [],
                            where: {
                                expires_at: null
                            }
                        }
                    }
                ]
            });

            if (!user) {
                return false;
            }

            // Check role permissions
            const hasRolePermission = user.permissions.some(p => p.name === permissionName);

            // Check direct permissions
            const hasDirectPermission = user.directPermissions.some(p => p.name === permissionName);

            return hasRolePermission || hasDirectPermission;
        } catch (error) {
            logger.error('Check user permission error:', error);
            return false;
        }
    }

    // Get user's effective permissions
    async getUserEffectivePermissions(userId) {
        try {
            const user = await User.findByPk(userId, {
                include: [
                    {
                        model: Permission,
                        as: 'permissions',
                        through: { attributes: [] }
                    },
                    {
                        model: Permission,
                        as: 'directPermissions',
                        through: { 
                            attributes: ['granted_at', 'expires_at'],
                            where: {
                                [Op.or]: [
                                    { expires_at: null },
                                    { expires_at: { [Op.gt]: new Date() } }
                                ]
                            }
                        }
                    }
                ]
            });

            if (!user) {
                return [];
            }

            // Combine and deduplicate permissions
            const allPermissions = [...user.permissions, ...user.directPermissions];
            const uniquePermissions = Array.from(
                new Map(allPermissions.map(p => [p.id, p])).values()
            );

            return uniquePermissions;
        } catch (error) {
            logger.error('Get user effective permissions error:', error);
            throw error;
        }
    }

    // Get all permissions grouped by resource
    async getPermissionsByResource() {
        try {
            const permissions = await Permission.findAll({
                order: [
                    ['resource', 'ASC'],
                    ['action', 'ASC']
                ]
            });

            const grouped = permissions.reduce((acc, perm) => {
                if (!acc[perm.resource]) {
                    acc[perm.resource] = [];
                }
                acc[perm.resource].push(perm);
                return acc;
            }, {});

            return grouped;
        } catch (error) {
            logger.error('Get permissions by resource error:', error);
            throw error;
        }
    }

    // Validate permission names
    async validatePermissions(permissionNames) {
        try {
            const permissions = await Permission.findAll({
                where: {
                    name: { [Op.in]: permissionNames }
                }
            });

            const foundNames = permissions.map(p => p.name);
            const missingNames = permissionNames.filter(name => !foundNames.includes(name));

            return {
                valid: missingNames.length === 0,
                validPermissions: permissions,
                invalidPermissions: missingNames
            };
        } catch (error) {
            logger.error('Validate permissions error:', error);
            throw error;
        }
    }

    // Get permissions by role
    async getPermissionsByRole(roleId) {
        try {
            const role = await Role.findByPk(roleId, {
                include: [{
                    model: Permission,
                    as: 'permissions',
                    through: { attributes: [] }
                }]
            });

            if (!role) {
                throw new Error('Role not found');
            }

            return role.permissions;
        } catch (error) {
            logger.error('Get permissions by role error:', error);
            throw error;
        }
    }

    // Check if user has any of the given permissions
    async userHasAnyPermission(userId, permissionNames) {
        try {
            for (const permissionName of permissionNames) {
                const hasPermission = await this.userHasPermission(userId, permissionName);
                if (hasPermission) {
                    return true;
                }
            }
            return false;
        } catch (error) {
            logger.error('Check user any permission error:', error);
            return false;
        }
    }

    // Check if user has all of the given permissions
    async userHasAllPermissions(userId, permissionNames) {
        try {
            for (const permissionName of permissionNames) {
                const hasPermission = await this.userHasPermission(userId, permissionName);
                if (!hasPermission) {
                    return false;
                }
            }
            return true;
        } catch (error) {
            logger.error('Check user all permissions error:', error);
            return false;
        }
    }
}

module.exports = new PermissionService();