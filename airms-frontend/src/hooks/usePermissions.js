import { useAuth } from './useAuth';

export const usePermissions = () => {
  const { user, hasPermission } = useAuth();

  const permissions = {
    canCreateUser: () => hasPermission('user:create'),
    canReadUser: () => hasPermission('user:read'),
    canUpdateUser: () => hasPermission('user:update'),
    canDeleteUser: () => hasPermission('user:delete'),

    canCreateRequest: () => hasPermission('request:create'),
    canReadRequest: () => hasPermission('request:read'),
    canUpdateRequest: () => hasPermission('request:update'),
    canDeleteRequest: () => hasPermission('request:delete'),
    canApproveChairman: () => hasPermission('request:approve-chairman'),
    canApproveStorage: () => hasPermission('request:approve-storage'),

    canViewInventory: () => hasPermission('inventory:view'),
    canAdjustInventory: () => hasPermission('inventory:adjust'),

    canCreateDischarge: () => hasPermission('discharge:create'),
    canExecuteDischarge: () => hasPermission('discharge:execute'),

    canViewAssignments: () => hasPermission('assignment:view'),
    canUpdateAssignments: () => hasPermission('assignment:update'),

    canViewReports: () => hasPermission('report:view'),
    canGenerateReports: () => hasPermission('report:generate'),

    canViewDashboard: () => hasPermission('dashboard:view'),
  };

  return permissions;
};