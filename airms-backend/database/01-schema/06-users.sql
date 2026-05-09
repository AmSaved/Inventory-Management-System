CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    role_id INTEGER REFERENCES roles(id),
    branch_id INTEGER REFERENCES branches(id),
    is_active BOOLEAN DEFAULT true,
    requires_password_change BOOLEAN DEFAULT false,
    last_login TIMESTAMP,
    refresh_token TEXT,
    refresh_token_expires TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);