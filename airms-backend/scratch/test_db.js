require('dotenv').config({ path: 'c:/Users/User/Desktop/airms/airms-backend/.env' });
const { sequelize } = require('c:/Users/User/Desktop/airms/airms-backend/src/models');
const { QueryTypes } = require('sequelize');

async function test() {
  console.log("Benchmarking individual table queries twice...");
  await sequelize.authenticate();
  
  const tables = ['companies', 'roles', 'permissions', 'users', 'activity_logs'];
  
  console.log("\n--- Pass 1 ---");
  for (const table of tables) {
    const start = Date.now();
    await sequelize.query(`SELECT * FROM ${table} LIMIT 5`, { type: QueryTypes.SELECT });
    console.log(`SELECT * FROM ${table} LIMIT 5 took ${Date.now() - start}ms`);
  }

  console.log("\n--- Pass 2 ---");
  for (const table of tables) {
    const start = Date.now();
    await sequelize.query(`SELECT * FROM ${table} LIMIT 5`, { type: QueryTypes.SELECT });
    console.log(`SELECT * FROM ${table} LIMIT 5 took ${Date.now() - start}ms`);
  }

  await sequelize.close();
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
