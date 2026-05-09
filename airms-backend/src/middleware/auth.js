const jwt = require('jsonwebtoken');
const { User, Role, Permission, OrganizationNode } = require('../models');
const logger = require('../config/logger');

const authMiddleware = async (req, res, next) => {
    try {
        
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const token = authHeader.split(' ')[1];

        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        
        const user = await User.findByPk(decoded.id, {
            attributes: { exclude: ['password_hash', 'refresh_token'] },
            include: [
                {
                    model: Role,
                    as: 'role',
                    include: [{
                        model: Permission,
                        as: 'permissions',
                        through: { attributes: [] }
                    }]
                },
                {
                    model: OrganizationNode,
                    as: 'organizationNode'
                }
            ]
        });

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

        // Attach user to request
        req.user = user;
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