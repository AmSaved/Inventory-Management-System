'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('organization_nodes', 'created_by', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    
    await queryInterface.addIndex('organization_nodes', ['created_by']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('organization_nodes', 'created_by');
  }
};
