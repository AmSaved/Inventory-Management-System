const { User, Role, ActivityLog } = require('../models');
const authService = require('../services/authService');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');

const authController = {
    // Register new user
    async register(req, res, next) {
        const startTime = Date.now();
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const userData = req.body;
            logger.info(`Starting registration for email: ${userData.email}`);
            
            const registrationResult = await authService.register(userData);
            const user = registrationResult.user; // Extract the actual user object

            logger.debug(`User record created in ${Date.now() - startTime}ms. Finalizing in background...`);

            // FIRE AND FORGET Activity Log to avoid blocking response
            ActivityLog.create({
                user_id: user.id,
                action: 'CREATE',
                resource: 'users',
                resource_id: user.id,
                details: { email: user.email },
                ip_address: req.ip,
                user_agent: req.get('User-Agent'),
                company_id: user.company_id
            }).catch(err => logger.error(`Background activity logging failed for registration:`, err));

            const totalTime = Date.now() - startTime;
            logger.info(`Registration completed successfully in ${totalTime}ms for user ID: ${user.id}`);

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                data: registrationResult
            });
        } catch (error) {
            logger.error(`Registration failed after ${Date.now() - startTime}ms: ${error.message}`);
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
            // PHASE 1: Fetch basic user info and simple associations
            const user = await User.findByPk(req.user.id, {
                include: [
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

            if (user) {
                // PHASE 2: Fetch Primary Role and its permissions separately
                if (user.role_id) {
                    const primaryRole = await Role.findByPk(user.role_id, {
                        attributes: ['id', 'name', 'level', 'visibility_scope'],
                        include: [{
                            model: require('../models').Permission,
                            as: 'permissions',
                            attributes: ['id', 'name', 'resource', 'action'],
                            through: { attributes: [] }
                        }]
                    });
                    user.setDataValue('role', primaryRole);
                }

                // PHASE 3: Fetch Secondary Roles and their permissions separately
                const secondaryRoles = await user.getRoles({
                    attributes: ['id', 'name'],
                    include: [{
                        model: require('../models').Permission,
                        as: 'permissions',
                        attributes: ['id', 'name', 'resource', 'action'],
                        through: { attributes: [] }
                    }]
                });
                user.setDataValue('roles', secondaryRoles);
            }

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