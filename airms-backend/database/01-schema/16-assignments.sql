CREATE TABLE assignments (
    id SERIAL PRIMARY KEY,
    assignment_number VARCHAR(50) UNIQUE NOT NULL,
    discharge_item_id INTEGER REFERENCES discharge_items(id),
    product_id INTEGER REFERENCES products(id),
    user_id INTEGER REFERENCES users(id),
    branch_id INTEGER REFERENCES branches(id),
    serial_number VARCHAR(100),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expected_return_date DATE,
    actual_return_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    condition_at_assignment VARCHAR(20),
    condition_at_return VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);