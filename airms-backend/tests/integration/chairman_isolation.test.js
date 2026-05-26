require('dotenv').config();
const request = require('supertest');
const app = require('../../src/app');
const { 
  Request, 
  User, 
  Role, 
  Company, 
  OrganizationType, 
  OrganizationNode, 
  Workflow, 
  WorkflowStep, 
  WorkflowRoute, 
  sequelize 
} = require('../../src/models');
const { generateToken } = require('../../src/utils/helpers');

// Mock notification service
jest.mock('../../src/services/notificationService', () => ({
  notifyChairman: jest.fn().mockResolvedValue([]),
  notifyStorageManager: jest.fn().mockResolvedValue([]),
  notifyUser: jest.fn().mockResolvedValue({}),
  notifyRole: jest.fn().mockResolvedValue([]),
  notifyBranch: jest.fn().mockResolvedValue([])
}));

jest.setTimeout(60000);

describe('Chairman Departmental Isolation Integration Tests', () => {
  let userA, chairmanA, chairmanB;
  let tokenUserA, tokenChairmanA, tokenChairmanB;
  let deptA, deptB;
  let company, orgType;
  let userRole, chairmanRole;
  let workflow, step1;

  beforeAll(async () => {
    await sequelize.authenticate();

    // 1. Setup Company
    company = await Company.findOne({ where: { name: 'Chairman Isolation Test Company' } }) 
        || await Company.create({ name: 'Chairman Isolation Test Company' });

    // 2. Setup Hierarchy
    orgType = await OrganizationType.findOne({ where: { company_id: company.id } }) 
        || await OrganizationType.create({ name: 'Department Type', code: 'CI_DT', company_id: company.id });
    
    deptA = await OrganizationNode.findOne({ where: { name: 'Dept A', company_id: company.id } })
        || await OrganizationNode.create({ name: 'Dept A', code: 'DA01', company_id: company.id, org_type_id: orgType.id });
    await deptA.update({ path: `/${deptA.id}/` });

    deptB = await OrganizationNode.findOne({ where: { name: 'Dept B', company_id: company.id } })
        || await OrganizationNode.create({ name: 'Dept B', code: 'DB01', company_id: company.id, org_type_id: orgType.id });
    await deptB.update({ path: `/${deptB.id}/` });

    // 3. Setup Roles
    userRole = await Role.findOne({ where: { name: 'user_ci_role', company_id: company.id } })
        || await Role.create({ name: 'user_ci_role', level: 20, company_id: company.id });
    chairmanRole = await Role.findOne({ where: { name: 'chairman_ci_role', company_id: company.id } })
        || await Role.create({ name: 'chairman_ci_role', level: 80, company_id: company.id });

    // 4. Setup Users
    const rand = Math.floor(Math.random() * 10000);
    userA = await User.create({ 
      first_name: 'User', last_name: 'A', email: `usera_${rand}@test.com`, 
      password_hash: 'password123!', employee_id: `UA_${rand}`, 
      role_id: userRole.id, company_id: company.id, org_node_id: deptA.id 
    });
    tokenUserA = generateToken({ id: userA.id, role_id: userA.role_id, company_id: userA.company_id, org_node_id: userA.org_node_id });

    chairmanA = await User.create({ 
      first_name: 'Chairman', last_name: 'A', email: `chairmana_${rand}@test.com`, 
      password_hash: 'password123!', employee_id: `CA_${rand}`, 
      role_id: chairmanRole.id, company_id: company.id, org_node_id: deptA.id 
    });
    tokenChairmanA = generateToken({ id: chairmanA.id, role_id: chairmanA.role_id, company_id: chairmanA.company_id, org_node_id: chairmanA.org_node_id });

    chairmanB = await User.create({ 
      first_name: 'Chairman', last_name: 'B', email: `chairmanb_${rand}@test.com`, 
      password_hash: 'password123!', employee_id: `CB_${rand}`, 
      role_id: chairmanRole.id, company_id: company.id, org_node_id: deptB.id 
    });
    tokenChairmanB = generateToken({ id: chairmanB.id, role_id: chairmanB.role_id, company_id: chairmanB.company_id, org_node_id: chairmanB.org_node_id });

    // 5. Setup dynamic workflow for request
    workflow = await Workflow.create({
      company_id: company.id,
      org_node_id: deptA.id,
      name: 'Chairman Isolation Workflow',
      resource_type: 'request',
      created_by: userA.id
    });

    step1 = await WorkflowStep.create({
      workflow_id: workflow.id,
      step_order: 1,
      required_role_id: chairmanRole.id,
      action_name: 'approve',
      status_label_override: 'pending_chairman'
    });

    await WorkflowRoute.create({
      workflow_id: workflow.id,
      source_step_id: null,
      target_step_id: step1.id,
      action_trigger: 'approve'
    });
  });

  afterAll(async () => {
    // Cleanup in correct dependency order
    if (workflow) {
      await WorkflowRoute.destroy({ where: { workflow_id: workflow.id } });
      await WorkflowStep.destroy({ where: { workflow_id: workflow.id } });
      await workflow.destroy();
    }

    await Request.destroy({ where: { company_id: company.id } });

    if (userA) await User.destroy({ where: { id: userA.id } });
    if (chairmanA) await User.destroy({ where: { id: chairmanA.id } });
    if (chairmanB) await User.destroy({ where: { id: chairmanB.id } });

    if (userRole) await Role.destroy({ where: { id: userRole.id } });
    if (chairmanRole) await Role.destroy({ where: { id: chairmanRole.id } });

    if (deptA) await OrganizationNode.destroy({ where: { id: deptA.id } });
    if (deptB) await OrganizationNode.destroy({ where: { id: deptB.id } });
  });

  test('Chairman A should see requests from User A (same department)', async () => {
    // Create request as User A
    const reqRes = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        purpose: 'Test request',
        items: []
      });
    
    expect(reqRes.status).toBe(201);
    const requestId = reqRes.body.data.id;

    // Chairman A checks pending approvals
    const listRes = await request(app)
      .get('/api/requests/pending-approvals')
      .set('Authorization', `Bearer ${tokenChairmanA}`);
    
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some(r => r.id === requestId)).toBe(true);
  });

  test('Chairman B should NOT see requests from User A (different department)', async () => {
    // Chairman B checks pending approvals
    const listRes = await request(app)
      .get('/api/requests/pending-approvals')
      .set('Authorization', `Bearer ${tokenChairmanB}`);
    
    expect(listRes.status).toBe(200);
    // Should NOT find the request from User A
    expect(listRes.body.data.some(r => r.requester.id === userA.id)).toBe(false);
  });

  test('Chairman B should NOT be able to approve request from User A', async () => {
    const reqs = await Request.findAll({ where: { requester_id: userA.id } });
    const requestId = reqs[0].id;

    const approveRes = await request(app)
      .post(`/api/requests/${requestId}/workflow-action`)
      .set('Authorization', `Bearer ${tokenChairmanB}`)
      .send({ action: 'approve', comments: 'Stealing approval' });
    
    expect(approveRes.status).toBe(403);
    expect(approveRes.body.message).toMatch(/Authorization Failure/);
  });

  test('Chairman A SHOULD be able to approve request from User A', async () => {
    const reqs = await Request.findAll({ where: { requester_id: userA.id } });
    const requestId = reqs[0].id;

    const approveRes = await request(app)
      .post(`/api/requests/${requestId}/workflow-action`)
      .set('Authorization', `Bearer ${tokenChairmanA}`)
      .send({ action: 'approve', comments: 'Valid approval' });
    
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('pending_acknowledgment');
  });
});
