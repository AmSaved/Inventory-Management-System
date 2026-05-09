require('dotenv').config();
const request = require('supertest');
const app = require('../../src/app');
const { Request, User, Department, Role, Branch, sequelize } = require('../../src/models');
const { generateToken } = require('../../src/utils/helpers');
const notificationService = require('../../src/services/notificationService');

// Mock notification service as the model is missing in the codebase
jest.mock('../../src/services/notificationService', () => ({
  notifyChairman: jest.fn().mockResolvedValue([]),
  notifyStorageManager: jest.fn().mockResolvedValue([]),
  notifyUser: jest.fn().mockResolvedValue({}),
  notifyRole: jest.fn().mockResolvedValue([]),
  notifyBranch: jest.fn().mockResolvedValue([])
}));

jest.setTimeout(60000);

describe('Chairman Departmental Isolation Integration Tests', () => {
  let userA, userB, chairmanA, chairmanB;
  let tokenUserA, tokenChairmanA, tokenChairmanB;
  let deptA, deptB;
  let branch;

  beforeAll(async () => {
    // Setup test data
    await sequelize.authenticate();

    // Setup test data
    branch = await Branch.findOne() || await Branch.create({ name: 'Test Branch', code: 'TB01' });

    deptA = await Department.create({ name: 'Dept A', code: 'DA01' });
    deptB = await Department.create({ name: 'Dept B', code: 'DB01' });

    userA = await User.create({ 
      first_name: 'User', last_name: 'A', email: 'usera@test.com', 
      password_hash: 'password123!', employee_id: 'UA01', 
      role_id: 5, branch_id: branch.id, department_id: deptA.id 
    });
    tokenUserA = generateToken({ id: userA.id, role_id: userA.role_id, department_id: userA.department_id, branch_id: userA.branch_id });

    chairmanA = await User.create({ 
      first_name: 'Chairman', last_name: 'A', email: 'chairmana@test.com', 
      password_hash: 'password123!', employee_id: 'CA01', 
      role_id: 2, branch_id: branch.id, department_id: deptA.id 
    });
    tokenChairmanA = generateToken({ id: chairmanA.id, role_id: chairmanA.role_id, department_id: chairmanA.department_id, branch_id: chairmanA.branch_id });

    chairmanB = await User.create({ 
      first_name: 'Chairman', last_name: 'B', email: 'chairmanb@test.com', 
      password_hash: 'password123!', employee_id: 'CB01', 
      role_id: 2, branch_id: branch.id, department_id: deptB.id 
    });
    tokenChairmanB = generateToken({ id: chairmanB.id, role_id: chairmanB.role_id, department_id: chairmanB.department_id, branch_id: chairmanB.branch_id });
  });

  afterAll(async () => {
    // Cleanup
    await Request.destroy({ where: {} });
    await User.destroy({ where: { employee_id: ['UA01', 'CA01', 'CB01'] } });
    await Department.destroy({ where: { code: ['DA01', 'DB01'] } });
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
    // Find the request ID (or just use the one from previous test if shared)
    const reqs = await Request.findAll({ where: { requester_id: userA.id } });
    const requestId = reqs[0].id;

    const approveRes = await request(app)
      .post(`/api/requests/${requestId}/approve-chairman`)
      .set('Authorization', `Bearer ${tokenChairmanB}`)
      .send({ status: 'approved', comment: 'Stealing approval' });
    
    expect(approveRes.status).toBe(403);
    expect(approveRes.body.message).toMatch(/Not authorized/);
  });

  test('Chairman A SHOULD be able to approve request from User A', async () => {
    const reqs = await Request.findAll({ where: { requester_id: userA.id } });
    const requestId = reqs[0].id;

    const approveRes = await request(app)
      .post(`/api/requests/${requestId}/approve-chairman`)
      .set('Authorization', `Bearer ${tokenChairmanA}`)
      .send({ status: 'approved', comment: 'Valid approval' });
    
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('pending_storage');
  });
});
