'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('workflows', {
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
        org_node_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'organization_nodes',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        name: {
            type: Sequelize.STRING(200),
            allowNull: false
        },
        resource_type: {
            type: Sequelize.STRING(50),
            allowNull: false
        },
        is_active: {
            type: Sequelize.BOOLEAN,
            defaultValue: true
        },
        created_by: {
            type: Sequelize.INTEGER,
            references: {
                model: 'users',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
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

    await queryInterface.createTable('workflow_steps', {
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
        step_order: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        required_role_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'roles',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        required_permission: {
            type: Sequelize.STRING(100),
            allowNull: true
        },
        action_name: {
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
    await queryInterface.dropTable('workflow_steps');
    await queryInterface.dropTable('workflows');
  }
};
