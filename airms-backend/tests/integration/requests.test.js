const request = require('supertest');
const app = require('../../src/app');
const { Request, RequestItem, User, Product, Branch, Inventory } = require('../../src/models');
const { generateToken } = require('../../src/utils/auth');

describe('Request Lifecycle Integration Tests', () => {
  let userToken, chairmanToken, storageManagerToken;
  let productId, branchId;

  beforeAll(async () => {
    // Setup test data
    const branch = await Branch.create({ name: 'Test Branch', code: 'T001' });
    branchId = branch.id;

    const product = await Product.create({ name: 'Test Laptop', sku: 'LAP-001', category: 'IT' });
    productId = product.id;

    const user = await User.create({ first_name: 'Tester', last_name: 'User', email: 'user@test.com', password: 'password', role_id: 5, branch_id: branchId });
    userToken = generateToken(user);

    const chairman = await User.create({ first_name: 'Chairman', last_name: 'Approve', email: 'chairman@test.com', password: 'password', role_id: 3, branch_id: branchId });
    chairmanToken = generateToken(chairman);

    const storageManager = await User.create({ first_name: 'Storage', last_name: 'Manager', email: 'storage@test.com', password: 'password', role_id: 4, branch_id: branchId });
    storageManagerToken = generateToken(storageManager);

    await Inventory.create({ branch_id: branchId, product_id: productId, quantity: 10 });
  });

  afterAll(async () => {
    // Cleanup
    await Request.destroy({ where: {} });
    await User.destroy({ where: {} });
    await Product.destroy({ where: {} });
    await Branch.destroy({ where: {} });
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
    expect(createRes.body.data.status).toBe('pending_chairman');

    // 2. Chairman Approval
    const chairmanRes = await request(app)
      .post(`/api/approvals/${requestId}/chairman-approve`)
      .set('Authorization', `Bearer ${chairmanToken}`)
      .send({ comments: 'Approved by chairman' });
    
    expect(chairmanRes.status).toBe(200);
    const updatedReq1 = await Request.findByPk(requestId);
    expect(updatedReq1.status).toBe('pending_storage');

    // 3. Storage Manager Approval
    const storageRes = await request(app)
      .post(`/api/approvals/${requestId}/storage-approve`)
      .set('Authorization', `Bearer ${storageManagerToken}`)
      .send({ comments: 'Inventory available' });
    
    expect(storageRes.status).toBe(200);
    const updatedReq2 = await Request.findByPk(requestId);
    expect(updatedReq2.status).toBe('pending_discharge');

    // 4. Discharge (Storage Manager)
    const dischargeRes = await request(app)
      .post('/api/discharge')
      .set('Authorization', `Bearer ${storageManagerToken}`)
      .send({
        request_id: requestId,
        discharge_type: 'user',
        from_branch_id: branchId,
        to_user_id: 1, // dummy
        items: [{ product_id: productId, quantity: 1 }]
      });
    
    const updatedReq3 = await Request.findByPk(requestId);
    expect(updatedReq3.status).toBe('approved');
  });
});
