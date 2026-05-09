'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('products', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      sku: {
        type: Sequelize.STRING(50),
        unique: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      category: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      sub_category: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      brand: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      model: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      unit: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      barcode_data: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      qr_code_data: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      specifications: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      image_url: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('products');
  }
};