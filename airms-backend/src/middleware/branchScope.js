const { Op } = require('sequelize');

const branchScope = (req, res, next) => {
    try {
        // Add branch filtering to query
        const userBranchId = req.user?.branch_id;
        const userRole = req.user?.role_id;

        // Super admin can see all branches
        if (userRole === 1) {
            return next();
        }

        // For other users, filter by their branch
        if (userBranchId) {
            // Add branch filter to query
            if (!req.query) req.query = {};
            req.query.branch_id = userBranchId;
        }

        next();
    } catch (error) {
        next(error);
    }
};

const branchDataScope = (req, res, next) => {
    try {
        // For creating/updating data, ensure branch_id is set correctly
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            const userBranchId = req.user?.branch_id;
            const userRole = req.user?.role_id;

            // Super admin can set any branch
            if (userRole !== 1) {
                // Force branch_id to user's branch
                if (req.body) {
                    req.body.branch_id = userBranchId;
                }
            }
        }

        next();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    branchScope,
    branchDataScope
};