const { WorkflowStatus, ActivityLog } = require('../models');

const workflowStatusController = {
    /**
     * Get all custom status labels for the company.
     */
    async getAll(req, res, next) {
        try {
            const company_id = req.user.company_id;

            // SECURITY: Strict multi-tenancy enforcement
            if (!company_id) {
                return res.json({ success: true, data: [] });
            }

            const statuses = await WorkflowStatus.findAll({
                where: { company_id },
                order: [['name', 'ASC']]
            });
            res.json({ success: true, data: statuses });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Create a new status label.
     */
    async create(req, res, next) {
        try {
            const { name, color } = req.body;
            const company_id = req.user.company_id;

            const existing = await WorkflowStatus.findOne({ where: { company_id, name } });
            if (existing) return res.status(400).json({ success: false, message: 'Status label already exists' });

            const status = await WorkflowStatus.create({
                company_id,
                name,
                color,
                is_system: false
            });

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'CREATE',
                resource: 'workflow_statuses',
                resource_id: status.id,
                details: { name }
            });

            res.status(201).json({ success: true, data: status });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Delete a status label.
     */
    async delete(req, res, next) {
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;

            const status = await WorkflowStatus.findOne({ where: { id, company_id } });
            if (!status) return res.status(404).json({ success: false, message: 'Status not found' });
            if (status.is_system) return res.status(400).json({ success: false, message: 'Cannot delete system statuses' });

            await status.destroy();
            res.json({ success: true, message: 'Status label removed' });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = workflowStatusController;
