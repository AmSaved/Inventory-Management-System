const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
    // Log error
    logger.error('Error:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        user: req.user?.id
    });

    // Default error
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal server error';
    let errors = err.errors || null;

    // Handle specific errors
    if (err.name === 'SequelizeValidationError') {
        statusCode = 400;
        message = 'Database validation error';
        errors = err.errors.map(e => ({
            field: e.path,
            message: e.message
        }));
    }

    if (err.name === 'SequelizeUniqueConstraintError') {
        statusCode = 409;
        message = 'Duplicate entry';
        errors = err.errors.map(e => ({
            field: e.path,
            message: `${e.path} already exists`
        }));
    }

    if (err.name === 'SequelizeForeignKeyConstraintError') {
        statusCode = 400;
        message = 'Referenced record not found';
    }

    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    }

    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }

    // Send response
    res.status(statusCode).json({
        success: false,
        message,
        errors,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

module.exports = errorHandler;