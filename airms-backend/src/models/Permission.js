const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Permission = sequelize.define('Permission', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        unique: true,
        allowNull: false
    },
    resource: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    action: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT
    },
    company_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'companies',
            key: 'id'
        }
    }
}, {
    tableName: 'permissions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Permission;