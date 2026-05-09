const { Inventory, Product, OrganizationNode, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');

class InventoryAlerts {
    // Check low stock items
    async checkLowStock() {
        try {
            logger.info('Running low stock check...');

            const lowStockItems = await Inventory.findAll({
                where: {
                    quantity: {
                        [Op.lte]: sequelize.col('minimum_quantity')
                    },
                    minimum_quantity: {
                        [Op.gt]: 0
                    }
                },
                include: [
                    {
                        model: Product,
                        as: 'product'
                    },
                    {
                        model: OrganizationNode,
                        as: 'organizationNode'
                    }
                ]
            });

            logger.info(`Found ${lowStockItems.length} low stock items`);

            for (const item of lowStockItems) {
                await this.processLowStockAlert(item);
            }

            // Group by node for summary
            const byNode = this.groupByOrgNode(lowStockItems);
            
            // Send summary to storage managers
            for (const [nodeId, items] of Object.entries(byNode)) {
                await this.sendLowStockSummary(nodeId, items);
            }

            return {
                total: lowStockItems.length,
                by_node: byNode
            };
        } catch (error) {
            logger.error('Low stock check error:', error);
            throw error;
        }
    }

    // Process individual low stock alert
    async processLowStockAlert(inventoryItem) {
        try {
            const alertLevel = this.calculateAlertLevel(
                inventoryItem.quantity,
                inventoryItem.minimum_quantity
            );

            // Create notification for storage managers
            await notificationService.notifyStorageManager('LOW_STOCK_ALERT', {
                org_node_id: inventoryItem.org_node_id,
                product_id: inventoryItem.product_id,
                product_name: inventoryItem.product.name,
                current_quantity: inventoryItem.quantity,
                minimum_quantity: inventoryItem.minimum_quantity,
                alert_level: alertLevel,
                reorder_quantity: this.calculateReorderQuantity(inventoryItem)
            });

            // Log alert
            logger.warn(`Low stock alert: ${inventoryItem.product.name} at ${inventoryItem.organizationNode.name} - ${inventoryItem.quantity} remaining (min: ${inventoryItem.minimum_quantity})`);

        } catch (error) {
            logger.error('Process low stock alert error:', error);
        }
    }

    // Calculate alert level
    calculateAlertLevel(current, minimum) {
        const ratio = current / minimum;
        if (ratio <= 0.25) return 'critical';
        if (ratio <= 0.5) return 'high';
        if (ratio <= 0.75) return 'medium';
        return 'low';
    }

    // Calculate reorder quantity
    calculateReorderQuantity(inventoryItem) {
        const max = inventoryItem.maximum_quantity || inventoryItem.minimum_quantity * 3;
        return max - inventoryItem.quantity;
    }

    // Group low stock items by organization node
    groupByOrgNode(items) {
        return items.reduce((acc, item) => {
            const nodeId = item.org_node_id;
            if (!acc[nodeId]) {
                acc[nodeId] = [];
            }
            acc[nodeId].push({
                product_id: item.product_id,
                product_name: item.product.name,
                sku: item.product.sku,
                current_quantity: item.quantity,
                minimum_quantity: item.minimum_quantity,
                alert_level: this.calculateAlertLevel(item.quantity, item.minimum_quantity),
                location: item.location_details
            });
            return acc;
        }, {});
    }

    // Send low stock summary to organization node storage managers
    async sendLowStockSummary(nodeId, items) {
        try {
            const node = await OrganizationNode.findByPk(nodeId);
            const storageManagers = await User.findAll({
                where: {
                    org_node_id: nodeId,
                    role_id: 3, // Storage Manager role
                    is_active: true
                }
            });

            const criticalCount = items.filter(i => i.alert_level === 'critical').length;
            const highCount = items.filter(i => i.alert_level === 'high').length;

            for (const manager of storageManagers) {
                await emailService.sendEmail(
                    manager.email,
                    `Low Stock Summary - ${node.name}`,
                    this.getLowStockEmailTemplate(node, items, criticalCount, highCount)
                );
            }
        } catch (error) {
            logger.error('Send low stock summary error:', error);
        }
    }

    // Get low stock email template
    getLowStockEmailTemplate(node, items, criticalCount, highCount) {
        const itemsList = items.map(item => `
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.product_name}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.sku}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.current_quantity}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.minimum_quantity}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">
                    <span style="color: ${this.getAlertColor(item.alert_level)}; font-weight: bold;">
                        ${item.alert_level.toUpperCase()}
                    </span>
                </td>
            </tr>
        `).join('');

        return `
            <h2>Low Stock Alert - ${node.name}</h2>
            <p>Summary of items below minimum quantity:</p>
            
            <p><strong>Critical:</strong> ${criticalCount} | <strong>High:</strong> ${highCount}</p>
            
            <table style="border-collapse: collapse; width: 100%;">
                <thead>
                    <tr>
                        <th style="border: 1px solid #ddd; padding: 8px; background: #f2f2f2;">Product</th>
                        <th style="border: 1px solid #ddd; padding: 8px; background: #f2f2f2;">SKU</th>
                        <th style="border: 1px solid #ddd; padding: 8px; background: #f2f2f2;">Current</th>
                        <th style="border: 1px solid #ddd; padding: 8px; background: #f2f2f2;">Minimum</th>
                        <th style="border: 1px solid #ddd; padding: 8px; background: #f2f2f2;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsList}
                </tbody>
            </table>
            
            <p>Please review and place orders for critical items.</p>
            <p><a href="${process.env.FRONTEND_URL}/inventory/low-stock">View in Dashboard</a></p>
            
            <br>
            <p>Best regards,<br>AIRMS System</p>
        `;
    }

    // Get alert color
    getAlertColor(level) {
        switch(level) {
            case 'critical': return '#dc3545';
            case 'high': return '#fd7e14';
            case 'medium': return '#ffc107';
            default: return '#28a745';
        }
    }
}

module.exports = new InventoryAlerts();