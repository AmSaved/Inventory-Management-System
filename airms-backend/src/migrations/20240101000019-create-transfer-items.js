'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('transfer_items', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      transfer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'transfers',
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
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      serial_numbers: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        allowNull: true
      },
      condition: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('transfer_items', ['transfer_id'], {
      name: 'idx_transfer_items_transfer_id'
    });
    await queryInterface.addIndex('transfer_items', ['product_id'], {
      name: 'idx_transfer_items_product_id'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('transfer_items');
  }
};