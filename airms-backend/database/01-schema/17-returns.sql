CREATE TABLE returns (
    id SERIAL PRIMARY KEY,
    return_number VARCHAR(50) UNIQUE NOT NULL,
    assignment_id INTEGER REFERENCES assignments(id),
    user_id INTEGER REFERENCES users(id),
    from_branch_id INTEGER REFERENCES branches(id),
    to_branch_id INTEGER REFERENCES branches(id),
    request_id INTEGER REFERENCES requests(id),
    return_type VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(20) DEFAULT 'pending',
    received_by INTEGER REFERENCES users(id),
    received_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);