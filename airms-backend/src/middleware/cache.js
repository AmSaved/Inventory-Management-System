const mcache = require('memory-cache');

const cache = (duration) => {
    return (req, res, next) => {
        // Skip cache for non-GET requests
        if (req.method !== 'GET') {
            return next();
        }

        const key = '__express__' + req.originalUrl || req.url;
        const cachedBody = mcache.get(key);

        if (cachedBody) {
            return res.json(JSON.parse(cachedBody));
        }

        // Store original send
        const originalSend = res.json;

        // Override send to cache response
        res.json = function(body) {
            mcache.put(key, JSON.stringify(body), duration * 1000);
            originalSend.call(this, body);
        };

        next();
    };
};

const clearCache = (pattern) => {
    const keys = mcache.keys();
    keys.forEach(key => {
        if (key.includes(pattern)) {
            mcache.del(key);
        }
    });
};

module.exports = {
    cache,
    clearCache
};