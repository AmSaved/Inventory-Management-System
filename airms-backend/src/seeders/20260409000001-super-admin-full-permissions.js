'use strict';

const { Role, Permission, RolePermission } = require('../models');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      const adminRoles = await queryInterface.sequelize.query(
        `SELECT id, name FROM roles WHERE name ILIKE '%admin%' OR level >= 80`,
        { type: Sequelize.QueryTypes.SELECT }
      );

      if (!adminRoles || adminRoles.length === 0) {
        console.error('No Admin-tier roles found. Skipping permission assignment.');
        return;
      }

      const roleIds = adminRoles.map(r => r.id);

      // 2. Fetch all permissions
      const permissions = await queryInterface.sequelize.query(
        `SELECT id FROM permissions`,
        { type: Sequelize.QueryTypes.SELECT }
      );

      if (!permissions || permissions.length === 0) {
        console.error('No permissions found. Skipping assignment.');
        return;
      }

      // 3. Prepare role_permissions mapping (Only insert if not exists)
      const existingMappings = await queryInterface.sequelize.query(
        `SELECT permission_id, role_id FROM role_permissions WHERE role_id IN (:roleIds)`,
        { 
          replacements: { roleIds },
          type: Sequelize.QueryTypes.SELECT 
        }
      );
      const existingIds = existingMappings.map(m => m.permission_id);

      const newPermissions = [];
      for (const roleId of roleIds) {
        const existingForRole = existingMappings
          .filter(m => m.role_id === roleId)
          .map(m => m.permission_id);

        const toAdd = permissions
          .filter(perm => !existingForRole.includes(perm.id))
          .map(perm => ({
            role_id: roleId,
            permission_id: perm.id,
            created_at: new Date()
          }));
        
        newPermissions.push(...toAdd);
      }

      if (newPermissions.length > 0) {
        return queryInterface.bulkInsert('role_permissions', newPermissions, {});
      }
      return;

    } catch (error) {
      console.error('Error in super-admin-full-permissions seeder:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Optionally remove assignments, though usually not desired in down for data integrity
    return queryInterface.bulkDelete('role_permissions', null, {});
  }
};
