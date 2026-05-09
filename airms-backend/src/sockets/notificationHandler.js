const logger = require('../config/logger');

const notificationHandler = (io, socket) => {
    const userId = socket.userId;

    // Join notification room
    socket.join(`notifications:${userId}`);

    // Handle marking notification as read
    socket.on('notification:read', async (data) => {
        try {
            const { notificationId } = data;
            
            // Emit to all user's devices that notification was read
            io.to(`user:${userId}`).emit('notification:read-confirmed', {
                notificationId,
                userId,
                timestamp: new Date()
            });

            logger.debug(`Notification ${notificationId} marked as read for user ${userId}`);
        } catch (error) {
            logger.error('Notification read error:', error);
            socket.emit('error', { message: 'Failed to mark notification as read' });
        }
    });

    // Handle marking all notifications as read
    socket.on('notification:read-all', async () => {
        try {
            io.to(`user:${userId}`).emit('notification:read-all-confirmed', {
                userId,
                timestamp: new Date()
            });

            logger.debug(`All notifications marked as read for user ${userId}`);
        } catch (error) {
            logger.error('Notification read all error:', error);
            socket.emit('error', { message: 'Failed to mark all notifications as read' });
        }
    });

    // Handle notification preference update
    socket.on('notification:preferences', async (data) => {
        try {
            const { preferences } = data;
            
            io.to(`user:${userId}`).emit('notification:preferences-updated', {
                userId,
                preferences,
                timestamp: new Date()
            });

            logger.debug(`Notification preferences updated for user ${userId}`);
        } catch (error) {
            logger.error('Notification preferences error:', error);
            socket.emit('error', { message: 'Failed to update notification preferences' });
        }
    });

    // Handle notification click
    socket.on('notification:click', async (data) => {
        try {
            const { notificationId, action } = data;
            
            logger.debug(`User ${userId} clicked notification ${notificationId} with action ${action}`);
            
            // Acknowledge receipt
            socket.emit('notification:click-confirmed', {
                notificationId,
                action,
                timestamp: new Date()
            });
        } catch (error) {
            logger.error('Notification click error:', error);
        }
    });

    // Handle notification dismiss
    socket.on('notification:dismiss', async (data) => {
        try {
            const { notificationId } = data;
            
            io.to(`user:${userId}`).emit('notification:dismissed', {
                notificationId,
                userId,
                timestamp: new Date()
            });

            logger.debug(`Notification ${notificationId} dismissed for user ${userId}`);
        } catch (error) {
            logger.error('Notification dismiss error:', error);
        }
    });

    // Handle notification snooze
    socket.on('notification:snooze', async (data) => {
        try {
            const { notificationId, duration } = data;
            
            io.to(`user:${userId}`).emit('notification:snoozed', {
                notificationId,
                duration,
                userId,
                timestamp: new Date()
            });

            logger.debug(`Notification ${notificationId} snoozed for ${duration} minutes`);
        } catch (error) {
            logger.error('Notification snooze error:', error);
        }
    });

    // Handle typing indicator for notifications (for admin responses)
    socket.on('notification:typing', (data) => {
        const { conversationId } = data;
        
        // Broadcast to other users in the conversation
        socket.to(`conversation:${conversationId}`).emit('notification:typing', {
            userId,
            conversationId,
            timestamp: new Date()
        });
    });

    // Clean up on disconnect
    socket.on('disconnect', () => {
        socket.leave(`notifications:${userId}`);
        logger.debug(`User ${userId} left notification room`);
    });
};

// Function to send notification to user
const sendNotification = (io, userId, notification) => {
    io.to(`notifications:${userId}`).emit('notification:new', {
        ...notification,
        timestamp: new Date()
    });
};

// Function to broadcast notification to everyone with a specific permission
const broadcastToPermission = (io, permission, notification) => {
    io.to(`permission:${permission}`).emit('notification:permission', {
        ...notification,
        permission,
        timestamp: new Date()
    });
};

// Function to broadcast notification to a specific unit (Node)
const broadcastToUnit = (io, unitId, notification) => {
    io.to(`unit:${unitId}`).emit('notification:unit', {
        ...notification,
        unitId,
        timestamp: new Date()
    });
};

module.exports = (io, socket) => {
    notificationHandler(io, socket);
};

// Export utility functions
module.exports.sendNotification = sendNotification;
module.exports.broadcastToPermission = broadcastToPermission;
module.exports.broadcastToUnit = broadcastToUnit;