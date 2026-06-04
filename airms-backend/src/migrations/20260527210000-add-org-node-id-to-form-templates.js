'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableDescription = await queryInterface.describeTable('form_templates');

        if (!tableDescription.org_node_id) {
            await queryInterface.addColumn('form_templates', 'org_node_id', {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'organization_nodes',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            });

            await queryInterface.addIndex('form_templates', ['org_node_id'], {
                name: 'form_templates_org_node_id_idx'
            });
        }
    },

    async down(queryInterface) {
        const tableDescription = await queryInterface.describeTable('form_templates');
        if (tableDescription.org_node_id) {
            await queryInterface.removeIndex('form_templates', 'form_templates_org_node_id_idx');
            await queryInterface.removeColumn('form_templates', 'org_node_id');
        }
    }
};
