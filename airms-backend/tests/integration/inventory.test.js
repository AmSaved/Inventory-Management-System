require('dotenv').config();
const request = require('supertest');
const app = require('../../src/app');
const { 
  Product, 
  Inventory, 
  OrganizationNode, 
  User, 
  StoreForm, 
  StoreItem, 
  Role, 
  ActivityLog, 
  UserNode, 
  UserRole, 
  UserPermission, 
  sequelize 
} = require('../../src/models');
const { generateToken } = require('../../src/utils/helpers');

jest.setTimeout(30000);

describe('Serial Number Uniqueness Validation Tests', () => {
  let tokenAdmin;
  let companyId = 1;
  let orgNodeId;
  let product1, product2;
  let adminUser;
  let adminRole;
  let customRoleCreated = false;

  beforeAll(async () => {
    await sequelize.authenticate();

    // Find or create test node
    const node = await OrganizationNode.findOne({ where: { company_id: companyId, can_store_inventory: true } }) 
      || await OrganizationNode.create({ name: 'Test Node', code: 'TN01', company_id: companyId, can_store_inventory: true });
    orgNodeId = node.id;

    // Create unique product blueprints for testing
    const rand = Math.floor(Math.random() * 10000);
    product1 = await Product.create({ name: `Test Prod 1 ${rand}`, sku: `TP1-${rand}`, company_id: companyId });
    product2 = await Product.create({ name: `Test Prod 2 ${rand}`, sku: `TP2-${rand}`, company_id: companyId });

    // Dynamic Role resolution: find or create 'Admin' role
    adminRole = await Role.findOne({ where: { name: 'Admin', company_id: companyId } })
      || await Role.findOne({ where: { name: 'admin', company_id: companyId } });
    if (!adminRole) {
      adminRole = await Role.create({ name: 'Admin', company_id: companyId });
      customRoleCreated = true;
    }

    // Admin user to execute request
    adminUser = await User.create({ 
      first_name: 'Store', last_name: 'Admin', email: `admin-${rand}@test.com`, 
      password_hash: 'password123!', employee_id: `ADM-${rand}`, 
      role_id: adminRole.id, company_id: companyId, org_node_id: orgNodeId
    });
    tokenAdmin = generateToken({ id: adminUser.id, role_id: adminUser.role_id, company_id: adminUser.company_id, org_node_id: adminUser.org_node_id });
  });

  afterAll(async () => {
    // Cleanup
    if (adminUser) {
      const forms = await StoreForm.findAll({ where: { created_by: adminUser.id } });
      const formIds = forms.map(f => f.id);
      if (formIds.length > 0) {
        await StoreItem.destroy({ where: { store_form_id: formIds } });
        await StoreForm.destroy({ where: { id: formIds } });
      }
    }

    const productIds = [];
    if (product1) productIds.push(product1.id);
    if (product2) productIds.push(product2.id);
    if (productIds.length > 0) {
      await Inventory.destroy({ where: { product_id: productIds } });
    }

    if (product1) await Product.destroy({ where: { id: product1.id } });
    if (product2) await Product.destroy({ where: { id: product2.id } });
    
    if (adminUser) {
      // Clear associated activity logs and join tables to prevent constraint violations
      await ActivityLog.destroy({ where: { user_id: adminUser.id } });
      await UserNode.destroy({ where: { user_id: adminUser.id } });
      await UserRole.destroy({ where: { user_id: adminUser.id } });
      await UserPermission.destroy({ where: { user_id: adminUser.id } });
      await User.destroy({ where: { id: adminUser.id } });
    }

    if (customRoleCreated && adminRole) {
      await Role.destroy({ where: { id: adminRole.id } });
    }
  });

  test('Direct single manual intake should enforce serial validation', async () => {
    const serial = `SN-${Date.now()}-1`;

    // First manual intake
    const res1 = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        product_id: product1.id,
        org_node_id: orgNodeId,
        branch_id: orgNodeId, // Satisfies createInventoryValidation
        quantity: 1,
        serial_number: serial
      });
    expect(res1.status).toBe(201);

    // Second manual intake of the same serial for the same product name
    const res2 = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        product_id: product1.id,
        org_node_id: orgNodeId,
        branch_id: orgNodeId, // Satisfies createInventoryValidation
        quantity: 1,
        serial_number: serial
      });
    expect(res2.status).toBe(400);
    expect(res2.body.message).toContain('this item is already exist');
  });

  test('Bulk store intake should store new items and skip duplicates', async () => {
    const serialDup = `SN-${Date.now()}-DUP`;
    const serialNew = `SN-${Date.now()}-NEW`;

    // 1. Manually insert the duplicate serial
    await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        product_id: product1.id,
        org_node_id: orgNodeId,
        branch_id: orgNodeId, // Satisfies createInventoryValidation
        quantity: 1,
        serial_number: serialDup
      });

    // 2. Perform bulk store intake with 1 duplicate and 1 new item
    const resStore = await request(app)
      .post('/api/store')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        org_node_id: orgNodeId,
        branch_id: orgNodeId,
        supplier: 'Test Supplier',
        items: [
          {
            product_id: product1.id,
            quantity: 1,
            serial_number: serialDup
          },
          {
            product_id: product1.id,
            quantity: 1,
            serial_number: serialNew
          }
        ]
      });

    expect(resStore.status).toBe(201);
    expect(resStore.body.message).toContain('Warning');
    expect(resStore.body.message).toContain('this item is already exist');

    // Verify only the new serial is actively stored now
    const activeInventory = await Inventory.findAll({
      where: {
        company_id: companyId,
        product_id: product1.id,
        serial_number: serialNew,
        quantity: { [sequelize.Sequelize.Op.gt]: 0 }
      }
    });
    expect(activeInventory.length).toBe(1);
  });

  test('Bulk store intake with only duplicates should fail with 400 Bad Request', async () => {
    const serialDup = `SN-${Date.now()}-DUP-ONLY`;

    // 1. Manually insert the duplicate serial
    await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        product_id: product1.id,
        org_node_id: orgNodeId,
        branch_id: orgNodeId, // Satisfies createInventoryValidation
        quantity: 1,
        serial_number: serialDup
      });

    // 2. Perform bulk store intake with only duplicates
    const resStore = await request(app)
      .post('/api/store')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        org_node_id: orgNodeId,
        branch_id: orgNodeId,
        supplier: 'Test Supplier',
        items: [
          {
            product_id: product1.id,
            quantity: 1,
            serial_number: serialDup
          }
        ]
      });

    expect(resStore.status).toBe(400);
    expect(resStore.body.message).toContain('All items already exist');
    expect(resStore.body.message).toContain('this item is already exist');
  });
});
