require('dotenv').config();
const { sequelize, User, Role } = require('../src/models');
const dashboardController = require('../src/controllers/dashboardController');

async function run() {
    try {
        console.log("Starting CONCURRENT Dashboard Benchmark...");
        
        await sequelize.authenticate();
        console.log("Database connected successfully.");

        // Find Anam User
        const user = await User.findOne({ 
            where: { email: 'anam@gmail.com' },
            include: [{ model: Role, as: 'role' }]
        });

        if (!user) {
            console.log("User anam@gmail.com not found!");
            return;
        }

        console.log(`Using User: ${user.first_name} ${user.last_name} (${user.email})`);

        // We simulate the auth check + stats fetching concurrently (like 3 dashboard components mounting at once!)
        console.log("Simulating 3 concurrent API requests hitting the server...");
        
        console.time("3 Concurrent Requests time");
        
        const makeMockRequest = (id) => {
            const mockReq = {
                user: user,
                userPermissions: ['system:manage', 'request:approve', 'inventory:manage', 'hierarchy:all:view'],
                query: { org_node_id: '1' },
                getAuthorizedNodes: async () => [1] // simulate scoped allowedNodes
            };
            const mockRes = {
                json: (payload) => {
                    console.log(`[Req #${id}] Dashboard Response complete.`);
                },
                status: (code) => {
                    console.log(`[Req #${id}] Status:`, code);
                    return mockRes;
                }
            };
            return dashboardController.getDashboardStats(mockReq, mockRes, (err) => {
                if (err) console.error(err);
            });
        };

        // Fire 3 concurrent requests at the exact same time!
        await Promise.all([
            makeMockRequest(1),
            makeMockRequest(2),
            makeMockRequest(3)
        ]);

        console.timeEnd("3 Concurrent Requests time");

    } catch (e) {
        console.error("Benchmark error:", e);
    } finally {
        process.exit(0);
    }
}

run();
