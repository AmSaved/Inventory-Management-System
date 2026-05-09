'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('request_items', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      request_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'requests',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'products',
          key: 'id'
        }
      },
      quantity_requested: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      quantity_approved: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      quantity_fulfilled: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      specifications: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
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
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('request_items');
  }
};