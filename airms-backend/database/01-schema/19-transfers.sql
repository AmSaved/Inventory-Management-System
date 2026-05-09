CREATE TABLE transfers (
    id SERIAL PRIMARY KEY,
    transfer_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Source (from)
    from_user_id INTEGER REFERENCES users(id),
    from_branch_id INTEGER REFERENCES branches(id),
    
    -- Destination (to)
    to_user_id INTEGER REFERENCES users(id),
    to_branch_id INTEGER REFERENCES branches(id),
    
    -- Transfer metadata
    transfer_type VARCHAR(20) NOT NULL CHECK (transfer_type IN ('user_to_user', 'user_to_branch', 'branch_to_user', 'branch_to_branch')),
    requested_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    transfer_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Validation: Ensure proper source/destination based on type
    CHECK (
        (transfer_type = 'user_to_user' AND from_user_id IS NOT NULL AND to_user_id IS NOT NULL AND from_branch_id IS NULL AND to_branch_id IS NULL) OR
        (transfer_type = 'user_to_branch' AND from_user_id IS NOT NULL AND to_branch_id IS NOT NULL AND from_branch_id IS NULL AND to_user_id IS NULL) OR
        (transfer_type = 'branch_to_user' AND from_branch_id IS NOT NULL AND to_user_id IS NOT NULL AND from_user_id IS NULL AND to_branch_id IS NULL) OR
        (transfer_type = 'branch_to_branch' AND from_branch_id IS NOT NULL AND to_branch_id IS NOT NULL AND from_user_id IS NULL AND to_user_id IS NULL)
    )
);