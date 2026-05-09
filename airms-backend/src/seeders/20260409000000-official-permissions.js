'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const permissionsList = [
      // User Management
      { name: 'user:create', resource: 'users', action: 'create', description: 'Create new users' },
      { name: 'user:read', resource: 'users', action: 'read', description: 'View user details' },
      { name: 'user:update', resource: 'users', action: 'update', description: 'Update user information' },
      { name: 'user:delete', resource: 'users', action: 'delete', description: 'Delete users' },
      { name: 'user:activate', resource: 'users', action: 'activate', description: 'Activate/deactivate users' },
      { name: 'user:impersonate', resource: 'users', action: 'impersonate', description: 'Login as another user' },
      { name: 'user:export', resource: 'users', action: 'export', description: 'Export user list' },
      { name: 'user:import', resource: 'users', action: 'import', description: 'Bulk import users' },

      // Role Management
      { name: 'role:create', resource: 'roles', action: 'create', description: 'Create new roles' },
      { name: 'role:read', resource: 'roles', action: 'read', description: 'View role details' },
      { name: 'role:update', resource: 'roles', action: 'update', description: 'Update role information' },
      { name: 'role:delete', resource: 'roles', action: 'delete', description: 'Delete roles' },
      { name: 'role:assign', resource: 'roles', action: 'assign', description: 'Assign roles to users' },
      { name: 'role:permissions', resource: 'roles', action: 'permissions', description: 'Manage role permissions' },
      { name: 'role:visibility:global', resource: 'roles', action: 'visibility', description: 'Grant global visibility to roles' },
      { name: 'role:visibility:sub_units', resource: 'roles', action: 'visibility', description: 'Grant multi-unit visibility to roles' },
      { name: 'role:visibility:own_node', resource: 'roles', action: 'visibility', description: 'Restrict role to single node visibility' },

      // Permission Management
      { name: 'permission:create', resource: 'permissions', action: 'create', description: 'Create new permissions' },
      { name: 'permission:read', resource: 'permissions', action: 'read', description: 'View permissions' },
      { name: 'permission:update', resource: 'permissions', action: 'update', description: 'Update permissions' },
      { name: 'permission:delete', resource: 'permissions', action: 'delete', description: 'Delete permissions' },
      { name: 'permission:assign', resource: 'permissions', action: 'assign', description: 'Assign permissions to roles/users' },

      // Branch Management
      { name: 'branch:create', resource: 'branches', action: 'create', description: 'Create new branches' },
      { name: 'branch:read', resource: 'branches', action: 'read', description: 'View branch details' },
      { name: 'branch:update', resource: 'branches', action: 'update', description: 'Update branch information' },
      { name: 'branch:delete', resource: 'branches', action: 'delete', description: 'Delete branches' },
      { name: 'branch:activate', resource: 'branches', action: 'activate', description: 'Activate/deactivate branches' },
      { name: 'branch:transfer', resource: 'branches', action: 'transfer', description: 'Transfer inventory between branches' },
      { name: 'branch:reports', resource: 'branches', action: 'reports', description: 'View branch-specific reports' },

      // Product Management
      { name: 'product:create', resource: 'products', action: 'create', description: 'Create new products' },
      { name: 'product:read', resource: 'products', action: 'read', description: 'View product details' },
      { name: 'product:update', resource: 'products', action: 'update', description: 'Update product information' },
      { name: 'product:delete', resource: 'products', action: 'delete', description: 'Delete products' },
      { name: 'product:activate', resource: 'products', action: 'activate', description: 'Activate/deactivate products' },
      { name: 'product:import', resource: 'products', action: 'import', description: 'Bulk import products' },
      { name: 'product:export', resource: 'products', action: 'export', description: 'Export product list' },
      { name: 'product:barcode', resource: 'products', action: 'barcode', description: 'Generate barcodes for products' },

      // Inventory Management
      { name: 'inventory:view', resource: 'inventory', action: 'view', description: 'View inventory levels' },
      { name: 'inventory:adjust', resource: 'inventory', action: 'adjust', description: 'Adjust inventory quantities' },
      { name: 'inventory:count', resource: 'inventory', action: 'count', description: 'Perform inventory counting' },
      { name: 'inventory:transfer', resource: 'inventory', action: 'transfer', description: 'Transfer inventory between branches' },
      { name: 'inventory:low-stock', resource: 'inventory', action: 'low-stock', description: 'View low stock alerts' },
      { name: 'inventory:reorder', resource: 'inventory', action: 'reorder', description: 'Create reorder requests' },
      { name: 'inventory:reports', resource: 'inventory', action: 'reports', description: 'Generate inventory reports' },
      { name: 'inventory:audit', resource: 'inventory', action: 'audit', description: 'View inventory audit trail' },

      // Request Management
      { name: 'request:create', resource: 'requests', action: 'create', description: 'Create new requests' },
      { name: 'request:read', resource: 'requests', action: 'read', description: 'View requests' },
      { name: 'request:update', resource: 'requests', action: 'update', description: 'Update pending requests' },
      { name: 'request:delete', resource: 'requests', action: 'delete', description: 'Delete requests' },
      { name: 'request:cancel', resource: 'requests', action: 'cancel', description: 'Cancel requests' },
      { name: 'request:approve', resource: 'requests', action: 'approve', description: 'Dynamically approve workflow steps' },
      { name: 'request:reject', resource: 'requests', action: 'reject', description: 'Reject requests' },
      { name: 'request:priority', resource: 'requests', action: 'priority', description: 'Set request priority' },
      { name: 'request:assign', resource: 'requests', action: 'assign', description: 'Assign requests to users' },
      { name: 'request:escalate', resource: 'requests', action: 'escalate', description: 'Escalate urgent requests' },

      // Discharge Management
      { name: 'discharge:create', resource: 'discharge', action: 'create', description: 'Create discharge forms' },
      { name: 'discharge:read', resource: 'discharge', action: 'read', description: 'View discharge forms' },
      { name: 'discharge:update', resource: 'discharge', action: 'update', description: 'Update discharge forms' },
      { name: 'discharge:delete', resource: 'discharge', action: 'delete', description: 'Delete discharge forms' },
      { name: 'discharge:approve', resource: 'discharge', action: 'approve', description: 'Approve discharge' },
      { name: 'discharge:reject', resource: 'discharge', action: 'reject', description: 'Reject discharge' },
      { name: 'discharge:execute', resource: 'discharge', action: 'execute', description: 'Execute discharge (issue assets)' },
      { name: 'discharge:cancel', resource: 'discharge', action: 'cancel', description: 'Cancel discharge' },
      { name: 'discharge:print', resource: 'discharge', action: 'print', description: 'Print discharge documents' },
      { name: 'discharge:export', resource: 'discharge', action: 'export', description: 'Export discharge records' },

      // Assignment Management
      { name: 'assignment:view', resource: 'assignments', action: 'view', description: 'View assignments' },
      { name: 'assignment:create', resource: 'assignments', action: 'create', description: 'Create assignments' },
      { name: 'assignment:update', resource: 'assignments', action: 'update', description: 'Update assignments' },
      { name: 'assignment:transfer', resource: 'assignments', action: 'transfer', description: 'Transfer assignments between users' },
      { name: 'assignment:return', resource: 'assignments', action: 'return', description: 'Process asset returns' },
      { name: 'assignment:extend', resource: 'assignments', action: 'extend', description: 'Extend assignment due date' },
      { name: 'assignment:terminate', resource: 'assignments', action: 'terminate', description: 'Early termination of assignments' },
      { name: 'assignment:report', resource: 'assignments', action: 'report', description: 'Report issues with assigned assets' },
      { name: 'assignment:history', resource: 'assignments', action: 'history', description: 'View assignment history' },

      // Return Management
      { name: 'return:request', resource: 'returns', action: 'request', description: 'Request asset return' },
      { name: 'return:read', resource: 'returns', action: 'read', description: 'View return requests' },
      { name: 'return:approve', resource: 'returns', action: 'approve', description: 'Approve returns' },
      { name: 'return:reject', resource: 'returns', action: 'reject', description: 'Reject returns' },
      { name: 'return:process', resource: 'returns', action: 'process', description: 'Process returns (receive items)' },
      { name: 'return:inspect', resource: 'returns', action: 'inspect', description: 'Inspect returned items' },
      { name: 'return:damage', resource: 'returns', action: 'damage', description: 'Report damage on returns' },
      { name: 'return:restock', resource: 'returns', action: 'restock', description: 'Restock returned items' },

      // Transfer Management
      { name: 'transfer:request', resource: 'transfers', action: 'request', description: 'Request transfers' },
      { name: 'transfer:read', resource: 'transfers', action: 'read', description: 'View transfers' },
      { name: 'transfer:approve', resource: 'transfers', action: 'approve', description: 'Approve transfers' },
      { name: 'transfer:reject', resource: 'transfers', action: 'reject', description: 'Reject transfers' },
      { name: 'transfer:execute', resource: 'transfers', action: 'execute', description: 'Execute transfers' },
      { name: 'transfer:cancel', resource: 'transfers', action: 'cancel', description: 'Cancel transfers' },
      { name: 'transfer:history', resource: 'transfers', action: 'history', description: 'View transfer history' },

      // Issue Management
      { name: 'issue:report', resource: 'issues', action: 'report', description: 'Report issues' },
      { name: 'issue:read', resource: 'issues', action: 'read', description: 'View issues' },
      { name: 'issue:update', resource: 'issues', action: 'update', description: 'Update issues' },
      { name: 'issue:assign', resource: 'issues', action: 'assign', description: 'Assign issues to staff' },
      { name: 'issue:resolve', resource: 'issues', action: 'resolve', description: 'Resolve issues' },
      { name: 'issue:close', resource: 'issues', action: 'close', description: 'Close issues' },
      { name: 'issue:reopen', resource: 'issues', action: 'reopen', description: 'Reopen closed issues' },
      { name: 'issue:escalate', resource: 'issues', action: 'escalate', description: 'Escalate critical issues' },
      { name: 'issue:priority', resource: 'issues', action: 'priority', description: 'Set issue priority' },

      // Report Management
      { name: 'report:view', resource: 'reports', action: 'view', description: 'View reports' },
      { name: 'report:create', resource: 'reports', action: 'create', description: 'Create custom reports' },
      { name: 'report:export', resource: 'reports', action: 'export', description: 'Export reports (PDF, Excel, CSV)' },
      { name: 'report:schedule', resource: 'reports', action: 'schedule', description: 'Schedule automated reports' },
      { name: 'report:email', resource: 'reports', action: 'email', description: 'Email reports to recipients' },
      { name: 'report:delete', resource: 'reports', action: 'delete', description: 'Delete reports' },
      { name: 'report:dashboard', resource: 'reports', action: 'dashboard', description: 'View dashboard widgets' },
      { name: 'report:analytics', resource: 'reports', action: 'analytics', description: 'View advanced analytics' },

      // Dashboard Management
      { name: 'dashboard:view', resource: 'dashboard', action: 'view', description: 'View main dashboard' },
      { name: 'dashboard:executive', resource: 'dashboard', action: 'executive', description: 'View executive dashboard' },
      { name: 'dashboard:branch', resource: 'dashboard', action: 'branch', description: 'View branch dashboard' },
      { name: 'dashboard:personal', resource: 'dashboard', action: 'personal', description: 'View personal dashboard' },
      { name: 'dashboard:customize', resource: 'dashboard', action: 'customize', description: 'Customize dashboard layout' },
      { name: 'dashboard:widgets', resource: 'dashboard', action: 'widgets', description: 'Add/remove dashboard widgets' },

      // Settings Management
      { name: 'settings:view', resource: 'settings', action: 'view', description: 'View system settings' },
      { name: 'settings:update', resource: 'settings', action: 'update', description: 'Update system settings' },
      { name: 'settings:backup', resource: 'settings', action: 'backup', description: 'Backup system data' },
      { name: 'settings:restore', resource: 'settings', action: 'restore', description: 'Restore system data' },
      { name: 'settings:audit', resource: 'settings', action: 'audit', description: 'View audit logs' },
      { name: 'settings:maintenance', resource: 'settings', action: 'maintenance', description: 'Put system in maintenance mode' },
      { name: 'settings:logs', resource: 'settings', action: 'logs', description: 'View system logs' },

      // Notification Management
      { name: 'notification:read', resource: 'notifications', action: 'read', description: 'Read notifications' },
      { name: 'notification:send', resource: 'notifications', action: 'send', description: 'Send notifications' },
      { name: 'notification:configure', resource: 'notifications', action: 'configure', description: 'Configure notification channels' },
      { name: 'notification:template', resource: 'notifications', action: 'template', description: 'Manage notification templates' },
      { name: 'notification:bulk', resource: 'notifications', action: 'bulk', description: 'Send bulk notifications' },

      // Audit & Logging
      { name: 'audit:view', resource: 'audit', action: 'view', description: 'View audit logs' },
      { name: 'audit:export', resource: 'audit', action: 'export', description: 'Export audit logs' },
      { name: 'audit:delete', resource: 'audit', action: 'delete', description: 'Delete old audit logs' },
      { name: 'audit:monitor', resource: 'audit', action: 'monitor', description: 'Real-time activity monitoring' },

      // System Management
      { name: 'system:status', resource: 'system', action: 'status', description: 'View system status' },
      { name: 'system:health', resource: 'system', action: 'health', description: 'Check system health' },
      { name: 'system:cache', resource: 'system', action: 'cache', description: 'Clear system cache' },
      { name: 'system:maintenance', resource: 'system', action: 'maintenance', description: 'Perform system maintenance' },
      { name: 'system:upgrade', resource: 'system', action: 'upgrade', description: 'Upgrade system' },
      { name: 'system:config', resource: 'system', action: 'config', description: 'Modify system configuration' },

      // Workflow Management
      { name: 'workflow:create', resource: 'workflow', action: 'create', description: 'Create new workflows' },
      { name: 'workflow:read', resource: 'workflow', action: 'read', description: 'View workflow details' },
      { name: 'workflow:update', resource: 'workflow', action: 'update', description: 'Update workflow configuration' },
      { name: 'workflow:delete', resource: 'workflow', action: 'delete', description: 'Delete workflows' },
      { name: 'workflow:manage', resource: 'workflow', action: 'manage', description: 'Full workflow orchestration' },

      // Logistics & Store Operations (Ported)
      { name: 'item:request', resource: 'items', action: 'request', description: 'Ability to request new products from the catalog' },
      { name: 'stock:intake', resource: 'stock', action: 'intake', description: 'Record new inventory arrivals (Store Item)' },
      { name: 'stock:discharge', resource: 'stock', action: 'discharge', description: 'Release assets for distribution (Discharge Item)' },
      { name: 'stock:transfer', resource: 'stock', action: 'transfer', description: 'Initiate asset transfers between organizational nodes' },
      { name: 'stock:return', resource: 'stock', action: 'return', description: 'Handle returning of issued assets into inventory' },
      { name: 'stock:return:approve', resource: 'stock', action: 'approve', description: 'Approve bulk inventory returns from sub-branches' },
      { name: 'stock:return:reject', resource: 'stock', action: 'reject', description: 'Reject inventory returns from sub-branches' },

      // Advanced Asset & Inventory (Ported)
      { name: 'inventory:split', resource: 'inventory', action: 'split', description: 'Split inventory items into multiple records' },
      { name: 'inventory:merge', resource: 'inventory', action: 'merge', description: 'Merge multiple inventory records into one' },
      { name: 'asset:transfer_peer', resource: 'assets', action: 'transfer_peer', description: 'Transfer assets directly between users' },
      { name: 'asset:report_issue', resource: 'assets', action: 'report_issue', description: 'Report issues or damages on assigned assets' },
      { name: 'organization:manage', resource: 'organization', action: 'manage', description: 'Manage organization nodes and hierarchy' },
      { name: 'report:generate', resource: 'reports', action: 'generate', description: 'Access and generate analytical system reports' },
      { name: 'permission:manage', resource: 'permissions', action: 'manage', description: 'Full administrative control over the permission system' },
      
      // Master Governance Permissions (to replace hardcoded Levels)
      { name: 'user:manage:all', resource: 'users', action: 'manage_all', description: 'Manage all users regardless of who created them' },
      { name: 'organization:manage_roots', resource: 'organization', action: 'manage_roots', description: 'Create and delete root organization nodes' },
      { name: 'hierarchy:all:view', resource: 'hierarchy', action: 'view_all', description: 'Global visibility across the entire organizational tree' },
      { name: 'role:manage:all', resource: 'roles', action: 'manage_all', description: 'Manage all roles without level restrictions' },
      { name: 'system:manage', resource: 'system', action: 'manage', description: 'Universal master administrative access' }
    ];

    for (const perm of permissionsList) {
      const existing = await queryInterface.sequelize.query(
        `SELECT id FROM permissions WHERE name = :name LIMIT 1`,
        { 
          replacements: { name: perm.name },
          type: Sequelize.QueryTypes.SELECT 
        }
      );

      if (existing.length === 0) {
        await queryInterface.bulkInsert('permissions', [{
          ...perm,
          created_at: new Date(),
          updated_at: new Date()
        }]);
      }
    }
    return;
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('permissions', null, {});
  }
};
