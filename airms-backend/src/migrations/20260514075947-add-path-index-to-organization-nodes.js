'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Critical index for hierarchical materialized path queries
    await queryInterface.addIndex('organization_nodes', ['path']);
    
    // 2. Ensure company_id is indexed for node filtering (if not already)
    await queryInterface.addIndex('organization_nodes', ['company_id']);

    // 3. Activity Log performance
    await queryInterface.addIndex('activity_logs', ['user_id']);
    await queryInterface.addIndex('activity_logs', ['resource_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('organization_nodes', ['path']);
    await queryInterface.removeIndex('organization_nodes', ['company_id']);
    await queryInterface.removeIndex('activity_logs', ['user_id']);
    await queryInterface.removeIndex('activity_logs', ['resource_id']);
  }
};
