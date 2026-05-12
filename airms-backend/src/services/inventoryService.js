const { Inventory, Product, OrganizationNode, ActivityLog } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const hierarchyService = require('./hierarchyService');

class InventoryService {
    /**
     * Add to inventory at a specific node.
     */
    async addToInventory(companyId, nodeId, productId, quantity, options = {}) {
        try {
            const [inventory, created] = await Inventory.findOrCreate({
                where: { 
                    company_id: companyId,
                    org_node_id: nodeId, 
                    product_id: productId,
                    serial_number: options.serialNumber || null
                },
                defaults: {
                    quantity: 0,
                    minimum_quantity: 0
                },
                transaction: options.transaction
            });

            await inventory.update({
                quantity: inventory.quantity + quantity,
                serial_number: options.serialNumber || inventory.serial_number,
                batch_number: options.batchNumber || inventory.batch_number,
                status: options.status || inventory.status,
                unit_cost: options.unitCost || inventory.unit_cost,
                ...options.metadata
            }, { transaction: options.transaction });

            // Log activity
            await ActivityLog.create({
                company_id: companyId,
                user_id: options.userId,
                action: 'INVENTORY_ADD',
                resource: 'inventory',
                resource_id: inventory.id,
                details: {
                    org_node_id: nodeId,
                    product_id: productId,
                    quantity_added: quantity,
                    new_quantity: inventory.quantity,
                    reference: options.reference,
                    notes: options.notes
                }
            }, { transaction: options.transaction });

            return inventory;
        } catch (error) {
            logger.error('Add to inventory error:', error);
            throw error;
        }
    }

    /**
     * Remove from inventory at a specific node.
     */
    async removeFromInventory(companyId, nodeId, productId, quantity, options = {}) {
        try {
            const inventory = await Inventory.findOne({
                where: { 
                    company_id: companyId,
                    org_node_id: nodeId, 
                    product_id: productId,
                    serial_number: options.serialNumber || null
                },
                transaction: options.transaction
            });

            if (!inventory) {
                throw new Error('Inventory item not found');
            }

            if (inventory.quantity < quantity) {
                throw new Error('Insufficient inventory');
            }

            await inventory.update({
                quantity: inventory.quantity - quantity
            }, { transaction: options.transaction });

            // Log activity
            await ActivityLog.create({
                company_id: companyId,
                user_id: options.userId,
                action: 'INVENTORY_REMOVE',
                resource: 'inventory',
                resource_id: inventory.id,
                details: {
                    org_node_id: nodeId,
                    product_id: productId,
                    quantity_removed: quantity,
                    new_quantity: inventory.quantity,
                    reference: options.reference,
                    notes: options.notes
                }
            }, { transaction: options.transaction });

            return inventory;
        } catch (error) {
            logger.error('Remove from inventory error:', error);
            throw error;
        }
    }

    /**
     * Check inventory availability at a specific node.
     */
    async checkAvailability(companyId, nodeId, productId, quantity, options = {}) {
        try {
            const inventory = await Inventory.findOne({
                where: { 
                    company_id: companyId,
                    org_node_id: nodeId, 
                    product_id: productId,
                    serial_number: options.serialNumber || null
                },
                transaction: options.transaction
            });

            if (!inventory) {
                return {
                    available: false,
                    current_quantity: 0,
                    required: quantity
                };
            }

            return {
                available: inventory.quantity >= quantity,
                current_quantity: inventory.quantity,
                required: quantity,
                shortfall: Math.max(0, quantity - inventory.quantity)
            };
        } catch (error) {
            logger.error('Check availability error:', error);
            throw error;
        }
    }

    /**
     * Get low stock items, optionally scoped to a node and its descendants.
     */
    async getLowStockItems(companyId, scopeNodeId = null) {
        try {
            const where = {
                company_id: companyId,
                quantity: { [Op.lte]: Inventory.sequelize.col('minimum_quantity') }
            };

            if (scopeNodeId) {
                // Use hierarchy service to get all node IDs in the subtree
                const nodeIds = await hierarchyService.getDescendants(scopeNodeId);
                where.org_node_id = { [Op.in]: nodeIds };
            }

            const items = await Inventory.findAll({
                where,
                include: [
                    { model: Product, as: 'product' },
                    { model: OrganizationNode, as: 'organizationNode' }
                ],
                order: [
                    [Inventory.sequelize.literal('quantity / NULLIF(minimum_quantity, 0)'), 'ASC']
                ]
            });

            return items;
        } catch (error) {
            logger.error('Get low stock items error:', error);
            throw error;
        }
    }

