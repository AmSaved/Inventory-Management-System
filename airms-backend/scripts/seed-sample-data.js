require('dotenv').config();
const { Branch, Product, sequelize } = require('../src/models');

const seedSampleData = async () => {
  try {
    console.log('--- Seeding Sample Data ---');

    // Create Branches
    const branches = [
      { name: 'North', code: 'BR-NORTH', type: 'branch', city: 'North City' },
      { name: 'South', code: 'BR-SOUTH', type: 'branch', city: 'South City' },
      { name: 'East', code: 'BR-EAST', type: 'branch', city: 'East City' },
      { name: 'West', code: 'BR-WEST', type: 'branch', city: 'West City' },
      { name: 'Central Head Quarter', code: 'BR-CHQ', type: 'headquarters', city: 'Central City' }
    ];

    console.log('Creating Branches...');
    const createdBranches = [];
    for (const b of branches) {
      const [branch] = await Branch.findOrCreate({
        where: { code: b.code },
        defaults: b
      });
      createdBranches.push(branch);
      console.log(`- ${branch.name} (ID: ${branch.id})`);
    }

    // Create Products
    const products = [
      { sku: 'DELL-001', name: 'Laptops - Dell Latitude', brand: 'Dell', model: 'Latitude 5420', category: 'Computing' },
      { sku: 'CHAIR-042', name: 'Office Chairs - Ergonomic', brand: 'Herman Miller', model: 'Aeron', category: 'Furniture' },
      { sku: 'HP-992', name: 'Printers - HP Laserjet', brand: 'HP', model: 'LaserJet Pro', category: 'Peripherals' },
      { sku: 'SAM-27', name: 'Monitors - Samsung 27"', brand: 'Samsung', model: 'Odyssey G5', category: 'Display' }
    ];

    console.log('\nCreating Products...');
    const createdProducts = [];
    for (const p of products) {
      const [product] = await Product.findOrCreate({
        where: { sku: p.sku },
        defaults: p
      });
      createdProducts.push(product);
      console.log(`- ${product.name} (ID: ${product.id})`);
    }

    console.log('\n✅ Sample data seeded successfully!');
    
    // Print IDs in JSON for easy capture
    const result = {
      branches: createdBranches.map(b => ({ id: b.id, name: b.name })),
      products: createdProducts.map(p => ({ id: p.id, name: p.name }))
    };
    console.log('\nDATA_JSON_START');
    console.log(JSON.stringify(result));
    console.log('DATA_JSON_END');

    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedSampleData();
