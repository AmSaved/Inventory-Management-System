
const { Request, RequestItem, Assignment, User, sequelize } = require('../models');
const inventoryService = require('./inventoryService');
const logger = require('../config/logger');

class RequestService {
    /**
     * Executes the physical fulfillment of a request (Custody transfer & Stock update).
     * This is the "Engine Room" of the logistics system.
     */
    async fulfillRequest(requestId, companyId, effectorUser, options = {}) {
        const t = options.transaction || await sequelize.transaction();
        try {
            const request = await Request.findOne({
                where: { id: requestId, company_id: companyId },
                include: ['items'],
                transaction: t
            });

            if (!request) throw new Error('Request not found');
            if (request.status === 'fulfilled') return request;

            // 1. Transition Request status
            await request.update({ 
                status: 'fulfilled', 
                completed_date: new Date(),
                workflow_status: options.workflowStatus || 'Fulfilled (Final)'
            }, { transaction: t });

            // 2. Parse Logistics Notes
            let logisticsNotes = {};
            try {
                logisticsNotes = JSON.parse(request.notes || '{}');
            } catch (e) { /* ignore */ }

            // 3. Execution Logic based on Request Type
            if (request.request_type === 'transfer') {
                const assignmentId = logisticsNotes.assignment_id;
                const targetUserId = request.target_user_id || logisticsNotes.transfer_to_user_id;

                if (assignmentId && targetUserId) {
                    const oldAssignment = await Assignment.findByPk(assignmentId, { transaction: t });
                    const targetUser = await User.findByPk(targetUserId, { transaction: t });

                    if (oldAssignment && targetUser) {
                        // CROSS-BRANCH CHECK: If moving between nodes, update the Inventory records
                        if (oldAssignment.org_node_id !== targetUser.org_node_id) {
                            await inventoryService.transferBetweenNodes(
                                companyId,
                                oldAssignment.org_node_id,
                                targetUser.org_node_id,
                                oldAssignment.product_id,
                                1,
                                { 
                                    userId: effectorUser?.id, 
                                    reference: `TRF-${request.request_number}`,
                                    transaction: t 
                                }
                            );
                        }

                        // Close old assignment
                        await oldAssignment.update({ status: 'transferred', actual_return_date: new Date() }, { transaction: t });
                        
                        // Create NEW assignment for target user
                        await Assignment.create({
                            company_id: companyId,
                            product_id: oldAssignment.product_id,
                            user_id: targetUserId,
                            org_node_id: targetUser.org_node_id,
                            serial_number: oldAssignment.serial_number,
                            assigned_at: new Date(),
                            status: 'active',
                            condition_at_assignment: oldAssignment.condition_at_assignment,
                            notes: `Transferred via request #${request.request_number}`
                        }, { transaction: t });
                    }
                }
            } else if (request.request_type === 'return') {
                // Return logic (Simplified from requestController)
                const assignmentId = logisticsNotes.assignment_id;
                if (assignmentId) {
                    const assignment = await Assignment.findByPk(assignmentId, { transaction: t });
                    if (assignment) {
                        await assignment.update({ 
                            status: 'returned', 
                            actual_return_date: new Date() 
                        }, { transaction: t });
                        
                        await inventoryService.addToInventory(
                            companyId, 
                            assignment.org_node_id, 
                            assignment.product_id, 
                            1, 
                            { 
                                userId: effectorUser?.id, 
                                reference: `RET-${request.request_number}`,
                                transaction: t 
                            }
                        );
                    }
                }
            } else {
                // Default: New Issue / Requisition
                const targetUserId = request.target_user_id || request.requester_id;
                const targetUser = await User.findByPk(targetUserId, { transaction: t });
                const targetNodeId = request.org_node_id || targetUser?.org_node_id;

                for (const item of request.items) {
                    const specs = typeof item.specifications === 'string' ? JSON.parse(item.specifications || '{}') : (item.specifications || {});
                    const sourceNodeId = specs.source_node_id || targetNodeId;
                    const serialNumber = specs.serial_number || `AUTO-${request.request_number}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

                    // Subtract from inventory
                    await inventoryService.removeFromInventory(
                        companyId,
                        sourceNodeId,
                        item.product_id,
                        item.quantity_requested || 1,
                        { 
                            userId: effectorUser?.id, 
                            reference: `REQ-${request.request_number}`,
                            transaction: t,
                            serialNumber: specs.serial_number // Use specific serial if provided
                        }
                    );

                    // Create Assignment
                    await Assignment.create({
                        company_id: companyId,
                        product_id: item.product_id,
                        user_id: targetUserId,
                        org_node_id: targetNodeId,
                        serial_number: serialNumber,
                        assigned_at: new Date(),
                        status: 'active',
                        condition_at_assignment: 'good',
                        notes: `Automatically assigned via request #${request.request_number}`
                    }, { transaction: t });
                }
            }

            if (!options.transaction) await t.commit();
            return request;
        } catch (error) {
            if (!options.transaction) await t.rollback();
            logger.error('Request fulfillment error:', error);
            throw error;
        }
    }
}

module.exports = new RequestService();
