const { ActivityLog, User } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

class AuditService {
    // Log activity
    async logActivity(data) {
        try {
            const log = await ActivityLog.create({
                user_id: data.user_id,
                action: data.action,
                resource: data.resource,
                resource_id: data.resource_id,
                details: data.details,
                ip_address: data.ip_address,
                user_agent: data.user_agent,
                branch_id: data.branch_id
            });

            return log;
        } catch (error) {
            logger.error('Log activity error:', error);
            // Don't throw - logging should not break main flow
        }
    }

    // Get activity logs with filters
    async getActivityLogs(filters = {}, page = 1, limit = 50) {
        try {
            const where = {};

            if (filters.user_id) where.user_id = filters.user_id;
            if (filters.action) where.action = filters.action;
            if (filters.resource) where.resource = filters.resource;
            if (filters.resource_id) where.resource_id = filters.resource_id;
            if (filters.branch_id) where.branch_id = filters.branch_id;

            if (filters.from_date || filters.to_date) {
                where.created_at = {};
                if (filters.from_date) where.created_at[Op.gte] = new Date(filters.from_date);
                if (filters.to_date) where.created_at[Op.lte] = new Date(filters.to_date);
            }

            const offset = (page - 1) * limit;

            const { count, rows } = await ActivityLog.findAndCountAll({
                where,
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['id', 'first_name', 'last_name', 'email']
                }],
                limit,
                offset,
                order: [['created_at', 'DESC']]
            });

            return {
                logs: rows,
                pagination: {
                    total: count,
                    page,
                    pages: Math.ceil(count / limit)
                }
            };
        } catch (error) {
            logger.error('Get activity logs error:', error);
            throw error;
        }
    }

    // Get user activity summary
    async getUserActivitySummary(userId, days = 30) {
        try {
            const since = new Date();
            since.setDate(since.getDate() - days);

            const logs = await ActivityLog.findAll({
                where: {
                    user_id: userId,
                    created_at: { [Op.gte]: since }
                },
                attributes: [
                    'action',
                    'resource',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                group: ['action', 'resource'],
                order: [[sequelize.literal('count'), 'DESC']]
            });

            return logs;
        } catch (error) {
            logger.error('Get user activity summary error:', error);
            throw error;
        }
    }

    // Get resource activity
    async getResourceActivity(resource, resourceId, limit = 50) {
        try {
            const logs = await ActivityLog.findAll({
                where: {
                    resource,
                    resource_id: resourceId
                },
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['id', 'first_name', 'last_name']
                }],
                limit,
                order: [['created_at', 'DESC']]
            });

            return logs;
        } catch (error) {
            logger.error('Get resource activity error:', error);
            throw error;
        }
    }

    // Clean old logs
    async cleanOldLogs(daysToKeep = 365) {
        try {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - daysToKeep);

            const deleted = await ActivityLog.destroy({
                where: {
                    created_at: { [Op.lt]: cutoff }
                }
            });

            logger.info(`Cleaned ${deleted} old activity logs`);
            return deleted;
        } catch (error) {
            logger.error('Clean old logs error:', error);
            throw error;
        }
    }

    // Get activity statistics
    async getActivityStatistics(filters = {}) {
        try {
            const where = {};

            if (filters.from_date || filters.to_date) {
                where.created_at = {};
                if (filters.from_date) where.created_at[Op.gte] = new Date(filters.from_date);
                if (filters.to_date) where.created_at[Op.lte] = new Date(filters.to_date);
            }

            // By action
            const byAction = await ActivityLog.findAll({
                where,
                attributes: [
                    'action',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                group: ['action']
            });

            // By resource
            const byResource = await ActivityLog.findAll({
                where,
                attributes: [
                    'resource',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                group: ['resource']
            });

            // By user
            const byUser = await ActivityLog.findAll({
                where,
                attributes: [
                    'user_id',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                group: ['user_id'],
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['id', 'first_name', 'last_name']
                }],
                limit: 10,
                order: [[sequelize.literal('count'), 'DESC']]
            });

            // Daily activity
            const dailyActivity = await ActivityLog.findAll({
                where,
                attributes: [
                    [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                group: [sequelize.fn('DATE', sequelize.col('created_at'))],
                order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'DESC']],
                limit: 30
            });

            return {
                by_action: byAction,
                by_resource: byResource,
                top_users: byUser,
                daily_activity: dailyActivity,
                total: await ActivityLog.count({ where })
            };
        } catch (error) {
            logger.error('Get activity statistics error:', error);
            throw error;
        }
    }
}

module.exports = new AuditService();