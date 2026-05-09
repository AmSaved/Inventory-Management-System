const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('airms_dev', 'postgres', '286042', {
  host: 'localhost',
  dialect: 'postgres',
  logging: false
});

async function grantPermission() {
  try {
    const [roles] = await sequelize.query("SELECT id FROM roles WHERE name IN ('storage_manager', 'STORAGE_MANAGER')");
    if (roles.length === 0) {
      console.log('Role storage_manager not found');
      return;
    }
    const roleId = roles[0].id;

    const [perms] = await sequelize.query("SELECT id FROM permissions WHERE name = 'product:create'");
    let permId;
    if (perms.length === 0) {
      const [newPerm] = await sequelize.query("INSERT INTO permissions (name, description, created_at, updated_at) VALUES ('product:create', 'Can create new products in catalog', NOW(), NOW()) RETURNING id");
      permId = newPerm[0].id;
    } else {
      permId = perms[0].id;
    }

    await sequelize.query("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?) ON CONFLICT DO NOTHING", {
      replacements: [roleId, permId]
    });

    console.log('✅ product:create permission granted to Storage Manager (Role ID: ' + roleId + ')');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to grant permission:', error.message);
    process.exit(1);
  }
}

grantPermission();
