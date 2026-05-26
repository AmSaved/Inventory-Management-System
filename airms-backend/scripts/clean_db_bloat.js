require('dotenv').config({ path: 'c:/Users/User/Desktop/airms/airms-backend/.env' });
const { sequelize } = require('c:/Users/User/Desktop/airms/airms-backend/src/models');
const { QueryTypes } = require('sequelize');

async function cleanDbBloat() {
  try {
    console.log("====================================================");
    console.log("🛡️  Starting Database Constraint/Index Bloat Clean-up");
    console.log("====================================================");
    
    await sequelize.authenticate();
    console.log("✅ Connected to the database.");

    // Step 1: Query all unique constraints in the public schema
    console.log("🔍 Fetching unique constraints...");
    const query = `
      SELECT
        c.conname AS constraint_name,
        c.conrelid::regclass::text AS table_name,
        array_to_string(array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum)), ',') AS column_names
      FROM
        pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE
        c.contype = 'u'
        AND c.connamespace = 'public'::regnamespace
      GROUP BY
        c.conname,
        c.conrelid;
    `;

    const constraints = await sequelize.query(query, { type: QueryTypes.SELECT });
    console.log(`📊 Found ${constraints.length} total unique constraints in public schema.`);

    // Step 2: Group by table_name and column_names
    const groups = {};
    for (const con of constraints) {
      const key = `${con.table_name}:${con.column_names}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(con.constraint_name);
    }

    const dropPlan = {};
    let totalToDrop = 0;

    for (const [key, names] of Object.entries(groups)) {
      if (names.length > 1) {
        const [tableName, columns] = key.split(':');
        
        // Sort constraint names to keep the cleanest one (the one without numeric trailing digits)
        const sortedNames = [...names].sort((a, b) => {
          const aHasDigit = /\d+$/.test(a);
          const bHasDigit = /\d+$/.test(b);
          if (aHasDigit && !bHasDigit) return 1;
          if (!aHasDigit && bHasDigit) return -1;
          return a.localeCompare(b, undefined, { numeric: true });
        });

        const keep = sortedNames[0];
        const drop = sortedNames.slice(1);

        if (!dropPlan[tableName]) dropPlan[tableName] = [];
        dropPlan[tableName].push(...drop);
        totalToDrop += drop.length;

        console.log(`📝 Plan for '${tableName}' on columns (${columns}):`);
        console.log(`   👉 KEEP: ${keep}`);
        console.log(`   ❌ DROP: ${drop.length} duplicate constraints (e.g. ${drop.slice(0, 3).join(', ')}...)`);
      }
    }

    if (totalToDrop === 0) {
      console.log("✅ No duplicate constraints found! The database is already clean.");
      process.exit(0);
    }

    console.log(`\n🚨 Ready to drop ${totalToDrop} redundant unique constraints across ${Object.keys(dropPlan).length} tables.`);
    console.log("🚀 Executing drops table by table...");

    // Step 3: Execute drops table by table to keep catalog locks localized and short
    for (const [tableName, constraintNames] of Object.entries(dropPlan)) {
      console.log(`\n⚡ Cleaning table '${tableName}' (${constraintNames.length} constraints)...`);
      
      // Batch drops in chunks of 100 to avoid overly huge query strings or transaction buffer overflows
      const chunkSize = 100;
      for (let i = 0; i < constraintNames.length; i += chunkSize) {
        const batch = constraintNames.slice(i, i + chunkSize);
        const dropClauses = batch.map(name => `DROP CONSTRAINT "${name}"`).join(', ');
        const sql = `ALTER TABLE "${tableName}" ${dropClauses};`;
        
        const start = Date.now();
        await sequelize.query(sql);
        console.log(`   ✅ Dropped batch ${Math.floor(i / chunkSize) + 1}/${Math.ceil(constraintNames.length / chunkSize)} (${batch.length} constraints) in ${Date.now() - start}ms`);
      }
    }

    console.log("\n====================================================");
    console.log("🎉 SUCCESS: Constraint clean-up complete!");
    console.log("====================================================");
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ ERROR DURING CLEAN-UP:", error);
    process.exit(1);
  }
}

cleanDbBloat();
