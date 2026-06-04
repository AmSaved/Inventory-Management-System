require('dotenv').config();
const { Workflow, WorkflowStep, WorkflowRoute, Role, Request, RequestItem, Approval, Company, User, OrganizationNode, OrganizationType, ActivityLog, sequelize } = require('../../src/models');
const { generateToken } = require('../../src/utils/helpers');
const request = require('supertest');
const app = require('../../src/app');

describe('Workflow Sync Integration Tests', () => {
    let company;
    let orgType;
    let orgNode;
    let user;
    let role1, role2;
    let workflow;
    let adminUser;
    let adminRole;

    const uniqueId = Date.now();
    const role1Name = `Role One ${uniqueId}`;
    const role2Name = `Role Two ${uniqueId}`;
    const adminRoleName = `Admin Sync ${uniqueId}`;
    const userEmail = `syncuser_${uniqueId}@test.com`;
    const adminEmail = `adminsync_${uniqueId}@test.com`;

    beforeAll(async () => {
        await sequelize.authenticate();

        // 1. Find or create a test company
        company = await Company.findOne({ where: { name: 'Sync Test Company' } }) 
            || await Company.create({ name: 'Sync Test Company' });

        // 2. Find or create a test org type and org node
        orgType = await OrganizationType.findOne({ where: { company_id: company.id } }) 
            || await OrganizationType.create({ name: 'Test Type', code: 'TT01', company_id: company.id });
        orgNode = await OrganizationNode.findOne({ where: { company_id: company.id } })
            || await OrganizationNode.create({ name: 'Test Node', code: 'TN01', company_id: company.id, org_type_id: orgType.id });

        // 3. Create Roles with guaranteed unique names
        role1 = await Role.create({ name: role1Name, company_id: company.id, level: 30 });
        role2 = await Role.create({ name: role2Name, company_id: company.id, level: 40 });

        // 4. Create a test user
        user = await User.create({
            first_name: 'Sync',
            last_name: 'Tester',
            email: userEmail,
            password_hash: 'password123!',
            employee_id: `SYNC_${uniqueId}`,
            role_id: role1.id,
            company_id: company.id,
            org_node_id: orgNode.id
        });
    });

    afterAll(async () => {
        // Cleanup in correct FK dependency order
        // 1. Delete ActivityLog records
        await ActivityLog.destroy({ where: { company_id: company.id } });

        // 2. Delete Request children before Request
        const companyRequests = await Request.findAll({ where: { company_id: company.id }, attributes: ['id'] });
        const companyRequestIds = companyRequests.map(r => r.id);
        if (companyRequestIds.length > 0) {
            await Approval.destroy({ where: { request_id: companyRequestIds } });
            await RequestItem.destroy({ where: { request_id: companyRequestIds } });
        }

        // 3. Delete Request
        await Request.destroy({ where: { company_id: company.id } });

        // 4. Delete Workflow, steps, routes
        if (workflow) {
            await WorkflowRoute.destroy({ where: { workflow_id: workflow.id } });
            await WorkflowStep.destroy({ where: { workflow_id: workflow.id } });
            await workflow.destroy();
        }

        // 5. Delete Users
        if (adminUser) {
            await User.destroy({ where: { id: adminUser.id } });
        }
        if (user) {
            await User.destroy({ where: { id: user.id } });
        }

        // 6. Delete Roles
        if (adminRole) {
            await Role.destroy({ where: { id: adminRole.id } });
        }
        if (role1) {
            await Role.destroy({ where: { id: role1.id } });
        }
        if (role2) {
            await Role.destroy({ where: { id: role2.id } });
        }
    });

    test('Updating a workflow should re-assign pending resources to the new first step role', async () => {
        // 1. Create a workflow for requests
        workflow = await Workflow.create({
            company_id: company.id,
            org_node_id: orgNode.id,
            name: 'Request Sync Workflow',
            resource_type: 'request',
            created_by: user.id
        });

        // 2. Create Workflow Steps (initially Role One is first)
        const step1 = await WorkflowStep.create({
            workflow_id: workflow.id,
            step_order: 1,
            required_role_id: role1.id,
            action_name: 'approve_role_one',
            status_label_override: `Pending ${role1Name}`
        });

        // Create the entry route
        await WorkflowRoute.create({
            workflow_id: workflow.id,
            source_step_id: null,
            target_step_id: step1.id,
            action_trigger: 'approve'
        });

        // 3. Create a pending Request pointing to this workflow and step1
        const pendingRequest = await Request.create({
            company_id: company.id,
            org_node_id: orgNode.id,
            requester_id: user.id,
            purpose: 'Sync Test Request',
            status: 'pending',
            workflow_id: workflow.id,
            current_step_id: step1.id,
            workflow_status: `Pending ${role1Name}`
        });

        // 4. Update the workflow steps via the update logic:
        
        // Let's create an Admin User with role level 100 to get superadmin access.
        adminRole = await Role.create({ name: adminRoleName, company_id: company.id, level: 100 });
        
        adminUser = await User.create({
            first_name: 'Admin',
            last_name: 'Sync',
            email: adminEmail,
            password_hash: 'password123!',
            employee_id: `ADMINSYNC_${uniqueId}`,
            role_id: adminRole.id,
            company_id: company.id,
            org_node_id: orgNode.id
        });

        const adminToken = generateToken({
            id: adminUser.id,
            role_id: adminUser.role_id,
            company_id: adminUser.company_id,
            org_node_id: adminUser.org_node_id
        });

        // Let's perform the workflow update API call
        // We will change the steps to Role Two (linear mode)
        const updateRes = await request(app)
            .put(`/api/workflows/${workflow.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Updated Request Sync Workflow',
                steps: [role2.id] // Role Two is now the first step
            });

        expect(updateRes.status).toBe(200);

        // 5. Fetch the updated request and assert it was re-assigned!
        const updatedReq = await Request.findByPk(pendingRequest.id);
        
        // Check that current_step_id is updated to the new step (which should be for role2)
        const newFirstStep = await WorkflowStep.findOne({
            where: { workflow_id: workflow.id, required_role_id: role2.id }
        });
        
        expect(newFirstStep).not.toBeNull();
        expect(updatedReq.current_step_id).toBe(newFirstStep.id);
        expect(updatedReq.workflow_status).toBe(`Pending ${role2Name}`);
    });
});
