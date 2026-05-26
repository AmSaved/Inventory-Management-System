require('dotenv').config({ path: 'c:/Users/User/Desktop/airms/airms-backend/.env' });
const { sequelize, Role } = require('c:/Users/User/Desktop/airms/airms-backend/src/models');

async function main() {
    await sequelize.authenticate();
    const roles = await Role.findAll();
    console.log("Roles in Database:");
    roles.forEach(r => {
        console.log(`ID: ${r.id}, Name: ${r.name}, Level: ${r.level}, CompanyID: ${r.company_id}`);
    });
    await sequelize.close();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