    /**
     * Transfer between two nodes.
     */
    async transferBetweenNodes(companyId, fromNodeId, toNodeId, productId, quantity, options = {}) {
        try {
            // Check source inventory
            const sourceInventory = await Inventory.findOne({
                where: { 
                    company_id: companyId, 
                    org_node_id: fromNodeId, 
                    product_id: productId 
                },
                transaction: options.transaction
            });

            if (!sourceInventory || sourceInventory.quantity < quantity) {
                throw new Error('Insufficient inventory in source node');
            }

            // Perform transfer
            await this.removeFromInventory(companyId, fromNodeId, productId, quantity, {
                userId: options.userId,
                reference: options.reference,
                notes: `Transfer to node ${toNodeId}`,
                transaction: options.transaction
            });

            await this.addToInventory(companyId, toNodeId, productId, quantity, {
                userId: options.userId,
                reference: options.reference,
                notes: `Transfer from node ${fromNodeId}`,
                transaction: options.transaction
            });

            return true;
        } catch (error) {
            logger.error('Transfer between units error:', error);
            throw error;
        }
    }

    /**
     * Adjust inventory at a specific node.
     */
    async adjustInventory(companyId, nodeId, productId, newQuantity, reason, options = {}) {
        try {
            const where = options.id ? { id: options.id, company_id: companyId } : { 
                company_id: companyId,
                org_node_id: nodeId, 
                product_id: productId,
                serial_number: options.serial_number || null
            };

            const inventory = await Inventory.findOne({ where });

            if (!inventory) {
                throw new Error('Inventory item not found');
            }

            const oldQuantity = inventory.quantity;

            await inventory.update({
                quantity: newQuantity,
                last_counted_at: new Date()
            }, { transaction: options.transaction });

            // Log adjustment
            await ActivityLog.create({
                company_id: companyId,
                user_id: options.userId,
                action: 'INVENTORY_ADJUST',
                resource: 'inventory',
                resource_id: inventory.id,
                details: {
                    org_node_id: nodeId,
                    product_id: productId,
                    old_quantity: oldQuantity,
                    new_quantity: newQuantity,
                    difference: newQuantity - oldQuantity,
                    reason
                }
            }, { transaction: options.transaction });

            return inventory;
        } catch (error) {
            logger.error('Adjust inventory error:', error);
            throw error;
        }
    }

    /**
     * Get inventory valuation scoped to a node and its descendants.
     */
    async getInventoryValuation(companyId, scopeNodeId = null) {
        try {
            const where = { company_id: companyId };
            
            if (scopeNodeId) {
                const nodeIds = await hierarchyService.getDescendants(scopeNodeId);
                where.org_node_id = { [Op.in]: nodeIds };
            }

            const inventory = await Inventory.findAll({
                where,
                include: [
                    { model: Product, as: 'product' },
                    { model: OrganizationNode, as: 'organizationNode' }
                ],
                order: [
                    ['org_node_id', 'ASC'],
                    ['product_id', 'ASC']
                ]
            });

            // Calculate valuation
            let totalValue = 0;
            const items = inventory.map(item => {
                const price = parseFloat(item.product?.specifications?.price || 0);
                const value = item.quantity * price;
                totalValue += value;
                return {
                    ...item.toJSON(),
                    estimated_value: value
                };
            });

            return {
                items,
                summary: {
                    total_items: inventory.length,
                    total_quantity: inventory.reduce((sum, item) => sum + item.quantity, 0),
                    total_value: totalValue,
                    by_node: this.groupByNode(items)
                }
            };
        } catch (error) {
            logger.error('Get inventory valuation error:', error);
            throw error;
        }
    }

