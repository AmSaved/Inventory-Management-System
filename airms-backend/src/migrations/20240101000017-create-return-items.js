'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('return_items', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      return_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'returns',
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
      condition: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      remarks: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('return_items', ['return_id'], {
      name: 'idx_return_items_return_id'
    });
    await queryInterface.addIndex('return_items', ['product_id'], {
      name: 'idx_return_items_product_id'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('return_items');
  }
};