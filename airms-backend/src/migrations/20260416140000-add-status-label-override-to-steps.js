'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('workflow_steps', 'status_label_override', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('workflow_steps', 'status_label_override');
  }
};
