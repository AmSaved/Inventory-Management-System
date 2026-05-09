require('dotenv').config();
const { Role, Permission, User } = require('../src/models');

const diagnose = async () => {
    try {
        console.log('--- Roles ---');
        const roles = await Role.findAll({
            include: [{
                model: Permission,
                as: 'permissions',
                through: { attributes: [] }
            }]
        });

        roles.forEach(role => {
            console.log(`Role: ${role.name} (ID: ${role.id}, Level: ${role.level})`);
            console.log('Permissions:', role.permissions.map(p => p.name).join(', ') || 'NONE');
            console.log('---');
        });

        console.log('\n--- All Available Permissions ---');
        const allPermissions = await Permission.findAll();
        console.log(allPermissions.map(p => p.name).join(', '));

        process.exit(0);
    } catch (error) {
        console.error('Diagnosis failed:', error);
        process.exit(1);
    }
};

diagnose();
