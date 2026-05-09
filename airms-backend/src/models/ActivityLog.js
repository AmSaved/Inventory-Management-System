const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ActivityLog = sequelize.define('ActivityLog', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    action: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    resource: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    resource_id: {
        type: DataTypes.INTEGER
    },
    details: {
        type: DataTypes.JSONB
    },
    ip_address: {
        type: DataTypes.INET
    },
    user_agent: {
        type: DataTypes.TEXT
    },
    company_id: {
        type: DataTypes.INTEGER,
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
    }
}, {
    tableName: 'activity_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = ActivityLog;