const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Workflow = sequelize.define('Workflow', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
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
        allowNull: true, // If null, applies to whole company
        references: {
            model: 'organization_nodes',
            key: 'id'
        }
    },
    name: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    resource_type: {
        type: DataTypes.STRING(50), // e.g. 'request', 'discharge', 'transfer_peer'
        allowNull: false
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    created_by: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
            key: 'id'
        }
    }
}, {
    tableName: 'workflows',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Workflow;
