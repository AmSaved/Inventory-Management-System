const { FormTemplate } = require('../src/models');
const sequelize = require('../src/config/database');

async function seedTemplate() {
  try {
    await sequelize.authenticate();
    
    const companyId = 1; // Assuming company 1 exists

    const intakeTemplate = {
      name: 'Standard Stock Intake',
      template_key: 'stock_intake',
      module: 'inventory',
      company_id: companyId,
      schema: [
        {
          key: 'vendor_name',
          label: 'Supplier / Vendor',
          type: 'text',
          placeholder: 'Enter supplier name',
          required: true
        },
        {
          key: 'invoice_ref',
          label: 'Invoice Reference',
          type: 'text',
          placeholder: 'e.g. INV-2024-001'
        },
        {
          key: 'warranty_period',
          label: 'Warranty (Months)',
          type: 'number',
          placeholder: 'e.g. 12'
        },
        {
          key: 'inspection_status',
          label: 'Pre-Intake Inspection',
          type: 'select',
          options: [
            { label: 'Passed', value: 'passed' },
            { label: 'Minor Issues', value: 'minor_issues' },
            { label: 'Failed', value: 'failed' }
          ],
          required: true
        }
      ]
    };

    await FormTemplate.upsert(intakeTemplate);
    console.log('Dynamic Intake Template seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding template:', error);
    process.exit(1);
  }
}

seedTemplate();
