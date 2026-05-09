const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrganizationNode = sequelize.define('OrganizationNode', {
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
    parent_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'organization_nodes',
            key: 'id'
        }
    },
    org_type_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'organization_types',
            key: 'id'
        }
    },
    name: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    code: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    manager_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    location_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Reference to a location ID or physical address'
    },
    can_store_inventory: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    path: {
        type: DataTypes.TEXT,
        comment: 'Materialized path (e.g. /1/5/12) for faster tree searches'
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true, // Allow null for legacy nodes
        references: {
            model: 'users',
            key: 'id'
        }
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: 'Dynamic configurations for this specific node (cost center, timezone, etc)'
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive', 'archived'),
        defaultValue: 'active'
    }
}, {
    tableName: 'organization_nodes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = OrganizationNode;
