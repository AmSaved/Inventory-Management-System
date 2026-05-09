'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Drop in order to handle potential remaining foreign keys
    await queryInterface.dropTable('departments');
    await queryInterface.dropTable('branches');
  },

  down: async (queryInterface, Sequelize) => {
      // Re-creating these with their original schema would be needed for rollback
  }
};
