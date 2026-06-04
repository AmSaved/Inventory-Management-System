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
        
        // 1. Institutional authority (Pure Permission Check)
        // Super Admins (role level 100) or specific permissions get global access
        const hasGlobalVisibility = (user.role?.level >= 100) || 
                                     permissions.includes('hierarchy:all:view') || 
                                     permissions.includes('system:manage');
        
        if (hasGlobalVisibility) {
            // Signal global visibility by returning null
            return null;
        }

        // 2. Multi-node recursive authority check
        const seedPaths = [];
        
        // Primary node
        if (user.organizationNode && user.organizationNode.path) {
            seedPaths.push(user.organizationNode.path);
        } else if (user.org_node_id) {
            // Fallback if association not loaded
            const node = await OrganizationNode.findByPk(user.org_node_id, { attributes: ['path'] });
            if (node && node.path) seedPaths.push(node.path);
        }

        // Additional authorized nodes (from multi-tenancy junction)
        if (user.authorizedNodes && user.authorizedNodes.length > 0) {
            user.authorizedNodes.forEach(node => {
                if (node.path && !seedPaths.includes(node.path)) {
                    seedPaths.push(node.path);
                }
            });
        }

        if (seedPaths.length === 0) return [];

        // Get all descendants for all seed paths in one query
        const descendants = await OrganizationNode.findAll({
            where: {
                [Op.or]: seedPaths.map(p => ({
                    path: { [Op.like]: `${p}%` }
                })),
                status: { [Op.ne]: 'archived' }
            },
            attributes: ['id'],
            raw: true
        });

        return [...new Set(descendants.map(d => d.id))];
    }

    /**
     * Expand a list of allowed node IDs to also include any archived nodes
     * that were merged INTO one of those allowed nodes.
     *
     * This lets users who belong to a merged/consolidated branch still see
     * historical transfers, returns, and discharges that referenced the old
     * (now-archived) source branches before they were merged.
     *
     * @param {number[]|null} allowedNodeIds  - result of getAllowedNodes()
     * @param {number}        companyId
     * @returns {number[]|null}  Expanded ID list, or null (= global access)
     */
    async expandWithMergedSources(allowedNodeIds, companyId) {
        if (allowedNodeIds === null) return null; // global access – no expansion needed

        // Find all archived nodes for this company that have metadata.merged_into
        const archivedNodes = await OrganizationNode.findAll({
            where: {
                company_id: companyId,
                status: 'archived',
                metadata: { [Op.ne]: null }
            },
            attributes: ['id', 'metadata'],
            raw: true
        });

        // Keep only those whose merged_into target is in our allowed list
        const extraIds = archivedNodes
            .filter(n => {
                const meta = (typeof n.metadata === 'string') ? (() => { try { return JSON.parse(n.metadata); } catch { return {}; } })() : (n.metadata || {});
                return meta.merged_into && allowedNodeIds.includes(Number(meta.merged_into));
            })
            .map(n => Number(n.id));

        if (extraIds.length === 0) return allowedNodeIds;

        return [...new Set([...allowedNodeIds, ...extraIds])];
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
