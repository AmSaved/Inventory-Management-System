'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('approvals', 'discharge_form_id', {
      type: Sequelize.INTEGER,
      references: {
        model: 'discharge_forms',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      allowNull: true
    });

    await queryInterface.addColumn('approvals', 'store_form_id', {
      type: Sequelize.INTEGER,
      references: {
        model: 'store_forms',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('approvals', 'discharge_form_id');
    await queryInterface.removeColumn('approvals', 'store_form_id');
  }
};
