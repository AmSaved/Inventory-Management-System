const { 
    User, Product, Inventory, Request, RequestItem,
    DischargeForm, Assignment, Return, Transfer, TransferItem, Issue,
    OrganizationNode, ActivityLog, Role, Company, sequelize
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
                // Super Admin can see any node; others only within their allowedNodes
                if (allowedNodes !== null && !allowedNodes.includes(activeOrgId)) {
                    return res.status(403).json({ success: false, message: 'Access denied: Target node is outside your visibility scope' });
                }
                const requestedDescendants = await hierarchyService.getDescendants(activeOrgId);
                // If allowedNodes is null, they see all descendants; otherwise filter by authorization
                targetNodeIds = allowedNodes === null ? requestedDescendants : requestedDescendants.filter(id => allowedNodes.includes(id));
            } else {
                // Global View: Scoped to all authorized nodes
                targetNodeIds = allowedNodes;
            }

            // --- UNIFIED SCOPING LOGIC ---
            // null = Global (Super Admin), [] = No Access, [ids] = Scoped Access
            const baseWhere = { company_id };
            const nodeFilter = targetNodeIds === null ? {} : { org_node_id: { [Op.in]: targetNodeIds } };
            const where = { ...baseWhere, ...nodeFilter };

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
                pendingApprovalListRaw = await approvalService.getPendingApprovals(company_id, req.user);
            } else {
                // OPERATIONAL VIEW (Scoped)
                const results = await Promise.all([
                    User.count({ where }),
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

                // --- CROSS-NODE LOGISTICS SCOPING ---
                const transferWhere = { company_id };
                const dischargeWhere = { company_id };
                
                if (targetNodeIds !== null) {
                    const scopeOp = { [Op.in]: targetNodeIds };
                    transferWhere[Op.or] = [{ from_node_id: scopeOp }, { to_node_id: scopeOp }];
                    dischargeWhere[Op.or] = [{ from_node_id: scopeOp }, { to_node_id: scopeOp }];
                }

                const [
                    totalTransfers,
                    totalDischarges,
                    totalReturns,
                    totalProcurement,
                    totalIssues,
                    pendingTransferRequests
                ] = await Promise.all([
                    Transfer.count({ where: transferWhere }),
                    DischargeForm.count({ where: dischargeWhere }),
                    Request.count({ 
                        where: { 
                            ...where, 
                            request_type: { [Op.in]: ['return', 'returns'] } 
                        } 
                    }),
                    Request.count({ 
                        where: { 
                            ...where, 
                            request_type: { [Op.in]: ['procurement', 'new', 'requisition'] } 
                        } 
                    }),
                    Issue.count({ where }),
                    Request.count({
                        where: {
                            ...where,
                            request_type: { [Op.in]: ['transfer', 'items'] }
                        }
                    })
                ]);

                // Calculate Total Transferred Items
                const transferredItemsResult = await TransferItem.findAll({
                    attributes: [[sequelize.fn('SUM', sequelize.col('quantity')), 'total']],
                    include: [{
                        model: Transfer,
                        as: 'transfer',
                        where: transferWhere,
                        attributes: []
                    }],
                    raw: true
                });
                const totalTransferredItems = parseInt(transferredItemsResult[0]?.total || 0);

                metrics = {
                    total_users: totalUsers,
                    total_products: totalProducts,
                    total_stock: totalInventorySum,
                    total_nodes: targetNodeIds === null ? await OrganizationNode.count({ where: { company_id } }) : targetNodeIds.length,
                    pending_requests: pendingApprovalListRaw.length,
                    active_assignments: activeAssignments,
                    open_issues: openIssues,
                    low_stock: lowStockCount,
                    total_transfers: totalTransfers + pendingTransferRequests,
                    total_discharges: totalDischarges,
                    total_returns: totalReturns,
                    total_procurement: totalProcurement,
                    total_reports: totalIssues,
                    total_transferred_items: totalTransferredItems
                };
            }

            // 3. Trends
            const recentActivity = await ActivityLog.findAll({
                where,
                limit: 10,
                order: [['created_at', 'DESC']],
                include: [{ model: User, as: 'user', attributes: ['id', 'first_name', 'last_name'] }]
            });

            // 4. Inventory by Level (Top Level Nodes)
            // Optimized Approach: Fetch all stock in the company first, then aggregate in memory
            const nodes = await OrganizationNode.findAll({
                where: { 
                    company_id, 
                    parent_id: activeOrgId,
                    status: { [Op.ne]: 'archived' }
                },
                attributes: ['id', 'name', 'code', 'path']
            });

            // Get all inventory sums grouped by org_node_id for the whole target scope
            const inventoryStats = await Inventory.findAll({
                where,
                attributes: [
                    'org_node_id',
                    [sequelize.fn('SUM', sequelize.col('quantity')), 'total_stock']
                ],
                group: ['org_node_id'],
                raw: true
            });

            // Create a map for fast lookup
            const stockMap = {};
            inventoryStats.forEach(stat => {
                stockMap[stat.org_node_id] = Number(stat.total_stock) || 0;
            });

            // Get ALL nodes in this company once to build a path-based aggregation map
            // This is much faster than N+1 getDescendants calls
            const allNodes = await OrganizationNode.findAll({
                where: { company_id, status: { [Op.ne]: 'archived' } },
                attributes: ['id', 'path'],
                raw: true
            });

            const levelStats = nodes.map(node => {
                const nodePath = node.path;
                let totalStockForBranch = 0;
                
                // Sum stock for all nodes that are descendants of this node (including itself)
                allNodes.forEach(candidate => {
                    if (candidate.path.startsWith(nodePath)) {
                        totalStockForBranch += stockMap[candidate.id] || 0;
                    }
                });

                return {
                    ...node.toJSON(),
                    stock_count: totalStockForBranch
                };
            });

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