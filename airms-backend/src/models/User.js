const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    employee_id: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    email: {
        type: DataTypes.STRING(100),
        unique: true,
        allowNull: false,
        validate: {
            isEmail: true,
            notEmpty: true
        }
    },
    username: {
        type: DataTypes.STRING(100),
        unique: true,
        allowNull: true // Allow true initially for migrations, but we'll enforce it in logic
    },
    password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    first_name: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    last_name: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    phone: {
        type: DataTypes.STRING(20)
    },
    role_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'roles',
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
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    requires_password_change: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    last_login: {
        type: DataTypes.DATE
    },
    refresh_token: {
        type: DataTypes.TEXT
    },
    refresh_token_expires: {
        type: DataTypes.DATE
    },
    created_by: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
            key: 'id'
        }
    }
}, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
        beforeCreate: async (user) => {
            if (user.email) {
                user.email = user.email.toLowerCase();
            }
            if (user.password_hash) {
                const salt = await bcrypt.genSalt(10);
                user.password_hash = await bcrypt.hash(user.password_hash, salt);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('email')) {
                user.email = user.email.toLowerCase();
            }
            if (user.changed('password_hash')) {
                const salt = await bcrypt.genSalt(10);
                user.password_hash = await bcrypt.hash(user.password_hash, salt);
            }
        }
    }
});

// Instance methods
User.prototype.validatePassword = async function(password) {
    return bcrypt.compare(password, this.password_hash);
};

User.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    delete values.password_hash;
    delete values.refresh_token;
    return values;
};

module.exports = User;