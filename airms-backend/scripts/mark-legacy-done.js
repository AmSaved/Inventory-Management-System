// Run: node scripts/mark-legacy-done.js
const { Sequelize } = require('sequelize');
const config = require('../src/config/config.js').development;

const seq = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  port: config.port || 5432,
  dialect: 'postgres',
  logging: false
});

const ALL_LEGACY = [
  '20240401000003-universal-multitenancy-update.js',
  '20240401000004-drop-deprecated-tables.js',
  '20240401000005-create-products-inventory.js',
  '20240401000006-create-operational-tables.js',
  '20240101000100-add-org-node-id-to-users.js',
];

async function run() {
  try {
    await seq.authenticate();
    console.log('Connected to DB');
    for (const name of ALL_LEGACY) {
      const [rows] = await seq.query(
        `SELECT name FROM "SequelizeMeta" WHERE name = '${name}'`
      );
      if (!rows.length) {
        await seq.query(`INSERT INTO "SequelizeMeta" (name) VALUES ('${name}')`);
        console.log('Marked as done:', name);
      } else {
        console.log('Already recorded:', name);
      }
    }
    console.log('\nAll legacy migrations handled. Now run: npm run migrate');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await seq.close();
  }
}

run();
