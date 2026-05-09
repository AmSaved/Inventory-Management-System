module.exports = {
    // User roles
    ROLES: {
        SUPER_ADMIN: 1,
        CHAIRMAN: 2,
        STORAGE_MANAGER: 3,
        CLUSTER_MANAGER: 4,
        USER: 5
    },

    // Role names
    ROLE_NAMES: {
        1: 'super_admin',
        2: 'chairman',
        3: 'storage_manager',
        4: 'cluster_manager',
        5: 'user'
    },

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
    TRANSFER_TYPES: {
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
        DAMAGED: 'damaged',
        TRANSFERRED: 'transferred'
    },

    // Return types
    RETURN_TYPE: {
        NORMAL: 'normal',
        DAMAGE: 'damage',
        MAINTENANCE: 'maintenance'
    },

    // Return status
    RETURN_STATUS: {
        PENDING: 'pending',
        COMPLETED: 'completed',
        REJECTED: 'rejected',
        CANCELLED: 'cancelled'
    },

    // Transfer status
    TRANSFER_STATUS: {
        PENDING: 'pending',
        APPROVED: 'approved',
        COMPLETED: 'completed',
        REJECTED: 'rejected',
        CANCELLED: 'cancelled'
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
    },

    // Issue status
    ISSUE_STATUS: {
        OPEN: 'open',
        IN_PROGRESS: 'in_progress',
        RESOLVED: 'resolved',
        CLOSED: 'closed'
    },

    // Priorities
    PRIORITY: {
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high',
        URGENT: 'urgent'
    },

    // Branch types
    BRANCH_TYPE: {
        CENTRAL: 'central',
        BRANCH: 'branch',
        WAREHOUSE: 'warehouse'
    },

    // Notification types
    NOTIFICATION_TYPE: {
        INFO: 'info',
        SUCCESS: 'success',
        WARNING: 'warning',
        ERROR: 'error'
    },

    // Notification priorities
    NOTIFICATION_PRIORITY: {
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high'
    },

    // Activity actions
    ACTIVITY_ACTIONS: {
        CREATE: 'CREATE',
        UPDATE: 'UPDATE',
        DELETE: 'DELETE',
        VIEW: 'VIEW',
        APPROVE: 'APPROVE',
        REJECT: 'REJECT',
        CANCEL: 'CANCEL',
        EXECUTE: 'EXECUTE',
        LOGIN: 'LOGIN',
        LOGOUT: 'LOGOUT'
    },

    // HTTP status codes
    HTTP_STATUS: {
        OK: 200,
        CREATED: 201,
        ACCEPTED: 202,
        NO_CONTENT: 204,
        BAD_REQUEST: 400,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        CONFLICT: 409,
        UNPROCESSABLE: 422,
        TOO_MANY_REQUESTS: 429,
        INTERNAL_SERVER: 500,
        BAD_GATEWAY: 502,
        SERVICE_UNAVAILABLE: 503
    },

    // File types
    FILE_TYPES: {
        IMAGE: ['jpg', 'jpeg', 'png', 'gif', 'bmp'],
        DOCUMENT: ['pdf', 'doc', 'docx', 'txt'],
        SPREADSHEET: ['xls', 'xlsx', 'csv']
    },

    // Date formats
    DATE_FORMATS: {
        DEFAULT: 'YYYY-MM-DD',
        DISPLAY: 'MMM DD, YYYY',
        DATETIME: 'YYYY-MM-DD HH:mm:ss',
        TIME: 'HH:mm:ss',
        MONTH: 'YYYY-MM',
        YEAR: 'YYYY'
    },

    // Pagination defaults
    PAGINATION: {
        DEFAULT_PAGE: 1,
        DEFAULT_LIMIT: 10,
        MAX_LIMIT: 100
    },

    // Cache durations (in seconds)
    CACHE_DURATION: {
        SHORT: 60,
        MEDIUM: 300,
        LONG: 3600,
        DAY: 86400
    },

    // SKU prefixes by category
    SKU_PREFIX: {
        IT: 'IT',
        FURNITURE: 'FUR',
        OFFICE: 'OFF',
        STATIONERY: 'STN',
        OTHER: 'OTH'
    },

    // Product categories
    PRODUCT_CATEGORIES: [
        'IT',
        'Furniture',
        'Office Equipment',
        'Stationery',
        'Other'
    ],

    // Report types
    REPORT_TYPES: [
        'inventory-valuation',
        'asset-utilization',
        'request-analytics',
        'discharge-report',
        'return-report',
        'transfer-report',
        'issue-report',
        'user-activity',
        'branch-performance',
        'low-stock',
        'overdue-assets'
    ],

    // Export formats
    EXPORT_FORMATS: {
        JSON: 'json',
        EXCEL: 'excel',
        PDF: 'pdf',
        CSV: 'csv'
    }
};