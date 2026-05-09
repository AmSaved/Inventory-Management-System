
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const { Company } = require('./src/models');
const sequelize = require('./src/config/database');

async function check() {
    try {
        const companies = await Company.findAll();
        console.log(`Total Companies: ${companies.length}`);
        
        companies.forEach(c => {
            console.log(`Company: ${c.name} (ID: ${c.id})`);
        });

    } catch (error) {
        console.error('Check failed:', error);
    } finally {
        await sequelize.close();
    }
}

check();
