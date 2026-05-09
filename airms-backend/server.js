#!/usr/bin/env node

require('dotenv').config();
require('express-async-errors');

const http = require('http');
const app = require('./src/app');
const { Workflow, WorkflowStep, WorkflowStatus, WorkflowRoute, Approval, ActivityLog, Role, OrganizationNode, Request } = require('./src/models');
const logger = require('./src/config/logger');
const { sequelize } = require('./src/models');
const { initializeSockets } = require('./src/sockets');
const { initJobs } = require('./src/jobs');

/**
 * Normalize port into a number, string, or false
 */
const normalizePort = (val) => {
    const port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
};

const PORT = normalizePort(process.env.PORT || '5000');

/**
 * Create HTTP server
 */
const server = http.createServer(app);

/**
 * Initialize Socket.io
 */
const io = initializeSockets(server);
app.set('io', io); // Make io accessible to routes

/**
 * Start server function
 */
const startServer = async () => {
    try {
        // Test database connection
        await sequelize.authenticate();
        logger.info('✅ Database connection established successfully');

        // Sync database (in development only)
        if (process.env.NODE_ENV === 'development') {
            // Disabled { alter: true } because it heavily slows down server startup
            // await sequelize.sync({ alter: true });
            // logger.info('✅ Database synced');
            
            // Note: Auto-seeding of basic data (Company, Nodes, Products) has been 
            // bypassed to dramatically improve nodemon restart times during development.
        }

        // Run migrations in production
        if (process.env.NODE_ENV === 'production') {
            logger.info('Running database migrations...');
            // You might want to run migrations here via sequelize-cli or custom script
        }

        // Start background jobs
        if (process.env.NODE_ENV !== 'test') {
            initJobs();
            logger.info('✅ Background jobs initialized');
        }

        // Start server
        server.listen(PORT, () => {
            logger.info(`
    =====================================
    🚀 AIRMS Backend Server is running!
    =====================================
    Environment: ${process.env.NODE_ENV || 'development'}
    Port: ${PORT}
    Health check: http://localhost:${PORT}/health
    API: http://localhost:${PORT}/api
    Database: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}
    =====================================
            `);
        });

    } catch (error) {
        logger.error('❌ Failed to start server:', error);
        logger.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        process.exit(1);
    }
};

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async (signal, code = 0) => {
    logger.info(`📥 ${signal} received. Starting graceful shutdown...`);

    const closeResources = async (exitCode) => {
        try {
            // Close database connections
            await sequelize.close();
            logger.info('✅ Database connection closed');

            // Close socket connections
            if (io) {
                io.close();
                logger.info('✅ Socket connections closed');
            }

            logger.info('👋 Graceful shutdown completed');
            process.exit(exitCode);
        } catch (error) {
            logger.error('❌ Error during graceful shutdown:', error);
            process.exit(1);
        }
    };

    // Close server first - stop accepting new connections
    if (server.listening) {
        server.close(async (err) => {
            if (err) {
                logger.error('❌ Error closing HTTP server:', err);
            }
            logger.info('✅ HTTP server closed');
            await closeResources(code);
        });
    } else {
        logger.info('ℹ️ HTTP server was not listening');
        await closeResources(code);
    }

    // Force close after timeout
    setTimeout(() => {
        logger.error('⚠️ Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000); // 10 seconds timeout
};

/**
 * Event listener for HTTP server "error" event
 */
server.on('error', (error) => {
    if (error.syscall !== 'listen') {
        throw error;
    }

    const bind = typeof PORT === 'string'
        ? `Pipe ${  PORT}`
        : `Port ${  PORT}`;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            logger.error(`${bind  } requires elevated privileges`);
            process.exit(1);
            break;
        case 'EADDRINUSE':
            logger.error(`${bind  } is already in use`);
            process.exit(1);
            break;
        default:
            throw error;
    }
});

/**
 * Event listener for HTTP server "listening" event
 */
server.on('listening', () => {
    const addr = server.address();
    const bind = typeof addr === 'string' || !addr
        ? `pipe ${  addr}`
        : `port ${  addr.port}`;
    logger.debug(`Server listening on ${bind}`);
});

/**
 * Handle shutdown signals
 */
process.on('SIGTERM', () => gracefulShutdown('SIGTERM', 0));
process.on('SIGINT', () => gracefulShutdown('SIGINT', 0));

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (error) => {
    logger.error('❌ Uncaught Exception:', error);
    // logger.error('Stack:', error.stack); // Stack is typically included in the error object logging
    gracefulShutdown('uncaughtException', 1);
});

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ Unhandled Rejection:', reason);
    // Pass exit code 1 for failure
    gracefulShutdown('unhandledRejection', 1);
});

/**
 * Start the server
 */
startServer();

// Export for testing
module.exports = server;