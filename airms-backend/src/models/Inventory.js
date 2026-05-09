const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Inventory = sequelize.define('Inventory', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    product_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'products',
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
        allowNull: false,
        references: {
            model: 'organization_nodes',
            key: 'id'
        }
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0
        }
    },
    minimum_quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    maximum_quantity: {
        type: DataTypes.INTEGER
    },
    location_details: {
        type: DataTypes.STRING(100)
    },
    serial_number: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    batch_number: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'available'
    },
    unit_cost: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00
    },
    // Financial Information
    current_value: {
        type: DataTypes.DECIMAL(10, 2)
    },
    purchase_date: {
        type: DataTypes.DATE
    },
    warranty_expiry: {
        type: DataTypes.DATE
    },
    supplier: {
        type: DataTypes.STRING(200)
    },
    invoice_number: {
        type: DataTypes.STRING(100)
    },
    // Lifecycle & Physical
    expiry_date: {
        type: DataTypes.DATE
    },
    condition: {
        type: DataTypes.STRING(50) // new, used, damaged, maintenance
    },
    // Assignment Information (for serialized units)
    assigned_to: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    assigned_at: {
        type: DataTypes.DATE
    },
    expected_return_date: {
        type: DataTypes.DATE
    },
    assignment_notes: {
        type: DataTypes.TEXT
    },
    last_counted_at: {
        type: DataTypes.DATE
    }
}, {
    tableName: 'inventory',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['product_id', 'org_node_id']
        },
        {
            fields: ['serial_number']
        }
    ]
});

module.exports = Inventory;