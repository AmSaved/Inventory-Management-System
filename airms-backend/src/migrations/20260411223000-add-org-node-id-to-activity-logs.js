'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('activity_logs', 'org_node_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'organization_nodes',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Add index for performance in scoped audit logs
    await queryInterface.addIndex('activity_logs', ['org_node_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('activity_logs', ['org_node_id']);
    await queryInterface.removeColumn('activity_logs', 'org_node_id');
  }
};
