const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StoreForm = sequelize.define('StoreForm', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    store_number: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: true // Handled by DB trigger
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
    created_by: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    supplier: {
        type: DataTypes.STRING(200)
    },
    invoice_number: {
        type: DataTypes.STRING(100)
    },
    invoice_date: {
        type: DataTypes.DATE
    },
    notes: {
        type: DataTypes.TEXT
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'completed'
    },
    workflow_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'workflows',
            key: 'id'
        }
    },
    current_step_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'workflow_steps',
            key: 'id'
        }
    },
    workflow_status: {
        type: DataTypes.STRING(100),
        allowNull: true
    }
}, {
    tableName: 'store_forms',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = StoreForm;