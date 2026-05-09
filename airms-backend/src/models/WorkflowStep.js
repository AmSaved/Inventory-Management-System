const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WorkflowStep = sequelize.define('WorkflowStep', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    workflow_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'workflows',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    step_order: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    required_role_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'roles',
            key: 'id'
        }
    },
    required_permission: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    action_name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    status_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'workflow_statuses',
            key: 'id'
        }
    },
    status_label_override: {
        type: DataTypes.STRING(100),
        allowNull: true
    }
}, {
    tableName: 'workflow_steps',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = WorkflowStep;
