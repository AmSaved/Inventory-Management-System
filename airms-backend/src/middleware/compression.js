const compression = require('compression');

// Compression configuration
const compressionMiddleware = compression({
    level: 6, // Compression level (1-9)
    threshold: 1024, // Compress responses larger than 1KB
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
});

module.exports = compressionMiddleware;