    /**
     * Group items by organization node for summary reports.
     */
    groupByNode(items) {
        return items.reduce((acc, item) => {
            const nodeName = item.organizationNode?.name || 'Unknown';
            if (!acc[nodeName]) {
                acc[nodeName] = {
                    quantity: 0,
                    value: 0,
                    items: []
                };
            }
            acc[nodeName].quantity += item.quantity;
            acc[nodeName].value += item.estimated_value || 0;
            acc[nodeName].items.push(item);
            return acc;
        }, {});
    }

    /**
     * Splits an existing inventory record into a new one.
     */
    async splitInventory(companyId, sourceId, splitQuantity, metadata = {}, options = {}) {
        const t = await Inventory.sequelize.transaction();
        try {
            const source = await Inventory.findOne({ where: { id: sourceId, company_id: companyId }, transaction: t });
            if (!source) throw new Error('Source inventory not found');
            if (source.quantity < splitQuantity) throw new Error('Insufficient quantity to split');

            // 1. Subtract from source
            await source.update({ quantity: source.quantity - splitQuantity }, { transaction: t });

            // 2. Create the new "split" record
            const newInventory = await Inventory.create({
                company_id: companyId,
                product_id: source.product_id,
                org_node_id: metadata.org_node_id || source.org_node_id,
                quantity: splitQuantity,
                minimum_quantity: 0,
                unit_cost: source.unit_cost,
                status: metadata.status || source.status,
                serial_number: metadata.serial_number,
                batch_number: metadata.batch_number,
                location_details: metadata.location_details || source.location_details
            }, { transaction: t });

            await ActivityLog.create({
                company_id: companyId,
                user_id: options.userId,
                action: 'INVENTORY_SPLIT',
                resource: 'inventory',
                resource_id: sourceId,
                details: { source_id: sourceId, new_id: newInventory.id, quantity: splitQuantity }
            }, { transaction: t });

            await t.commit();
            return newInventory;
        } catch (error) {
            await t.rollback();
            throw error;
        }
    }

    /**
     * Merges multiple inventory records into one.
     */
    async mergeInventory(companyId, sourceIds, targetId, options = {}) {
        const t = await Inventory.sequelize.transaction();
        try {
            const target = await Inventory.findOne({ where: { id: targetId, company_id: companyId }, transaction: t });
            if (!target) throw new Error('Target inventory record not found');

            const sources = await Inventory.findAll({
                where: { 
                    id: { [Op.in]: sourceIds, [Op.ne]: targetId },
                    company_id: companyId
                },
                transaction: t
            });

            let totalMerged = 0;
            for (const source of sources) {
                if (source.product_id !== target.product_id || source.org_node_id !== target.org_node_id) {
                    throw new Error('Can only merge matching products at the same node');
                }
                totalMerged += source.quantity;
                await source.destroy({ transaction: t });
            }

            await target.update({ quantity: target.quantity + totalMerged }, { transaction: t });

            await ActivityLog.create({
                company_id: companyId,
                user_id: options.userId,
                action: 'INVENTORY_MERGE',
                resource: 'inventory',
                resource_id: targetId,
                details: { merged_ids: sourceIds, total_quantity_merged: totalMerged }
            }, { transaction: t });

            await t.commit();
            return target;
        } catch (error) {
            await t.rollback();
            throw error;
        }
    }

    /**
     * Decommissions an inventory record (sets quantity to 0 and status to decommissioned).
     */
    async decommissionInventory(companyId, id, reason, options = {}) {
        try {
            const inventory = await Inventory.findOne({ 
                where: { id, company_id: companyId },
                transaction: options.transaction 
            });
            if (!inventory) throw new Error('Inventory record not found');

            const oldQuantity = inventory.quantity;

            await inventory.update({
                quantity: 0,
                status: 'decommissioned',
                last_counted_at: new Date()
            }, { transaction: options.transaction });

            await ActivityLog.create({
                company_id: companyId,
                user_id: options.userId,
                action: 'INVENTORY_DECOMMISSION',
                resource: 'inventory',
                resource_id: id,
                details: { old_quantity: oldQuantity, reason }
            }, { transaction: options.transaction });

            return inventory;
        } catch (error) {
            logger.error('Decommission inventory error:', error);
            throw error;
        }
    }

