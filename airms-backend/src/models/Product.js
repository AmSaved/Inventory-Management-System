const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    sku: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT
    },
    category: {
        type: DataTypes.STRING(50)
    },
    sub_category: {
        type: DataTypes.STRING(50)
    },
    brand: {
        type: DataTypes.STRING(100)
    },
    model: {
        type: DataTypes.STRING(100)
    },
    unit: {
        type: DataTypes.STRING(20)
    },
    // Physical Specifications
    weight: {
        type: DataTypes.STRING(50)
    },
    dimensions: {
        type: DataTypes.STRING(100)
    },
    color: {
        type: DataTypes.STRING(50)
    },
    material: {
        type: DataTypes.STRING(100)
    },
    // Technical Specifications (For IT/Electronics)
    processor: {
        type: DataTypes.STRING(100)
    },
    ram: {
        type: DataTypes.STRING(50)
    },
    storage: {
        type: DataTypes.STRING(100)
    },
    graphics: {
        type: DataTypes.STRING(100)
    },
    display: {
        type: DataTypes.STRING(100)
    },
    os: {
        type: DataTypes.STRING(50)
    },
    battery: {
        type: DataTypes.STRING(100)
    },
    ports: {
        type: DataTypes.TEXT
    },
    // Media & Documentation
    image_url: {
        type: DataTypes.TEXT
    },
    images: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    catalog_url: {
        type: DataTypes.TEXT
    },
    manual_url: {
        type: DataTypes.TEXT
    },
    // Inventory Thresholds
    reorder_quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    barcode_data: {
        type: DataTypes.TEXT
    },
    qr_code_data: {
        type: DataTypes.TEXT
    },
    specifications: {
        type: DataTypes.JSONB,
        defaultValue: {}
    },
    custom_fields: {
        type: DataTypes.JSONB,
        defaultValue: {}
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    company_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'companies',
            key: 'id'
        }
    }
}, {
    tableName: 'products',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Product;