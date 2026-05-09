const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');
const notificationHandler = require('./notificationHandler');
const inventoryHandler = require('./inventoryHandler');
const { getEffectivePermissions } = require('../middleware/permissions');
const { User, Role, Permission } = require('../models');

// Store connected users
const connectedUsers = new Map();
const userSockets = new Map();

// Initialize socket.io
const initializeSockets = (server) => {
    const io = socketIO(server, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:3000',
            credentials: true,
            methods: ['GET', 'POST']
        },
        pingTimeout: 60000,
        pingInterval: 25000
    });

    // Authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || 
                         socket.handshake.headers.authorization?.split(' ')[1];

            if (!token) {
                return next(new Error('Authentication required'));
            }

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Attach user info to socket
            const user = await User.findByPk(decoded.id, {
                include: [{
                    model: Role,
                    as: 'role',
                    include: [{
                        model: Permission,
                        as: 'permissions',
                        through: { attributes: [] }
                    }]
                }]
            });

            if (!user) return next(new Error('User not found'));

            const permissions = await getEffectivePermissions(user);

            socket.userId = user.id;
            socket.userPermissions = permissions;
            socket.userNodeId = user.org_node_id;
            socket.userCompanyId = user.company_id;
            
            next();
        } catch (error) {
            logger.error('Socket authentication error:', error);
            next(new Error('Invalid token'));
        }
    });

    // Connection handler
    io.on('connection', (socket) => {
        const userId = socket.userId;
        const userPermissions = socket.userPermissions || [];
        const userNodeId = socket.userNodeId;

        logger.info(`User ${userId} connected to socket with ${userPermissions.length} permissions`);

        // Store connection
        connectedUsers.set(userId, socket.id);
        
        if (!userSockets.has(userId)) {
            userSockets.set(userId, new Set());
        }
        userSockets.get(userId).add(socket.id);

        // Join user to their rooms (Dynamic & Permission-Based)
        socket.join(`user:${userId}`);
        
        // Join Permission Rooms (The core of dynamic real-time auth)
        userPermissions.forEach(permission => {
            socket.join(`permission:${permission}`);
        });

        if (userNodeId) {
            socket.join(`unit:${userNodeId}`);
        }

        // Initialize handlers
        notificationHandler(io, socket);
        inventoryHandler(io, socket);

        // Handle disconnection
        socket.on('disconnect', () => {
            logger.info(`User ${userId} disconnected from socket`);
            
            // Remove from connected users
            connectedUsers.delete(userId);
            
            const userSocketsSet = userSockets.get(userId);
            if (userSocketsSet) {
                userSocketsSet.delete(socket.id);
                if (userSocketsSet.size === 0) {
                    userSockets.delete(userId);
                }
            }
        });

        // Handle errors
        socket.on('error', (error) => {
            logger.error(`Socket error for user ${userId}:`, error);
        });
    });

    // Make io accessible to routes
    global.io = io;

    return io;
};

// Utility functions for emitting events
const emitToUser = (userId, event, data) => {
    if (global.io) {
        global.io.to(`user:${userId}`).emit(event, data);
        logger.debug(`Emitted ${event} to user ${userId}`);
    }
};

const emitToPermission = (permission, event, data) => {
    if (global.io) {
        global.io.to(`permission:${permission}`).emit(event, data);
        logger.debug(`Emitted ${event} to permission ${permission}`);
    }
};

const emitToUnit = (unitId, event, data) => {
    if (global.io) {
        global.io.to(`unit:${unitId}`).emit(event, data);
        logger.debug(`Emitted ${event} to unit ${unitId}`);
    }
};

const emitToAll = (event, data) => {
    if (global.io) {
        global.io.emit(event, data);
        logger.debug(`Emitted ${event} to all`);
    }
};

const getConnectedUsers = () => {
    return Array.from(connectedUsers.keys());
};

const isUserConnected = (userId) => {
    return connectedUsers.has(userId);
};

const getUserSocketCount = (userId) => {
    const sockets = userSockets.get(userId);
    return sockets ? sockets.size : 0;
};

module.exports = {
    initializeSockets,
    emitToUser,
    emitToRole: (roleId, event, data) => {
        logger.warn('DEPRECATED: emitToRole called. Use emitToPermission instead.');
        if (global.io) global.io.to(`role:${roleId}`).emit(event, data);
    },
    emitToPermission,
    emitToUnit,
    emitToAll,
    getConnectedUsers,
    isUserConnected,
    getUserSocketCount
};