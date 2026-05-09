require('dotenv').config();
const { sequelize, Permission, Role, RolePermission } = require('../src/models');

const permissions = [
    // Users
    'user:read', 'user:create', 'user:update', 'user:delete',
    // Roles & Permissions
    'role:read', 'role:create', 'role:update', 'role:delete', 'permission:assign',
    // Products & Inventory
    'product:read', 'product:create', 'product:update', 'product:delete',
    'inventory:read', 'inventory:add', 'inventory:adjust',
    // Requests
    'request:read', 'request:create', 'request:update', 'request:approve', 'request:cancel',
    // Approvals
    'approval:read', 'approval:create',
    // Store
    'store:read', 'store:create', 'store:update', 'store:delete',
    // Discharge
    'discharge:read', 'discharge:create', 'discharge:update', 'discharge:approve',
    // Assignments
    'assignment:read', 'assignment:create', 'assignment:update', 'assignment:return',
    // Returns
    'return:view', 'return:request', 'return:process', 'return:update',
    // Transfers
    'transfer:view', 'transfer:request', 'transfer:approve', 'transfer:execute', 'transfer:update',
    // Issues
    'issue:read', 'issue:create', 'issue:update', 'issue:resolve',
    // Reports
    'report:read', 'report:generate',
    // Dashboard
    'dashboard:view'
];

const userPerms = [
    'product:read', 'inventory:read', 'request:read', 'request:create', 'request:cancel',
    'assignment:read', 'return:request', 'return:view', 'issue:read', 'issue:create', 'dashboard:view', 'user:read'
];

const clusterManagerPerms = [...userPerms, 'request:approve', 'return:process', 'transfer:request', 'transfer:view', 'issue:update'];
const storageManagerPerms = [...userPerms, 'inventory:add', 'inventory:adjust', 'store:read', 'store:create', 'store:update', 'discharge:read', 'discharge:create', 'discharge:approve', 'transfer:execute', 'transfer:approve'];
const chairmanPerms = permissions;

async function seed() {
    try {
        await sequelize.authenticate();
        for (const name of permissions) {
            const [resource, action] = name.split(':');
            await Permission.findOrCreate({ where: { name }, defaults: { name, description: name, resource, action } });
        }
        const allPermissionRecords = await Permission.findAll();
        const permMap = {};
        allPermissionRecords.forEach(p => permMap[p.name] = p.id);

        const assignPerms = async (roleId, permNames) => {
            for (const name of permNames) {
                if (permMap[name]) {
                    await RolePermission.findOrCreate({
                        where: { role_id: roleId, permission_id: permMap[name] }
                    });
                }
            }
        };

        await assignPerms(5, userPerms);
        await assignPerms(4, clusterManagerPerms);
        await assignPerms(3, storageManagerPerms);
        await assignPerms(2, chairmanPerms);

        console.log("Permissions seeded securely and correctly assigned to roles.");
        process.exit(0);
    } catch (e) {
        console.error("Seeding permissions failed:", e);
        process.exit(1);
    }
}
seed();
