CREATE TABLE user_permissions (
    user_id INTEGER NOT NULL,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    granted_by INTEGER,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, permission_id)
);