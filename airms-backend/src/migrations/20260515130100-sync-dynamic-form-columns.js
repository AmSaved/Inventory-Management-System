'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add custom_fields to Inventory
    await queryInterface.addColumn('inventory', 'custom_fields', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {}
    });

    // 2. Add custom_fields to StoreItem
    await queryInterface.addColumn('store_items', 'custom_fields', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {}
    });

    // 3. Add form_template_id to Product
    await queryInterface.addColumn('products', 'form_template_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'form_templates',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('inventory', 'custom_fields');
    await queryInterface.removeColumn('store_items', 'custom_fields');
    await queryInterface.removeColumn('products', 'form_template_id');
  }
};
