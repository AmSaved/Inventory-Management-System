'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Users Table
    await queryInterface.addIndex('users', ['company_id']);
    await queryInterface.addIndex('users', ['org_node_id']);
    await queryInterface.addIndex('users', ['created_at']);

    // 2. Inventory Table
    await queryInterface.addIndex('inventory', ['company_id']);
    await queryInterface.addIndex('inventory', ['org_node_id']);
    await queryInterface.addIndex('inventory', ['created_at']);

    // 3. Activity Logs
    await queryInterface.addIndex('activity_logs', ['company_id']);
    await queryInterface.addIndex('activity_logs', ['created_at']);
    // Note: org_node_id already has an index from a previous migration

    // 4. Requests
    await queryInterface.addIndex('requests', ['company_id']);
    await queryInterface.addIndex('requests', ['org_node_id']);
    await queryInterface.addIndex('requests', ['created_at']);

    // 5. Products
    await queryInterface.addIndex('products', ['company_id']);
    await queryInterface.addIndex('products', ['created_at']);

    // 6. Assignments
    await queryInterface.addIndex('assignments', ['company_id']);
    await queryInterface.addIndex('assignments', ['org_node_id']);
    await queryInterface.addIndex('assignments', ['created_at']);

    // 7. Returns
    await queryInterface.addIndex('returns', ['company_id']);
    await queryInterface.addIndex('returns', ['created_at']);

    // 8. Transfers
    await queryInterface.addIndex('transfers', ['company_id']);
    await queryInterface.addIndex('transfers', ['created_at']);
  },

  down: async (queryInterface, Sequelize) => {
    // Removal of indexes if rolled back
    await queryInterface.removeIndex('users', ['company_id']);
    await queryInterface.removeIndex('users', ['org_node_id']);
    await queryInterface.removeIndex('users', ['created_at']);
    
    await queryInterface.removeIndex('inventory', ['company_id']);
    await queryInterface.removeIndex('inventory', ['org_node_id']);
    await queryInterface.removeIndex('inventory', ['created_at']);
    
    await queryInterface.removeIndex('activity_logs', ['company_id']);
    await queryInterface.removeIndex('activity_logs', ['created_at']);
    
    await queryInterface.removeIndex('requests', ['company_id']);
    await queryInterface.removeIndex('requests', ['org_node_id']);
    await queryInterface.removeIndex('requests', ['created_at']);
    
    await queryInterface.removeIndex('products', ['company_id']);
    await queryInterface.removeIndex('products', ['created_at']);
    
    await queryInterface.removeIndex('assignments', ['company_id']);
    await queryInterface.removeIndex('assignments', ['org_node_id']);
    await queryInterface.removeIndex('assignments', ['created_at']);
    
    await queryInterface.removeIndex('returns', ['company_id']);
    await queryInterface.removeIndex('returns', ['created_at']);
    
    await queryInterface.removeIndex('transfers', ['company_id']);
    await queryInterface.removeIndex('transfers', ['created_at']);
  }
};
