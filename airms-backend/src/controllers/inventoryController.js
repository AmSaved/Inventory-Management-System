const { Inventory, Product, OrganizationNode, User, ActivityLog, sequelize } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const inventoryService = require('../services/inventoryService');

const inventoryController = {
    /**
     * Get inventory with filters, scoped to user's company and optionally a unit subtree.
     */
    async getAll(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 10, 
                product_id,
                low_stock,
                search,
                serial_number,
                batch_number
            } = req.query;
            
            const company_id = req.user.company_id;
            const where = { company_id };
            
            // PERFORMANCE SCOPING: Use the lazy-loading authorized nodes getter
            const allowedNodes = await req.getAuthorizedNodes();
            
            if (req.query.org_node_id) {
                const targetNodeId = Number(req.query.org_node_id);
                if (!allowedNodes.includes(targetNodeId)) {
                    return res.status(403).json({ success: false, message: 'Access denied: Target node is outside your visibility scope' });
                }
                
                // HIERARCHICAL SEARCH: Find all descendant nodes using the materialized path
                const targetNode = await OrganizationNode.findByPk(targetNodeId);
                if (targetNode && targetNode.path) {
                    const descendantNodes = await OrganizationNode.findAll({
                        where: {
                            company_id,
                            path: { [Op.like]: `${targetNode.path}%` }
                        },
                        attributes: ['id']
                    });
                    const nodeIds = descendantNodes.map(n => n.id);
                    // Filter by these nodes, but ensure they are still within the user's allowed scope
                    const scopedNodeIds = nodeIds.filter(id => allowedNodes.includes(id));
                    where.org_node_id = { [Op.in]: scopedNodeIds };
                } else {
                    where.org_node_id = targetNodeId;
                }
            } else {
                where.org_node_id = { [Op.in]: allowedNodes };
            }

            if (product_id) where.product_id = product_id;
            if (low_stock === 'true') {
                where.quantity = { [Op.lte]: sequelize.col('minimum_quantity') };
            }
            if (req.query.quantity_gt) {
                where.quantity = { [Op.gt]: parseInt(req.query.quantity_gt) };
            }
            if (serial_number) where.serial_number = serial_number;
            if (batch_number) where.batch_number = batch_number;

            const offset = (page - 1) * limit;
            
            const { count, rows } = await Inventory.findAndCountAll({
                where,
                include: [
                    {
                        model: Product,
                        as: 'product',
                        where: search ? {
                            [Op.or]: [
                                { name: { [Op.iLike]: `%${search}%` } },
                                { sku: { [Op.iLike]: `%${search}%` } }
                            ]
                        } : undefined
                    },
                    {
                        model: OrganizationNode,
                        as: 'organizationNode',
                        attributes: ['id', 'name', 'code']
                    }
                ],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['updated_at', 'DESC']]
            });

            res.json({
                success: true,
                data: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    pages: Math.ceil(count / limit)
                }
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get inventory item by ID (Security: must match company_id)
     */
    async getById(req, res, next) {
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;
            
            const inventory = await Inventory.findOne({
                where: { id, company_id },
                include: [
                    { model: Product, as: 'product' },
                    { model: OrganizationNode, as: 'organizationNode' }
                ]
            });

            if (!inventory) {
                return res.status(404).json({ success: false, message: 'Inventory item not found' });
            }

            // Scoping check
            const allowedNodes = await req.getAuthorizedNodes();
            if (!allowedNodes.includes(inventory.org_node_id)) {
                return res.status(403).json({ success: false, message: 'Access denied: Inventory item is outside your visibility scope' });
            }

            // Fetch Lifecycle History
            const logs = await ActivityLog.findAll({
                where: { company_id, resource: 'inventory', resource_id: id },
                include: [{ model: User, as: 'user', attributes: ['first_name', 'last_name'] }],
                order: [['created_at', 'DESC']]
            });

            const responseData = inventory.toJSON();
            responseData.activity_logs = logs;

            res.json({ success: true, data: responseData });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Create inventory item
     */
    async create(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { 
                product_id, 
                org_node_id, 
                quantity, 
                minimum_quantity, 
                maximum_quantity, 
                location_details,
                serial_number,
                batch_number,
                unit_cost,
                status,
                // New Fields
                current_value,
                purchase_date,
                warranty_expiry,
                supplier,
                invoice_number,
                expiry_date,
                condition,
                assignment_notes,
                expected_return_date
            } = req.body;
            const company_id = req.user.company_id;

            // Scope check: Can only create inventory in authorized nodes
            const allowedNodes = await req.getAuthorizedNodes();
            if (!allowedNodes.includes(Number(org_node_id))) {
                return res.status(403).json({ success: false, message: 'Access denied: Cannot initialize inventory in nodes outside your visibility scope' });
            }

            const existing = await Inventory.findOne({
                where: { product_id, org_node_id, company_id }
            });

            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: 'Inventory item already exists for this product and node'
                });
            }

            const inventory = await Inventory.create({
                product_id,
                org_node_id,
                company_id,
                quantity,
                minimum_quantity,
                maximum_quantity,
                location_details,
                serial_number,
                batch_number,
                unit_cost,
                status: status || 'available',
                current_value,
                purchase_date,
                warranty_expiry,
                supplier,
                invoice_number,
                expiry_date,
                condition,
                assignment_notes,
                expected_return_date,
                last_counted_at: new Date()
            });

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'CREATE',
                resource: 'inventory',
                resource_id: inventory.id,
                details: { product_id, org_node_id, quantity },
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
            });

            res.status(201).json({
                success: true,
                message: 'Inventory item created successfully',
                data: inventory
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Update inventory metadata (min/max levels, location)
     */
    async update(req, res, next) {
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;
            const updates = req.body;

            const inventory = await Inventory.findOne({ where: { id, company_id } });
            if (!inventory) {
                return res.status(404).json({ success: false, message: 'Inventory item not found' });
            }

            // Scope check
            const allowedNodes = await req.getAuthorizedNodes();
            if (!allowedNodes.includes(inventory.org_node_id)) {
                return res.status(403).json({ success: false, message: 'Access denied: Item is outside your visibility scope' });
            }

            await inventory.update(updates);

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'UPDATE',
                resource: 'inventory',
                resource_id: id,
                details: updates,
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
            });

            res.json({ success: true, message: 'Inventory updated successfully', data: inventory });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Adjust inventory quantity (add/remove/set)
     */
    async adjustQuantity(req, res, next) {
        try {
            const { id } = req.params;
            const { adjustment, reason, type } = req.body;
            const company_id = req.user.company_id;

            const inventory = await Inventory.findOne({ where: { id, company_id } });
            if (!inventory) {
                return res.status(404).json({ success: false, message: 'Inventory item not found' });
            }

            // Deep Scoping Check
            
            const allowedNodes = await req.getAuthorizedNodes();
            if (!allowedNodes.includes(inventory.org_node_id)) {
                return res.status(403).json({ success: false, message: 'Access denied: Target unit is outside your visibility scope' });
            }

            const adjustedItem = await inventoryService.adjustInventory(
                company_id,
                inventory.org_node_id,
                inventory.product_id,
                type === 'set' ? adjustment : (type === 'add' ? inventory.quantity + adjustment : inventory.quantity - adjustment),
                reason,
                { userId: req.user.id, id: inventory.id }
            );

            res.json({
                success: true,
                message: 'Inventory adjusted successfully',
                data: adjustedItem
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get low stock alerts for the user's node scope.
     */
    async getLowStock(req, res, next) {
        try {
            const { org_node_id } = req.query;
            const company_id = req.user.company_id;
            
            // Respect role-based visibility scoping
            const allowedNodes = await req.getAuthorizedNodes();
            const scopeId = org_node_id || (allowedNodes.length === 1 ? allowedNodes[0] : null);
            
            if (org_node_id && !allowedNodes.includes(Number(org_node_id))) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }

            const items = await inventoryService.getLowStockItems(company_id, scopeId, (scopeId ? null : allowedNodes));

            res.json({ success: true, data: items });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get real-time availability for a product in a unit.
     */
    async getAvailability(req, res, next) {
        try {
            const { product_id, org_node_id } = req.query;
            const company_id = req.user.company_id;

            if (!product_id || !org_node_id) {
                return res.status(400).json({ success: false, message: 'Missing product_id or org_node_id' });
            }

            // Deep Scoping Check
            const allowedNodes = await req.getAuthorizedNodes();
            if (!allowedNodes.includes(Number(org_node_id))) {
                return res.status(403).json({ success: false, message: 'Access denied: Target unit is outside your visibility scope' });
            }

            const availability = await inventoryService.checkAvailability(
                company_id,
                org_node_id,
                product_id,
                1 // check for at least 1, but service returns current_quantity anyway
            );

            res.json({ success: true, data: availability });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Perform a physical count of inventory.
     */
    async countInventory(req, res, next) {
        try {
            const { id } = req.params;
            const { actual_quantity, notes } = req.body;
            const company_id = req.user.company_id;

            const inventory = await Inventory.findOne({ where: { id, company_id } });
            if (!inventory) {
                return res.status(404).json({ success: false, message: 'Inventory item not found' });
            }

            // Deep Scoping Check
            
            const allowedNodes = await req.getAuthorizedNodes();
            if (!allowedNodes.includes(inventory.org_node_id)) {
                return res.status(403).json({ success: false, message: 'Access denied: Target unit is outside your visibility scope' });
            }

            const result = await inventoryService.adjustInventory(
                company_id,
                inventory.org_node_id,
                inventory.product_id,
                actual_quantity,
                `Physical Count: ${notes}`,
                { userId: req.user.id }
            );

            res.json({
                success: true,
                message: 'Inventory counted successfully',
                data: result
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Transfer between nodes (Multi-tenant safe)
     */
    async transfer(req, res, next) {
        try {
            const { from_node_id, to_node_id, product_id, quantity, notes } = req.body;
            const company_id = req.user.company_id;

            // Strict Scope enforcement for both ends
            const allowedNodes = await req.getAuthorizedNodes();
            if (!allowedNodes.includes(Number(from_node_id)) || !allowedNodes.includes(Number(to_node_id))) {
                return res.status(403).json({ success: false, message: 'Access denied: Transfer involves nodes outside your visibility scope' });
            }

            await inventoryService.transferBetweenNodes(
                company_id,
                from_node_id,
                to_node_id,
                product_id,
                quantity,
                { userId: req.user.id, reference: 'DIRECT_TRANSFER', notes }
            );

            res.json({
                success: true,
                message: 'Inventory transferred successfully'
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Split inventory item.
     */
    async split(req, res, next) {
        try {
            const { id } = req.params;
            const { quantity, serial_number, batch_number, location_details, status, org_node_id } = req.body;
            const company_id = req.user.company_id;

            const inventory = await Inventory.findOne({ where: { id, company_id } });
            if (!inventory) return res.status(404).json({ success: false, message: 'Source inventory not found' });

            // Scope check: Source node must be authorized
            const allowedNodes = await req.getAuthorizedNodes();
            if (!allowedNodes.includes(inventory.org_node_id)) {
                return res.status(403).json({ success: false, message: 'Access denied: Source node is outside visibility' });
            }

            // Scope check: Target node (if provided) must be authorized
            if (org_node_id && !allowedNodes.includes(Number(org_node_id))) {
                return res.status(403).json({ success: false, message: 'Access denied: Destination node is outside visibility' });
            }

            const result = await inventoryService.splitInventory(company_id, id, quantity, {
                serial_number, batch_number, location_details, status, org_node_id
            }, { userId: req.user.id });

            res.json({ success: true, message: 'Inventory split successfully', data: result });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Merge inventory items.
     */
    async merge(req, res, next) {
        try {
            const { target_id, source_ids } = req.body;
            const company_id = req.user.company_id;

            const target = await Inventory.findOne({ where: { id: target_id, company_id: company_id } });
            if (!target) return res.status(404).json({ success: false, message: 'Target inventory not found' });

            // Scope check
            const allowedNodes = await req.getAuthorizedNodes();
            if (!allowedNodes.includes(target.org_node_id)) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }

            const result = await inventoryService.mergeInventory(company_id, source_ids, target_id, { userId: req.user.id });

            res.json({ success: true, message: 'Inventory records merged successfully', data: result });
        } catch (error) {
            next(error);
        }
    },
    /**
     * Decommission an inventory item.
     */
    async decommission(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const company_id = req.user.company_id;

            const inventory = await Inventory.findOne({ where: { id, company_id } });
            if (!inventory) return res.status(404).json({ success: false, message: 'Inventory item not found' });

            // Scope check: Org Admin check
            const allowedNodes = await req.getAuthorizedNodes();
            if (!allowedNodes.includes(inventory.org_node_id)) {
                return res.status(403).json({ success: false, message: 'Access denied: Asset is outside your node visibility' });
            }

            const result = await inventoryService.decommissionInventory(company_id, id, reason, { userId: req.user.id });

            res.json({ success: true, message: 'Inventory record decommissioned / retired successfully', data: result });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Bulk deletes all inventory for a specific product and node.
     */
    async bulkDelete(req, res, next) {
        const transaction = await Inventory.sequelize.transaction();
        try {
            const { product_id, org_node_id } = req.body;
            const company_id = req.user.company_id;

            if (!product_id || !org_node_id) {
                return res.status(400).json({ success: false, message: 'Missing product_id or org_node_id' });
            }

            // Scope check: User must have access to the node
            const allowedNodes = await req.getAuthorizedNodes();
            if (!allowedNodes.includes(Number(org_node_id))) {
                return res.status(403).json({ success: false, message: 'Access denied: Targeted node is outside your visibility' });
            }

            const deletedCount = await Inventory.destroy({
                where: {
                    company_id,
                    product_id,
                    org_node_id
                },
                transaction
            });

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'INVENTORY_BULK_DELETE',
                resource: 'inventory',
                details: { product_id, org_node_id, count: deletedCount }
            }, { transaction });

            await transaction.commit();
            res.json({ success: true, message: `Successfully deleted ${deletedCount} inventory records` });
        } catch (error) {
            if (transaction) await transaction.rollback();
            next(error);
        }
    }
};

module.exports = inventoryController;
