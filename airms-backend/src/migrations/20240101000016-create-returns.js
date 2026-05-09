'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('returns', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      return_number: {
        type: Sequelize.STRING(50),
        unique: true,
        allowNull: false
      },
      assignment_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'assignments',
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
      from_branch_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'branches',
          key: 'id'
        }
      },
      to_branch_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'branches',
          key: 'id'
        }
      },
      request_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'requests',
          key: 'id'
        }
      },
      return_type: {
        type: Sequelize.STRING(20),
        defaultValue: 'normal'
      },
      status: {
        type: Sequelize.STRING(20),
        defaultValue: 'pending'
      },
      received_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      received_at: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('returns', ['return_number'], {
      name: 'idx_returns_return_number'
    });
    await queryInterface.addIndex('returns', ['assignment_id'], {
      name: 'idx_returns_assignment_id'
    });
    await queryInterface.addIndex('returns', ['user_id'], {
      name: 'idx_returns_user_id'
    });
    await queryInterface.addIndex('returns', ['status'], {
      name: 'idx_returns_status'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('returns');
  }
};