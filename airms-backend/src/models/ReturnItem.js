const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ReturnItem = sequelize.define('ReturnItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    return_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'returns',
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
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1
        }
    },
    condition: {
        type: DataTypes.STRING(20)
    },
    remarks: {
        type: DataTypes.TEXT
    }
}, {
    tableName: 'return_items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = ReturnItem;