-- Cleanup old activity logs
DELETE FROM activity_logs
WHERE created_at < NOW() - INTERVAL '1 year';

-- Cleanup expired refresh tokens
UPDATE users 
SET refresh_token = NULL, refresh_token_expires = NULL
WHERE refresh_token_expires < NOW();

-- Reindex tables
REINDEX TABLE activity_logs;
REINDEX TABLE requests;
REINDEX TABLE inventory;