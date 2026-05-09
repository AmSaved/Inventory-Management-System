'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('organization_units', {
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
      parent_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'organization_units',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      org_level_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'organization_levels',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      code: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      can_store_inventory: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      path: {
        type: Sequelize.TEXT,
        comment: 'Materialized path like /1/5/12 for faster tree searches'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
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

    // Unique constraint: A company cannot have two units with the same code or same name under same level
    await queryInterface.addConstraint('organization_units', {
        fields: ['company_id', 'code'],
        type: 'unique',
        name: 'unique_company_unit_code'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('organization_units');
  }
};
