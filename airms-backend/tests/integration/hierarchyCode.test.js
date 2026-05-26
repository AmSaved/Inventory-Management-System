require('dotenv').config();
const { Company, OrganizationType, OrganizationNode, sequelize } = require('../../src/models');

describe('Hierarchy Code Auto-generation Tests', () => {
    let company;
    let orgType;

    beforeAll(async () => {
        await sequelize.authenticate();
        company = await Company.findOne({ where: { name: 'Code Test Company' } }) 
            || await Company.create({ name: 'Code Test Company' });

        orgType = await OrganizationType.findOne({ where: { company_id: company.id } }) 
            || await OrganizationType.create({ name: 'Test Type', code_prefix: 'TST', company_id: company.id });
    });

    afterAll(async () => {
        await OrganizationNode.destroy({ where: { company_id: company.id } });
    });

    test('Creating a node without a code should auto-generate a unique code', async () => {
        const node = await OrganizationNode.create({
            company_id: company.id,
            org_type_id: orgType.id,
            name: 'Strategic Hub Office'
        });

        expect(node.code).toBeDefined();
        expect(node.code).not.toBeNull();
        expect(node.code.startsWith('STRA')).toBe(true);
        expect(node.code.length).toBeGreaterThan(5);
    });

    test('Creating multiple nodes with same name without a code should generate unique codes', async () => {
        const node1 = await OrganizationNode.create({
            company_id: company.id,
            org_type_id: orgType.id,
            name: 'Logistics Division'
        });

        const node2 = await OrganizationNode.create({
            company_id: company.id,
            org_type_id: orgType.id,
            name: 'Logistics Division'
        });

        expect(node1.code).not.toBe(node2.code);
        expect(node1.code.startsWith('LOGI')).toBe(true);
        expect(node2.code.startsWith('LOGI')).toBe(true);
    });

    test('Creating a node with an explicit code should keep the provided code', async () => {
        const node = await OrganizationNode.create({
            company_id: company.id,
            org_type_id: orgType.id,
            name: 'Finance Division',
            code: 'FIN-101'
        });

        expect(node.code).toBe('FIN-101');
    });

    test('Updating a node to empty code should auto-generate a new one', async () => {
        const node = await OrganizationNode.create({
            company_id: company.id,
            org_type_id: orgType.id,
            name: 'HR Division',
            code: 'HR-101'
        });

        await node.update({ code: '' });
        expect(node.code).not.toBe('HR-101');
        expect(node.code.startsWith('HRDI')).toBe(true);
    });
});
