const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Approval = sequelize.define('Approval', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    request_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'requests',
            key: 'id'
        }
    },
    approver_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    approval_level: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    comments: {
        type: DataTypes.TEXT
    },
    approved_at: {
        type: DataTypes.DATE
    },
    discharge_form_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'discharge_forms',
            key: 'id'
        }
    },
    store_form_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'store_forms',
            key: 'id'
        }
    },
    transfer_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'transfers',
            key: 'id'
        }
    },
    return_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'returns',
            key: 'id'
        }
    }
}, {
    tableName: 'approvals',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Approval;