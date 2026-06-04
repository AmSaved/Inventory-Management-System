const jwt = require('jsonwebtoken');
const { User, Role, Permission, OrganizationNode } = require('../models');
const logger = require('../config/logger');
const hierarchyService = require('../services/hierarchyService');
const { getEffectivePermissions } = require('./permissions');

// High-performance auth memory cache (Bypasses Windows slow Statement Planning on concurrent loads)
const authCache = new Map();
const CACHE_TTL = 8000; // 8 seconds

const authMiddleware = async (req, res, next) => {
    try {
        // 1. Check if user is already attached (from previous middleware in same request)
        if (req.user) return next();

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const token = authHeader.split(' ')[1];

        // 2. Fast JWT verification
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const cacheKey = decoded.id;
        const now = Date.now();
        const cached = authCache.get(cacheKey);

        let user;
        if (cached && (now - cached.timestamp < CACHE_TTL)) {
            user = cached.user;
        } else {
            // 3. Optimized User Fetch (Only essential data for middleware)
            user = await User.findByPk(decoded.id, {
                attributes: ['id', 'email', 'role_id', 'company_id', 'org_node_id', 'is_active'],
                include: [
                    {
                        model: Role,
                        as: 'role',
                        attributes: ['id', 'name', 'level', 'visibility_scope']
                    },
                    {
                        model: OrganizationNode,
                        as: 'organizationNode',
                        attributes: ['id', 'name', 'code', 'path', 'status']
                    },
                    {
                        model: OrganizationNode,
                        as: 'authorizedNodes',
                        attributes: ['id', 'name', 'code', 'path'],
                        through: { attributes: [] }
                    }
                ]
            });

            if (user) {
                authCache.set(cacheKey, {
                    user,
                    timestamp: now
                });
            }
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'User account is inactive'
            });
        }

        // Block users whose assigned organization node is inactive
        if (user.organizationNode && user.organizationNode.status === 'inactive') {
            return res.status(403).json({
                success: false,
                message: 'Your organization node is currently inactive. Contact your administrator.'
            });
        }

        // Attach user to request
        req.user = user;

        // ATTACH SCOPING HELPER: req.getAuthorizedNodes()
        req.getAuthorizedNodes = async () => {
            const allPermissions = await getEffectivePermissions(req.user);
            return await hierarchyService.getAllowedNodes(req.user, allPermissions);
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        logger.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
};

const optionalAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findByPk(decoded.id, {
                attributes: { exclude: ['password_hash', 'refresh_token'] },
                include: [{
                    model: Role,
                    as: 'role'
                }]
            });
            if (user && user.is_active) {
                req.user = user;
            }
        }
        next();
    } catch (error) {
        // Continue even if token is invalid
        next();
    }
};

module.exports = {
    authMiddleware,
    optionalAuthMiddleware
};