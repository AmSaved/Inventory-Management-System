
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const { User, Company, Role, OrganizationNode } = require('./src/models');
const sequelize = require('./src/config/database');

async function check() {
    try {
        const users = await User.findAll({
            include: [
                { model: Company, as: 'company', attributes: ['id', 'name'] },
                { model: Role, as: 'role', attributes: ['id', 'name', 'level'] },
                { model: OrganizationNode, as: 'organizationNode', attributes: ['id', 'name'] }
            ]
        });
        
        console.log(`Total Users: ${users.length}`);
        
        users.forEach(u => {
            console.log(`User: ${u.first_name} ${u.last_name} (@${u.username})`);
            console.log(`  Company: ${u.company?.name} (ID: ${u.company_id})`);
            console.log(`  Role: ${u.role?.name} (Level: ${u.role?.level})`);
            console.log(`  Node: ${u.organizationNode?.name || 'NONE'} (ID: ${u.org_node_id})`);
            console.log('-------------------');
        });

    } catch (error) {
        console.error('Check failed:', error);
    } finally {
        await sequelize.close();
    }
}

check();
