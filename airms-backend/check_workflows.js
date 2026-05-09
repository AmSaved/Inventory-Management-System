
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const { Workflow, Company } = require('./src/models');
const sequelize = require('./src/config/database');

async function check() {
    try {
        const workflows = await Workflow.findAll();
        console.log(`Total Workflows: ${workflows.length}`);
        
        const nullCompany = workflows.filter(w => w.company_id === null);
        console.log(`Workflows with null company_id: ${nullCompany.length}`);
        
        const countsByCompany = {};
        workflows.forEach(w => {
            countsByCompany[w.company_id] = (countsByCompany[w.company_id] || 0) + 1;
        });
        console.log('Counts by company_id:', JSON.stringify(countsByCompany, null, 2));

        // Get company names
        const companies = await Company.findAll();
        const companyMap = {};
        companies.forEach(c => companyMap[c.id] = c.name);
        
        console.log('Workflows by Company Name:');
        Object.keys(countsByCompany).forEach(cid => {
            console.log(`${companyMap[cid] || 'Unknown/Null'}: ${countsByCompany[cid]}`);
        });

    } catch (error) {
        console.error('Check failed:', error);
    } finally {
        await sequelize.close();
    }
}

check();
