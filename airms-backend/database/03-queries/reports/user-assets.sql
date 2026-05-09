-- Assets assigned to users
SELECT 
    u.employee_id,
    u.first_name || ' ' || u.last_name AS user_name,
    b.name AS branch_name,
    COUNT(a.id) AS total_assets,
    STRING_AGG(DISTINCT p.category, ', ') AS asset_categories
FROM assignments a
JOIN users u ON a.user_id = u.id
JOIN branches b ON u.branch_id = b.id
JOIN products p ON a.product_id = p.id
WHERE a.status = 'active'
GROUP BY u.id, u.employee_id, u.first_name, u.last_name, b.name
ORDER BY total_assets DESC;

-- Assets due for return
SELECT 
    a.assignment_number,
    u.first_name || ' ' || u.last_name AS assigned_to,
    p.name AS product_name,
    a.assigned_at,
    a.expected_return_date,
    EXTRACT(DAY FROM (a.expected_return_date - CURRENT_DATE)) AS days_until_due
FROM assignments a
JOIN users u ON a.user_id = u.id
JOIN products p ON a.product_id = p.id
WHERE a.status = 'active' 
  AND a.expected_return_date IS NOT NULL
ORDER BY a.expected_return_date ASC;