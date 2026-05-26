require('dotenv').config({ path: 'c:/Users/User/Desktop/airms/airms-backend/.env' });
const { sequelize } = require('c:/Users/User/Desktop/airms/airms-backend/src/models');
const { QueryTypes } = require('sequelize');

async function listBloat() {
  await sequelize.authenticate();
  console.log("Connected to database. Listing indexes/constraints...");

  // Query indexes count by table
  const indexes = await sequelize.query(`
    SELECT
      schemaname,
      tablename,
      indexname,
      indexdef
    FROM
      pg_indexes
    WHERE
      schemaname = 'public'
    ORDER BY
      tablename, indexname;
  `, { type: QueryTypes.SELECT });

  console.log(`Total public indexes: ${indexes.length}`);
  
  // Group by tablename
  const indexGroups = {};
  for (const idx of indexes) {
    if (!indexGroups[idx.tablename]) indexGroups[idx.tablename] = [];
    indexGroups[idx.tablename].push(idx.indexname);
  }
  
  console.log("\n--- INDEX COUNTS PER TABLE ---");
  for (const [table, idxs] of Object.entries(indexGroups)) {
    console.log(`Table '${table}': ${idxs.length} indexes`);
    if (idxs.length > 10) {
      console.log(`  Sample index names: ${idxs.slice(0, 5).join(', ')} ... ${idxs.slice(-5).join(', ')}`);
    } else {
      console.log(`  Index names: ${idxs.join(', ')}`);
    }
  }

  // Query constraints
  const constraints = await sequelize.query(`
    SELECT
      conname,
      conrelid::regclass::text as tablename,
      contype
    FROM
      pg_constraint
    WHERE
      connamespace = 'public'::regnamespace
    ORDER BY
      tablename, conname;
  `, { type: QueryTypes.SELECT });

  console.log(`\nTotal public constraints: ${constraints.length}`);
  
  const constraintGroups = {};
  for (const con of constraints) {
    if (!constraintGroups[con.tablename]) constraintGroups[con.tablename] = [];
    constraintGroups[con.tablename].push({ name: con.conname, type: con.contype });
  }

  console.log("\n--- CONSTRAINT COUNTS PER TABLE ---");
  for (const [table, cons] of Object.entries(constraintGroups)) {
    console.log(`Table '${table}': ${cons.length} constraints`);
    if (cons.length > 10) {
      console.log(`  Sample constraints: ${cons.slice(0, 5).map(c => `${c.name} (${c.type})`).join(', ')} ... ${cons.slice(-5).map(c => `${c.name} (${c.type})`).join(', ')}`);
    } else {
      console.log(`  Constraints: ${cons.map(c => `${c.name} (${c.type})`).join(', ')}`);
    }
  }

  await sequelize.close();
}

listBloat().catch(console.error);
