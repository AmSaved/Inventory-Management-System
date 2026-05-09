const { ActivityLog } = require('../models');
const logger = require('../config/logger');

const auditLogger = (action, resource) => {
    return async (req, res, next) => {
        // Store original send function
        const originalSend = res.send;
        let responseBody;

        // Override send to capture response
        res.send = function(body) {
            responseBody = body;
            originalSend.call(this, body);
        };

        // Wait for response to finish
        res.on('finish', async () => {
            try {
                // Only log successful operations (2xx status codes)
                if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
                    let resourceId = null;
                    
                    // Try to extract resource ID from response or params
                    if (responseBody) {
                        try {
                            const parsed = JSON.parse(responseBody);
                            if (parsed.data?.id) {
                                resourceId = parsed.data.id;
                            } else if (parsed.data?.data?.id) {
                                resourceId = parsed.data.data.id;
                            }
                        } catch (e) {
                            // Ignore parsing errors
                        }
                    }

                    // If not found in response, try params
                    if (!resourceId && req.params.id) {
                        resourceId = parseInt(req.params.id);
                    }

                    // Create activity log
                    await ActivityLog.create({
                        user_id: req.user.id,
                        action,
                        resource,
                        resource_id: resourceId,
                        details: {
                            method: req.method,
                            url: req.url,
                            body: req.body,
                            query: req.query,
                            params: req.params,
                            status: res.statusCode
                        },
                        ip_address: req.ip,
                        user_agent: req.get('User-Agent'),
                        branch_id: req.user.branch_id
                    });
                }
            } catch (error) {
                logger.error('Audit log error:', error);
            }
        });

        next();
    };
};

module.exports = auditLogger;