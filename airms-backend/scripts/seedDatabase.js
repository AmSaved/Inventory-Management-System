require('dotenv').config();
const { sequelize, Role, Branch } = require('../src/models');

async function seed() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const roles = [
            { id: 1, name: 'super_admin', level: 1, description: 'Super Admin' },
            { id: 2, name: 'chairman', level: 2, description: 'Chairman' },
            { id: 3, name: 'storage_manager', level: 3, description: 'Storage Manager' },
            { id: 4, name: 'cluster_manager', level: 4, description: 'Cluster Manager' },
            { id: 5, name: 'user', level: 5, description: 'User' }
        ];

        for (const role of roles) {
            await Role.findOrCreate({ where: { id: role.id }, defaults: role });
        }
        console.log('Roles seeded.');

        const branches = [
            { id: 1, name: 'Central Headquarters', code: 'HQ001', address: 'HQ', is_active: true },
            { id: 2, name: 'North Branch', code: 'NB001', address: 'North', is_active: true },
            { id: 3, name: 'South Branch', code: 'SB001', address: 'South', is_active: true }
        ];

        for (const branch of branches) {
            await Branch.findOrCreate({ where: { id: branch.id }, defaults: branch });
        }
        console.log('Branches seeded.');

        console.log('Seeding complete!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
}

seed();
