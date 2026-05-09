const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrganizationType = sequelize.define('OrganizationType', {
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
    name: {
        // e.g., "Ministry", "Department", "Warehouse", "Branch"
        type: DataTypes.STRING(100),
        allowNull: false
    },
    code_prefix: {
        // e.g., "MIN-", "DEPT-", "WH-"
        type: DataTypes.STRING(100),
        allowNull: true
    },
    description: {
        type: DataTypes.TEXT
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    is_storage_allowed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_department: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_approval_unit: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    level_order: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Helps in sorting types from top to bottom (Org -> Branch -> Dept)'
    }
}, {
    tableName: 'organization_types',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = OrganizationType;
