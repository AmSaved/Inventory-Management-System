const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Company = sequelize.define('Company', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    tax_id: {
        type: DataTypes.STRING(50),
        unique: true
    },
    subdomain: {
        type: DataTypes.STRING(50),
        unique: true
    },
    logo_url: {
        type: DataTypes.TEXT
    },
    country: {
        type: DataTypes.STRING(100),
        defaultValue: 'Ethiopia'
    },
    city: {
        type: DataTypes.STRING(100)
    },
    currency: {
        type: DataTypes.STRING(10),
        defaultValue: 'ETB'
    },
    timezone: {
        type: DataTypes.STRING(50),
        defaultValue: 'Africa/Addis_Ababa'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'companies',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Company;
