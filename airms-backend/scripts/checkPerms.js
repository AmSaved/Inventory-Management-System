require('dotenv').config();
const { sequelize, Role, Permission } = require('../src/models');

async function check() {
    try {
        await sequelize.authenticate();
        console.log('DB connected.');
        const role = await Role.findOne({ 
            where: { id: 5 }, 
            include: [{ model: Permission, as: 'rolePermissions' }] 
        });
        if (role) {
            console.log("User Role permissions:", role.rolePermissions.length);
        } else {
            console.log("User Role not found!");
        }
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        process.exit(0);
    }
}
check();
