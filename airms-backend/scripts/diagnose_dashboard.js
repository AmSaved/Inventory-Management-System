require('dotenv').config();
const { sequelize, User, Role } = require('../src/models');
const approvalService = require('../src/services/approvalService');
const dashboardController = require('../src/controllers/dashboardController');

async function run() {
    try {
        console.log("Starting Dashboard Benchmark...");
        
        await sequelize.authenticate();
        console.log("Database connected successfully.");

        // Find Admin User
        const admin = await User.findOne({ 
            where: { email: 'admin@airms.com' },
            include: [{ model: Role, as: 'role' }]
        });

        if (!admin) {
            console.log("Admin user admin@airms.com not found!");
            return;
        }

        console.log(`Using Admin User: ${admin.first_name} ${admin.last_name} (${admin.email})`);
        
        console.time("Pending Approvals Fetch time");
        const pending = await approvalService.getPendingApprovals(admin.company_id, admin);
        console.timeEnd("Pending Approvals Fetch time");
        console.log(`Pending approvals found: ${pending.length} items.`);

        // Call getDashboardStats controller logic simulated
        console.time("Full getDashboardStats logic simulation");
        
        const mockReq = {
            user: admin,
            userPermissions: ['system:manage', 'request:approve', 'inventory:manage'],
            query: { org_node_id: '' },
            getAuthorizedNodes: async () => null // simulate super admin allowedNodes
        };

        const mockRes = {
            json: (payload) => {
                console.log("Dashboard response received successfully.");
                console.log("Metrics returned:", Object.keys(payload.data.metrics).length, "keys");
            },
            status: (code) => {
                console.log("Status code returned:", code);
                return mockRes;
            }
        };

        await dashboardController.getDashboardStats(mockReq, mockRes, (err) => {
            if (err) console.error("Error in controller logic:", err);
        });

        console.timeEnd("Full getDashboardStats logic simulation");

    } catch (e) {
        console.error("Benchmark error:", e);
    } finally {
        process.exit(0);
    }
}

run();
