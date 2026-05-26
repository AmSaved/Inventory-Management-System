require('dotenv').config();
const { sequelize, User, Role, OrganizationNode, Permission } = require('../src/models');
const { getEffectivePermissions } = require('../src/middleware/permissions');
const hierarchyService = require('../src/services/hierarchyService');
const userService = require('../src/services/userService');

async function run() {
    try {
        console.log("Starting diagnostic...");
        
        console.time("DB Authenticate");
        await sequelize.authenticate();
        console.timeEnd("DB Authenticate");

        console.time("Find Super Admin User");
        const admin = await User.findOne({ 
            where: { email: 'admin@airms.com' },
            include: [{ model: Role, as: 'role' }]
        });
        console.timeEnd("Find Super Admin User");

        if (!admin) {
            console.log("Admin user not found.");
            return;
        }

        console.time("Get Effective Permissions");
        const permissions = await getEffectivePermissions(admin);
        console.log(`Permissions fetched (${permissions.length} items)`);
        console.timeEnd("Get Effective Permissions");

        console.time("Get Allowed Nodes");
        const allowedNodes = await hierarchyService.getAllowedNodes(admin, permissions);
        console.log(`Allowed nodes fetched:`, allowedNodes);
        console.timeEnd("Get Allowed Nodes");

        console.time("Get Descendants");
        const descendants = await hierarchyService.getDescendants(admin.org_node_id || 1);
        console.log(`Descendants:`, descendants);
        console.timeEnd("Get Descendants");

        console.time("Get All Users Query");
        const usersResult = await userService.getAllUsers(admin.company_id, 1, 10, '', { org_node_id: descendants });
        console.log(`Users fetched:`, usersResult.users.length);
        console.timeEnd("Get All Users Query");

        console.time("Get All Roles Query");
        const roles = await Role.findAll({
            include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }]
        });
        console.log(`Roles fetched:`, roles.length);
        console.timeEnd("Get All Roles Query");

    } catch (e) {
        console.error("Diagnostic error:", e);
    } finally {
        process.exit(0);
    }
}

run();
