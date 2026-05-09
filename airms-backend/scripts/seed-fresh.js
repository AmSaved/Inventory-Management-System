require('dotenv').config();
const { sequelize, Company, Role, User, OrganizationType, OrganizationNode, Permission } = require('../src/models');
const bcrypt = require('bcryptjs');

async function seedFresh() {
    try {
        await sequelize.authenticate();
        console.log('✅ DB Connected.');

        // 1. Create default company
        const [company] = await Company.findOrCreate({
            where: { subdomain: 'main' },
            defaults: {
                name: 'AIRMS Main Organization',
                subdomain: 'main',
                plan: 'enterprise',
                max_users: 500,
                is_active: true,
                settings: {}
            }
        });
        console.log(`✅ Company: ${company.name} (ID: ${company.id})`);

        // 2. Create roles
        const rolesData = [
            { name: 'super_admin',     level: 100, description: 'System Super Administrator' },
            { name: 'admin',           level: 90,  description: 'Company Administrator' },
            { name: 'chairman',        level: 70,  description: 'Chairman / Director' },
            { name: 'storage_manager', level: 50,  description: 'Storage Manager' },
            { name: 'cluster_manager', level: 40,  description: 'Cluster / Branch Manager' },
            { name: 'user',            level: 10,  description: 'Standard User' },
        ];
        const roleMap = {};
        for (const r of rolesData) {
            const [role] = await Role.findOrCreate({
                where: { name: r.name, company_id: company.id },
                defaults: { ...r, company_id: company.id }
            });
            roleMap[r.name] = role;
        }
        console.log(`✅ Roles seeded: ${Object.keys(roleMap).join(', ')}`);

        // 3. Create organization type
        const [orgType] = await OrganizationType.findOrCreate({
            where: { name: 'Headquarters', company_id: company.id },
            defaults: {
                company_id: company.id,
                name: 'Headquarters',
                level_order: 1,
                can_have_inventory: true,
                can_have_users: true,
                is_active: true
            }
        });
        console.log(`✅ OrgType: ${orgType.name} (ID: ${orgType.id})`);

        // 4. Create root organization node
        const [rootNode] = await OrganizationNode.findOrCreate({
            where: { name: 'Main HQ', company_id: company.id },
            defaults: {
                company_id: company.id,
                org_type_id: orgType.id,
                name: 'Main HQ',
                code: 'HQ-001',
                parent_id: null,
                path: null,   // will be set after create
                can_store_inventory: true,
                is_active: true
            }
        });
        // Update path using materialized path pattern
        if (!rootNode.path) {
            await rootNode.update({ path: `/${rootNode.id}/` });
        }
        console.log(`✅ Root Node: ${rootNode.name} (ID: ${rootNode.id}, path: ${rootNode.path})`);

        // 5. Seed permissions
        const permissionsData = [
            // User management
            { name: 'user:create', description: 'Create users' },
            { name: 'user:read', description: 'Read users' },
            { name: 'user:update', description: 'Update users' },
            { name: 'user:delete', description: 'Delete users' },
            // Product management
            { name: 'product:create', description: 'Create products' },
            { name: 'product:read', description: 'Read products' },
            { name: 'product:update', description: 'Update products' },
            { name: 'product:delete', description: 'Delete products' },
            // Inventory
            { name: 'inventory:read', description: 'View inventory' },
            { name: 'inventory:adjust', description: 'Adjust inventory' },
            { name: 'inventory:transfer', description: 'Transfer inventory' },
            // Requests
            { name: 'request:create', description: 'Create requests' },
            { name: 'request:read', description: 'Read requests' },
            { name: 'request:approve_chairman', description: 'Chairman approval' },
            { name: 'request:approve_storage', description: 'Storage approval' },
            // Reports
            { name: 'report:read', description: 'View reports' },
            // Organization
            { name: 'org:manage', description: 'Manage organization structure' },
        ];
        for (const p of permissionsData) {
            const [resource, action] = p.name.split(':');
            await Permission.findOrCreate({ 
                where: { name: p.name }, 
                defaults: { ...p, resource, action } 
            });
        }
        console.log(`✅ Permissions seeded: ${permissionsData.length} permissions`);

        // 6. Create super admin user
        const passwordHash = await bcrypt.hash('admin123', 10);
        const [superAdmin, created] = await User.findOrCreate({
            where: { email: 'admin@airms.com' },
            defaults: {
                employee_id: 'SA-001',
                first_name: 'Super',
                last_name: 'Admin',
                email: 'admin@airms.com',
                password_hash: passwordHash,
                company_id: company.id,
                role_id: roleMap['super_admin'].id,
                org_node_id: rootNode.id,
                is_active: true,
                requires_password_change: false
            }
        });
        console.log(`\n✅ Super Admin ${created ? 'created' : 'already exists'}: ${superAdmin.email}`);
        console.log('─────────────────────────────────');
        console.log('  Email:    admin@airms.com');
        console.log('  Password: admin123');
        console.log('─────────────────────────────────\n');

        process.exit(0);
    } catch (err) {
        console.error('\n❌ Seed failed:', err.message);
        if (err.original) console.error('   DB Error:', err.original.message);
        console.error(err.stack);
        process.exit(1);
    }
}

seedFresh();
