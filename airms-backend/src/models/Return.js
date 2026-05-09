const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Return = sequelize.define('Return', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    return_number: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: true // Handled by DB trigger
    },
    assignment_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'assignments',
            key: 'id'
        }
    },
    company_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'companies',
            key: 'id'
        }
    },
    user_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
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
    to_node_id: {
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
    return_type: {
        type: DataTypes.STRING(20),
        defaultValue: 'normal'
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending'
    },
    workflow_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'workflows',
            key: 'id'
        }
    },
    current_step_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'workflow_steps',
            key: 'id'
        }
    },
    received_by: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    received_at: {
        type: DataTypes.DATE
    },
    notes: {
        type: DataTypes.TEXT
    }
}, {
    tableName: 'returns',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Return;