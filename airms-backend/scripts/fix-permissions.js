require('dotenv').config();
const { Role, Permission, sequelize } = require('../src/models');

const requiredPermissions = [
    // Requests
    { name: 'request:read', description: 'View requests' },
    { name: 'request:create', description: 'Create new requests' },
    { name: 'request:update', description: 'Update/Cancel own requests' },
    { name: 'request:delete', description: 'Delete requests (Admin only)' },
    { name: 'request:approve:chairman', description: 'Chairman approval' },
    { name: 'request:approve:storage', description: 'Storage manager approval' },
    
    // Transfers
    { name: 'transfer:view', description: 'View transfers' },
    { name: 'transfer:request', description: 'Request asset transfer' },
    { name: 'transfer:approve', description: 'Approve asset transfer' },
    { name: 'transfer:execute', description: 'Execute asset transfer' },
    { name: 'transfer:update', description: 'Update transfer' },
    
    // Returns
    { name: 'return:view', description: 'View returns' },
    { name: 'return:request', description: 'Request asset return' },
    { name: 'return:process', description: 'Process asset return' },
    { name: 'return:update', description: 'Update return' },
    
    // Issues
    { name: 'issue:view', description: 'View issues' },
    { name: 'issue:report', description: 'Report asset issue' },
    { name: 'issue:resolve', description: 'Resolve asset issue' },
    { name: 'issue:update', description: 'Update issue' },
    
    // Inventory & Products
    { name: 'inventory:view', description: 'View inventory' },
    { name: 'inventory:adjust', description: 'Adjust inventory/stock' },
    { name: 'product:read', description: 'View products' },
    { name: 'dashboard:view', description: 'View dashboard' },

    // Core resources
    { name: 'branch:read', description: 'View branches' },
    { name: 'user:read', description: 'View users' },

    // Store (Intakes)
    { name: 'store:read', description: 'View store intakes' },
    { name: 'store:create', description: 'Create store intakes' },
    { name: 'store:update', description: 'Update store intakes' },
    { name: 'store:delete', description: 'Delete store intakes' },

    // Discharge (Distributions)
    { name: 'discharge:read', description: 'View discharges' },
    { name: 'discharge:create', description: 'Create discharges' },
    { name: 'discharge:update', description: 'Update discharges' },
    { name: 'discharge:execute', description: 'Execute/Approve discharges' }
];

const fixPermissions = async () => {
    try {
        console.log('Ensuring all permissions exist...');
        for (const p of requiredPermissions) {
            const [resource, action] = p.name.split(':');
            await Permission.findOrCreate({
                where: { name: p.name },
                defaults: { 
                    description: p.description,
                    resource: resource || 'system',
                    action: action || 'view'
                }
            });
        }

        const allPerms = await Permission.findAll();
        const permMap = {};
        allPerms.forEach(p => permMap[p.name] = p.id);

        const roleAssignments = {
            'user': [
                'request:read', 'request:create', 'request:update',
                'transfer:view', 'transfer:request',
                'return:view', 'return:request',
                'issue:view', 'issue:report',
                'inventory:view', 'product:read', 'dashboard:view',
                'branch:read', 'user:read'
            ],
            'chairman': [
                'request:read', 'request:create', 'request:update', 'request:approve:chairman',
                'transfer:view', 'transfer:request', 'transfer:approve',
                'return:view', 'return:request',
                'issue:view', 'issue:report',
                'inventory:view', 'product:read', 'dashboard:view',
                'branch:read', 'user:read',
                'store:read', 'discharge:read'
            ],
            'storage_manager': [
                'request:read', 'request:create', 'request:update', 'request:approve:storage',
                'transfer:view', 'transfer:request', 'transfer:execute',
                'return:view', 'return:request', 'return:process',
                'issue:view', 'issue:report', 'issue:resolve',
                'inventory:view', 'inventory:adjust', 'product:read', 'dashboard:view',
                'branch:read', 'user:read',
                'store:read', 'store:create', 'store:update', 'store:delete',
                'discharge:read', 'discharge:create', 'discharge:update', 'discharge:execute'
            ]
        };

        for (const [roleName, perms] of Object.entries(roleAssignments)) {
            const role = await Role.findOne({ where: { name: roleName } });
            if (role) {
                console.log(`Assigning permissions to role: ${roleName}...`);
                const permIds = perms.map(name => permMap[name]).filter(id => id);
                await role.setPermissions(permIds);
            } else {
                console.warn(`Role ${roleName} not found!`);
            }
        }

        // Super Admin gets EVERYTHING
        const superAdminRole = await Role.findOne({ where: { name: 'super_admin' } });
        if (superAdminRole) {
            await superAdminRole.setPermissions(allPerms.map(p => p.id));
            console.log('Granted all permissions to super_admin.');
        }

        console.log('\n✅ Permissions fixed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Fix failed:', error);
        process.exit(1);
    }
};

fixPermissions();
