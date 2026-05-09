const sanitizeHtml = require('sanitize-html');

const sanitizeMiddleware = (req, res, next) => {
    // Sanitize request body
    if (req.body) {
        sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query) {
        sanitizeObject(req.query);
    }

    next();
};

const sanitizeObject = (obj) => {
    for (let key in obj) {
        if (typeof obj[key] === 'string') {
            // Sanitize string values
            obj[key] = sanitizeHtml(obj[key], {
                allowedTags: [], // No HTML tags allowed
                allowedAttributes: {} // No attributes allowed
            }).trim();
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            // Recursively sanitize nested objects
            sanitizeObject(obj[key]);
        }
    }
};

module.exports = sanitizeMiddleware;