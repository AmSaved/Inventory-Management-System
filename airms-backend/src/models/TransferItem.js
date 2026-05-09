const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TransferItem = sequelize.define('TransferItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    transfer_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'transfers',
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
    serial_numbers: {
        type: DataTypes.ARRAY(DataTypes.TEXT)
    },
    condition: {
        type: DataTypes.STRING(20)
    }
}, {
    tableName: 'transfer_items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = TransferItem;