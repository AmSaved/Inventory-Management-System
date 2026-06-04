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
    DischargeItem,
    StoreForm,
    Transfer,
    Return,
    ActivityLog,
    Issue,
    Workflow,
    FormTemplate,
    UserNode,
    sequelize 
} = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

class MergeService {
    /**
     * Orchestrates the consolidation of multiple branches into a new one or an existing one.
     */
    async executeMerge(sourceNodeIds, newBranchData, companyId, user, targetNodeId = null) {
        const t = await sequelize.transaction();
        try {
            // Resolve company_id as a last resort from the first source node
            let resolvedCompanyId = companyId || user.company_id;
            if (!resolvedCompanyId) {
                const fallbackNode = await OrganizationNode.findByPk(sourceNodeIds[0], { attributes: ['company_id'] });
                resolvedCompanyId = fallbackNode?.company_id;
            }
            logger.debug(`[MergeService] executeMerge companyId resolved to: ${resolvedCompanyId}`);
            if (!resolvedCompanyId) throw new Error('Cannot determine company_id for merge operation');

            let targetNode;
            if (targetNodeId) {
                targetNode = await OrganizationNode.findByPk(targetNodeId, { transaction: t });
                if (!targetNode) {
                    throw new Error('Target branch not found');
                }
                if (targetNode.status === 'archived') {
                    throw new Error('Cannot merge into an archived branch');
                }
            } else {
                // 1. Create the new Consolidated Branch
                targetNode = await OrganizationNode.create({
                    ...newBranchData,
                    company_id: resolvedCompanyId,
                    created_by: user.id,
                    status: 'active'
                }, { transaction: t });

                // Set the path for the new branch
                if (targetNode.parent_id) {
                    const parent = await OrganizationNode.findByPk(targetNode.parent_id, { transaction: t });
                    targetNode.path = `${parent.path || ''}${targetNode.id}/`;
                } else {
                    targetNode.path = `/${targetNode.id}/`;
                }
                await targetNode.save({ transaction: t });
            }

            const targetNodeIdVal = targetNode.id;
            // Exclude the target node itself from the sources being archived and consolidated
            const activeSourceNodeIds = sourceNodeIds.filter(id => Number(id) !== Number(targetNodeIdVal));

            if (activeSourceNodeIds.length > 0) {
                // 2. Consolidate Inventory
                await this.consolidateInventory(activeSourceNodeIds, targetNodeIdVal, resolvedCompanyId, user, t);

                // 3. Re-parent Human Resources (Users & Roles)
                await this.reparentHumanResources(activeSourceNodeIds, targetNodeIdVal, t);

                // 4. Re-parent Transactions & History
                await this.reparentTransactions(activeSourceNodeIds, targetNodeIdVal, t);

                // 5. Re-parent Sub-units (Hierarchy)
                await this.reparentSubUnits(activeSourceNodeIds, targetNodeIdVal, t);

                // 6. Final Cleanup: Liquidate Source Branches
                // individualHooks: false skips beforeValidate so it won't query with undefined company_id
                await OrganizationNode.update(
                    { status: 'archived', metadata: { merged_into: targetNodeIdVal, merged_at: new Date() } },
                    { where: { id: { [Op.in]: activeSourceNodeIds } }, transaction: t, individualHooks: false }
                );
            }

            await ActivityLog.create({
                company_id: resolvedCompanyId,
                user_id: user.id,
                action: 'CONSOLIDATE',
                resource: 'organization',
                resource_id: targetNodeIdVal,
                details: { source_nodes: sourceNodeIds, target_branch: targetNode.name, is_existing: !!targetNodeId }
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
        // Filter out targetNodeId to prevent double-counting or infinite loops
        const activeSourceNodeIds = sourceNodeIds.filter(id => Number(id) !== Number(targetNodeId));
        if (activeSourceNodeIds.length === 0) return;

        // 1. Move all serialized inventory records by updating their org_node_id directly.
        // Serialized inventory records are those where serial_number is not null and not empty.
        await Inventory.update(
            { org_node_id: targetNodeId },
            { 
                where: { 
                    org_node_id: { [Op.in]: activeSourceNodeIds },
                    serial_number: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
                }, 
                transaction 
            }
        );

        // 2. Consolidate non-serialized inventory records (where serial_number is null or empty)
        const sourceNonSerialized = await Inventory.findAll({
            where: { 
                org_node_id: { [Op.in]: activeSourceNodeIds },
                [Op.or]: [
                    { serial_number: null },
                    { serial_number: '' }
                ]
            },
            transaction
        });

        // Group by product_id to sum their quantities
        const productMap = {};
        for (const inv of sourceNonSerialized) {
            if (!productMap[inv.product_id]) {
                productMap[inv.product_id] = { qty: 0, company_id: inv.company_id };
            }
            productMap[inv.product_id].qty += Number(inv.quantity);
        }

        // Create or update consolidated non-serialized records in the target branch
        for (const [productId, data] of Object.entries(productMap)) {
            const effectiveCompanyId = companyId || data.company_id;

            // Check if target branch already has non-serialized inventory for this product
            const existing = await Inventory.findOne({
                where: { 
                    org_node_id: targetNodeId, 
                    product_id: productId,
                    [Op.or]: [
                        { serial_number: null },
                        { serial_number: '' }
                    ]
                },
                transaction
            });

            if (existing) {
                await existing.update({
                    quantity: Number(existing.quantity) + Number(data.qty)
                }, { transaction });
            } else {
                await Inventory.create({
                    company_id: effectiveCompanyId,
                    org_node_id: targetNodeId,
                    product_id: productId,
                    quantity: data.qty,
                    minimum_quantity: 0
                }, { transaction });
            }
        }

        // Delete the original source non-serialized records
        await Inventory.destroy({
            where: { 
                org_node_id: { [Op.in]: activeSourceNodeIds },
                [Op.or]: [
                    { serial_number: null },
                    { serial_number: '' }
                ]
            },
            transaction
        });

        // Move all individual Assignments to the new node
        await Assignment.update(
            { org_node_id: targetNodeId },
            { where: { org_node_id: { [Op.in]: activeSourceNodeIds } }, transaction }
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
        const models = [
            Request, 
            DischargeForm, 
            DischargeItem,
            StoreForm, 
            Transfer, 
            Return, 
            ActivityLog,
            Issue,
            Workflow,
            FormTemplate,
            Product,
            UserNode
        ];
        
        for (const Model of models) {
            const fields = ['org_node_id', 'from_node_id', 'to_node_id', 'target_node_id'];
            
            for (const field of fields) {
                if (Model && Model.rawAttributes && Model.rawAttributes[field]) {
                    await Model.update(
                        { [field]: targetNodeId },
                        { where: { [field]: { [Op.in]: sourceNodeIds } }, transaction }
                    );
                }
            }
        }

        // Also update specifications.source_node_id inside RequestItem if it references any of the merged branches
        const { RequestItem } = require('../models');
        if (RequestItem) {
            const items = await RequestItem.findAll({
                where: {
                    specifications: {
                        [Op.ne]: null
                    }
                },
                transaction
            });

            for (const item of items) {
                let specs = item.specifications;
                if (typeof specs === 'string') {
                    try { specs = JSON.parse(specs); } catch (e) { specs = null; }
                }
                if (specs && specs.source_node_id && sourceNodeIds.map(Number).includes(Number(specs.source_node_id))) {
                    specs.source_node_id = targetNodeId;
                    await item.update({ specifications: specs }, { transaction });
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
            child.path = `${targetNode.path}${child.id}/`;
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
            desc.path = `${parentNode.path}${desc.id}/`;
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
            pending_transfers: await Transfer.count({
                where: {
                    status: 'pending',
                    [Op.or]: [
                        { from_node_id: { [Op.in]: sourceNodeIds } },
                        { to_node_id: { [Op.in]: sourceNodeIds } }
                    ]
                }
            }),
            pending_discharges: await DischargeForm.count({
                where: {
                    status: 'pending',
                    [Op.or]: [
                        { from_node_id: { [Op.in]: sourceNodeIds } },
                        { to_node_id: { [Op.in]: sourceNodeIds } }
                    ]
                }
            }),
            pending_returns: await Return.count({
                where: {
                    status: 'pending',
                    [Op.or]: [
                        { from_node_id: { [Op.in]: sourceNodeIds } },
                        { to_node_id: { [Op.in]: sourceNodeIds } }
                    ]
                }
            }),
            sub_units: await OrganizationNode.count({ where: { parent_id: { [Op.in]: sourceNodeIds } } })
        };
        return stats;
    }
}

module.exports = new MergeService();
