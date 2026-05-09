const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Issue = sequelize.define('Issue', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    issue_number: {
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
    product_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'products',
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
    issue_type: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    severity: {
        type: DataTypes.STRING(20),
        defaultValue: 'medium'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    reported_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    reported_by: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    assigned_to: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'open'
    },
    resolution_notes: {
        type: DataTypes.TEXT
    },
    resolved_at: {
        type: DataTypes.DATE
    },
    resolved_by: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
            key: 'id'
        }
    }
}, {
    tableName: 'issues',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Issue;