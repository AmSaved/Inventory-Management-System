'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('issues', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      issue_number: {
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
      issue_type: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      severity: {
        type: Sequelize.STRING(20),
        defaultValue: 'medium'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      reported_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      reported_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      assigned_to: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      status: {
        type: Sequelize.STRING(20),
        defaultValue: 'open'
      },
      resolution_notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      resolved_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      resolved_by: {
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

    await queryInterface.addIndex('issues', ['issue_number'], {
      name: 'idx_issues_issue_number'
    });
    await queryInterface.addIndex('issues', ['assignment_id'], {
      name: 'idx_issues_assignment_id'
    });
    await queryInterface.addIndex('issues', ['user_id'], {
      name: 'idx_issues_user_id'
    });
    await queryInterface.addIndex('issues', ['status'], {
      name: 'idx_issues_status'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('issues');
  }
};