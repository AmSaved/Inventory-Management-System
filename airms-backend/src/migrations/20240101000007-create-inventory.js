'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('inventory', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      branch_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'branches',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      minimum_quantity: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      maximum_quantity: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      location_details: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      last_counted_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    return; // Don't add constraint as branch_id is dropped in later migrations
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('inventory');
  }
};