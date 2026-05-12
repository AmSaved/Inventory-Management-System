const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StoreItem = sequelize.define('StoreItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    store_form_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'store_forms',
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
    is_serialized: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    unit_price: {
        type: DataTypes.DECIMAL(10, 2)
    },
    total_price: {
        type: DataTypes.DECIMAL(10, 2)
    },
    batch_number: {
        type: DataTypes.STRING(100)
    },
    serial_number: {
        type: DataTypes.STRING(100)
    },
    expiry_date: {
        type: DataTypes.DATE
    },
    notes: {
        type: DataTypes.TEXT
    }
}, {
    tableName: 'store_items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = StoreItem;