const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserPermission = sequelize.define('UserPermission', {
    user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    permission_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
            model: 'permissions',
            key: 'id'
        }
    },
    granted_by: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    granted_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    expires_at: {
        type: DataTypes.DATE
    }
}, {
    tableName: 'user_permissions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = UserPermission;