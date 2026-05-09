const { 
    User, Product, Inventory, Request, RequestItem,
    DischargeForm, Assignment, Return, Transfer, Issue,
    OrganizationNode, ActivityLog, Role, sequelize
} = require('../models');
const { Op } = require('sequelize');
const hierarchyService = require('../services/hierarchyService');
const approvalService = require('../services/approvalService');
const { getEffectivePermissions } = require('../middleware/permissions');

const dashboardController = {
    /**
     * Get statistics for the user's current organizational scope.
     * This replaces multiple legacy dashboard methods with a hierarchy-aware one.
     */
    async getDashboardStats(req, res, next) {
        try {
            const company_id = req.user.company_id;
            const permissions = req.userPermissions || await getEffectivePermissions(req.user);
            const isSuperAdmin = (req.user.role && req.user.role.level >= 100) || permissions.includes('system:manage');
            
            // 1. Calculate field of vision (resilient fallback)
            const allowedNodes = req.getAuthorizedNodes 
                ? await req.getAuthorizedNodes() 
                : await hierarchyService.getAllowedNodes(req.user, permissions);

            // 2. Determine target scope
            let targetNodeIds = [];
            const requestedNodeId = (req.query.org_node_id && req.query.org_node_id !== 'undefined' && req.query.org_node_id !== 'null' && req.query.org_node_id !== '') 
                ? Number(req.query.org_node_id) 
                : null;
            
            const activeOrgId = requestedNodeId || (isSuperAdmin ? null : req.user.org_node_id);

            if (activeOrgId) {
                // Focus View: Scoped to a specific branch
                if (!allowedNodes.includes(activeOrgId)) {
                    return res.status(403).json({ success: false, message: 'Access denied: Target node is outside your visibility scope' });
                }
                const requestedDescendants = await hierarchyService.getDescendants(activeOrgId);
                targetNodeIds = requestedDescendants.filter(id => allowedNodes.includes(id));
            } else {
                // Global View: Scoped to all authorized nodes
                targetNodeIds = allowedNodes;
            }

            const where = { company_id };
            // For global company-wide stats (Super Admin + No specific node selected), 
            // we DON'T add an org_node_id filter to allow seeing everything including root-less nodes.
            // But if we have a specific set of target nodes, we apply it.
            if (activeOrgId || !isSuperAdmin) {
                if (targetNodeIds.length > 0) {
                    where.org_node_id = { [Op.in]: targetNodeIds };
                }
            }

            // 2. Aggregate Metrics (Conditional based on role)
            let metrics = {};
            let pendingApprovalListRaw = [];

            if (isSuperAdmin && !activeOrgId) {
                // SYSTEM INFRASTRUCTURE VIEW (Level 100)
                const [
                    totalCompanies,
                    totalNodes,
                    totalProducts,
                    totalRoles,
                    totalUsersGlobal
                ] = await Promise.all([
                    Company.count(),
                    OrganizationNode.count({ where: { status: { [Op.ne]: 'archived' } } }),
                    Product.count(),
                    Role.count(),
                    User.count()
                ]);

                metrics = {
                    total_companies: totalCompanies,
                    total_nodes: totalNodes,
                    total_products: totalProducts,
                    total_roles: totalRoles,
                    total_users: totalUsersGlobal
                };

                // Fetch global pending approvals for Super Admin view
                pendingApprovalListRaw = await approvalService.getPendingApprovals(null, req.user);
            } else {
                // OPERATIONAL VIEW (Scoped)
                const results = await Promise.all([
                    User.count({ where: { company_id, ... (targetNodeIds.length > 0 ? { org_node_id: { [Op.in]: targetNodeIds } } : {}) } }),
                    Product.count({ where: { company_id } }),
                    Inventory.sum('quantity', { where }) || 0,
                    approvalService.getPendingApprovals(company_id, req.user),
                    Assignment.count({ where: { ...where, status: 'active' } }),
                    Issue.count({ where: { ...where, status: { [Op.in]: ['open', 'in_progress'] } } }),
                    Inventory.count({
                        where: {
                            ...where,
                            quantity: { [Op.lte]: sequelize.col('minimum_quantity') }
                        }
                    })
                ]);

                const totalUsers = results[0];
                const totalProducts = results[1];
                const totalInventorySum = results[2];
                pendingApprovalListRaw = results[3];
                const activeAssignments = results[4];
                const openIssues = results[5];
                const lowStockCount = results[6];

                metrics = {
                    total_users: totalUsers,
                    total_products: totalProducts,
                    total_stock: totalInventorySum,
                    total_nodes: targetNodeIds.length,
                    pending_requests: pendingApprovalListRaw.length,
                    active_assignments: activeAssignments,
                    open_issues: openIssues,
                    low_stock: lowStockCount
                };
            }

            // 3. Trends
            const recentActivity = await ActivityLog.findAll({
                where: { company_id, ... (targetNodeIds.length > 0 ? { org_node_id: { [Op.in]: targetNodeIds } } : {}) },
                limit: 10,
                order: [['created_at', 'DESC']],
                include: [{ model: User, as: 'user', attributes: ['id', 'first_name', 'last_name'] }]
            });

            // 4. Inventory by Level (Top Level Nodes)
            // Robust Approach: Fetch nodes first, then aggregate inventory in a separate, clean pass
            const nodes = await OrganizationNode.findAll({
                where: { 
                    company_id, 
                    parent_id: activeOrgId, // null shows roots, otherwise shows children of the focused node
                    status: { [Op.ne]: 'archived' }
                },
                attributes: ['id', 'name', 'code', 'path']
            });

            const levelStats = await Promise.all(nodes.map(async (node) => {
                // Get all descendants for this node (very fast with path index)
                const descendantIds = await hierarchyService.getDescendants(node.id);
                
                const stockSum = await Inventory.sum('quantity', {
                    where: {
                        company_id,
                        org_node_id: { [Op.in]: descendantIds }
                    }
                }) || 0;

                return {
                    ...node.toJSON(),
                    stock_count: stockSum
                };
            }));

            // Sort by stock count descending
            levelStats.sort((a, b) => b.stock_count - a.stock_count);

            res.json({
                success: true,
                data: {
                    metrics,
                    level_distribution: levelStats,
                    recent_activity: recentActivity,
                    pending_approvals: pendingApprovalListRaw
                }
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * User-specific dashboard (personal stats).
     */
    async getUserDashboard(req, res, next) {
        try {
            const user_id = req.user.id;
            const company_id = req.user.company_id;

            const [
                myRequests,
                myAssignments,
                overdueCount,
                pendingApprovals
            ] = await Promise.all([
                Request.findAll({ 
                    where: { 
                        [Op.or]: [
                            { requester_id: user_id },
                            { target_user_id: user_id }
                        ],
                        company_id 
                    }, 
                    include: [
                        {
                            model: RequestItem,
                            as: 'items',
                            include: [{ model: Product, as: 'product' }]
                        }
                    ],
                    limit: 10, 
                    order: [['created_at', 'DESC']] 
                }),
                Assignment.findAll({ where: { user_id, status: 'active', company_id }, include: ['product'] }),
                Assignment.count({
                    where: { user_id, status: 'active', company_id, expected_return_date: { [Op.lt]: new Date() } }
                }),
                approvalService.getPendingApprovals(company_id, req.user)
            ]);

            res.json({
                success: true,
                data: {
                    my_requests: myRequests,
                    my_assignments: myAssignments,
                    pending_approvals: pendingApprovals,
                    metrics: {
                        active_assets: myAssignments.length,
                        overdue_assets: overdueCount
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = dashboardController;