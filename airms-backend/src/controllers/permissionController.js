const { Permission, ActivityLog } = require('../models');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');

const permissionController = {
    // Get all permissions
    async getAll(req, res, next) {
        try {
            const permissions = await Permission.findAll({
                order: [
                    ['resource', 'ASC'],
                    ['action', 'ASC']
                ]
            });

            // Group by resource
            res.json({
                success: true,
                data: permissions
            });
        } catch (error) {
            next(error);
        }
    },

    // Get permission by ID
    async getById(req, res, next) {
        try {
            const { id } = req.params;
            const permission = await Permission.findByPk(id);

            if (!permission) {
                return res.status(404).json({
                    success: false,
                    message: 'Permission not found'
                });
            }

            res.json({
                success: true,
                data: permission
            });
        } catch (error) {
            next(error);
        }
    },

    // Create permission
    async create(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { name, resource, action, description } = req.body;

            const permission = await Permission.create({
                name,
                resource,
                action,
                description
            });

            await ActivityLog.create({
                user_id: req.user.id,
                action: 'CREATE',
                resource: 'permissions',
                resource_id: permission.id,
                details: { name, resource, action },
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
            });

            res.status(201).json({
                success: true,
                message: 'Permission created successfully',
                data: permission
            });
        } catch (error) {
            next(error);
        }
    },

    // Update permission
    async update(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { id } = req.params;
            const { name, resource, action, description } = req.body;

            const permission = await Permission.findByPk(id);
            if (!permission) {
                return res.status(404).json({
                    success: false,
                    message: 'Permission not found'
                });
            }

            await permission.update({
                name,
                resource,
                action,
                description
            });

            await ActivityLog.create({
                user_id: req.user.id,
                action: 'UPDATE',
                resource: 'permissions',
                resource_id: id,
                details: { name, resource, action },
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
            });

            res.json({
                success: true,
                message: 'Permission updated successfully',
                data: permission
            });
        } catch (error) {
            next(error);
        }
    },

    // Delete permission
    async delete(req, res, next) {
        try {
            const { id } = req.params;

            const permission = await Permission.findByPk(id);
            if (!permission) {
                return res.status(404).json({
                    success: false,
                    message: 'Permission not found'
                });
            }

            // Check if permission is assigned to any roles
            const roleCount = await permission.countRoles();
            if (roleCount > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete permission assigned to roles'
                });
            }

            await permission.destroy();

            await ActivityLog.create({
                user_id: req.user.id,
                action: 'DELETE',
                resource: 'permissions',
                resource_id: id,
                details: { name: permission.name },
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
            });

            res.json({
                success: true,
                message: 'Permission deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    },

    // Get permissions by resource
    async getByResource(req, res, next) {
        try {
            const { resource } = req.params;
            
            const permissions = await Permission.findAll({
                where: { resource },
                order: [['action', 'ASC']]
            });

            res.json({
                success: true,
                data: permissions
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = permissionController;