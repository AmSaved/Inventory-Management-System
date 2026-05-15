const { OrganizationNode, OrganizationType } = require('../models');
const { Op } = require('sequelize');

class HierarchyService {
    /**
     * Get all descendants of a specific node (including itself) using materialized paths.
     * This is extremely fast for hierarchy scoping.
     */
    async getDescendants(nodeId) {
        const node = await OrganizationNode.findByPk(nodeId);
        if (!node) return [];

        // If path is not set, just return the node itself
        if (!node.path) return [nodeId];

        const descendants = await OrganizationNode.findAll({
            where: {
                path: {
                    [Op.like]: `${node.path}%`
                },
                status: { [Op.ne]: 'archived' }
            },
            attributes: ['id'],
            raw: true
        });

        return descendants.map(d => d.id);
    }

    /**
     * Check if childId is a descendant of parentId.
     */
    async isDescendant(parentId, childId) {
        const parent = await OrganizationNode.findByPk(parentId);
        const child = await OrganizationNode.findByPk(childId);

        if (!parent || !child) return false;
        
        return child.path.startsWith(parent.path);
    }

    /**
     * Get the full breadcrumb path for a node.
     */
    async getBreadcrumb(nodeId) {
        const node = await OrganizationNode.findByPk(nodeId);
        if (!node || !node.path) return [];

        const ids = node.path.split('/').filter(id => id !== '');
        
        const nodes = await OrganizationNode.findAll({
            where: { id: { [Op.in]: ids } },
            include: [{ model: OrganizationType, as: 'type' }],
            order: [['path', 'ASC']]
        });

        return nodes;
    }

    /**
     * Build the materialized path for a new or moved node.
     */
    async calculatePath(nodeId, parentId = null) {
        if (!parentId) {
            return `/${nodeId}/`;
        }

        const parent = await OrganizationNode.findByPk(parentId);
        if (!parent) return `/${nodeId}/`;

        return `${parent.path}${nodeId}/`;
    }

    /**
     * Get children of a specific node (one level deep).
     */
    async getChildren(nodeId) {
        return await OrganizationNode.findAll({
            where: { 
                parent_id: nodeId,
                status: { [Op.ne]: 'archived' }
            },
            include: [{ model: OrganizationType, as: 'type' }]
        });
    }

    /**
     * Get all Node IDs a user is authorized to see based on their role's visibility scope.
     * This is the heart of the "Isolation-First" security logic.
     */
    async getAllowedNodes(user, permissions = []) {
        if (!user) return [];
        
        const visibility = user.role?.visibility_scope || 'own_node';
        const roleLevel = user.role?.level || 0;
        const roleName = user.role?.name?.toLowerCase() || '';

        // 1. Institutional authority (Pure Permission Check)
        const hasGlobalVisibility = permissions.includes('hierarchy:all:view') || 
                                     permissions.includes('system:manage');
        
        if (hasGlobalVisibility) {
            // Signal global visibility by returning null
            // This prevents building massive arrays of IDs that slow down SQL IN clauses
            return null;
        }

        // 2. Recursive authority check
        // If user is at a branch, they can see that branch and all sub-units
        // This is where we remove the "static" nature by allowing the hierarchy to dictate access
        if (user.org_node_id) {
            return await this.getDescendants(user.org_node_id);
        }

        return [];
    }

    /**
     * Get roots of a company hierarchy.
     */
    async getRoots(companyId) {
        return await OrganizationNode.findAll({
            where: { 
                company_id: companyId,
                parent_id: null,
                status: { [Op.ne]: 'archived' }
            },
            include: [{ model: OrganizationType, as: 'type' }]
        });
    }
}

module.exports = new HierarchyService();