    /**
     * Executes the physical movement for a discharge form.
     * Can be called by controllers or the workflow engine.
     */
    async executeDischarge(dischargeForm, user, options = {}) {
        const t = options.transaction || await Inventory.sequelize.transaction();
        try {
            const { DischargeItem, Assignment, User } = require('../models');
            const company_id = dischargeForm.company_id;
            
            // Re-fetch items if not included
            const items = dischargeForm.items || await DischargeItem.findAll({ 
                where: { discharge_form_id: dischargeForm.id },
                transaction: t 
            });

            for (const item of items) {
                // 1. Subtract from source inventory
                await this.removeFromInventory(
                    company_id,
                    dischargeForm.from_node_id,
                    item.product_id,
                    item.quantity,
                    {
                        userId: user.id,
                        reference: `DISCHARGE-${dischargeForm.discharge_number}`,
                        transaction: t
                    }
                );

                // 2. Determine Destination
                const targetUserId = item.to_user_id || dischargeForm.to_user_id;
                const targetNodeId = item.to_node_id || dischargeForm.to_node_id;
                
                const isUnitDischarge = !!targetNodeId && (targetNodeId !== dischargeForm.from_node_id);
                const isUserDischarge = !isUnitDischarge && !!targetUserId;

                if (isUnitDischarge) {
                    await this.addToInventory(
                        company_id,
                        targetNodeId,
                        item.product_id,
                        item.quantity,
                        {
                            userId: user.id,
                            reference: `RECEIVE-DISCHARGE-${dischargeForm.discharge_number}`,
                            notes: `Received from unit ${dischargeForm.from_node_id}`,
                            transaction: t,
                            metadata: {
                                condition: item.condition,
                                batch_number: item.batch_number,
                                serial_numbers: item.serial_numbers
                            }
                        }
                    );
                } else if (isUserDischarge) {
                    const targetUser = await User.findByPk(targetUserId, { transaction: t });
                    const serialNumbers = item.serial_numbers || [];

                    for (let i = 0; i < item.quantity; i++) {
                        await Assignment.create({
                            company_id,
                            discharge_item_id: item.id,
                            product_id: item.product_id,
                            user_id: targetUserId,
                            org_node_id: targetUser ? targetUser.org_node_id : dischargeForm.from_node_id,
                            serial_number: serialNumbers[i] || `SN-${Date.now()}-${item.id}-${i}`,
                            assigned_at: new Date(),
                            status: 'active',
                            condition_at_assignment: item.condition
                        }, { transaction: t });
                    }
                }
            }

            if (!options.transaction) await t.commit();
            return true;
        } catch (error) {
            if (!options.transaction) await t.rollback();
            logger.error('Execute discharge movement error:', error);
            throw error;
        }
    }

    /**
     * Executes the physical movement for a branch-to-branch transfer.
     */
    async executeTransfer(transferForm, user, options = {}) {
        const t = options.transaction || await Inventory.sequelize.transaction();
        try {
            const { TransferItem } = require('../models');
            const company_id = transferForm.company_id;
            
            const items = transferForm.items || await TransferItem.findAll({ 
                where: { transfer_id: transferForm.id },
                transaction: t 
            });

            for (const item of items) {
                // 1. Subtract from source branch
                await this.removeFromInventory(
                    company_id,
                    transferForm.from_node_id,
                    item.product_id,
                    item.quantity,
                    {
                        userId: user.id,
                        reference: `TRANSFER-OUT-${transferForm.transfer_number}`,
                        transaction: t
                    }
                );

                // 2. Add to target branch
                await this.addToInventory(
                    company_id,
                    transferForm.to_node_id,
                    item.product_id,
                    item.quantity,
                    {
                        userId: user.id,
                        reference: `TRANSFER-IN-${transferForm.transfer_number}`,
                        notes: `Lateral transfer from branch ID ${transferForm.from_node_id}`,
                        transaction: t,
                        metadata: {
                            condition: item.condition,
                            serial_numbers: item.serial_numbers
                        }
                    }
                );
            }

            if (!options.transaction) await t.commit();
            return true;
        } catch (error) {
            if (!options.transaction) await t.rollback();
            logger.error('Execute transfer movement error:', error);
            throw error;
        }
    }
}

module.exports = new InventoryService();