const path = require('path');
const backendDir = 'C:/Users/User/Desktop/airms/airms-backend';
require(path.join(backendDir, 'node_modules/dotenv')).config({ path: path.join(backendDir, '.env') });
module.paths.push(path.join(backendDir, 'node_modules'));

const { Inventory, Assignment, Product, OrganizationNode, Return, ReturnItem, sequelize } = require(path.join(backendDir, 'src/models'));
const inventoryService = require(path.join(backendDir, 'src/services/inventoryService'));
const requestService = require(path.join(backendDir, 'src/services/requestService'));
const returnController = require(path.join(backendDir, 'src/controllers/returnController'));

async function runTest() {
    console.log('=== STARTING RETURN RESTOCK TEST ===\n');

    // 1. Setup metadata
    const company = await sequelize.query('SELECT id FROM Companies LIMIT 1', { type: sequelize.QueryTypes.SELECT });
    if (company.length === 0) {
        console.error('No companies in DB');
        process.exit(1);
    }
    const company_id = company[0].id;
    const node = await OrganizationNode.findOne({ where: { status: 'active' } });
    const userObj = await sequelize.query('SELECT id FROM Users LIMIT 1', { type: sequelize.QueryTypes.SELECT });
    const user_id = userObj[0].id;

    // Create a dummy product
    const product = await Product.create({
        company_id,
        name: 'Test Return Restock Product ' + Date.now(),
        sku: 'SKU-' + Date.now(),
        status: 'active'
    });

    console.log(`Created product: ${product.name} (${product.sku})`);

    // -------------------------------------------------------------
    // CASE A: SERIALIZED ITEM
    // -------------------------------------------------------------
    console.log('\n--- Testing Serialized Item Return ---');
    const serial = 'SN-TST-RET-' + Date.now();
    
    // Create inventory record
    const serialInv = await Inventory.create({
        company_id,
        product_id: product.id,
        org_node_id: node.id,
        quantity: 1,
        serial_number: serial,
        status: 'available'
    });

    console.log(`1. Initial Inventory status: ${serialInv.status}, quantity: ${serialInv.quantity}`);

    // Create a mock transaction
    const t1 = await sequelize.transaction();
    let assignment;
    try {
        // Discharge to user (mark as assigned)
        await serialInv.update({
            status: 'assigned',
            assigned_to: user_id,
            assigned_at: new Date()
        }, { transaction: t1 });

        assignment = await Assignment.create({
            company_id,
            product_id: product.id,
            user_id,
            org_node_id: node.id,
            serial_number: serial,
            inventory_id: serialInv.id,
            assigned_at: new Date(),
            status: 'active',
            condition_at_assignment: 'good'
        }, { transaction: t1 });

        await t1.commit();
        console.log('2. Discharged. Inventory status: assigned, quantity: 1 (should not be decremented)');
    } catch (e) {
        await t1.rollback();
        console.error('Discharge error:', e);
        process.exit(1);
    }

    // Double check DB state after discharge
    let dbInv = await Inventory.findByPk(serialInv.id);
    console.log(`   Verification: Inventory status in DB: ${dbInv.status}, quantity: ${dbInv.quantity}`);

    // Create a direct return request & acknowledge it
    const t2 = await sequelize.transaction();
    try {
        const returnRecord = await Return.create({
            company_id,
            assignment_id: assignment.id,
            user_id,
            from_node_id: node.id,
            to_node_id: node.id,
            return_type: 'normal',
            status: 'pending_acknowledgment'
        }, { transaction: t2 });

        const returnItem = await ReturnItem.create({
            return_id: returnRecord.id,
            product_id: product.id,
            quantity: 1
        }, { transaction: t2 });

        // Simulate ReturnController.acknowledge() User Asset Logic
        await returnRecord.update({
            status: 'completed',
            received_by: user_id,
            received_at: new Date()
        }, { transaction: t2 });

        await assignment.update({
            status: 'returned',
            condition_at_return: 'good',
            actual_return_date: new Date()
        }, { transaction: t2 });

        // Apply our return restock fix logic directly
        const inventoryItem = await Inventory.findOne({
            where: {
                company_id,
                [sequelize.Op.or]: [
                    { id: assignment.inventory_id || 0 },
                    { serial_number: assignment.serial_number }
                ]
            },
            transaction: t2
        });

        if (inventoryItem) {
            await inventoryItem.update({
                status: 'available',
                assigned_to: null,
                assigned_at: null,
                org_node_id: returnRecord.to_node_id,
                condition: 'good'
            }, { transaction: t2 });
            console.log('3. Return logic matched: found physical item. Changing status to available.');
        } else {
            console.log('3. Return logic: fallback to addToInventory.');
            await inventoryService.addToInventory(
                company_id,
                returnRecord.to_node_id,
                returnItem.product_id,
                returnItem.quantity,
                { transaction: t2 }
            );
        }

        await t2.commit();
    } catch (e) {
        await t2.rollback();
        console.error('Acknowledge error:', e);
        process.exit(1);
    }

    // Verify DB state after return acknowledgment
    dbInv = await Inventory.findByPk(serialInv.id);
    console.log(`4. After Return: Inventory status: ${dbInv.status}, quantity: ${dbInv.quantity}`);
    if (dbInv.status === 'available' && dbInv.quantity === 1) {
        console.log('   -> SUCCESS: Serialized item quantity remained 1 and status changed back to available!');
    } else {
        console.error(`   -> FAILURE: Inventory quantity is ${dbInv.quantity} (expected 1) or status is ${dbInv.status} (expected available)`);
    }

    // Clean up created records
    await Assignment.destroy({ where: { product_id: product.id } });
    await ReturnItem.destroy({ where: { product_id: product.id } });
    await Return.destroy({ where: { assignment_id: assignment.id } });
    await Inventory.destroy({ where: { product_id: product.id } });
    await product.destroy();

    console.log('\n=== TEST COMPLETED ===\n');
    process.exit(0);
}

runTest();
