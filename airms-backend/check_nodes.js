
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const { OrganizationNode, Company } = require('./src/models');
const sequelize = require('./src/config/database');

async function check() {
    try {
        const nodes = await OrganizationNode.findAll({
            include: [{ model: Company, as: 'company', attributes: ['id', 'name'] }]
        });
        
        console.log(`Total Nodes: ${nodes.length}`);
        
        nodes.forEach(n => {
            console.log(`Node: ${n.name} (ID: ${n.id})`);
            console.log(`  Path: ${n.path}`);
            console.log(`  Parent ID: ${n.parent_id}`);
            console.log(`  Company: ${n.company?.name} (ID: ${n.company_id})`);
            console.log(`  Status: ${n.status}`);
            console.log('-------------------');
        });

    } catch (error) {
        console.error('Check failed:', error);
    } finally {
        await sequelize.close();
    }
}

check();
