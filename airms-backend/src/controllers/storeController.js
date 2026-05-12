const { StoreForm, StoreItem, Product, Inventory, OrganizationNode, User, ActivityLog, sequelize } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const inventoryService = require('../services/inventoryService');
const hierarchyService = require('../services/hierarchyService');
const workflowService = require('../services/workflowService');
const logger = require('../config/logger');
const { getEffectivePermissions } = require('../middleware/permissions');

const storeController = {
    /**
     * Get all store forms scoped to company and user's organizational scope.
     */
    async getAll(req, res, next) {
        try {
            const { page = 1, limit = 10, org_node_id, from_date, to_date, search } = req.query;
            const company_id = req.user.company_id;
            
            const where = { company_id };

            const permissions = await getEffectivePermissions(req.user);
            const hasGlobalVisibility = permissions.includes('hierarchy:all:view') || permissions.includes('system:manage');

            // Hierarchical Scoping
            if (org_node_id) {
                const nodeIds = await hierarchyService.getDescendants(org_node_id);
                where.org_node_id = { [Op.in]: nodeIds };
            } else if (!hasGlobalVisibility && req.user.org_node_id) {
                const nodeIds = await hierarchyService.getDescendants(req.user.org_node_id);
                where.org_node_id = { [Op.in]: nodeIds };
            }
            
            if (from_date || to_date) {
                where.created_at = {};
                if (from_date) where.created_at[Op.gte] = new Date(from_date);
                if (to_date) where.created_at[Op.lte] = new Date(to_date);
            }

            if (search) {
                where.store_number = { [Op.iLike]: `%${search}%` };
            }

            const offset = (page - 1) * limit;
            
            const { count, rows } = await StoreForm.findAndCountAll({
                where,
                include: [
                    {
                        model: OrganizationNode,
                        as: 'organizationNode',
                        attributes: ['id', 'name', 'code']
                    },
                    {
                        model: User,
                        as: 'creator',
                        attributes: ['id', 'first_name', 'last_name']
                    }
                ],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['created_at', 'DESC']]
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
     * Get store form by ID (Secured by companyId).
     */
    async getById(req, res, next) {
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;
            
            const storeForm = await StoreForm.findOne({
                where: { id, company_id },
                include: [
                    { model: OrganizationNode, as: 'organizationNode' },
                    { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name', 'email'] },
                    { model: StoreItem, as: 'items', include: ['product'] }
                ]
            });

            if (!storeForm) return res.status(404).json({ success: false, message: 'Store form not found' });

            res.json({ success: true, data: storeForm });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Create a new store form and update inventory.
     */
    async create(req, res, next) {
        const transaction = await sequelize.transaction();
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

            const { items, ...storeData } = req.body;
            const company_id = req.user.company_id;
            
            storeData.company_id = company_id;
            storeData.created_by = req.user.id;
            
            // Set node (if not provided, use user's node)
            storeData.org_node_id = storeData.org_node_id || req.user.org_node_id;

            // Validate the node can store inventory
            const node = await OrganizationNode.findOne({ where: { id: storeData.org_node_id, company_id } });
            if (!node || !node.can_store_inventory) {
                return res.status(400).json({ success: false, message: 'Selected node cannot store inventory' });
            }

            // Generate store number
            const count = await StoreForm.count({ where: { company_id }, transaction });
            storeData.store_number = `STR-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
            storeData.status = 'completed'; // default, might be updated by workflow

            const storeForm = await StoreForm.create(storeData, { transaction });

            // Process dynamic product generation and prepare final items
            const finalItems = [];
            if (items && items.length > 0) {
                for (const item of items) {
                    let finalProductId = item.product_id;
                    
                    if (!finalProductId && item.new_product) {
                        const existingProduct = await Product.findOne({
                            where: { sku: item.new_product.sku, company_id },
                            transaction
                        });
                        
                        if (existingProduct) {
                            finalProductId = existingProduct.id;
                        } else {
                            const newProduct = await Product.create({
                                ...item.new_product,
                                company_id,
                                created_by: req.user.id
                            }, { transaction });
                            finalProductId = newProduct.id;
                            
                            await ActivityLog.create({
                                company_id, user_id: req.user.id, action: 'CREATE', resource: 'products',
                                resource_id: newProduct.id, details: { source: 'Dynamic Store Intake' }
                            }, { transaction });
                        }
                    }

                    finalItems.push({
                        ...item,
                        product_id: finalProductId,
                        store_form_id: storeForm.id,
                        total_price: 0 // financials removed
                    });
                }
            }

            // ---------------------------------------------------------
            // USER OVERRIDE: Intake Workflow Bypassed
            // Intakes now automatically register to the live ledger without approval
            // ---------------------------------------------------------
            /*
            const workflow = await workflowService.getActiveWorkflow(company_id, storeData.org_node_id, 'inventory_store');
            
            if (workflow && workflow.steps.length > 0) { ... }
            */

            const inventoryResults = [];
            // Legacy/Direct path (No Workflow)
            if (finalItems.length > 0) {
                await StoreItem.bulkCreate(finalItems, { transaction });

                for (const item of finalItems) {
                    if (item.is_serialized && item.quantity > 1) {
                        for (let i = 0; i < item.quantity; i++) {
                            const serializedSN = item.serial_number ? `${item.serial_number}-${String(i + 1).padStart(3, '0')}` : `SN-${Date.now()}-${i}`;
                            const newInv = await inventoryService.addToInventory(
                                company_id,
                                storeData.org_node_id,
                                item.product_id,
                                1, // Force quantity of 1 for serialized
                                {
                                    userId: req.user.id,
                                    reference: `STORE-${storeForm.store_number}`,
                                    notes: `Store form #${storeForm.store_number}`,
                                    serialNumber: serializedSN,
                                    transaction
                                }
                            );
                            if (item.product_id) newInv.product = { name: 'Item', sku: item.product_id }; 
                            inventoryResults.push(newInv);
                        }
                    } else {
                        const newInv = await inventoryService.addToInventory(
                            company_id,
                            storeData.org_node_id,
                            item.product_id,
                            item.quantity,
                            {
                                userId: req.user.id,
                                reference: `STORE-${storeForm.store_number}`,
                                notes: `Store form #${storeForm.store_number}`,
                                serialNumber: item.serial_number, // PASS SERIAL NUMBER HERE
                                transaction
                            }
                        );
                        if (item.product_id) newInv.product = { name: 'Item', sku: item.product_id };
                        inventoryResults.push(newInv);
                    }
                }
            }

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'CREATE_DIRECT',
                resource: 'store_forms',
                resource_id: storeForm.id,
                details: { store_number: storeForm.store_number, items_count: finalItems.length }
            }, { transaction });

            await transaction.commit();

            const result = await StoreForm.findByPk(storeForm.id, { include: ['items'] });
            
            // To support the auto-print modal on the frontend, we send back the items
            res.status(201).json({ 
                success: true, 
                message: 'Store form created and inventory instantly updated', 
                data: result,
                inventoryItems: inventoryResults 
            });
        } catch (error) {
            if (transaction) await transaction.rollback();
            next(error);
        }
    },

    /**
     * Advance store form through its workflow.
     */
    async approve(req, res, next) {
        const transaction = await sequelize.transaction();
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;

            const storeForm = await StoreForm.findOne({ 
                where: { id, company_id },
                include: ['items']
            });

            if (!storeForm) return res.status(404).json({ success: false, message: 'Store form not found' });
            if (storeForm.status === 'completed') return res.status(400).json({ success: false, message: 'Already completed' });

            const result = await workflowService.advanceWorkflow(
                storeForm, 
                'inventory_store', 
                req.user, 
                req.body.notes || 'Step approved'
            );

            if (result && result.isFinalStep) {
                // IMPORTANT: The process is now "Approved/Final". Realize the inventory.
                for (const item of storeForm.items) {
                    if (item.is_serialized && item.quantity > 1) {
                        for (let i = 0; i < item.quantity; i++) {
                            const serializedSN = item.serial_number ? `${item.serial_number}-${String(i + 1).padStart(3, '0')}` : `SN-${Date.now()}-${i}`;
                            await inventoryService.addToInventory(
                                company_id,
                                storeForm.org_node_id,
                                item.product_id,
                                1, // Force quantity of 1
                                {
                                    userId: req.user.id,
                                    reference: `STORE-${storeForm.store_number}`,
                                    notes: `Finalized via workflow approval`,
                                    serialNumber: serializedSN,
                                    transaction
                                }
                            );
                        }
                    } else {
                        await inventoryService.addToInventory(
                            company_id,
                            storeForm.org_node_id,
                            item.product_id,
                            item.quantity,
                            {
                                userId: req.user.id,
                                reference: `STORE-${storeForm.store_number}`,
                                notes: `Finalized via workflow approval`,
                                serialNumber: item.serial_number, // PASS SERIAL NUMBER
                                transaction
                            }
                        );
                    }
                }
                await storeForm.update({ status: 'completed' }, { transaction });
            }

            await transaction.commit();
            res.json({ 
                success: true, 
                message: result?.isFinalStep ? 'Store intake finalized and inventory updated' : 'Workflow step approved',
                data: storeForm 
            });
        } catch (error) {
            if (transaction) await transaction.rollback();
            next(error);
        }
    },

    /**
     * Delete a store form (only if no items or for audit reversal).
     */
    async delete(req, res, next) {
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;

            const storeForm = await StoreForm.findOne({ where: { id, company_id } });
            if (!storeForm) return res.status(404).json({ success: false, message: 'Store form not found' });

            const itemCount = await StoreItem.count({ where: { store_form_id: id } });
            if (itemCount > 0) {
                return res.status(400).json({ success: false, message: 'Cannot delete store form with items' });
            }

            await storeForm.destroy();

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'DELETE',
                resource: 'store_forms',
                resource_id: id
            });

            res.json({ success: true, message: 'Store form deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = storeController;