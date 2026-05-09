'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const rolesToSeed = [
      { 
        name: 'super_admin', 
        description: 'System administrator with global institutional access. Absolute authority.', 
        level: 100,
        created_at: new Date(),
        updated_at: new Date()
      },
      { 
        name: 'user', 
        description: 'Standard employee role. Limited to personal asset requests.', 
        level: 20,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    for (const roleDef of rolesToSeed) {
      const existing = await queryInterface.sequelize.query(
        `SELECT id FROM roles WHERE name = :name LIMIT 1`,
        { 
          replacements: { name: roleDef.name },
          type: Sequelize.QueryTypes.SELECT 
        }
      );

      if (existing.length === 0) {
        await queryInterface.bulkInsert('roles', [roleDef]);
      } else {
        await queryInterface.bulkUpdate('roles', 
          { 
            description: roleDef.description, 
            level: roleDef.level,
            updated_at: new Date()
          }, 
          { id: existing[0].id }
        );
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('roles', null, {});
  }
};
