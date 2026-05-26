'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add metadata column to Inventory table
    await queryInterface.addColumn('inventory', 'metadata', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {}
    });

    // 2. Create FormTemplates table
    await queryInterface.createTable('form_templates', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      template_key: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      module: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'inventory',
        comment: 'inventory, request, issue, etc.'
      },
      schema: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: []
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
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
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

    // Add unique index for template_key per company and module
    await queryInterface.addIndex('form_templates', ['template_key', 'company_id', 'module'], {
      unique: true,
      name: 'form_templates_key_company_module_unique'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('form_templates');
    await queryInterface.removeColumn('inventory', 'metadata');
  }
};
