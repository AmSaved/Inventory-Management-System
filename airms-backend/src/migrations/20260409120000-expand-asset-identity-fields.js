'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ── Products table: Physical, Technical, Media columns ───────────────
    const productsTable = await queryInterface.describeTable('products');

    const productColumns = {
      weight: Sequelize.STRING(50),
      dimensions: Sequelize.STRING(100),
      color: Sequelize.STRING(50),
      material: Sequelize.STRING(100),
      processor: Sequelize.STRING(100),
      ram: Sequelize.STRING(50),
      storage: Sequelize.STRING(100),
      graphics: Sequelize.STRING(100),
      display: Sequelize.STRING(100),
      os: Sequelize.STRING(50),
      battery: Sequelize.STRING(100),
      ports: Sequelize.TEXT,
      images: Sequelize.JSONB,
      catalog_url: Sequelize.TEXT,
      manual_url: Sequelize.TEXT,
      reorder_quantity: { type: Sequelize.INTEGER, defaultValue: 0 },
      custom_fields: { type: Sequelize.JSONB, defaultValue: {} },
    };

    for (const [col, type] of Object.entries(productColumns)) {
      if (!productsTable[col]) {
        await queryInterface.addColumn('products', col, {
          type,
          allowNull: true,
        });
      }
    }

    // ── Inventory table: Financial, Lifecycle, Assignment columns ─────────
    const inventoryTable = await queryInterface.describeTable('inventory');

    const inventoryColumns = {
      current_value: Sequelize.DECIMAL(10, 2),
      purchase_date: Sequelize.DATE,
      warranty_expiry: Sequelize.DATE,
      supplier: Sequelize.STRING(200),
      invoice_number: Sequelize.STRING(100),
      expiry_date: Sequelize.DATE,
      condition: Sequelize.STRING(50),
      assigned_to: Sequelize.INTEGER,
      assigned_at: Sequelize.DATE,
      expected_return_date: Sequelize.DATE,
      assignment_notes: Sequelize.TEXT,
    };

    for (const [col, type] of Object.entries(inventoryColumns)) {
      if (!inventoryTable[col]) {
        await queryInterface.addColumn('inventory', col, {
          type,
          allowNull: true,
        });
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const productCols = ['weight','dimensions','color','material','processor','ram','storage','graphics','display','os','battery','ports','images','catalog_url','manual_url','reorder_quantity','custom_fields'];
    for (const col of productCols) {
      await queryInterface.removeColumn('products', col).catch(() => {});
    }

    const inventoryCols = ['current_value','purchase_date','warranty_expiry','supplier','invoice_number','expiry_date','condition','assigned_to','assigned_at','expected_return_date','assignment_notes'];
    for (const col of inventoryCols) {
      await queryInterface.removeColumn('inventory', col).catch(() => {});
    }
  }
};
