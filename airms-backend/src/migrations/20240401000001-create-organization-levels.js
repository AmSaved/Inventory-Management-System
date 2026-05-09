'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('organization_levels', {
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
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      rank: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: '1 for highest, 2 for second level, etc.'
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

    // Unique constraint: A company cannot have two levels with the same rank or name
    await queryInterface.addConstraint('organization_levels', {
        fields: ['company_id', 'rank'],
        type: 'unique',
        name: 'unique_company_rank'
    });
    await queryInterface.addConstraint('organization_levels', {
        fields: ['company_id', 'name'],
        type: 'unique',
        name: 'unique_company_level_name'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('organization_levels');
  }
};
