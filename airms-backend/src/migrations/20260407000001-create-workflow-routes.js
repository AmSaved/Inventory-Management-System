'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('workflow_routes', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      workflow_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'workflows',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      source_step_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'workflow_steps',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      target_step_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'workflow_steps',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      action_trigger: {
        type: Sequelize.STRING(100),
        allowNull: false
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
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('workflow_routes');
  }
};
