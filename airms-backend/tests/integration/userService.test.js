require('dotenv').config();
const { Company, User, Role, sequelize } = require('../../src/models');
const userService = require('../../src/services/userService');

describe('UserService Sanitization Tests', () => {
    let company;
    let creator;

    beforeAll(async () => {
        await sequelize.authenticate();
        company = await Company.findOne({ where: { name: 'Sanitization Test Company' } }) 
            || await Company.create({ name: 'Sanitization Test Company' });

        creator = await User.findOne({ where: { email: 'creator@sanitization.com' } });
        if (!creator) {
            const role = await Role.findOne() || await Role.create({ name: 'test_role', level: 10 });
            creator = await User.create({
                email: 'creator@sanitization.com',
                first_name: 'Test',
                last_name: 'Creator',
                password_hash: 'dummy',
                company_id: company.id,
                role_id: role.id,
                employee_id: 'EMP-CREATOR-999'
            });
        }
    });

    afterAll(async () => {
        await User.destroy({ where: { company_id: company.id } });
        await Company.destroy({ where: { id: company.id } });
    });

    test('createUser should sanitize empty string integer fields to null', async () => {
        const userData = {
            email: 'newuser@sanitization.com',
            first_name: 'New',
            last_name: 'User',
            password: 'password123',
            role_id: '',       
            org_node_id: '',   
        };

        const user = await userService.createUser(company.id, userData, creator.id);

        expect(user.role_id).toBeNull();
        expect(user.org_node_id).toBeNull();
        expect(user.email).toBe('newuser@sanitization.com');
    });

    test('updateUser should sanitize empty string integer fields to null', async () => {
        const userData = {
            email: 'updateuser@sanitization.com',
            first_name: 'Update',
            last_name: 'User',
            password: 'password123',
        };
        const user = await userService.createUser(company.id, userData, creator.id);

        const updateData = {
            role_id: '',
            org_node_id: '',
        };

        const updatedUser = await userService.updateUser(company.id, user.id, updateData, creator.id);

        expect(updatedUser.role_id).toBeNull();
        expect(updatedUser.org_node_id).toBeNull();
    });
});
