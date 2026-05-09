const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Request = sequelize.define('Request', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    request_number: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: true // Handled by DB trigger
    },
    requester_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
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
    org_node_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'organization_nodes',
            key: 'id'
        }
    },
    request_type: {
        type: DataTypes.STRING(50),
        defaultValue: 'new'
    },
    status: {
        type: DataTypes.STRING(50),
        defaultValue: 'pending'
    },
    priority: {
        type: DataTypes.STRING(20),
        defaultValue: 'medium'
    },
    purpose: {
        type: DataTypes.TEXT
    },
    chairman_approval_status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending'
    },
    chairman_approved_at: {
        type: DataTypes.DATE
    },
    chairman_approver_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    chairman_comment: {
        type: DataTypes.TEXT
    },
    storage_approval_status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending'
    },
    storage_approved_at: {
        type: DataTypes.DATE
    },
    storage_approver_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    storage_comment: {
        type: DataTypes.TEXT
    },
    expected_delivery_date: {
        type: DataTypes.DATE
    },
    completed_date: {
        type: DataTypes.DATE
    },
    is_emergency: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    notes: {
        type: DataTypes.TEXT
    },
    cancelled_at: {
        type: DataTypes.DATE
    },
    cancelled_by: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
            key: 'id'
        }
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
    },
    target_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    }
}, {
    tableName: 'requests',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Request;