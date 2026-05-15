const { User, Role, Notification } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const emailService = require('./emailService');

class NotificationService {
    // Notify chairman
    async notifyChairman(event, data) {
        try {
            // Find all chairman users
            const chairmen = await User.findAll({
                where: {
                    role_id: 2, // Chairman role
                    is_active: true
                },
                attributes: ['id', 'email']
            });

            const notifications = [];

            for (const chairman of chairmen) {
                const notification = {
                    user_id: chairman.id,
                    type: event,
                    title: this.getNotificationTitle(event),
                    message: this.getNotificationMessage(event, data),
                    data: data,
                    priority: 'high'
                };

                // Save to database (We await this as it's part of the record)
                const saved = await Notification.create(notification);
                notifications.push(saved);

                // Send email for high priority (FIRE AND FORGET to avoid SMTP blocking)
                emailService.sendNotificationEmail(chairman.email, {
                    subject: notification.title,
                    message: notification.message,
                    data
                }).catch(err => logger.error(`Background email notification failed for ${chairman.email}:`, err));
            }

            return notifications;
        } catch (error) {
            logger.error('Notify chairman error:', error);
            throw error;
        }
    }

    // Notify storage manager
    async notifyStorageManager(event, data) {
        try {
            const storageManagers = await User.findAll({
                where: {
                    role_id: 3, // Storage Manager role
                    is_active: true
                },
                attributes: ['id', 'email', 'org_node_id']
            });

            // Filter by node if needed
            const targetManagers = data.org_node_id 
                ? storageManagers.filter(sm => sm.org_node_id === data.org_node_id)
                : storageManagers;

            const notifications = [];

            for (const manager of targetManagers) {
                const notification = {
                    user_id: manager.id,
                    type: event,
                    title: this.getNotificationTitle(event),
                    message: this.getNotificationMessage(event, data),
                    data: data,
                    priority: 'high'
                };

                const saved = await Notification.create(notification);
                notifications.push(saved);

                // Send email (FIRE AND FORGET)
                emailService.sendNotificationEmail(manager.email, {
                    subject: notification.title,
                    message: notification.message,
                    data
                }).catch(err => logger.error(`Background email notification failed for storage manager ${manager.email}:`, err));
            }

            return notifications;
        } catch (error) {
            logger.error('Notify storage manager error:', error);
            throw error;
        }
    }

    // Notify user
    async notifyUser(event, data) {
        try {
            const { user_id, ...notificationData } = data;

            const user = await User.findByPk(user_id, {
                attributes: ['id', 'email']
            });

            if (!user) {
                throw new Error('User not found');
            }

            const notification = {
                user_id: user.id,
                type: event,
                title: this.getNotificationTitle(event),
                message: this.getNotificationMessage(event, notificationData),
                data: notificationData,
                priority: this.getNotificationPriority(event)
            };

            const saved = await Notification.create(notification);

            // Send email for important notifications (FIRE AND FORGET)
            if (this.shouldSendEmail(event)) {
                emailService.sendNotificationEmail(user.email, {
                    subject: notification.title,
                    message: notification.message,
                    data: notificationData
                }).catch(err => logger.error(`Background email notification failed for user ${user.email}:`, err));
            }

            return saved;
        } catch (error) {
            logger.error('Notify user error:', error);
            throw error;
        }
    }

    // Notify role
    async notifyRole(role, event, data) {
        try {
            const roleMap = {
                'super_admin': 1,
                'chairman': 2,
                'storage_manager': 3,
                'cluster_manager': 4,
                'user': 5
            };

            const roleId = roleMap[role];
            if (!roleId) {
                throw new Error('Invalid role');
            }

            const users = await User.findAll({
                where: {
                    role_id: roleId,
                    is_active: true
                },
                attributes: ['id', 'email']
            });

            const notifications = [];

            for (const user of users) {
                const notification = {
                    user_id: user.id,
                    type: event,
                    title: this.getNotificationTitle(event),
                    message: this.getNotificationMessage(event, data),
                    data: data,
                    priority: 'medium'
                };

                const saved = await Notification.create(notification);
                notifications.push(saved);
            }

            return notifications;
        } catch (error) {
            logger.error('Notify role error:', error);
            throw error;
        }
    }

    // Notify organization node
    async notifyBranch(event, data) {
        try {
            const { org_node_id, ...notificationData } = data;

            // Find all users in the node
            const users = await User.findAll({
                where: {
                    org_node_id,
                    is_active: true
                },
                attributes: ['id', 'email', 'role_id']
            });

            const notifications = [];

            for (const user of users) {
                const notification = {
                    user_id: user.id,
                    type: event,
                    title: this.getNotificationTitle(event),
                    message: this.getNotificationMessage(event, notificationData),
                    data: notificationData,
                    priority: 'low'
                };

                const saved = await Notification.create(notification);
                notifications.push(saved);
            }

            return notifications;
        } catch (error) {
            logger.error('Notify branch error:', error);
            throw error;
        }
    }

