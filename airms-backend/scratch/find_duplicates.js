require('dotenv').config({ path: 'c:/Users/User/Desktop/airms/airms-backend/.env' });
const { sequelize } = require('c:/Users/User/Desktop/airms/airms-backend/src/models');
const { QueryTypes } = require('sequelize');

async function findDuplicates() {
  await sequelize.authenticate();
  console.log("Connected to DB. Analyzing unique constraints...");

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
  console.log(`Found ${constraints.length} total unique constraints.`);

  // Group by table_name and column_names
  const groups = {};
  for (const con of constraints) {
    const key = `${con.table_name}:${con.column_names}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(con.constraint_name);
  }

  let totalDuplicates = 0;
  const plan = [];

  for (const [key, names] of Object.entries(groups)) {
    if (names.length > 1) {
      const [tableName, columns] = key.split(':');
      totalDuplicates += (names.length - 1);
      
      // Determine which constraint is the "cleanest" or "primary" one
      // The cleanest name is the one without numeric trailing suffixes
      // Let's sort them so that the cleanest names come first
      const sortedNames = [...names].sort((a, b) => {
        const aHasDigit = /\d+$/.test(a);
        const bHasDigit = /\d+$/.test(b);
        if (aHasDigit && !bHasDigit) return 1;
        if (!aHasDigit && bHasDigit) return -1;
        // If both have or don't have digits, sort alphabetically
        return a.localeCompare(b, undefined, { numeric: true });
      });

      const toKeep = sortedNames[0];
      const toDrop = sortedNames.slice(1);

      plan.push({
        table: tableName,
        columns: columns,
        keep: toKeep,
        drop: toDrop
      });
    }
  }

  console.log(`Total duplicate constraint groups: ${plan.length}`);
  console.log(`Total redundant constraints to drop: ${totalDuplicates}`);

  // Print a preview of the plan
  console.log("\n--- PREVIEW OF DROP PLAN (Top 5 groups with most duplicates) ---");
  const sortedPlan = [...plan].sort((a, b) => b.drop.length - a.drop.length);
  for (const item of sortedPlan.slice(0, 5)) {
    console.log(`Table '${item.table}' on columns (${item.columns}):`);
    console.log(`  KEEP: ${item.keep}`);
    console.log(`  DROP (${item.drop.length} items): ${item.drop.slice(0, 3).join(', ')} ... ${item.drop.slice(-3).join(', ')}`);
  }

  await sequelize.close();
}

findDuplicates().catch(console.error);
