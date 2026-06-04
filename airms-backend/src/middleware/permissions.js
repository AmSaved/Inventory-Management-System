const { Permission, UserPermission, Role, User, OrganizationNode, UserRole } = require('../models');
const logger = require('../config/logger');
const hierarchyService = require('../services/hierarchyService');

const getEffectivePermissions = async (user) => {
    if (user.permissions_cache) return user.permissions_cache;
    
    const permissionSet = new Set();

    // PHASE 1: Fetch Role permissions (Primary & Secondary Roles)
    const roleIds = new Set();
    if (user.role_id) {
        roleIds.add(Number(user.role_id));
    }

    // Retrieve secondary roles from UserRole table
    const assignedUserRoles = await UserRole.findAll({
        where: { user_id: user.id },
        attributes: ['role_id'],
        raw: true
    });
    assignedUserRoles.forEach(ur => roleIds.add(Number(ur.role_id)));

    if (roleIds.size > 0) {
        const rolesWithPermissions = await Role.findAll({
            where: { id: { [require('sequelize').Op.in]: Array.from(roleIds) } },
            include: [{
                model: Permission,
                as: 'permissions',
                attributes: ['name'],
                through: { attributes: [] }
            }]
        });

        for (const role of rolesWithPermissions) {
            role.permissions?.forEach(p => permissionSet.add(p.name));
        }
    }

    // PHASE 2: Fetch Direct Permissions
    const directPerms = await UserPermission.findAll({
        where: {
            user_id: user.id,
            expires_at: { [require('sequelize').Op.or]: [{ [require('sequelize').Op.is]: null }, { [require('sequelize').Op.gt]: new Date() }] }
        },
        include: [{ model: Permission, as: 'permission', attributes: ['name'] }]
    });

    directPerms.forEach(up => {
        if (up.permission) permissionSet.add(up.permission.name);
    });

    const finalPermissions = Array.from(permissionSet);
    user.permissions_cache = finalPermissions;

    return finalPermissions;
};

const checkPermission = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });

            const user = req.user;
            const allPermissions = await getEffectivePermissions(user);
            // Log user info and permissions for debugging
            logger.debug(`Auth Debug: User ID=${user.id}, Role=${user.role ? user.role.name : 'none'}, Permissions=${JSON.stringify(allPermissions)}`);
            req.userPermissions = allPermissions;

            // Global SuperAdmin check
            const isSuperAdmin = (user.role && user.role.level >= 100) || allPermissions.includes('system:manage');

            // Permission check
            const requiredPerms = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
            const hasPermission = isSuperAdmin || allPermissions.some(userPerm => 
                requiredPerms.some(reqPerm => 
                    userPerm === reqPerm || userPerm.startsWith(`${reqPerm}-`) || userPerm.startsWith(`${reqPerm}:`)
                )
            );

            if (!hasPermission) {
                return res.status(403).json({ 
                    success: false, 
                    message: `Insufficient permissions. Required: ${requiredPerms.join(' or ')}` 
                });
            }

            next();
        } catch (error) {
            logger.error('Permission check error:', error);
            return res.status(500).json({ success: false, message: 'Permission check failed' });
        }
    };
};

const checkAnyPermission = (permissions) => {
    return async (req, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });

            const user = req.user;
            const allPermissions = await getEffectivePermissions(user);
            // Log user info and permissions for debugging
            logger.debug(`Auth Debug: User ID=${user.id}, Role=${user.role ? user.role.name : 'none'}, Permissions=${JSON.stringify(allPermissions)}`);
            
            const isSuperAdmin = (user.role && user.role.level >= 100) || allPermissions.includes('system:manage');
            if (isSuperAdmin) return next();

            const hasAny = permissions.some(reqPerm => 
                allPermissions.some(userPerm => 
                    userPerm === reqPerm || userPerm.startsWith(`${reqPerm}-`) || userPerm.startsWith(`${reqPerm}:`)
                )
            );

            if (!hasAny) {
                return res.status(403).json({ 
                    success: false, 
                    message: `Insufficient permissions. Required one of: ${permissions.join(', ')}` 
                });
            }

            next();
        } catch (error) {
            logger.error('Permission check error:', error);
            return res.status(500).json({ success: false, message: 'Permission check failed' });
        }
    };
};

const checkHierarchyScope = async (req, res, next) => {
    try {
        const user = req.user;
        const targetNodeId = req.params.nodeId || req.body.org_node_id || req.query.org_node_id || req.params.id;
        if (!targetNodeId) return next();

        const allPermissions = await getEffectivePermissions(user);
        const allowedNodes = await hierarchyService.getAllowedNodes(user, allPermissions);

        if (allowedNodes !== null && !allowedNodes.includes(Number(targetNodeId))) {
            return res.status(403).json({ success: false, message: 'Access denied: Outside organizational scope' });
        }
        next();
    } catch (error) {
        logger.error('Hierarchy scope check error:', error);
        return res.status(500).json({ success: false, message: 'Scope validation failed' });
    }
};

module.exports = {
    getEffectivePermissions,
    checkPermission,
    checkAnyPermission,
    checkHierarchyScope
};