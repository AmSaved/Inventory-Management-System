const { 
    Return, 
    ReturnItem, 
    Inventory, 
    Assignment, 
    Request, 
    ActivityLog, 
    sequelize, 
    User 
} = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const hierarchyService = require('../services/hierarchyService');
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
                // Verify sender has enough stock either in inventory or active assignments
                const inventoryRows = await Inventory.findAll({
                    where: {
                        org_node_id: from_node_id,
                        product_id: item.product_id,
                        quantity: { [Op.gt]: 0 }
                    },
                    transaction: t
                });

                const inventoryQty = inventoryRows.reduce((sum, row) => sum + (row.quantity || 0), 0);
                let hasStock = inventoryQty >= item.quantity;

                if (!hasStock) {
                    // Count direct assignments at source node
                    const assignmentCountNode = await Assignment.count({
                        where: {
                            org_node_id: from_node_id,
                            product_id: item.product_id,
                            status: 'active'
                        },
                        transaction: t
                    });
                    // Count assignments linked to users belonging to the source node
                    const assignmentCountUser = await Assignment.count({
                        where: {
                            product_id: item.product_id,
                            status: 'active'
                        },
                        include: [{ model: User, as: 'user', where: { org_node_id: from_node_id }, attributes: [] }],
                        transaction: t
                    });
                    if ((assignmentCountNode + assignmentCountUser) >= item.quantity) {
                        hasStock = true;
                    }
                }

                if (!hasStock) {
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
            if (returnRecord.status !== 'pending' && returnRecord.status !== 'pending_acknowledgment') {
                throw new Error('Return is not in a pending or pending_acknowledgment state');
            }

            // Move each item
            for (const item of returnRecord.items) {
                // 1. Deduct from Source (Branch) - handle both inventory and assignments
                let remainingQty = item.quantity;
                const sourceInvRows = await Inventory.findAll({
                    where: { org_node_id: returnRecord.from_node_id, product_id: item.product_id, quantity: { [Op.gt]: 0 } },
                    order: [['created_at', 'ASC']],
                    transaction: t
                });

                for (const sourceInv of sourceInvRows) {
                    if (remainingQty <= 0) break;
                    const deduct = Math.min(sourceInv.quantity, remainingQty);
                    if (deduct > 0) {
                        await sourceInv.decrement('quantity', { by: deduct, transaction: t });
                        remainingQty -= deduct;
                    }
                }

                if (remainingQty > 0) {
                    // Need to remove assignments to cover the remaining quantity
                    const assignments = await Assignment.findAll({
                        where: {
                            org_node_id: returnRecord.from_node_id,
                            product_id: item.product_id,
                            status: 'active'
                        },
                        limit: remainingQty,
                        transaction: t
                    });
                    if (assignments.length < remainingQty) {
                        throw new Error(`Source branch no longer has sufficient stock for ${item.product_id}`);
                    }
                    for (const assign of assignments) {
                        await assign.destroy({ transaction: t });
                    }
                }

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
            returnRecord.workflow_status = 'Completed';
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
        returnRecord.workflow_status = 'Rejected';
        returnRecord.current_step_id = null;
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
     * Get recent discharge history to help the user select items to return.
     * Includes both 'completed' and 'acknowledged' forms since discharges
     * transition to 'acknowledged' once the recipient confirms receipt.
     */
    async getDischargeHistoryForReturn(nodeId, companyId) {
        const { DischargeForm, DischargeItem, Product, OrganizationNode } = require('../models');

        // Match forms targeting this branch either at the form level (to_node_id on
        // the form) OR at the item level (to_node_id on individual items).
        // Status includes both 'completed' and 'acknowledged' because a discharge moves
        // to 'acknowledged' after the receiving branch confirms it.
        return await DischargeForm.findAll({
            where: {
                company_id: companyId,
                status: { [Op.in]: ['completed', 'acknowledged'] },
                [Op.or]: [
                    { to_node_id: nodeId },        // Form-level branch assignment
                    { to_node_id: null }            // Form has no branch override — rely on item-level filter below
                ]
            },
            include: [
                { model: OrganizationNode, as: 'fromNode', attributes: ['id', 'name'] },
                {
                    model: DischargeItem,
                    as: 'items',
                    required: true,
                    // For item-level filtering: keep items that belong to this branch
                    // OR items with no per-item override (they inherit the form's to_node_id).
                    where: {
                        [Op.or]: [
                            { to_node_id: nodeId },
                            { to_node_id: null }
                        ]
                    },
                    include: [{ model: Product, as: 'product' }]
                }
            ],
            order: [['created_at', 'DESC']],
            limit: 50
        });
    }
}

module.exports = new ReturnService();
