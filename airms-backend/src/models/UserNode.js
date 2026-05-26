const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserNode = sequelize.define('UserNode', {
    user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    org_node_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
            model: 'organization_nodes',
            key: 'id'
        }
    }
}, {
    tableName: 'user_nodes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = UserNode;