    // Get user notifications
    async getUserNotifications(userId, page = 1, limit = 20, unreadOnly = false) {
        try {
            const where = { user_id: userId };
            if (unreadOnly) {
                where.read_at = null;
            }

            const offset = (page - 1) * limit;

            const { count, rows } = await Notification.findAndCountAll({
                where,
                limit,
                offset,
                order: [['created_at', 'DESC']]
            });

            return {
                notifications: rows,
                unread_count: await Notification.count({
                    where: { user_id: userId, read_at: null }
                }),
                pagination: {
                    total: count,
                    page,
                    pages: Math.ceil(count / limit)
                }
            };
        } catch (error) {
            logger.error('Get user notifications error:', error);
            throw error;
        }
    }

    // Mark notification as read
    async markAsRead(notificationId, userId) {
        try {
            const notification = await Notification.findOne({
                where: { id: notificationId, user_id: userId }
            });

            if (!notification) {
                throw new Error('Notification not found');
            }

            await notification.update({
                read_at: new Date()
            });

            return notification;
        } catch (error) {
            logger.error('Mark notification as read error:', error);
            throw error;
        }
    }

    // Mark all as read
    async markAllAsRead(userId) {
        try {
            await Notification.update(
                { read_at: new Date() },
                { where: { user_id: userId, read_at: null } }
            );

            return true;
        } catch (error) {
            logger.error('Mark all as read error:', error);
            throw error;
        }
    }

    // Get notification title
    getNotificationTitle(event) {
        const titles = {
            'NEW_REQUEST': 'New Request Created',
            'REQUEST_APPROVED': 'Request Approved',
            'REQUEST_REJECTED': 'Request Rejected',
            'REQUEST_FULLY_APPROVED': 'Request Fully Approved',
            'PENDING_APPROVAL': 'Pending Approval Required',
            'ASSET_ASSIGNED': 'New Asset Assigned',
            'ASSET_RETURNED': 'Asset Returned',
            'RETURN_REQUESTED': 'Return Requested',
            'RETURN_PROCESSED': 'Return Processed',
            'RETURN_REJECTED': 'Return Rejected',
            'TRANSFER_PENDING': 'Transfer Pending',
            'TRANSFER_COMPLETED': 'Transfer Completed',
            'TRANSFER_REJECTED': 'Transfer Rejected',
            'ISSUE_REPORTED': 'Issue Reported',
            'ISSUE_ASSIGNED': 'Issue Assigned',
            'ISSUE_RESOLVED': 'Issue Resolved',
            'LOW_STOCK_ALERT': 'Low Stock Alert'
        };

        return titles[event] || 'New Notification';
    }

    // Get notification message
    getNotificationMessage(event, data) {
        const messages = {
            'NEW_REQUEST': `New request #${data.request_number} created by ${data.requester?.first_name}`,
            'REQUEST_APPROVED': `Request #${data.request_number} approved by ${data.approver?.first_name}`,
            'REQUEST_REJECTED': `Request #${data.request_number} rejected: ${data.reason}`,
            'REQUEST_FULLY_APPROVED': `Request #${data.request_number} is fully approved`,
            'PENDING_APPROVAL': `Request #${data.request_number} requires your approval`,
            'ASSET_ASSIGNED': `Asset assigned: ${data.product_name}`,
            'ASSET_RETURNED': `Asset returned: ${data.product_name}`,
            'RETURN_REQUESTED': `Return request #${data.return_number} created`,
            'RETURN_PROCESSED': `Return #${data.return_number} processed`,
            'RETURN_REJECTED': `Return #${data.return_number} rejected: ${data.reason}`,
            'TRANSFER_PENDING': `Transfer #${data.transfer_number} pending approval`,
            'TRANSFER_COMPLETED': `Transfer #${data.transfer_number} completed`,
            'TRANSFER_REJECTED': `Transfer #${data.transfer_number} rejected`,
            'ISSUE_REPORTED': `Issue reported: ${data.issue_type}`,
            'ISSUE_ASSIGNED': `Issue assigned to you`,
            'ISSUE_RESOLVED': `Issue resolved`,
            'LOW_STOCK_ALERT': `Low stock alert: ${data.product_name}`
        };

        return messages[event] || 'You have a new notification';
    }

    // Get notification priority
    getNotificationPriority(event) {
        const highPriority = ['REQUEST_REJECTED', 'TRANSFER_REJECTED', 'LOW_STOCK_ALERT'];
        const mediumPriority = ['PENDING_APPROVAL', 'ISSUE_REPORTED', 'ASSET_ASSIGNED'];
        
        if (highPriority.includes(event)) return 'high';
        if (mediumPriority.includes(event)) return 'medium';
        return 'low';
    }

    // Check if should send email
    shouldSendEmail(event) {
        const emailEvents = [
            'PENDING_APPROVAL',
            'REQUEST_REJECTED',
            'TRANSFER_REJECTED',
            'LOW_STOCK_ALERT',
            'ASSET_ASSIGNED'
        ];
        
        return emailEvents.includes(event);
    }
}

module.exports = new NotificationService();
