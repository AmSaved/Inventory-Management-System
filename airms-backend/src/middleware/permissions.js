const { Permission, UserPermission, Role, User, OrganizationNode } = require('../models');
const logger = require('../config/logger');
const hierarchyService = require('../services/hierarchyService');

const getEffectivePermissions = async (user) => {
    // Optimization: Check if permissions are already attached to the user object (if eager-loaded)
    if (user.permissions_cache) return user.permissions_cache;

    // 1. Aggregate permissions from all roles (Legacy + M2M)
    const userWithRoles = await User.findByPk(user.id, {
        attributes: ['id'],
        include: [
            {
                model: Role,
                as: 'role',
                include: [{ model: Permission, as: 'permissions', attributes: ['name'], through: { attributes: [] } }]
            },
            {
                model: Role,
                as: 'roles',
                include: [{ model: Permission, as: 'permissions', attributes: ['name'], through: { attributes: [] } }]
            }
        ]
    });

    if (!userWithRoles) return [];

    const permissionSet = new Set();
    
    // Process legacy role
    userWithRoles.role?.permissions?.forEach(p => permissionSet.add(p.name));
    
    // Process many-to-many roles
    userWithRoles.roles?.forEach(r => {
        r.permissions?.forEach(p => permissionSet.add(p.name));
    });

    // 2. Aggregate direct permissions
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
    user.permissions_cache = finalPermissions; // Attach to object for request-lifetime cache
    return finalPermissions;
};

const checkPermission = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });

            const user = req.user;
            if (!user.company_id) return res.status(403).json({ success: false, message: 'User not associated with a company' });

            // 1. Get permissions (efficiently cached on the user object for the request duration)
            const allPermissions = await getEffectivePermissions(user);
            req.userPermissions = allPermissions;

            // 2. Fast-path for Super Admins
            const isSuperAdmin = (user.role && user.role.level >= 100) || allPermissions.includes('system:manage');
            
            // 3. Simple organizational requirement check
            const hasGlobalAccess = isSuperAdmin || allPermissions.includes('workflow:process') || allPermissions.includes('user:read');
            if (!user.org_node_id && !hasGlobalAccess) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Access Denied: You must be assigned to an organizational node or have global management permissions.' 
                });
            }

            // 4. Permission check with hierarchical matching
            const requiredPerms = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
            
            const hasPermission = isSuperAdmin || allPermissions.some(userPerm => 
                requiredPerms.some(reqPerm => 
                    userPerm === reqPerm || userPerm.startsWith(`${reqPerm}-`) || userPerm.startsWith(`${reqPerm}:`)
                )
            );

            if (!hasPermission) {
                return res.status(403).json({ success: false, message: 'Insufficient permissions' });
            }

            // 5. LAZY SCOPE: We only calculate allowedNodes IF explicitly requested by the controller
            // Or we attach a getter function to be efficient
            req.getAuthorizedNodes = async () => {
                if (req._authorizedNodesCache) return req._authorizedNodesCache;
                req._authorizedNodesCache = await hierarchyService.getAllowedNodes(user, allPermissions);
                return req._authorizedNodesCache;
            };

            next();
        } catch (error) {
            logger.error('Permission check error:', error);
            return res.status(500).json({ success: false, message: 'Permission check failed' });
        }
    };
};

/**
 * Middleware to check if a user has access to a specific organization node.
 * Logic: User can access if:
 * 1. They are a Company Admin (Level 90+)
 * 2. They are assigned to the target Node
 * 3. They are assigned to an ancestor of the target Node
 */
const checkHierarchyScope = async (req, res, next) => {
    try {
        const user = req.user;
        // The target node ID can be in params, body, or query
        const targetNodeId = req.params.nodeId || req.body.org_node_id || req.query.org_node_id || req.params.id;

        if (!targetNodeId) {
            return next();
        }

        const allPermissions = await getEffectivePermissions(user);
        const allowedNodes = await hierarchyService.getAllowedNodes(user, allPermissions);

        if (!allowedNodes.includes(Number(targetNodeId))) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Target node is outside your organizational visibility scope'
            });
        }

        next();
    } catch (error) {
        logger.error('Hierarchy scope check error:', error);
        return res.status(500).json({ success: false, message: 'Scope validation failed' });
    }
};

const checkAnyPermission = (permissions) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: 'Authentication required' });
            }

            const user = req.user;
            const allPermissions = await getEffectivePermissions(user);
            if (allPermissions.includes('system:manage') || (user.role && user.role.level >= 100)) return next();

            const hasAny = permissions.some(reqPerm => 
                allPermissions.some(userPerm => 
                    userPerm === reqPerm || 
                    userPerm.startsWith(`${reqPerm}-`) || 
                    userPerm.startsWith(`${reqPerm}:`)
                )
            );

            if (!hasAny) {
                return res.status(403).json({ success: false, message: 'Insufficient permissions' });
            }

            next();
        } catch (error) {
            logger.error('Permission check error:', error);
            return res.status(500).json({ success: false, message: 'Permission check failed' });
        }
    };
};

module.exports = {
    getEffectivePermissions,
    checkPermission,
    checkAnyPermission,
    checkHierarchyScope
};