require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { Product, ActivityLog, User, OrganizationNode, sequelize } = require('../models');
const hierarchyService = require('../services/hierarchyService');

async function runBackfill() {
    console.log("Starting Blueprint org_node_id Backfill...");
    try {
        const productsToUpdate = await Product.findAll({
            where: { org_node_id: null }
        });

        console.log(`Found ${productsToUpdate.length} products needing backfill.`);

        let updatedCount = 0;

        for (const product of productsToUpdate) {
            // Find creation log
            const log = await ActivityLog.findOne({
                where: {
                    action: 'CREATE',
                    resource: 'products',
                    resource_id: product.id
                }
            });

            if (log && log.user_id) {
                const user = await User.findByPk(log.user_id);
                if (user && user.org_node_id) {
                    const breadcrumb = await hierarchyService.getBreadcrumb(user.org_node_id);
                    if (breadcrumb && breadcrumb.length > 0) {
                        const rootNodeId = breadcrumb[0].id;
                        await product.update({ org_node_id: rootNodeId });
                        updatedCount++;
                        console.log(`Updated Product ${product.id} (${product.name}) -> org_node_id: ${rootNodeId}`);
                    } else {
                        console.log(`User ${user.id} has no valid hierarchy.`);
                    }
                } else {
                    console.log(`Could not find user or user has no org_node_id for Product ${product.id}.`);
                }
            } else {
                console.log(`Could not find creation log for Product ${product.id}.`);
            }
        }

        console.log(`Backfill complete. Updated ${updatedCount} products.`);
    } catch (error) {
        console.error("Error during backfill:", error);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

runBackfill();
