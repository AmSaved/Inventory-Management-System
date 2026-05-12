require('dotenv').config();
const { sequelize } = require('./src/models');

async function checkTargetedIndexes() {
    try {
        console.log('--- Targeted Performance Index Audit ---');
        
        const tables = [
            'users', 'inventory', 'activity_logs', 
            'requests', 'products', 'assignments',
            'returns', 'transfers'
        ];

        const targetColumns = ['company_id', 'org_node_id', 'created_at'];

        for (const table of tables) {
            console.log(`\nTable: ${table}`);
            
            for (const col of targetColumns) {
                const [results] = await sequelize.query(`
                    SELECT
                        indexname,
                        indexdef
                    FROM
                        pg_indexes
                    WHERE
                        tablename = '${table}'
                        AND indexdef LIKE '%(${col})%';
                `);

                if (results.length === 0) {
                    console.log(`  ❌ MISSING INDEX: ${col}`);
                } else {
                    results.forEach(idx => {
                        console.log(`  ✅ INDEX FOUND: ${col} (${idx.indexname})`);
                    });
                }
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Audit failed:', error);
        process.exit(1);
    }
}

checkTargetedIndexes();
