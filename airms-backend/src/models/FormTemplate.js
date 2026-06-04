const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FormTemplate = sequelize.define('FormTemplate', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    template_key: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    module: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'inventory'
    },
    icon: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    schema: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: []
    },
    company_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'companies',
            key: 'id'
        }
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
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
    }
}, {
    tableName: 'form_templates',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            unique: true,
            fields: ['template_key', 'company_id', 'module'],
            name: 'form_templates_key_company_module_unique'
        }
    ]
});

module.exports = FormTemplate;
