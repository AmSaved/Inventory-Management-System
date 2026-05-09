-- Low stock alerts
SELECT 
    b.name AS branch_name,
    p.sku,
    p.name AS product_name,
    i.quantity,
    i.minimum_quantity,
    i.maximum_quantity,
    CASE 
        WHEN i.quantity <= i.minimum_quantity THEN 'CRITICAL'
        WHEN i.quantity <= i.minimum_quantity * 1.5 THEN 'WARNING'
        ELSE 'OK'
    END AS alert_level
FROM inventory i
JOIN products p ON i.product_id = p.id
JOIN branches b ON i.branch_id = b.id
WHERE i.quantity <= i.minimum_quantity * 1.5
ORDER BY alert_level, (i.quantity::float / i.minimum_quantity) ASC;