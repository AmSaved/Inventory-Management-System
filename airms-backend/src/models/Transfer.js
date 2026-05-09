const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Transfer = sequelize.define('Transfer', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    transfer_number: {
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
    from_user_id: {
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
    transfer_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            isIn: [['user_to_user', 'user_to_node', 'node_to_user', 'node_to_node']]
        }
    },
    requested_by: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
            key: 'id'
        }
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
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending'
    },
    transfer_date: {
        type: DataTypes.DATE
    },
    notes: {
        type: DataTypes.TEXT
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
        allowNull: true,
        comment: 'Human-readable status based on current workflow step'
    }
}, {
    tableName: 'transfers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Transfer;