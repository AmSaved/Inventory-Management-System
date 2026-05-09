const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Role = sequelize.define('Role', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT
    },
    level: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    company_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'companies',
            key: 'id'
        }
    },
    visibility_scope: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'own_node',
        comment: 'Determines the data visibility scope for this role within the organization hierarchy'
    },
    org_node_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'organization_nodes',
            key: 'id'
        }
    },
    created_by_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    }
}, {
    tableName: 'roles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Role;