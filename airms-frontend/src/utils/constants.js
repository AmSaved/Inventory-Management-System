export const REQUEST_STATUS = {
  PENDING_CHAIRMAN: 'pending_chairman',
  REJECTED_CHAIRMAN: 'rejected_chairman',
  PENDING_STORAGE: 'pending_storage',
  REJECTED_STORAGE: 'rejected_storage',
  PENDING_DISCHARGE: 'pending_discharge',
  APPROVED: 'approved',
  CANCELLED: 'cancelled',
};

export const REQUEST_STATUS_COLORS = {
  pending_chairman: 'warning',
  rejected_chairman: 'danger',
  pending_storage: 'warning',
  rejected_storage: 'danger',
  pending_discharge: 'info',
  approved: 'success',
  cancelled: 'default',
};

export const ASSIGNMENT_STATUS = {
  ACTIVE: 'active',
  RETURNED: 'returned',
  LOST: 'lost',
  DAMAGED: 'damaged',
};

export const ASSIGNMENT_STATUS_COLORS = {
  active: 'success',
  returned: 'info',
  lost: 'danger',
  damaged: 'warning',
};

export const ISSUE_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

export const ISSUE_SEVERITY_COLORS = {
  low: 'info',
  medium: 'warning',
  high: 'warning',
  critical: 'danger',
};

export const PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
};

export const PRIORITY_COLORS = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
};