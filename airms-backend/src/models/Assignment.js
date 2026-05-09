const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Assignment = sequelize.define('Assignment', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    assignment_number: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: true // Handled by DB trigger
    },
    discharge_item_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'discharge_items',
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
    user_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    company_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'companies',
            key: 'id'
        }
    },
    org_node_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'organization_nodes',
            key: 'id'
        }
    },
    serial_number: {
        type: DataTypes.STRING(100)
    },
    assigned_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    expected_return_date: {
        type: DataTypes.DATE
    },
    actual_return_date: {
        type: DataTypes.DATE
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active'
    },
    condition_at_assignment: {
        type: DataTypes.STRING(20)
    },
    condition_at_return: {
        type: DataTypes.STRING(20)
    },
    notes: {
        type: DataTypes.TEXT
    }
}, {
    tableName: 'assignments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Assignment;