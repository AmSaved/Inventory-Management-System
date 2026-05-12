const { Inventory, Product } = require('../src/models');

async function check() {
  try {
    const items = await Inventory.findAll({
      limit: 5,
      order: [['created_at', 'DESC']],
      include: [{ model: Product, as: 'product' }]
    });
    
    console.log('--- LATEST INVENTORY RECORDS ---');
    items.forEach(it => {
      console.log(`ID: ${it.id} | Product: ${it.product?.name} | Serial: "${it.serial_number}" | Qty: ${it.quantity}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
