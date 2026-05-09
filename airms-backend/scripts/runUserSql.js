require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../src/models');
const AuthService = require('../src/services/authService');

async function run() {
    try {
        await sequelize.authenticate();
        console.log("Database connected. Executing your SQL seed files...");
        
        const seedFiles = [
            '01-roles-data.sql',
            '02-permissions-data.sql',
            '03-role-permissions.sql',
            '04-branches-data.sql',
            '06-products-data.sql',
            '07-inventory-data.sql'
        ];

        for (const file of seedFiles) {
            console.log(`Processing ${file}...`);
            let sql = fs.readFileSync(path.join(__dirname, '../database/02-seed-data/', file), 'utf8');
            
            // Clean up SQL to prevent simple duplicates if possible, or just catch error
            try {
                // Remove CREATE TABLE if user accidentally left it in (for branches)
                if (file === '04-branches-data.sql') {
                    sql = sql.replace(/CREATE TABLE branches \([\s\S]*?\);/i, '');
                }
                
                await sequelize.query(sql);
                console.log(`${file} executed.`);
            } catch (err) {
                console.log(`Skipped or partially failed ${file}: ${err.message}`);
            }
        }
        
        // Execute User via AuthService so the password gets securely hashed!
        try {
            await AuthService.register({
                employee_id: 'EMP001',
                email: 'solytesfa32@gmail.com',
                password: 'Admin123!',
                first_name: 'Solomon',
                last_name: 'Tesfaye',
                role_id: 1,
                branch_id: 1
            });
            console.log("Admin user seeded properly via AuthService (hashed password).");
        } catch (err) {
            console.log("Admin user already existed or skipped:", err.message);
        }

        console.log("Successfully processed your custom seed files!");
        process.exit(0);
    } catch(e) {
        console.error("Critical error:", e.message);
        process.exit(1);
    }
}
run();
