require('dotenv').config();
const request = require('supertest');
const app = require('../../src/app');
const { 
  Request, 
  RequestItem, 
  User, 
  Product, 
  Company, 
  OrganizationType, 
  OrganizationNode, 
  Inventory, 
  Role, 
  Permission,
  RolePermission,
  Workflow, 
  WorkflowStep, 
  WorkflowRoute,
  sequelize 
} = require('../../src/models');
const { generateToken } = require('../../src/utils/helpers');

describe('Request Lifecycle Integration Tests', () => {
  let userToken, chairmanToken, storageManagerToken;
  let productId, orgNodeId;
  let company, orgType, orgNode;
  let userRole, chairmanRole, storageManagerRole;
  let workflow, step1, step2;
  let testUser, testChairman, testStorageManager, testProduct;

  beforeAll(async () => {
    await sequelize.authenticate();

    // 1. Setup Company
    company = await Company.findOne({ where: { name: 'Request Lifecycle Test Company' } }) 
        || await Company.create({ name: 'Request Lifecycle Test Company' });

    // 2. Setup Hierarchy
    orgType = await OrganizationType.findOne({ where: { company_id: company.id } }) 
        || await OrganizationType.create({ name: 'Test Branch Type', code: 'RL_TBT', company_id: company.id });
    orgNode = await OrganizationNode.findOne({ where: { company_id: company.id } })
        || await OrganizationNode.create({ name: 'Test Node', code: 'RL_TN', company_id: company.id, org_type_id: orgType.id, can_store_inventory: true });
    orgNodeId = orgNode.id;

    // 3. Setup Roles
    userRole = await Role.findOne({ where: { name: 'user_rl_role', company_id: company.id } })
        || await Role.create({ name: 'user_rl_role', level: 20, company_id: company.id });
    chairmanRole = await Role.findOne({ where: { name: 'chairman_rl_role', company_id: company.id } })
        || await Role.create({ name: 'chairman_rl_role', level: 80, company_id: company.id });
    storageManagerRole = await Role.findOne({ where: { name: 'storage_rl_role', company_id: company.id } })
        || await Role.create({ name: 'storage_rl_role', level: 80, company_id: company.id });

    // 3b. Setup Permissions & Role Associations
    const [permCreateRequest] = await Permission.findOrCreate({ where: { name: 'request:create', description: 'Create request' } });
    const [permReadRequest] = await Permission.findOrCreate({ where: { name: 'request:read', description: 'Read request' } });
    const [permUpdateRequest] = await Permission.findOrCreate({ where: { name: 'request:update', description: 'Update request' } });
    const [permApproveRequest] = await Permission.findOrCreate({ where: { name: 'request:approve', description: 'Approve request' } });
    const [permCreateDischarge] = await Permission.findOrCreate({ where: { name: 'discharge:create', description: 'Create discharge' } });
    const [permStockDischarge] = await Permission.findOrCreate({ where: { name: 'stock:discharge', description: 'Discharge stock' } });

    await RolePermission.findOrCreate({ where: { role_id: userRole.id, permission_id: permCreateRequest.id } });
    await RolePermission.findOrCreate({ where: { role_id: userRole.id, permission_id: permReadRequest.id } });

    await RolePermission.findOrCreate({ where: { role_id: chairmanRole.id, permission_id: permReadRequest.id } });
    await RolePermission.findOrCreate({ where: { role_id: chairmanRole.id, permission_id: permApproveRequest.id } });
    await RolePermission.findOrCreate({ where: { role_id: chairmanRole.id, permission_id: permUpdateRequest.id } });

    await RolePermission.findOrCreate({ where: { role_id: storageManagerRole.id, permission_id: permReadRequest.id } });
    await RolePermission.findOrCreate({ where: { role_id: storageManagerRole.id, permission_id: permApproveRequest.id } });
    await RolePermission.findOrCreate({ where: { role_id: storageManagerRole.id, permission_id: permUpdateRequest.id } });
    await RolePermission.findOrCreate({ where: { role_id: storageManagerRole.id, permission_id: permCreateDischarge.id } });
    await RolePermission.findOrCreate({ where: { role_id: storageManagerRole.id, permission_id: permStockDischarge.id } });

    // 4. Setup Product
    const rand = Math.floor(Math.random() * 10000);
    testProduct = await Product.create({ name: `Test Laptop ${rand}`, sku: `LAP-${rand}`, category: 'IT', company_id: company.id });
    productId = testProduct.id;

    // 5. Setup Users
    testUser = await User.create({ 
      first_name: 'Tester', last_name: 'User', email: `user_${rand}@test.com`, 
      password_hash: 'password123!', employee_id: `U_${rand}`, 
      role_id: userRole.id, company_id: company.id, org_node_id: orgNodeId 
    });
    userToken = generateToken({ id: testUser.id, role_id: testUser.role_id, company_id: testUser.company_id, org_node_id: testUser.org_node_id });

    testChairman = await User.create({ 
      first_name: 'Chairman', last_name: 'Approve', email: `chairman_${rand}@test.com`, 
      password_hash: 'password123!', employee_id: `C_${rand}`, 
      role_id: chairmanRole.id, company_id: company.id, org_node_id: orgNodeId 
    });
    chairmanToken = generateToken({ id: testChairman.id, role_id: testChairman.role_id, company_id: testChairman.company_id, org_node_id: testChairman.org_node_id });

    testStorageManager = await User.create({ 
      first_name: 'Storage', last_name: 'Manager', email: `storage_${rand}@test.com`, 
      password_hash: 'password123!', employee_id: `S_${rand}`, 
      role_id: storageManagerRole.id, company_id: company.id, org_node_id: orgNodeId 
    });
    storageManagerToken = generateToken({ id: testStorageManager.id, role_id: testStorageManager.role_id, company_id: testStorageManager.company_id, org_node_id: testStorageManager.org_node_id });

    // 6. Setup Inventory
    await Inventory.create({ company_id: company.id, org_node_id: orgNodeId, product_id: productId, quantity: 10 });

    // 7. Setup Dynamic Workflow for Requests
    workflow = await Workflow.create({
      company_id: company.id,
      org_node_id: orgNodeId,
      name: 'Test Request Workflow',
      resource_type: 'request',
      created_by: testUser.id
    });

    step1 = await WorkflowStep.create({
      workflow_id: workflow.id,
      step_order: 1,
      required_role_id: chairmanRole.id,
      action_name: 'approve',
      status_label_override: 'pending_chairman'
    });

    step2 = await WorkflowStep.create({
      workflow_id: workflow.id,
      step_order: 2,
      required_role_id: storageManagerRole.id,
      action_name: 'approve',
      status_label_override: 'pending_storage'
    });

    // Create routes
    await WorkflowRoute.create({
      workflow_id: workflow.id,
      source_step_id: null,
      target_step_id: step1.id,
      action_trigger: 'approve'
    });

    await WorkflowRoute.create({
      workflow_id: workflow.id,
      source_step_id: step1.id,
      target_step_id: step2.id,
      action_trigger: 'approve'
    });
  });

  afterAll(async () => {
    // Cleanup in correct order to avoid foreign key violations
    if (workflow) {
      await WorkflowRoute.destroy({ where: { workflow_id: workflow.id } });
      await WorkflowStep.destroy({ where: { workflow_id: workflow.id } });
      await workflow.destroy();
    }
    
    await RequestItem.destroy({ where: {} });
    await Request.destroy({ where: { company_id: company.id } });
    await Inventory.destroy({ where: { company_id: company.id } });

    await RolePermission.destroy({ where: { role_id: [userRole.id, chairmanRole.id, storageManagerRole.id] } });

    if (testUser) await User.destroy({ where: { id: testUser.id } });
    if (testChairman) await User.destroy({ where: { id: testChairman.id } });
    if (testStorageManager) await User.destroy({ where: { id: testStorageManager.id } });

    if (userRole) await Role.destroy({ where: { id: userRole.id } });
    if (chairmanRole) await Role.destroy({ where: { id: chairmanRole.id } });
    if (storageManagerRole) await Role.destroy({ where: { id: storageManagerRole.id } });

    if (testProduct) await Product.destroy({ where: { id: testProduct.id } });
  });

  test('Full Request Workflow: Create -> Chairman Approve -> Storage Manager Approve -> Discharge', async () => {
    // 1. Create Request (User)
    const createRes = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        purpose: 'Need laptop for work',
        items: [{ product_id: productId, quantity_requested: 1 }]
      });
    
    expect(createRes.status).toBe(201);
    const requestId = createRes.body.data.id;
    expect(createRes.body.data.status).toBe('pending');
    expect(createRes.body.data.workflow_status).toBe('pending_chairman');

    // 2. Chairman Approval
    const chairmanRes = await request(app)
      .post(`/api/requests/${requestId}/workflow-action`)
      .set('Authorization', `Bearer ${chairmanToken}`)
      .send({ action: 'approve', comments: 'Approved by chairman' });
    
    expect(chairmanRes.status).toBe(200);
    const updatedReq1 = await Request.findByPk(requestId);
    expect(updatedReq1.status).toBe('pending');
    expect(updatedReq1.workflow_status).toBe('pending_storage');

    // 3. Storage Manager Approval
    const storageRes = await request(app)
      .post(`/api/requests/${requestId}/workflow-action`)
      .set('Authorization', `Bearer ${storageManagerToken}`)
      .send({ action: 'approve', comments: 'Inventory available' });
    
    expect(storageRes.status).toBe(200);
    const updatedReq2 = await Request.findByPk(requestId);
    expect(updatedReq2.status).toBe('pending_acknowledgment');
    expect(updatedReq2.workflow_status).toBe('Pending Receipt Acknowledgment');

    // 4. Discharge (Storage Manager)
    const dischargeRes = await request(app)
      .post('/api/discharge')
      .set('Authorization', `Bearer ${storageManagerToken}`)
      .send({
        request_id: requestId,
        discharge_type: 'user',
        from_node_id: orgNodeId,
        to_user_id: testUser.id,
        items: [{ product_id: productId, quantity: 1 }]
      });
    
    expect(dischargeRes.status).toBe(201);
    const updatedReq3 = await Request.findByPk(requestId);
    expect(updatedReq3.status).toBe('fulfilled');
  });
});
