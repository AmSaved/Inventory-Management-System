const { User, Role, ActivityLog } = require('../models');
const authService = require('../services/authService');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');

const authController = {
    // Register new user
    async register(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const userData = req.body;
            const user = await authService.register(userData);

            await ActivityLog.create({
                user_id: user.id,
                action: 'CREATE',
                resource: 'users',
                resource_id: user.id,
                details: { email: user.email },
                ip_address: req.ip,
                user_agent: req.get('User-Agent'),
                company_id: user.company_id
            });

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                data: user
            });
        } catch (error) {
            next(error);
        }
    },

    // Login user
    async login(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { email, password } = req.body;
            const result = await authService.login(email, password, req.ip);

            await ActivityLog.create({
                user_id: result.user.id,
                action: 'LOGIN',
                resource: 'auth',
                details: { email },
                ip_address: req.ip,
                user_agent: req.get('User-Agent'),
                company_id: result.user.company_id
            });

            res.json({
                success: true,
                message: 'Login successful',
                data: result
            });
        } catch (error) {
            next(error);
        }
    },

    // Refresh token
    async refreshToken(req, res, next) {
        try {
            const { refresh_token } = req.body;
            const result = await authService.refreshToken(refresh_token);

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            next(error);
        }
    },

    // Logout
    async logout(req, res, next) {
        try {
            const { refresh_token } = req.body;
            await authService.logout(refresh_token);

            await ActivityLog.create({
                user_id: req.user.id,
                action: 'LOGOUT',
                resource: 'auth',
                ip_address: req.ip,
                user_agent: req.get('User-Agent'),
                org_node_id: req.user.org_node_id
            });

            res.json({
                success: true,
                message: 'Logout successful'
            });
        } catch (error) {
            next(error);
        }
    },

    // Change password
    async changePassword(req, res, next) {
        try {
            const { current_password, new_password } = req.body;
            await authService.changePassword(req.user.id, current_password, new_password);

            await ActivityLog.create({
                user_id: req.user.id,
                action: 'CHANGE_PASSWORD',
                resource: 'auth',
                ip_address: req.ip,
                user_agent: req.get('User-Agent'),
                org_node_id: req.user.org_node_id
            });

            res.json({
                success: true,
                message: 'Password changed successfully'
            });
        } catch (error) {
            next(error);
        }
    },

    // Forgot password
    async forgotPassword(req, res, next) {
        try {
            const { email } = req.body;
            await authService.forgotPassword(email);

            res.json({
                success: true,
                message: 'Password reset email sent'
            });
        } catch (error) {
            next(error);
        }
    },

    // Reset password
    async resetPassword(req, res, next) {
        try {
            const { token, new_password } = req.body;
            await authService.resetPassword(token, new_password);

            res.json({
                success: true,
                message: 'Password reset successful'
            });
        } catch (error) {
            next(error);
        }
    },

    // Get current user
    async getCurrentUser(req, res, next) {
        try {
            // Optimization: If the middleware already loaded the basic user, 
            // we only fetch the extra details we need if they aren't there.
            const user = await User.findByPk(req.user.id, {
                include: [
                    {
                        model: Role,
                        as: 'role',
                        attributes: ['id', 'name', 'level', 'visibility_scope'],
                        include: [{
                            model: require('../models').Permission,
                            as: 'permissions',
                            attributes: ['id', 'name', 'resource', 'action'],
                            through: { attributes: [] }
                        }]
                    },
                    {
                        model: Role,
                        as: 'roles',
                        attributes: ['id', 'name'],
                        include: [{
                            model: require('../models').Permission,
                            as: 'permissions',
                            attributes: ['id', 'name', 'resource', 'action'],
                            through: { attributes: [] }
                        }]
                    },
                    {
                        model: require('../models').OrganizationNode,
                        as: 'organizationNode',
                        attributes: ['id', 'name', 'code', 'path']
                    },
                    {
                        model: require('../models').Company,
                        as: 'company',
                        attributes: ['id', 'name', 'subdomain']
                    }
                ],
                attributes: { exclude: ['password_hash', 'refresh_token'] }
            });

            res.json({
                success: true,
                data: user
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = authController;