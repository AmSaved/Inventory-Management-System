require('dotenv').config();
const { sequelize, User, Role } = require('../src/models');
const approvalService = require('../src/services/approvalService');

async function test() {
    try {
        await sequelize.authenticate();
        const user = await User.findOne({ 
            where: { email: 'anam@gmail.com' },
            include: [{ model: Role, as: 'role' }]
        });
        
        await approvalService.getPendingApprovals(user.company_id, user);
        console.log("SUCCESS!");
    } catch (e) {
        console.error("THE CAPTURED ERROR IS:", e.message);
        console.error(e.stack);
    }
    process.exit(0);
}
test();
