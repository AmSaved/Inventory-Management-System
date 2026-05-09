CREATE TABLE activity_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    resource VARCHAR(50) NOT NULL,
    resource_id INTEGER,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    branch_id INTEGER REFERENCES branches(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);