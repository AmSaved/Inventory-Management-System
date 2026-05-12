const { ActivityLog, User, OrganizationNode } = require('../models');
const { Op } = require('sequelize');

const activityController = {
    getRecentActivity: async (req, res) => {
        try {
            const company_id = req.user.company_id;
            const { limit = 20, resource } = req.query;
            
            // Apply Zero-Trust Isolation Scope
            const allowedNodes = req.getAuthorizedNodes 
                ? await req.getAuthorizedNodes() 
                : [];

            const where = { company_id };
            
            // If they are not global, restrict logs to their allowed nodes
            // Note: If org_node_id is null on the log, it's a global action, only Super Admins should see it
            if (allowedNodes.length > 0) {
                where.org_node_id = { [Op.in]: allowedNodes };
            }

            // Optional filter by resource type (e.g., 'Inventory', 'Transfer')
            if (resource) {
                where.resource = resource;
            }

            const logs = await ActivityLog.findAll({
                where,
                include: [
                    {
                        model: User,
                        as: 'user',
                        attributes: ['id', 'email', 'first_name', 'last_name']
                    }
                ],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit)
            });

            res.json({
                success: true,
                data: logs
            });

        } catch (error) {
            console.error('Error fetching activity logs:', error);
            res.status(500).json({ success: false, message: 'Failed to retrieve activity logs' });
        }
    }
};

module.exports = activityController;
