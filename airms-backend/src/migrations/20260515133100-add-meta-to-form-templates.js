'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add icon and description to form_templates
    await queryInterface.addColumn('form_templates', 'icon', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('form_templates', 'description', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('form_templates', 'icon');
    await queryInterface.removeColumn('form_templates', 'description');
  }
};
