-- Request statistics by status
SELECT 
    status,
    COUNT(*) AS total_requests,
    COUNT(CASE WHEN priority = 'urgent' THEN 1 END) AS urgent_count,
    COUNT(CASE WHEN priority = 'high' THEN 1 END) AS high_count,
    AVG(EXTRACT(DAY FROM (COALESCE(completed_date, NOW()) - created_at))) AS avg_days_to_complete
FROM requests
GROUP BY status
ORDER BY total_requests DESC;

-- Request trend over time
SELECT 
    DATE_TRUNC('month', created_at) AS month,
    COUNT(*) AS total_requests,
    COUNT(CASE WHEN status = 'approved' THEN 1 END) AS approved,
    COUNT(CASE WHEN status LIKE '%rejected%' THEN 1 END) AS rejected
FROM requests
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;