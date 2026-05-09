const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DischargeForm = sequelize.define('DischargeForm', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    discharge_number: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: true // Handled by DB trigger
    },
    company_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'companies',
            key: 'id'
        }
    },
    from_node_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'organization_nodes',
            key: 'id'
        }
    },
    request_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'requests',
            key: 'id'
        }
    },
    to_user_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    to_node_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'organization_nodes',
            key: 'id'
        }
    },
    discharge_type: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending'
    },
    workflow_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'workflows',
            key: 'id'
        }
    },
    current_step_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'workflow_steps',
            key: 'id'
        }
    },
    workflow_status: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    approved_by: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    approved_at: {
        type: DataTypes.DATE
    },
    notes: {
        type: DataTypes.TEXT
    },
    created_by: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
            key: 'id'
        }
    }
}, {
    tableName: 'discharge_forms',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = DischargeForm;