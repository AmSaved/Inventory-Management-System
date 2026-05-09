const logger = require('../config/logger');
const { Inventory, Product } = require('../models');
const { Op } = require('sequelize');

const inventoryHandler = (io, socket) => {
    const userId = socket.userId;
    const userPermissions = socket.userPermissions || [];
    const userNodeId = socket.userNodeId;

    // Join inventory rooms
    socket.join('inventory:updates');
    if (userNodeId) {
        socket.join(`inventory:unit:${userNodeId}`);
    }

    // AUTH HELPER (Dynamic)
    const canManageInventory = userPermissions.includes('inventory:manage') || userPermissions.includes('system:manage');

    // Handle stock level updates
    socket.on('inventory:stock-update', async (data) => {
        try {
            const { productId, branchId, oldQuantity, newQuantity, reason } = data;

            if (!canManageInventory) {
                socket.emit('error', { message: 'Insufficient permissions' });
                return;
            }

            // Broadcast to relevant unit
            io.to(`inventory:unit:${branchId}`).emit('inventory:stock-changed', {
                productId,
                unitId: branchId,
                oldQuantity,
                newQuantity,
                change: newQuantity - oldQuantity,
                reason,
                updatedBy: userId,
                timestamp: new Date()
            });

            // Check for low stock and alert if needed
            const inventory = await Inventory.findOne({
                where: { product_id: productId, org_node_id: branchId },
                include: ['product']
            });

            if (inventory && inventory.quantity <= inventory.minimum_quantity) {
                // Broadcast to anyone with inventory management permissions
                io.to(`permission:inventory:manage`).emit('inventory:low-stock-alert', {
                    productId,
                    productName: inventory.product.name,
                    unitId: branchId,
                    currentQuantity: inventory.quantity,
                    minimumQuantity: inventory.minimum_quantity,
                    timestamp: new Date()
                });
            }

            logger.info(`Stock update for product ${productId} in unit ${branchId} by user ${userId}`);
        } catch (error) {
            logger.error('Inventory stock update error:', error);
            socket.emit('error', { message: 'Failed to update stock' });
        }
    });

    // Handle inventory count/audit
    socket.on('inventory:count', async (data) => {
        try {
            const { unitId, counts } = data;

            if (!canManageInventory) {
                socket.emit('error', { message: 'Insufficient permissions' });
                return;
            }

            io.to(`inventory:unit:${unitId}`).emit('inventory:count-started', {
                unitId,
                startedBy: userId,
                timestamp: new Date()
            });

            for (const count of counts) {
                io.to(`inventory:unit:${unitId}`).emit('inventory:count-update', {
                    ...count,
                    countedBy: userId,
                    timestamp: new Date()
                });
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            io.to(`inventory:unit:${unitId}`).emit('inventory:count-completed', {
                unitId,
                completedBy: userId,
                totalCounted: counts.length,
                timestamp: new Date()
            });
        } catch (error) {
            logger.error('Inventory count error:', error);
        }
    });

    // Handle inventory transfer between units
    socket.on('inventory:transfer', async (data) => {
        try {
            const { fromUnit, toUnit, productId, quantity, status } = data;

            io.to(`inventory:unit:${fromUnit}`).emit('inventory:transfer-out', {
                toUnit,
                productId,
                quantity,
                status,
                initiatedBy: userId,
                timestamp: new Date()
            });

            io.to(`inventory:unit:${toUnit}`).emit('inventory:transfer-in', {
                fromUnit,
                productId,
                quantity,
                status,
                initiatedBy: userId,
                timestamp: new Date()
            });
        } catch (error) {
            logger.error('Inventory transfer error:', error);
        }
    });

    // Handle inventory search (Real-time)
    socket.on('inventory:search', async (data) => {
        try {
            const { query } = data;
            const results = await Product.findAll({
                where: {
                    [Op.or]: [
                        { name: { [Op.iLike]: `%${query}%` } },
                        { sku: { [Op.iLike]: `%${query}%` } }
                    ]
                },
                limit: 10
            });

            socket.emit('inventory:search-results', {
                query,
                results,
                timestamp: new Date()
            });
        } catch (error) {
            logger.error('Inventory search error:', error);
        }
    });

    // Handle reorder requests
    socket.on('inventory:reorder-request', async (data) => {
        try {
            const { productId, unitId, quantity, reason } = data;

            io.to(`permission:inventory:manage`).emit('inventory:reorder-created', {
                productId,
                unitId,
                quantity,
                reason,
                requestedBy: userId,
                timestamp: new Date()
            });
        } catch (error) {
            logger.error('Reorder request error:', error);
        }
    });

    // Clean up on disconnect
    socket.on('disconnect', () => {
        socket.leave('inventory:updates');
        if (userNodeId) socket.leave(`inventory:unit:${userNodeId}`);
        logger.debug(`User ${userId} disconnected from inventory handlers`);
    });
};

// BROADCAST UTILS (Dynamic)
const broadcastStockUpdate = (io, unitId, update) => {
    io.to(`inventory:unit:${unitId}`).emit('inventory:stock-updated', {
        ...update,
        timestamp: new Date()
    });
};

const broadcastLowStockAlert = (io, alert) => {
    io.to(`permission:inventory:manage`).emit('inventory:low-stock', {
        ...alert,
        timestamp: new Date()
    });
};

module.exports = (io, socket) => {
    inventoryHandler(io, socket);
};

module.exports.broadcastStockUpdate = broadcastStockUpdate;
module.exports.broadcastLowStockAlert = broadcastLowStockAlert;