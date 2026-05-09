const { 
    OrganizationNode, 
    User, 
    Inventory, 
    Role, 
    Request, 
    Assignment, 
    Product, 
    Category,
    DischargeForm,
    StoreForm,
    Transfer,
    Return,
    ActivityLog,
    sequelize 
} = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

class MergeService {
    /**
     * Orchestrates the consolidation of multiple branches into a new one.
     */
    async executeMerge(sourceNodeIds, newBranchData, companyId, user) {
        const t = await sequelize.transaction();
        try {
            // 1. Create the new Consolidated Branch
            const targetNode = await OrganizationNode.create({
                ...newBranchData,
                company_id: companyId,
                created_by: user.id,
                status: 'active'
            }, { transaction: t });

            // Set the path for the new branch
            const parentPath = ''; // If it's a top-level consolidation, path is empty
            if (targetNode.parent_id) {
                const parent = await OrganizationNode.findByPk(targetNode.parent_id, { transaction: t });
                targetNode.path = `${parent.path || ''}${parent.id}/`;
            } else {
                targetNode.path = '/';
            }
            await targetNode.save({ transaction: t });

            // 2. Consolidate Inventory
            await this.consolidateInventory(sourceNodeIds, targetNode.id, companyId, user, t);

            // 3. Re-parent Human Resources (Users & Roles)
            await this.reparentHumanResources(sourceNodeIds, targetNode.id, t);

            // 4. Re-parent Transactions & History
            await this.reparentTransactions(sourceNodeIds, targetNode.id, t);

            // 5. Re-parent Sub-units (Hierarchy)
            await this.reparentSubUnits(sourceNodeIds, targetNode.id, t);

            // 6. Final Cleanup: Liquidate Source Branches
            await OrganizationNode.update(
                { status: 'archived', metadata: { merged_into: targetNode.id, merged_at: new Date() } },
                { where: { id: { [Op.in]: sourceNodeIds } }, transaction: t }
            );

            await ActivityLog.create({
                company_id: companyId,
                user_id: user.id,
                action: 'CONSOLIDATE',
                resource: 'organization',
                resource_id: targetNode.id,
                details: { source_nodes: sourceNodeIds, new_node: targetNode.name }
            }, { transaction: t });

            await t.commit();
            return targetNode;
        } catch (error) {
            await t.rollback();
            logger.error('Branch Merge Error:', error);
            throw error;
        }
    }

    /**
     * Fuses stock levels for identical products.
     */
    async consolidateInventory(sourceNodeIds, targetNodeId, companyId, user, transaction) {
        // Find all inventory records from source branches
        const sourceInventory = await Inventory.findAll({
            where: { org_node_id: { [Op.in]: sourceNodeIds } },
            transaction
        });

        // Group by product_id to detect duplicates
        const productMap = {};
        for (const inv of sourceInventory) {
            if (!productMap[inv.product_id]) {
                productMap[inv.product_id] = 0;
            }
            productMap[inv.product_id] += Number(inv.quantity);
        }

        // Create/Update records in target branch
        for (const [productId, totalQuantity] of Object.entries(productMap)) {
            await Inventory.create({
                company_id: companyId,
                org_node_id: targetNodeId,
                product_id: productId,
                quantity: totalQuantity,
                min_threshold: 0 // Default
            }, { transaction });
        }

        // Cleanup: Physically remove inventory from liquidated branches to prevent double-counting
        await Inventory.destroy({
            where: { org_node_id: { [Op.in]: sourceNodeIds } },
            transaction
        });

        // Move all individual Assignments to the new node
        await Assignment.update(
            { org_node_id: targetNodeId },
            { where: { org_node_id: { [Op.in]: sourceNodeIds } }, transaction }
        );
    }

    /**
     * Moves users and roles without merging names.
     */
    async reparentHumanResources(sourceNodeIds, targetNodeId, transaction) {
        // Move Roles first so they remain valid anchors for users
        await Role.update(
            { org_node_id: targetNodeId },
            { where: { org_node_id: { [Op.in]: sourceNodeIds } }, transaction }
        );

        // Move Users
        await User.update(
            { org_node_id: targetNodeId },
            { where: { org_node_id: { [Op.in]: sourceNodeIds } }, transaction }
        );
    }

    /**
     * Moves all requests, transfers, and histories.
     */
    async reparentTransactions(sourceNodeIds, targetNodeId, transaction) {
        const models = [Request, DischargeForm, StoreForm, Transfer, Return, ActivityLog];
        
        for (const Model of models) {
            // Note: Transfer and Discharge might have from_node_id and to_node_id
            const fields = ['org_node_id', 'from_node_id', 'to_node_id', 'target_node_id'];
            
            for (const field of fields) {
                if (Model.rawAttributes[field]) {
                    await Model.update(
                        { [field]: targetNodeId },
                        { where: { [field]: { [Op.in]: sourceNodeIds } }, transaction }
                    );
                }
            }
        }
    }

    /**
     * Re-parents sub-units and rebuilds their Materialized Paths.
     */
    async reparentSubUnits(sourceNodeIds, targetNodeId, transaction) {
        const targetNode = await OrganizationNode.findByPk(targetNodeId, { transaction });

        // Find all sub-units that were children of the source nodes
        const children = await OrganizationNode.findAll({
            where: { 
                parent_id: { [Op.in]: sourceNodeIds },
                id: { [Op.notIn]: sourceNodeIds } // Don't re-parent the merged nodes themselves
            },
            transaction
        });

        for (const child of children) {
            child.parent_id = targetNodeId;
            child.path = `${targetNode.path}${targetNode.id}/`;
            await child.save({ transaction });
            
            // Recursively update descendants of this child
            await this.rebuildDescendantPaths(child, transaction);
        }
    }

    async rebuildDescendantPaths(parentNode, transaction) {
        const descendants = await OrganizationNode.findAll({
            where: { parent_id: parentNode.id },
            transaction
        });

        for (const desc of descendants) {
            desc.path = `${parentNode.path}${parentNode.id}/`;
            await desc.save({ transaction });
            await this.rebuildDescendantPaths(desc, transaction);
        }
    }

    /**
     * Generates a preview of what will be affected by a merge.
     */
    async getMergePreview(sourceNodeIds, companyId) {
        const stats = {
            users: await User.count({ where: { org_node_id: { [Op.in]: sourceNodeIds } } }),
            roles: await Role.count({ where: { org_node_id: { [Op.in]: sourceNodeIds } } }),
            inventory_items: await Inventory.count({ where: { org_node_id: { [Op.in]: sourceNodeIds } } }),
            pending_requests: await Request.count({ where: { org_node_id: { [Op.in]: sourceNodeIds }, status: 'pending' } }),
            sub_units: await OrganizationNode.count({ where: { parent_id: { [Op.in]: sourceNodeIds } } })
        };
        return stats;
    }
}

module.exports = new MergeService();
