'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Update Users
    await queryInterface.addColumn('users', 'company_id', {
      type: Sequelize.INTEGER,
      references: { model: 'companies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    await queryInterface.addColumn('users', 'org_unit_id', {
      type: Sequelize.INTEGER,
      references: { model: 'organization_units', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.removeColumn('users', 'branch_id');
    await queryInterface.removeColumn('users', 'department_id');

    // 2. Update Roles & Permissions
    await queryInterface.addColumn('roles', 'company_id', {
      type: Sequelize.INTEGER,
      allowNull: true, // System-wide roles might exist
      references: { model: 'companies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    await queryInterface.addColumn('permissions', 'company_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'companies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    // 3. Update Products
    await queryInterface.addColumn('products', 'company_id', {
      type: Sequelize.INTEGER,
      references: { model: 'companies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    // 4. Update Inventory
    await queryInterface.addColumn('inventory', 'company_id', {
      type: Sequelize.INTEGER,
      references: { model: 'companies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    await queryInterface.addColumn('inventory', 'org_unit_id', {
      type: Sequelize.INTEGER,
      references: { model: 'organization_units', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    await queryInterface.removeColumn('inventory', 'branch_id');

    // 5. Update Requests
    await queryInterface.addColumn('requests', 'company_id', {
      type: Sequelize.INTEGER,
      references: { model: 'companies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    await queryInterface.addColumn('requests', 'org_unit_id', {
      type: Sequelize.INTEGER,
      references: { model: 'organization_units', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.removeColumn('requests', 'branch_id');

    // 6. Update Activity Logs
    await queryInterface.addColumn('activity_logs', 'company_id', {
      type: Sequelize.INTEGER,
      references: { model: 'companies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    await queryInterface.removeColumn('activity_logs', 'branch_id');

    // 7. Update Store Forms
    await queryInterface.addColumn('store_forms', 'company_id', {
      type: Sequelize.INTEGER,
      references: { model: 'companies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    await queryInterface.addColumn('store_forms', 'org_unit_id', {
      type: Sequelize.INTEGER,
      references: { model: 'organization_units', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.removeColumn('store_forms', 'branch_id');

    // 8. Update Discharge Forms (Has from/to)
    await queryInterface.addColumn('discharge_forms', 'company_id', {
      type: Sequelize.INTEGER,
      references: { model: 'companies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    await queryInterface.addColumn('discharge_forms', 'from_unit_id', {
      type: Sequelize.INTEGER,
      references: { model: 'organization_units', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.addColumn('discharge_forms', 'to_unit_id', {
      type: Sequelize.INTEGER,
      references: { model: 'organization_units', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.removeColumn('discharge_forms', 'from_branch_id');
    await queryInterface.removeColumn('discharge_forms', 'to_branch_id');

    // 9. Update Assignments
    await queryInterface.addColumn('assignments', 'company_id', {
      type: Sequelize.INTEGER,
      references: { model: 'companies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    await queryInterface.addColumn('assignments', 'org_unit_id', {
      type: Sequelize.INTEGER,
      references: { model: 'organization_units', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.removeColumn('assignments', 'branch_id');

    // 10. Update Returns
    await queryInterface.addColumn('returns', 'company_id', {
      type: Sequelize.INTEGER,
      references: { model: 'companies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    await queryInterface.addColumn('returns', 'from_unit_id', {
      type: Sequelize.INTEGER,
      references: { model: 'organization_units', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.addColumn('returns', 'to_unit_id', {
      type: Sequelize.INTEGER,
      references: { model: 'organization_units', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.removeColumn('returns', 'from_branch_id');
    await queryInterface.removeColumn('returns', 'to_branch_id');

    // 11. Update Transfers
    await queryInterface.addColumn('transfers', 'company_id', {
      type: Sequelize.INTEGER,
      references: { model: 'companies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    await queryInterface.addColumn('transfers', 'from_unit_id', {
      type: Sequelize.INTEGER,
      references: { model: 'organization_units', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.addColumn('transfers', 'to_unit_id', {
      type: Sequelize.INTEGER,
      references: { model: 'organization_units', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.removeColumn('transfers', 'from_branch_id');
    await queryInterface.removeColumn('transfers', 'to_branch_id');

    // 12. Update Issues
    await queryInterface.addColumn('issues', 'company_id', {
      type: Sequelize.INTEGER,
      references: { model: 'companies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    await queryInterface.addColumn('issues', 'org_unit_id', {
      type: Sequelize.INTEGER,
      references: { model: 'organization_units', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.removeColumn('issues', 'branch_id');
  },

  down: async (queryInterface, Sequelize) => {
      // Reverting would involve re-adding columns and removing new ones
      // This is complex, but the standard migration path is forward
  }
};
