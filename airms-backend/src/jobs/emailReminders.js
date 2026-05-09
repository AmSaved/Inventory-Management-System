const { Assignment, User, Product } = require('../models');
const { Op } = require('sequelize');
const emailService = require('../services/emailService');
const logger = require('../config/logger');

class EmailReminders {
    // Send due date reminders
    async sendDueDateReminders() {
        try {
            // Find assignments due in next 3 days
            const threeDaysFromNow = new Date();
            threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

            const assignments = await Assignment.findAll({
                where: {
                    status: 'active',
                    expected_return_date: {
                        [Op.lte]: threeDaysFromNow,
                        [Op.gte]: new Date()
                    }
                },
                include: [
                    {
                        model: User,
                        as: 'user'
                    },
                    {
                        model: Product,
                        as: 'product'
                    }
                ]
            });

            for (const assignment of assignments) {
                const daysUntilDue = Math.ceil(
                    (new Date(assignment.expected_return_date) - new Date()) / (1000 * 60 * 60 * 24)
                );

                await emailService.sendEmail(
                    assignment.user.email,
                    'Asset Return Reminder',
                    this.getDueDateEmailContent(assignment, daysUntilDue)
                );

                logger.info(`Reminder sent to ${assignment.user.email} for assignment ${assignment.assignment_number}`);
            }

            // Find overdue assignments
            const overdueAssignments = await Assignment.findAll({
                where: {
                    status: 'active',
                    expected_return_date: {
                        [Op.lt]: new Date()
                    }
                },
                include: [
                    {
                        model: User,
                        as: 'user'
                    },
                    {
                        model: Product,
                        as: 'product'
                    }
                ]
            });

            for (const assignment of overdueAssignments) {
                const daysOverdue = Math.ceil(
                    (new Date() - new Date(assignment.expected_return_date)) / (1000 * 60 * 60 * 24)
                );

                await emailService.sendEmail(
                    assignment.user.email,
                    'URGENT: Asset Return Overdue',
                    this.getOverdueEmailContent(assignment, daysOverdue)
                );

                // Also notify storage manager
                const storageManagers = await User.findAll({
                    where: { role_id: 3, org_node_id: assignment.org_node_id }
                });

                for (const manager of storageManagers) {
                    await emailService.sendEmail(
                        manager.email,
                        'Overdue Asset Alert',
                        this.getManagerOverdueAlert(assignment, daysOverdue)
                    );
                }

                logger.info(`Overdue alert sent for assignment ${assignment.assignment_number}`);
            }

            return {
                reminders_sent: assignments.length,
                overdue_alerts_sent: overdueAssignments.length
            };
        } catch (error) {
            logger.error('Send due date reminders error:', error);
            throw error;
        }
    }

    // Get due date email content
    getDueDateEmailContent(assignment, daysUntilDue) {
        return `
            <h2>Asset Return Reminder</h2>
            <p>Dear ${assignment.user.first_name},</p>
            <p>This is a reminder that the following asset is due for return in ${daysUntilDue} days:</p>
            <table style="border-collapse: collapse; width: 100%;">
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;"><strong>Asset:</strong></td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${assignment.product.name}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;"><strong>Serial Number:</strong></td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${assignment.serial_number || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;"><strong>Due Date:</strong></td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${new Date(assignment.expected_return_date).toLocaleDateString()}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;"><strong>Assignment Number:</strong></td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${assignment.assignment_number}</td>
                </tr>
            </table>
            <p>Please ensure the asset is returned on or before the due date.</p>
            <p><a href="${process.env.FRONTEND_URL}/assignments/${assignment.id}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Assignment</a></p>
            <br>
            <p>Thank you,<br>AIRMS System</p>
        `;
    }

    // Get overdue email content
    getOverdueEmailContent(assignment, daysOverdue) {
        return `
            <h2 style="color: red;">URGENT: Asset Return Overdue</h2>
            <p>Dear ${assignment.user.first_name},</p>
            <p>The following asset is <strong>${daysOverdue} days overdue</strong> for return:</p>
            <table style="border-collapse: collapse; width: 100%;">
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;"><strong>Asset:</strong></td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${assignment.product.name}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;"><strong>Serial Number:</strong></td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${assignment.serial_number || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;"><strong>Due Date:</strong></td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${new Date(assignment.expected_return_date).toLocaleDateString()}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;"><strong>Days Overdue:</strong></td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${daysOverdue}</td>
                </tr>
            </table>
            <p>Please return this asset immediately to avoid any penalties.</p>
            <p><a href="${process.env.FRONTEND_URL}/assignments/${assignment.id}" style="background-color: #f44336; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Return Now</a></p>
            <br>
            <p>Thank you,<br>AIRMS System</p>
        `;
    }

    // Get manager overdue alert
    getManagerOverdueAlert(assignment, daysOverdue) {
        return `
            <h2>Overdue Asset Alert</h2>
            <p>The following asset is overdue for return:</p>
            <table style="border-collapse: collapse; width: 100%;">
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;"><strong>User:</strong></td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${assignment.user.first_name} ${assignment.user.last_name}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;"><strong>Email:</strong></td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${assignment.user.email}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;"><strong>Asset:</strong></td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${assignment.product.name}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;"><strong>Due Date:</strong></td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${new Date(assignment.expected_return_date).toLocaleDateString()}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;"><strong>Days Overdue:</strong></td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${daysOverdue}</td>
                </tr>
            </table>
            <p>Please take appropriate action.</p>
            <p><a href="${process.env.FRONTEND_URL}/assignments/${assignment.id}">View Assignment</a></p>
        `;
    }
}

module.exports = new EmailReminders();