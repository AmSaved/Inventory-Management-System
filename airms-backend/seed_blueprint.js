const { FormTemplate } = require('./src/models');

async function seed() {
  try {
    const templates = await FormTemplate.findAll({ where: { module: 'blueprint' } });
    if (templates.length === 0) {
      await FormTemplate.create({
        name: '💻 IT Hardware Blueprint',
        template_key: 'it_hardware_bp',
        module: 'blueprint',
        company_id: 1, // Default company
        icon: '💻',
        description: 'Standard technical specification for computers, laptops and servers.',
        schema: [
          { key: 'brand', label: 'Manufacturer / Brand', type: 'select', required: true, section: 'Identity', options: ['Dell', 'Apple', 'HP', 'Lenovo', 'Asus'] },
          { key: 'model', label: 'Model Reference', type: 'text', required: true, section: 'Identity', placeholder: 'e.g. Latitude 5420' },
          { key: 'serial', label: 'Asset Serial Number', type: 'text', required: true, section: 'Tracking', placeholder: 'S/N: 00000000' },
          { key: 'cpu', label: 'Processing Core', type: 'text', section: 'Technical Specs', placeholder: 'e.g. Intel i7' },
          { key: 'ram', label: 'Memory Capacity', type: 'select', section: 'Technical Specs', options: ['8GB', '16GB', '32GB', '64GB'] }
        ]
      });
      console.log('Starter Blueprint Seeded Successfully');
    } else {
      console.log('Blueprints already exist');
    }
  } catch (err) {
    console.error('Seeding failed:', err);
  }
  process.exit();
}

seed();
