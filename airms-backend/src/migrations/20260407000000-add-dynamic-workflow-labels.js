'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create workflow_statuses table (the "Label Table")
    await queryInterface.createTable('workflow_statuses', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'companies',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      color: {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: '#3b82f6' // Default blue
      },
      is_system: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // 2. Add status_id to workflow_steps
    await queryInterface.addColumn('workflow_steps', 'status_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'workflow_statuses',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // 3. Ensure all resource tables have workflow columns (Request and Transfer already have them)
    // Checking Return, Issue, Discharge, Store
    const tables = ['returns', 'issues', 'discharge_forms', 'store_forms'];
    for (const table of tables) {
      await queryInterface.addColumn(table, 'workflow_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'workflows', key: 'id' }
      });
      await queryInterface.addColumn(table, 'current_step_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'workflow_steps', key: 'id' }
      });
      await queryInterface.addColumn(table, 'workflow_status', {
        type: Sequelize.STRING(100),
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tables = ['returns', 'issues', 'discharge_forms', 'store_forms'];
    for (const table of tables) {
      await queryInterface.removeColumn(table, 'workflow_status');
      await queryInterface.removeColumn(table, 'current_step_id');
      await queryInterface.removeColumn(table, 'workflow_id');
    }
    await queryInterface.removeColumn('workflow_steps', 'status_id');
    await queryInterface.dropTable('workflow_statuses');
  }
};
