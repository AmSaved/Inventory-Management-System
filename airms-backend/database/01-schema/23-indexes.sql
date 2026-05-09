-- Enable pg_trgm for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Performance indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_employee_id ON users(employee_id);
CREATE INDEX idx_users_branch_id ON users(branch_id);
CREATE INDEX idx_users_role_id ON users(role_id);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category);

CREATE INDEX idx_inventory_branch_id ON inventory(branch_id);
CREATE INDEX idx_inventory_product_id ON inventory(product_id);

CREATE INDEX idx_requests_requester_id ON requests(requester_id);
CREATE INDEX idx_requests_branch_id ON requests(branch_id);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_request_number ON requests(request_number);

CREATE INDEX idx_approvals_request_id ON approvals(request_id);
CREATE INDEX idx_approvals_approver_id ON approvals(approver_id);

CREATE INDEX idx_discharge_forms_from_branch_id ON discharge_forms(from_branch_id);
CREATE INDEX idx_discharge_forms_request_id ON discharge_forms(request_id);

CREATE INDEX idx_assignments_user_id ON assignments(user_id);
CREATE INDEX idx_assignments_status ON assignments(status);

CREATE INDEX idx_returns_assignment_id ON returns(assignment_id);

CREATE INDEX idx_transfers_from_branch_id ON transfers(from_branch_id);
CREATE INDEX idx_transfers_to_branch_id ON transfers(to_branch_id);

CREATE INDEX idx_issues_assignment_id ON issues(assignment_id);
CREATE INDEX idx_issues_user_id ON issues(user_id);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
-- Additional indexes for transfers
CREATE INDEX idx_transfers_from_user_id ON transfers(from_user_id);
CREATE INDEX idx_transfers_to_user_id ON transfers(to_user_id);
CREATE INDEX idx_transfers_from_branch_id ON transfers(from_branch_id);
CREATE INDEX idx_transfers_to_branch_id ON transfers(to_branch_id);
CREATE INDEX idx_transfers_transfer_type ON transfers(transfer_type);
CREATE INDEX idx_transfers_status ON transfers(status);