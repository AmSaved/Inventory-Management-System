module.exports = {
  // Request statuses
  REQUEST_STATUS: {
    PENDING_CHAIRMAN: 'pending_chairman',
    REJECTED_CHAIRMAN: 'rejected_chairman',
    PENDING_STORAGE: 'pending_storage',
    REJECTED_STORAGE: 'rejected_storage',
    APPROVED: 'approved',
    CANCELLED: 'cancelled'
  },

  // Approval levels
  APPROVAL_LEVEL: {
    CHAIRMAN: 1,
    STORAGE_MANAGER: 2
  },

  // Discharge types
  DISCHARGE_TYPE: {
    USER: 'user',
    BRANCH: 'branch',
    DEPARTMENT: 'department'
  },

  // Transfer types
  TRANSFER_TYPE: {
    USER_TO_USER: 'user_to_user',
    USER_TO_NODE: 'user_to_node',
    NODE_TO_USER: 'node_to_user',
    NODE_TO_NODE: 'node_to_node'
  },

  // Assignment status
  ASSIGNMENT_STATUS: {
    ACTIVE: 'active',
    RETURNED: 'returned',
    LOST: 'lost',
    DAMAGED: 'damaged'
  },

  // Roles
  ROLES: {
    SUPER_ADMIN: 1,
    CHAIRMAN: 2,
    STORAGE_MANAGER: 3,
    CLUSTER_MANAGER: 4,
    USER: 5
  },

  // Priorities
  PRIORITY: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
  },

  // Issue types
  ISSUE_TYPE: {
    DAMAGE: 'damage',
    FAULT: 'fault',
    LOST: 'lost',
    MAINTENANCE: 'maintenance'
  },

  // Issue severity
  ISSUE_SEVERITY: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
  }
};