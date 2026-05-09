const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WorkflowStatus = sequelize.define('WorkflowStatus', {
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
        type: DataTypes.STRING(100),
        allowNull: false
    },
    color: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: '#3b82f6'
    },
    is_system: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'workflow_statuses',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = WorkflowStatus;
