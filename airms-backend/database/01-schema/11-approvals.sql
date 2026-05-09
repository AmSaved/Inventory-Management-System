CREATE TABLE approvals (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
    approver_id INTEGER REFERENCES users(id),
    approval_level INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    comments TEXT,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);