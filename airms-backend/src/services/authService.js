const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Role, Permission, ActivityLog } = require('../models');
const logger = require('../config/logger');
const emailService = require('./emailService');

class AuthService {
    // Register new user
    async register(userData) {
        try {
            // Check if user already exists
            const existingUser = await User.findOne({
                where: {
                    [Op.or]: [
                        { email: userData.email },
                        { employee_id: userData.employee_id }
                    ]
                }
            });

            if (existingUser) {
                throw new Error('User already exists with this email or employee ID');
            }

            // Map password to password_hash before creation
            if (userData.password) {
                userData.password_hash = userData.password;
                delete userData.password;
                delete userData.confirm_password;
            }

            // Create user
            const user = await User.create(userData);

            // Generate tokens
            const tokens = this.generateTokens(user);

            return {
                user: user.toJSON(),
                ...tokens
            };
        } catch (error) {
            logger.error('Registration error:', error);
            throw error;
        }
    }

    // Login user
    async login(email, password, ipAddress) {
        try {
// authService.js
            // Find user with case-insensitive email matching
            // PHASE 1: Fetch User and simple associations (No Permissions yet)
            const user = await User.findOne({
                where: { 
                    email: { [Op.iLike]: email } 
                },
                include: [
                    {
                        model: require('../models').OrganizationNode,
                        as: 'organizationNode'
                    },
                    {
                        model: require('../models').Company,
                        as: 'company'
                    }
                ]
            });

            if (!user) {
                throw new Error('Invalid email or password');
            }

            // PHASE 2: Fetch Primary Role with Permissions separately (FAST)
            if (user.role_id) {
                const primaryRole = await Role.findByPk(user.role_id, {
                    include: [{
                        model: Permission,
                        as: 'permissions',
                        through: { attributes: [] }
                    }]
                });
                // Attach it to the user object so it looks like it was eager-loaded
                user.setDataValue('role', primaryRole);
            }

            // PHASE 3: Fetch Secondary Roles with Permissions separately (FAST)
            const secondaryRoles = await user.getRoles({
                include: [{
                    model: Permission,
                    as: 'permissions',
                    through: { attributes: [] }
                }]
            });
            // Attach them to the user object
            user.setDataValue('roles', secondaryRoles);

            if (!user) {
                throw new Error('Invalid email or password');
            }

            // Check if user is active
            if (!user.is_active) {
                throw new Error('Account is deactivated');
            }

            // Validate password
            const isValidPassword = await user.validatePassword(password);
            if (!isValidPassword) {
                throw new Error('Invalid email or password');
            }

            // Update last login
            await user.update({
                last_login: new Date()
            });

            // Generate tokens
            const tokens = this.generateTokens(user);

            return {
                user: user.toJSON(),
                ...tokens
            };
        } catch (error) {
            logger.error('Login error:', error);
            throw error;
        }
    }

    // Generate access and refresh tokens
    generateTokens(user) {
        const payload = {
            id: user.id,
            email: user.email,
            role_id: user.role_id,
            role_ids: user.roles?.map(r => r.id) || (user.role_id ? [user.role_id] : []),
            org_node_id: user.org_node_id,
            company_id: user.company_id
        };

        // Access token
        const accessToken = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // Refresh token
        const refreshToken = jwt.sign(
            payload,
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '30d' }
        );

        return {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: 7 * 24 * 60 * 60 // 7 days in seconds
        };
    }

    // Refresh access token
    async refreshToken(refreshToken) {
        try {
            // Verify refresh token
            const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

            // Find user
            const user = await User.findByPk(decoded.id);
            if (!user || !user.is_active) {
                throw new Error('Invalid refresh token');
            }

            // Generate new tokens
            return this.generateTokens(user);
        } catch (error) {
            logger.error('Refresh token error:', error);
            throw new Error('Invalid refresh token');
        }
    }

    // Logout
    async logout(refreshToken) {
        try {
            // Invalidate refresh token (optional - can be stored in blacklist)
            // For now, just return success
            return true;
        } catch (error) {
            logger.error('Logout error:', error);
            throw error;
        }
    }

    // Change password
    async changePassword(userId, currentPassword, newPassword) {
        try {
            const user = await User.findByPk(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Validate current password
            const isValid = await user.validatePassword(currentPassword);
            if (!isValid) {
                throw new Error('Current password is incorrect');
            }

            // Update password
            user.password_hash = newPassword;
            await user.save();

            return true;
        } catch (error) {
            logger.error('Change password error:', error);
            throw error;
        }
    }

    // Forgot password
    async forgotPassword(email) {
        try {
            const user = await User.findOne({ where: { email } });
            if (!user) {
                // Don't reveal if user exists
                return true;
            }

            // Generate reset token
            const resetToken = jwt.sign(
                { id: user.id },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            // Send email
            await emailService.sendPasswordResetEmail(user.email, resetToken);

            return true;
        } catch (error) {
            logger.error('Forgot password error:', error);
            throw error;
        }
    }

    // Reset password
    async resetPassword(token, newPassword) {
        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Find user
            const user = await User.findByPk(decoded.id);
            if (!user) {
                throw new Error('Invalid reset token');
            }

            // Update password
            user.password_hash = newPassword;
            user.requires_password_change = false;
            await user.save();

            return true;
        } catch (error) {
            logger.error('Reset password error:', error);
            throw new Error('Invalid or expired reset token');
        }
    }

    // Verify token
    verifyToken(token) {
        try {
            return jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            throw new Error('Invalid token');
        }
    }
}

module.exports = new AuthService();