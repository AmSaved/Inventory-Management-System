-- Inventory valuation report by branch
SELECT 
    b.name AS branch_name,
    COUNT(DISTINCT i.product_id) AS unique_products,
    SUM(i.quantity) AS total_quantity,
    SUM(i.quantity * COALESCE(si.unit_price, 0)) AS total_value
FROM inventory i
JOIN branches b ON i.branch_id = b.id
LEFT JOIN (
    SELECT DISTINCT ON (product_id) product_id, unit_price
    FROM store_items
    ORDER BY product_id, created_at DESC
) si ON i.product_id = si.product_id
WHERE i.quantity > 0
GROUP BY b.id, b.name
ORDER BY total_value DESC;

-- Low value inventory items
SELECT 
    p.sku,
    p.name,
    i.quantity,
    i.minimum_quantity,
    i.branch_id,
    b.name AS branch_name
FROM inventory i
JOIN products p ON i.product_id = p.id
JOIN branches b ON i.branch_id = b.id
WHERE i.quantity <= i.minimum_quantity
ORDER BY (i.quantity::float / i.minimum_quantity) ASC;