/**
 * fix-merged-node-references.js
 * ─────────────────────────────────────────────────────────────────
 * One-time data-repair script.
 *
 * Finds all organization_nodes that are archived AND have metadata.merged_into
 * set (i.e., they were merged into another branch), then re-parents every
 * stale record in transfers, returns, discharges, requests, etc. that still
 * points to the old archived node ID.
 *
 * Run with:  node scripts/fix-merged-node-references.js
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { Op } = require('sequelize');
const {
    OrganizationNode,
    Transfer,
    Return,
    DischargeForm,
    DischargeItem,
    Request,
    Assignment,
    Inventory,
    User,
    Role,
    ActivityLog,
    Issue,
    Workflow,
    FormTemplate,
    UserNode,
    StoreForm,
    sequelize
} = require('../src/models');

async function main() {
    // 1. Find all archived nodes that have merged_into set
    const archivedNodes = await OrganizationNode.findAll({
        where: {
            status: 'archived',
            metadata: { [Op.ne]: null }
        },
        attributes: ['id', 'name', 'metadata']
    });

    const mergedNodes = archivedNodes.filter(
        n => n.metadata && n.metadata.merged_into
    );

    if (mergedNodes.length === 0) {
        console.log('✅  No archived/merged nodes found. Nothing to repair.');
        return;
    }

    console.log(`\n🔍  Found ${mergedNodes.length} archived (merged) node(s):\n`);
    mergedNodes.forEach(n => {
        console.log(`   ➤  Node #${n.id} "${n.name}"  →  merged into #${n.metadata.merged_into}`);
    });

    // 2. Process each merged node
    const t = await sequelize.transaction();
    try {
        for (const archivedNode of mergedNodes) {
            const sourceId  = archivedNode.id;
            const targetId  = archivedNode.metadata.merged_into;

            console.log(`\n⚙️   Re-parenting stale refs: #${sourceId} → #${targetId}`);

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
                User,
                Role,
                Assignment,
                UserNode
            ];

            const fields = ['org_node_id', 'from_node_id', 'to_node_id', 'target_node_id'];

            for (const Model of models) {
                for (const field of fields) {
                    if (Model && Model.rawAttributes && Model.rawAttributes[field]) {
                        const [count] = await Model.update(
                            { [field]: targetId },
                            { where: { [field]: sourceId }, transaction: t }
                        );
                        if (count > 0) {
                            console.log(`   ✔  ${Model.name}.${field}: ${count} row(s) updated`);
                        }
                    }
                }
            }

            // Also fix Inventory records
            if (Inventory && Inventory.rawAttributes && Inventory.rawAttributes['org_node_id']) {
                // Merge inventory quantities rather than blindly updating org_node_id
                const staleInventory = await Inventory.findAll({
                    where: { org_node_id: sourceId },
                    transaction: t
                });

                for (const inv of staleInventory) {
                    const existing = await Inventory.findOne({
                        where: { org_node_id: targetId, product_id: inv.product_id },
                        transaction: t
                    });
                    if (existing) {
                        await existing.update(
                            { quantity: Number(existing.quantity) + Number(inv.quantity) },
                            { transaction: t }
                        );
                        await inv.destroy({ transaction: t });
                        console.log(`   ✔  Inventory: merged product #${inv.product_id} into target (qty +${inv.quantity})`);
                    } else {
                        await inv.update({ org_node_id: targetId }, { transaction: t });
                        console.log(`   ✔  Inventory: moved product #${inv.product_id} to target node`);
                    }
                }
            }
        }

        await t.commit();
        console.log('\n🎉  All stale references repaired successfully!\n');
    } catch (err) {
        await t.rollback();
        console.error('\n❌  Repair failed, transaction rolled back:\n', err);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
