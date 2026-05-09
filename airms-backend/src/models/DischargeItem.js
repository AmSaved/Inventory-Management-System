const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DischargeItem = sequelize.define('DischargeItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    discharge_form_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'discharge_forms',
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
    batch_number: {
        type: DataTypes.STRING(100)
    },
    condition: {
        type: DataTypes.STRING(20),
        defaultValue: 'new'
    },
    to_node_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'organization_nodes',
            key: 'id'
        }
    },
    to_user_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    notes: {
        type: DataTypes.TEXT
    }
}, {
    tableName: 'discharge_items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = DischargeItem;