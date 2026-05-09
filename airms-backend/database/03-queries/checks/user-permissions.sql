-- Check user permissions
SELECT 
    u.employee_id,
    u.first_name || ' ' || u.last_name AS user_name,
    r.name AS role_name,
    p.name AS permission_name,
    p.resource,
    p.action
FROM users u
JOIN roles r ON u.role_id = r.id
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
WHERE u.id = $1
UNION
SELECT 
    u.employee_id,
    u.first_name || ' ' || u.last_name AS user_name,
    r.name AS role_name,
    p.name AS permission_name,
    p.resource,
    p.action
FROM users u
JOIN roles r ON u.role_id = r.id
LEFT JOIN user_permissions up ON u.id = up.user_id
LEFT JOIN permissions p ON up.permission_id = p.id
WHERE u.id = $1 AND up.expires_at IS NULL OR up.expires_at > NOW();