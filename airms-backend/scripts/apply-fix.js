const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');

// Hardcoded credentials for this specific fix if .env fails
const sequelize = new Sequelize('airms_dev', 'postgres', '286042', {
  host: 'localhost',
  dialect: 'postgres',
  logging: false
});

async function applyFix() {
  try {
    const sqlPath = path.join(__dirname, 'fix_triggers.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Applying trigger fixes...');
    await sequelize.query(sql);
    console.log('✅ Success: All trigger functions updated to use FROM 10 index.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to apply trigger fixes:', error.message);
    process.exit(1);
  }
}

applyFix();
