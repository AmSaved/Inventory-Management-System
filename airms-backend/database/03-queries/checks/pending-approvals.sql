-- Pending approvals by approver type
-- Chairman pending
SELECT 
    r.request_number,
    u.first_name || ' ' || u.last_name AS requester,
    b.name AS branch,
    r.priority,
    r.created_at,
    EXTRACT(DAY FROM (NOW() - r.created_at)) AS days_pending
FROM requests r
JOIN users u ON r.requester_id = u.id
JOIN branches b ON r.branch_id = b.id
LEFT JOIN approvals a ON r.id = a.request_id AND a.approval_level = 1
WHERE r.status = 'pending_chairman'
  AND a.id IS NULL
ORDER BY r.priority DESC, r.created_at ASC;

-- Storage Manager pending
SELECT 
    r.request_number,
    u.first_name || ' ' || u.last_name AS requester,
    b.name AS branch,
    r.priority,
    r.created_at,
    EXTRACT(DAY FROM (NOW() - r.created_at)) AS days_pending
FROM requests r
JOIN users u ON r.requester_id = u.id
JOIN branches b ON r.branch_id = b.id
LEFT JOIN approvals a ON r.id = a.request_id AND a.approval_level = 2
WHERE r.status = 'pending_storage'
  AND a.id IS NULL
ORDER BY r.priority DESC, r.created_at ASC;