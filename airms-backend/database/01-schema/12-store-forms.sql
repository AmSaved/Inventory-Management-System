CREATE TABLE store_forms (
    id SERIAL PRIMARY KEY,
    store_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id INTEGER REFERENCES branches(id),
    created_by INTEGER REFERENCES users(id),
    supplier VARCHAR(200),
    invoice_number VARCHAR(100),
    invoice_date DATE,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);