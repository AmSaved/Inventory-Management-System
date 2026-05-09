'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('assignments', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      assignment_number: {
        type: Sequelize.STRING(50),
        unique: true,
        allowNull: false
      },
      discharge_item_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'discharge_items',
          key: 'id'
        }
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'products',
          key: 'id'
        }
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      branch_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'branches',
          key: 'id'
        }
      },
      serial_number: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      assigned_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      expected_return_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      actual_return_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      status: {
        type: Sequelize.STRING(20),
        defaultValue: 'active'
      },
      condition_at_assignment: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      condition_at_return: {
        type: Sequelize.STRING(20),
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
    await queryInterface.dropTable('assignments');
  }
};