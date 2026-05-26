'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add blueprint_template_id to Products
    await queryInterface.addColumn('products', 'blueprint_template_id', {
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
    await queryInterface.removeColumn('products', 'blueprint_template_id');
  }
};
