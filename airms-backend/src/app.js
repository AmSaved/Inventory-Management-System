const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
// Import configuration
const logger = require('./config/logger');
const { sequelize } = require('./models');

// Import middleware
const { authMiddleware, optionalAuthMiddleware } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const { rateLimiter, apiRateLimiter } = require('./middleware/rateLimiter');
const sanitizeMiddleware = require('./middleware/sanitize');
const { cache } = require('./middleware/cache');
const { handleUploadError } = require('./middleware/upload');

// Import routes
const routes = require('./routes');
// Initialize express app
const app = express();

// ============================================
// Security Middleware
// ============================================
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// ============================================
// CORS Configuration
// ============================================
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    optionsSuccessStatus: 200
}));

// ============================================
// Compression Middleware
// ============================================
app.use(compression());

// ============================================
// Body Parsing Middleware
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// Sanitization Middleware
// ============================================
app.use(sanitizeMiddleware);

// ============================================
// Logging Middleware
// ============================================
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev', {
        stream: {
            write: (message) => logger.info(message.trim())
        }
    }));
} else {
    app.use(morgan('combined', {
        stream: {
            write: (message) => logger.info(message.trim())
        },
        skip: (req, res) => res.statusCode < 400
    }));
}

// ============================================
// Rate Limiting
// ============================================
app.use('/api/', apiRateLimiter);
app.use('/api/auth', rateLimiter);

// ============================================
// Static Files
// ============================================
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/public', express.static(path.join(__dirname, '../public')));

// ============================================
// Request ID Middleware
// ============================================
app.use((req, res, next) => {
    req.requestId = require('crypto').randomBytes(16).toString('hex');
    res.setHeader('X-Request-ID', req.requestId);
    next();
});

// ============================================
// Response Time Middleware
// ============================================
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.debug(`${req.method} ${req.originalUrl} - ${duration}ms`);
    });
    next();
});

// ============================================
// API Routes
// ============================================
app.use('/api', routes);

// ============================================
// Health Check Endpoint
// ============================================
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'AIRMS Backend is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0',
        requestId: req.requestId
    });
});

// ============================================
// Database Connection Test Endpoint
// ============================================
app.get('/health/db', async (req, res) => {
    try {
        await sequelize.authenticate();
        res.json({
            success: true,
            message: 'Database connection successful',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Database health check failed:', error);
        res.status(500).json({
            success: false,
            message: 'Database connection failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ============================================
// API Documentation Redirect (Development)
// ============================================
if (process.env.NODE_ENV === 'development') {
    app.get('/api-docs', (req, res) => {
        res.redirect('https://documenter.getpostman.com/view/your-api-docs');
    });
}

// ============================================
// 404 Handler
// ============================================
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
        path: req.originalUrl,
        method: req.method,
        requestId: req.requestId
    });
});

// Error Handling Middleware
app.use(handleUploadError);
app.use(errorHandler);

module.exports = app;