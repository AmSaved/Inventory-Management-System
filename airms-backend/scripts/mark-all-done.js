// Run: node scripts/mark-all-done.js
// Marks all legacy migrations as done so only the new asset-identity migration runs
const { Sequelize } = require('sequelize');
const config = require('../src/config/config.js').development;

const seq = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  port: config.port || 5432,
  dialect: 'postgres',
  logging: false
});

const TO_MARK = [
  '20240401000004-create-core-tables.js',
  '20240401000005-create-products-inventory.js',
  '20240401000006-create-operational-tables.js',
  '20260406090250-add-username-to-users.js',
  '20260406091602-add-created-by-to-nodes.js',
  '20260407000000-add-dynamic-workflow-labels.js',
  '20260407000001-create-workflow-routes.js',
];

async function run() {
  try {
    await seq.authenticate();
    console.log('Connected to DB');

    for (const name of TO_MARK) {
      const [rows] = await seq.query(
        `SELECT name FROM "SequelizeMeta" WHERE name = '${name}'`
      );
      if (!rows.length) {
        await seq.query(`INSERT INTO "SequelizeMeta" (name) VALUES ('${name}')`);
        console.log('Marked:', name);
      } else {
        console.log('Already done:', name);
      }
    }

    console.log('\nDone. Now run: npm run migrate');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await seq.close();
  }
}

run();
