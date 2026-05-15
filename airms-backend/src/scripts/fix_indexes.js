require('dotenv').config();
const { sequelize } = require('../models');

async function fixIndexes() {
    try {
        console.log('🚀 Starting Index Optimization...');
        
        const tables = [
            'users', 'inventory', 'activity_logs', 
            'requests', 'products', 'assignments',
            'returns', 'transfers', 'approvals',
            'discharge_forms', 'store_forms'
        ];

        // ─── ADD MISSING COLUMNS TO APPROVALS ───
        console.log('Migrating Approvals table schema...');
        try {
            await sequelize.query('ALTER TABLE approvals ADD COLUMN IF NOT EXISTS transfer_id INTEGER REFERENCES transfers(id)');
            await sequelize.query('ALTER TABLE approvals ADD COLUMN IF NOT EXISTS return_id INTEGER REFERENCES returns(id)');
            console.log('  ✅ Added missing columns to Approvals table');
        } catch (e) {
            console.log('  ℹ️ Columns already exist or could not be added via ALTER TABLE');
        }

        // ─── CONVERT SERIAL NUMBERS TO JSONB (Postgres Fix) ───
        console.log('Optimizing TransferItem storage...');
        try {
            await sequelize.query(`
                ALTER TABLE transfer_items 
                ALTER COLUMN serial_numbers TYPE JSONB 
                USING array_to_json(serial_numbers)::jsonb
            `);
            console.log('  ✅ Converted transfer_items.serial_numbers to JSONB');
        } catch (e) {
            console.log(`  ℹ️ Note: TransferItem migration skipped: ${e.message}`);
        }

        const targetColumns = ['company_id', 'org_node_id', 'created_at'];

        for (const table of tables) {
            console.log(`Checking indexes for ${table}...`);
            
            // Add company_id index if it doesn't exist
            await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_${table}_company_id ON ${table} (company_id)`).catch(e => console.log(`  (Note: could not add company_id index to ${table})`));
            
            // Add org_node_id index (or equivalent)
            const nodeCols = ['org_node_id', 'org_unit_id', 'branch_id', 'from_node_id', 'to_node_id'];
            for (const col of nodeCols) {
                try {
                    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_${table}_${col} ON ${table} (${col})`);
                    console.log(`  ✅ Added index for ${col} on ${table}`);
                } catch (e) {
                    // Column likely doesn't exist on this table
                }
            }
        }

        // ─── HIERARCHY PERFORMANCE (CRITICAL) ───
        console.log('Optimizing OrganizationNode hierarchy...');
        try {
            await sequelize.query('CREATE INDEX IF NOT EXISTS idx_org_nodes_path ON organization_nodes (path)');
            await sequelize.query('CREATE INDEX IF NOT EXISTS idx_org_nodes_company_path ON organization_nodes (company_id, path)');
            console.log('  ✅ Added path-based indexes for tree traversal');
        } catch (e) {
            console.log(`  ℹ️ Note: OrgNode index optimization skipped: ${e.message}`);
        }

        // ─── INVENTORY JOIN PERFORMANCE ───
        console.log('Optimizing Inventory join paths...');
        try {
            await sequelize.query('CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory (product_id)');
            await sequelize.query('CREATE INDEX IF NOT EXISTS idx_inventory_comp_node_prod ON inventory (company_id, org_node_id, product_id)');
            console.log('  ✅ Added composite indexes for Inventory joins');
        } catch (e) {
            console.log(`  ℹ️ Note: Inventory index optimization skipped: ${e.message}`);
        }

        console.log('✅ Index Optimization Complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Optimization failed:', error);
        process.exit(1);
    }
}

fixIndexes();
