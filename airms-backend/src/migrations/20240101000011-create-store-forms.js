'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('store_forms', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      store_number: {
        type: Sequelize.STRING(50),
        unique: true,
        allowNull: false
      },
      branch_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'branches',
          key: 'id'
        }
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      supplier: {
        type: Sequelize.STRING(200),
        allowNull: true
      },
      invoice_number: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      invoice_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.STRING(20),
        defaultValue: 'completed'
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
    await queryInterface.dropTable('store_forms');
  }
};
