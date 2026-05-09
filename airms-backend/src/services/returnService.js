const { 
    Return, 
    ReturnItem, 
    Inventory, 
    Assignment, 
    Request, 
    ActivityLog, 
    sequelize 
} = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

class ReturnService {
    /**
     * Create an Inventory Return (Branch to Parent)
     */
    async createInventoryReturn(data, companyId, user) {
        const t = await sequelize.transaction();
        try {
            const { from_node_id, to_node_id, items, request_id, notes } = data;

            // 1. Create the Return Header
            const returnRecord = await Return.create({
                company_id: companyId,
                user_id: user.id,
                from_node_id,
                to_node_id,
                request_id,
                notes,
                status: 'pending',
                return_type: 'inventory'
            }, { transaction: t });

            // 2. Add Items
            for (const item of items) {
                // Verify sender has enough stock
                const inv = await Inventory.findOne({
                    where: { 
                        org_node_id: from_node_id, 
                        product_id: item.product_id,
                        quantity: { [Op.gte]: item.quantity }
                    },
                    transaction: t
                });

                if (!inv) {
                    throw new Error(`Insufficient inventory for product ID ${item.product_id} at source branch`);
                }

                await ReturnItem.create({
                    return_id: returnRecord.id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    condition: item.condition || 'good',
                    remarks: item.remarks
                }, { transaction: t });
            }

            await ActivityLog.create({
                company_id: companyId,
                user_id: user.id,
                action: 'CREATE',
                resource: 'returns',
                resource_id: returnRecord.id,
                details: { type: 'inventory', from_node_id, to_node_id }
            }, { transaction: t });

            await t.commit();
            return returnRecord;
        } catch (error) {
            await t.rollback();
            logger.error('Inventory Return Creation Error:', error);
            throw error;
        }
    }

    /**
     * Finalize the Inventory Return (Execute Stock Move)
     */
    async approveInventoryReturn(returnId, companyId, approverId) {
        const t = await sequelize.transaction();
        try {
            const returnRecord = await Return.findByPk(returnId, {
                include: [{ model: ReturnItem, as: 'items' }],
                transaction: t
            });

            if (!returnRecord) throw new Error('Return record not found');
            if (returnRecord.status !== 'pending') throw new Error('Return is not in a pending state');

            // Move each item
            for (const item of returnRecord.items) {
                // 1. Deduct from Source (Sub-Branch)
                const sourceInv = await Inventory.findOne({
                    where: { org_node_id: returnRecord.from_node_id, product_id: item.product_id },
                    transaction: t
                });
                
                if (!sourceInv || sourceInv.quantity < item.quantity) {
                    throw new Error(`Source branch no longer has sufficient stock for ${item.product_id}`);
                }
                await sourceInv.decrement('quantity', { by: item.quantity, transaction: t });

                // 2. Add to Target (Parent Branch)
                const [targetInv] = await Inventory.findOrCreate({
                    where: { org_node_id: returnRecord.to_node_id, product_id: item.product_id },
                    defaults: { company_id: companyId, quantity: 0 },
                    transaction: t
                });
                await targetInv.increment('quantity', { by: item.quantity, transaction: t });
            }

            // Update status
            returnRecord.status = 'completed';
            returnRecord.received_by = approverId;
            returnRecord.received_at = new Date();
            await returnRecord.save({ transaction: t });

            await ActivityLog.create({
                company_id: companyId,
                user_id: approverId,
                action: 'APPROVE',
                resource: 'returns',
                resource_id: returnId,
                details: { status: 'completed', items_moved: returnRecord.items.length }
            }, { transaction: t });

            await t.commit();
            return returnRecord;
        } catch (error) {
            await t.rollback();
            logger.error('Inventory Return Approval Error:', error);
            throw error;
        }
    }

    async rejectInventoryReturn(returnId, companyId, rejecterId, reason) {
        const returnRecord = await Return.findByPk(returnId);
        if (!returnRecord) throw new Error('Return record not found');

        returnRecord.status = 'rejected';
        returnRecord.notes = (returnRecord.notes || '') + `\nRejected by ${rejecterId}: ${reason}`;
        await returnRecord.save();

        await ActivityLog.create({
            company_id: companyId,
            user_id: rejecterId,
            action: 'REJECT',
            resource: 'returns',
            resource_id: returnId,
            details: { reason }
        });

        return returnRecord;
    }

    /**
     * Get recent discharge history to help the user select items to return
     */
    async getDischargeHistoryForReturn(nodeId, companyId) {
        const { DischargeForm, DischargeItem, Product } = require('../models');

        // Find forms that have AT LEAST ONE item for this branch, 
        // then only include those specific items to prevent branch-leaks.
        return await DischargeForm.findAll({
            where: { 
                company_id: companyId, 
                status: 'completed'
            },
            include: [{
                model: DischargeItem,
                as: 'items',
                required: true, // This ensures only forms with items for this branch are returned
                where: { 
                    [Op.or]: [
                        { to_node_id: nodeId },
                        { to_node_id: null } // Fallback for legacy items without a specific node override
                    ]
                },
                include: [{ model: Product, as: 'product' }]
            }],
            order: [['created_at', 'DESC']],
            limit: 10
        });
    }
}

module.exports = new ReturnService();
