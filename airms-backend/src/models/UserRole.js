const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserRole = sequelize.define('UserRole', {
    user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    role_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
            model: 'roles',
            key: 'id'
        }
    },
    assigned_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'user_roles',
    timestamps: false
});

module.exports = UserRole;
