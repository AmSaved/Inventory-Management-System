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
  DischargeForm,
  DischargeItem,
  Assignment,
  Approval,
  ActivityLog,
  UserRole,
  UserNode,
  UserPermission,
  Return,
  ReturnItem,
  Transfer,
  TransferItem,
  Issue,
  StoreForm,
  StoreItem,
  WorkflowStatus,
  FormTemplate,
  sequelize 
} = require('../../src/models');
const { generateToken } = require('../../src/utils/helpers');

async function cleanupCompanyData(companyName) {
  const company = await Company.findOne({ where: { name: companyName } });
  if (!company) return;

  const companyId = company.id;

  await ActivityLog.destroy({ where: { company_id: companyId } });
  await Issue.destroy({ where: { company_id: companyId } });
  
  const returns = await Return.findAll({ where: { company_id: companyId }, attributes: ['id'] });
  const returnIds = returns.map(r => r.id);
  if (returnIds.length > 0) {
    await ReturnItem.destroy({ where: { return_id: returnIds } });
  }
  await Return.destroy({ where: { company_id: companyId } });

  const transfers = await Transfer.findAll({ where: { company_id: companyId }, attributes: ['id'] });
  const transferIds = transfers.map(t => t.id);
  if (transferIds.length > 0) {
    await TransferItem.destroy({ where: { transfer_id: transferIds } });
  }
  await Transfer.destroy({ where: { company_id: companyId } });

  await Assignment.destroy({ where: { company_id: companyId } });

  const dischargeForms = await DischargeForm.findAll({ where: { company_id: companyId }, attributes: ['id'] });
  const dischargeFormIds = dischargeForms.map(df => df.id);
  if (dischargeFormIds.length > 0) {
    await DischargeItem.destroy({ where: { discharge_form_id: dischargeFormIds } });
  }
  await DischargeForm.destroy({ where: { company_id: companyId } });

  const storeForms = await StoreForm.findAll({ where: { company_id: companyId }, attributes: ['id'] });
  const storeFormIds = storeForms.map(sf => sf.id);
  if (storeFormIds.length > 0) {
    await StoreItem.destroy({ where: { store_form_id: storeFormIds } });
  }
  await StoreForm.destroy({ where: { company_id: companyId } });

  const requests = await Request.findAll({ where: { company_id: companyId }, attributes: ['id'] });
  const requestIds = requests.map(r => r.id);
  if (requestIds.length > 0) {
    await RequestItem.destroy({ where: { request_id: requestIds } });
    await Approval.destroy({ where: { request_id: requestIds } });
  }
  await Request.destroy({ where: { company_id: companyId } });

  await Inventory.destroy({ where: { company_id: companyId } });

  const workflows = await Workflow.findAll({ where: { company_id: companyId }, attributes: ['id'] });
  const workflowIds = workflows.map(w => w.id);
  if (workflowIds.length > 0) {
    await WorkflowRoute.destroy({ where: { workflow_id: workflowIds } });
    await WorkflowStep.destroy({ where: { workflow_id: workflowIds } });
  }
  await Workflow.destroy({ where: { company_id: companyId } });
  await WorkflowStatus.destroy({ where: { company_id: companyId } });

  const users = await User.findAll({ where: { company_id: companyId }, attributes: ['id'] });
  const userIds = users.map(u => u.id);
  if (userIds.length > 0) {
    await UserRole.destroy({ where: { user_id: userIds } });
    await UserNode.destroy({ where: { user_id: userIds } });
    await UserPermission.destroy({ where: { user_id: userIds } });
  }
  await User.destroy({ where: { company_id: companyId } });

  const roles = await Role.findAll({ where: { company_id: companyId }, attributes: ['id'] });
  const roleIds = roles.map(r => r.id);
  if (roleIds.length > 0) {
    await RolePermission.destroy({ where: { role_id: roleIds } });
  }
  await Role.destroy({ where: { company_id: companyId } });

  await FormTemplate.destroy({ where: { company_id: companyId } });
  await Product.destroy({ where: { company_id: companyId } });
  await OrganizationNode.destroy({ where: { company_id: companyId } });
  await OrganizationType.destroy({ where: { company_id: companyId } });

  await Company.destroy({ where: { id: companyId } });
}


describe('Request Lifecycle Integration Tests', () => {
  let userToken, chairmanToken, storageManagerToken;
  let productId, orgNodeId;
  let company, orgType, orgNode;
  let userRole, chairmanRole, storageManagerRole;
  let workflow, step1, step2;
  let testUser, testChairman, testStorageManager, testProduct;

  beforeAll(async () => {
    await sequelize.authenticate();
    await cleanupCompanyData('Request Lifecycle Test Company');

    // 1. Setup Company
    company = await Company.create({ name: 'Request Lifecycle Test Company' });

    // 2. Setup Hierarchy
    orgType = await OrganizationType.create({ name: 'Test Branch Type', code: 'RL_TBT', company_id: company.id });
    orgNode = await OrganizationNode.create({ name: 'Test Node', code: 'RL_TN', company_id: company.id, org_type_id: orgType.id, can_store_inventory: true });
    await orgNode.update({ path: `/${orgNode.id}/` });
    orgNodeId = orgNode.id;

    // 3. Setup Roles
    userRole = await Role.create({ name: 'user_rl_role', level: 20, company_id: company.id });
    chairmanRole = await Role.create({ name: 'chairman_rl_role', level: 80, company_id: company.id });
    storageManagerRole = await Role.create({ name: 'storage_rl_role', level: 80, company_id: company.id });

    // 3b. Setup Permissions & Role Associations
    const [permCreateRequest] = await Permission.findOrCreate({
      where: { name: 'request:create' },
      defaults: { description: 'Create request', resource: 'request', action: 'create' }
    });
    const [permReadRequest] = await Permission.findOrCreate({
      where: { name: 'request:read' },
      defaults: { description: 'Read request', resource: 'request', action: 'read' }
    });
    const [permUpdateRequest] = await Permission.findOrCreate({
      where: { name: 'request:update' },
      defaults: { description: 'Update request', resource: 'request', action: 'update' }
    });
    const [permApproveRequest] = await Permission.findOrCreate({
      where: { name: 'request:approve' },
      defaults: { description: 'Approve request', resource: 'request', action: 'approve' }
    });
    const [permCreateDischarge] = await Permission.findOrCreate({
      where: { name: 'discharge:create' },
      defaults: { description: 'Create discharge', resource: 'discharge', action: 'create' }
    });
    const [permStockDischarge] = await Permission.findOrCreate({
      where: { name: 'stock:discharge' },
      defaults: { description: 'Discharge stock', resource: 'stock', action: 'discharge' }
    });

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
    await cleanupCompanyData('Request Lifecycle Test Company');
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
