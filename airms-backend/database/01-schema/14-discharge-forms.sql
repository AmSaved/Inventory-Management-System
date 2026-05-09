CREATE TABLE discharge_forms (
    id SERIAL PRIMARY KEY,
    discharge_number VARCHAR(50) UNIQUE NOT NULL,
    from_branch_id INTEGER REFERENCES branches(id),
    request_id INTEGER REFERENCES requests(id),
    to_user_id INTEGER REFERENCES users(id),
    to_branch_id INTEGER REFERENCES branches(id),
    discharge_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (discharge_type = 'user' AND to_user_id IS NOT NULL AND to_branch_id IS NULL) OR
        (discharge_type = 'branch' AND to_branch_id IS NOT NULL AND to_user_id IS NULL) OR
        (discharge_type = 'department' AND to_branch_id IS NOT NULL AND to_user_id IS NULL)
    )
);