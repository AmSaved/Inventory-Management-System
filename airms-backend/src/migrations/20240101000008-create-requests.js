'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('requests', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      request_number: {
        type: Sequelize.STRING(50),
        unique: true,
        allowNull: false
      },
      requester_id: {
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
      request_type: {
        type: Sequelize.STRING(50),
        defaultValue: 'new'
      },
      status: {
        type: Sequelize.STRING(50),
        defaultValue: 'pending_chairman'
      },
      priority: {
        type: Sequelize.STRING(20),
        defaultValue: 'medium'
      },
      purpose: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      expected_delivery_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      completed_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      is_emergency: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      cancelled_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      cancelled_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
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
    await queryInterface.dropTable('requests');
  }
};