const { FormTemplate } = require('../src/models');
const sequelize = require('../src/config/database');

async function seedBlueprintTemplate() {
  try {
    await sequelize.authenticate();
    
    const companyId = 1;

    const blueprintTemplate = {
      name: 'IT Hardware Specification',
      template_key: 'it_hardware_blueprint',
      module: 'blueprint',
      company_id: companyId,
      schema: [
        {
          key: 'processor',
          label: 'Computation Core (CPU)',
          type: 'text',
          placeholder: 'e.g. Intel Core i9',
          required: true
        },
        {
          key: 'ram',
          label: 'Memory Matrix (RAM)',
          type: 'text',
          placeholder: 'e.g. 64GB DDR5'
        },
        {
          key: 'storage',
          label: 'Storage Array (Disk)',
          type: 'text',
          placeholder: 'e.g. 2TB NVMe'
        },
        {
          key: 'graphics',
          label: 'Graphics Engine (GPU)',
          type: 'text'
        },
        {
          key: 'os',
          label: 'Operational OS',
          type: 'select',
          options: [
            { label: 'Windows 11 Pro', value: 'win11pro' },
            { label: 'Ubuntu 22.04', value: 'ubuntu22' },
            { label: 'macOS Sonoma', value: 'macos' }
          ]
        }
      ]
    };

    await FormTemplate.upsert(blueprintTemplate);
    console.log('Dynamic Blueprint Template seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding blueprint template:', error);
    process.exit(1);
  }
}

seedBlueprintTemplate();
