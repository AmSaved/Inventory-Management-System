const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('airms_dev', 'postgres', '286042', {
  host: 'localhost',
  dialect: 'postgres',
  logging: false
});

async function grantPermission() {
  try {
    // 1. Get role
    const [roles] = await sequelize.query("SELECT id FROM roles WHERE name IN ('storage_manager', 'STORAGE_MANAGER')");
    if (roles.length === 0) throw new Error('Role storage_manager not found');
    const roleId = roles[0].id;

    // 2. Get/Create permission
    const [perms] = await sequelize.query("SELECT id FROM permissions WHERE name = 'product:create'");
    let permId;
    if (perms.length === 0) {
      const [newPerm] = await sequelize.query("INSERT INTO permissions (name, description, created_at, updated_at) VALUES ('product:create', 'Can create new products in catalog', NOW(), NOW()) RETURNING id");
      permId = newPerm[0].id;
    } else {
      permId = perms[0].id;
    }

    // 3. Discover columns of role_permissions
    const [cols] = await sequelize.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'role_permissions'");
    const columnNames = cols.map(c => c.column_name);
    console.log('Detected columns in role_permissions:', columnNames);

    // 4. Build Dynamically
    let query = `INSERT INTO role_permissions (role_id, permission_id`;
    let values = `VALUES (${roleId}, ${permId}`;
    
    if (columnNames.includes('createdAt')) {
        query += `, "createdAt"`;
        values += `, NOW()`;
    } else if (columnNames.includes('created_at')) {
        query += `, created_at`;
        values += `, NOW()`;
    }

    if (columnNames.includes('updatedAt')) {
        query += `, "updatedAt"`;
        values += `, NOW()`;
    } else if (columnNames.includes('updated_at')) {
        query += `, updated_at`;
        values += `, NOW()`;
    }

    query += `) ${values}) ON CONFLICT DO NOTHING`;
    
    console.log('Executing query:', query);
    await sequelize.query(query);

    console.log('✅ product:create permission granted successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }
}

grantPermission();
