
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const { Transfer, Request, Inventory, Product, User } = require('./src/models');
const sequelize = require('./src/config/database');

async function check() {
    try {
        const transfers = await Transfer.findAll({ 
            limit: 10, 
            order: [['created_at', 'DESC']], 
            include: ['items'] 
        });
        
        const requests = await Request.findAll({ 
            where: { request_type: 'transfer' }, 
            limit: 10, 
            order: [['created_at', 'DESC']], 
            include: ['items'] 
        });

        console.log('--- RECENT LATERAL TRANSFERS (Branch-to-Branch) ---');
        for (const t of transfers) {
            console.log(`Transfer #${t.transfer_number}:`);
            console.log(`  Status: ${t.status}`);
            console.log(`  From Node: ${t.from_node_id}`);
            console.log(`  To Node: ${t.to_node_id}`);
            console.log(`  Created At: ${t.created_at}`);
            console.log('-------------------');
        }

        console.log('\n--- RECENT HANDOVER REQUESTS (User-to-User) ---');
        for (const r of requests) {
            console.log(`Request #${r.request_number}:`);
            console.log(`  Status: ${r.status}`);
            console.log(`  Requester: ${r.requester_id}`);
            console.log(`  Target User: ${r.target_user_id}`);
            console.log(`  Created At: ${r.created_at}`);
            console.log('-------------------');
        }

    } catch (error) {
        console.error('Check failed:', error);
    } finally {
        await sequelize.close();
    }
}

check();
