'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('request_items', 'inventory_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'inventory',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('request_items', 'inventory_id');
  }
};
