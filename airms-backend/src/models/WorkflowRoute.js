const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WorkflowRoute = sequelize.define('WorkflowRoute', {
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
        }
    },
    source_step_id: {
        type: DataTypes.INTEGER,
        allowNull: true, // If null, it means it's an entry point route
        references: {
            model: 'workflow_steps',
            key: 'id'
        }
    },
    target_step_id: {
        type: DataTypes.INTEGER,
        allowNull: true, // If null, it means it's an exit point route (terminates)
        references: {
            model: 'workflow_steps',
            key: 'id'
        }
    },
    action_trigger: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: 'approve', // approve, reject, escalate, etc
        comment: 'The action taken on the source step to trigger this route'
    }
}, {
    tableName: 'workflow_routes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = WorkflowRoute;
