const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RequestItem = sequelize.define('RequestItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    request_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'requests',
            key: 'id'
        }
    },
    product_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'products',
            key: 'id'
        }
    },
    quantity_requested: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1
        }
    },
    quantity_approved: {
        type: DataTypes.INTEGER
    },
    quantity_fulfilled: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    specifications: {
        type: DataTypes.JSONB
    },
    notes: {
        type: DataTypes.TEXT
    }
}, {
    tableName: 'request_items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = RequestItem;