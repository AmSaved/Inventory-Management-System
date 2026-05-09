// Run with: node scripts/check-and-migrate.js
const { Sequelize } = require('sequelize');
const config = require('../src/config/config.js').development;

const seq = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  port: config.port || 5432,
  dialect: 'postgres',
  logging: false
});

const LEGACY_MIGRATIONS = [
  '20240401000000-create-companies.js',
  '20240401000001-create-organization-levels.js',
  '20240401000002-create-organization-units.js',
  '20240401000003-universal-multitenancy-update.js',
  '20240401000004-create-core-tables.js',
  '20240401000005-create-products-inventory.js',
  '20240401000006-create-operational-tables.js',
  '20240101000100-add-org-node-id-to-users.js',
  '20240101000101-update-users-add-department.js',
];

async function run() {
  try {
    await seq.authenticate();
    console.log('✅ Connected to DB');

    // Check existing migrations
    const [existing] = await seq.query('SELECT name FROM "SequelizeMeta" ORDER BY name');
    const existingNames = existing.map(r => r.name);
    console.log('\nAlready recorded migrations:');
    existingNames.forEach(n => console.log(' ✓', n));

    // Mark legacy as done if not already
    let inserted = 0;
    for (const name of LEGACY_MIGRATIONS) {
      if (!existingNames.includes(name)) {
        await seq.query('INSERT INTO "SequelizeMeta" (name) VALUES (:name)', { replacements: { name } });
        console.log(' → Marked as done:', name);
        inserted++;
      }
    }
    if (inserted === 0) console.log('\nAll legacy migrations already marked.');

    // Now check if our new migration is pending
    const [afterInsert] = await seq.query('SELECT name FROM "SequelizeMeta" ORDER BY name');
    const afterNames = afterInsert.map(r => r.name);
    const ourMigration = '20260409120000-expand-asset-identity-fields.js';
    if (afterNames.includes(ourMigration)) {
      console.log('\n✅ Asset identity migration already applied!');
    } else {
      console.log('\n⏳ Asset identity migration NOT yet run. Run: npm run migrate');
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await seq.close();
  }
}

run();
