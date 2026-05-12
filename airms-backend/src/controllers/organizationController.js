const { OrganizationNode, OrganizationType, ActivityLog, Role, User } = require('../models');
const { Op } = require('sequelize');
const hierarchyService = require('../services/hierarchyService');
const { validationResult } = require('express-validator');
const { getEffectivePermissions } = require('../middleware/permissions');

const organizationController = {
    /**
     * Get the full organizational tree for the user's company.
     */
    async getNodeTree(req, res, next) {
        try {
            const companyId = req.user.company_id;
            const permissions = req.userPermissions || await getEffectivePermissions(req.user);
            const { only_mine } = req.query;
            const isSuperAdmin = (req.user.role && req.user.role.level >= 100) || permissions.includes('system:manage');
            
            // 1. Efficiently get authorized nodes (with resilient fallback if middleware didn't attach the lazy-loader)
            const allowedNodeIds = req.getAuthorizedNodes 
                ? await req.getAuthorizedNodes() 
                : await hierarchyService.getAllowedNodes(req.user, permissions);

            const where = { 
                id: { [Op.in]: allowedNodeIds },
                company_id: companyId,
                status: { [Op.ne]: 'archived' }
            };

            if (only_mine === 'true') {
                // Simplified: Just filter by the current user if 'only_mine' requested, 
                // as Super Admins are the only ones who can see root creations anyway.
                where.created_by = req.user.id;
            }

            // Fetch authorized nodes (Efficient query with type inclusion)
            const nodes = await OrganizationNode.findAll({
                where,
                include: [{ model: OrganizationType, as: 'type', attributes: ['id', 'name', 'code_prefix'] }],
                order: [['path', 'ASC']]
            });

            // ─── OPTIMIZED TREE BUILDER (O(N)) ───
            // Use a Map for O(1) lookup during construction
            const nodeMap = {};
            nodes.forEach(node => {
                nodeMap[node.id] = {
                    ...node.get({ plain: true }),
                    id: String(node.id),
                    parent_id: node.parent_id ? String(node.parent_id) : null,
                    children: []
                };
            });

            const treeData = [];
            const isGlobalAdmin = permissions.includes('hierarchy:all:view') || permissions.includes('system:manage');

            nodes.forEach(node => {
                const nodeItem = nodeMap[node.id];
                const parentId = node.parent_id;

                // Logic for root identification:
                // 1. If parent_id is null, it's a global root.
                // 2. If parent_id exists but IS NOT in our authorized map, it's an "entry point" root for this user.
                const isRoot = !parentId || !nodeMap[parentId];

                if (isRoot) {
                    treeData.push(nodeItem);
                } else {
                    nodeMap[parentId].children.push(nodeItem);
                }
            });

            res.json({ success: true, data: treeData });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get a flat list of nodes.
     */
    async getNodes(req, res, next) {
        try {
            const companyId = req.user.company_id;
            const permissions = req.userPermissions || await getEffectivePermissions(req.user);
            const isSuperAdmin = (req.user.role && req.user.role.level >= 100) || permissions.includes('system:manage');
            
            let whereClause = { 
                company_id: companyId,
                status: { [Op.ne]: 'archived' }
            };
            
            if (!isSuperAdmin) {
                let allowedNodeIds = req.getAuthorizedNodes 
                    ? await req.getAuthorizedNodes() 
                    : await hierarchyService.getAllowedNodes(req.user, permissions);
                
                // Scoped Peer Expansion: For lateral transfers, allow seeing siblings
                if (req.query.include_peers === 'true' && req.user.org_node_id) {
                    const myNode = await OrganizationNode.findByPk(req.user.org_node_id);
                    if (myNode && myNode.parent_id) {
                        const siblings = await OrganizationNode.findAll({
                            where: { parent_id: myNode.parent_id, company_id: companyId },
                            attributes: ['id']
                        });
                        const siblingIds = siblings.map(s => s.id);
                        allowedNodeIds = [...new Set([...allowedNodeIds, ...siblingIds])];
                    }
                }
                
                whereClause.id = { [Op.in]: allowedNodeIds };
            }

            const nodes = await OrganizationNode.findAll({
                where: whereClause,
                include: [{ model: OrganizationType, as: 'type' }]
            });
            res.json({ success: true, data: nodes });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get hierarchy types configured for the company.
     */
    async getTypes(req, res, next) {
        try {
            const types = await OrganizationType.findAll({
                where: { company_id: req.user.company_id },
                order: [['level_order', 'ASC'], ['id', 'ASC']]
            });
            res.json({ success: true, data: types });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Create a new organization type (Institutional Layer: Level 100+ only).
     */
    async createType(req, res, next) {
        try {
            const permissions = await getEffectivePermissions(req.user);
            const canManage = permissions.includes('system:manage') || permissions.includes('organization:manage_types');
            
            if (!canManage) {
                return res.status(403).json({ success: false, message: 'Institutional Breach: Only administrators with management permissions can modify structural types' });
            }

            const { name, code_prefix, description, is_storage_allowed, is_department, is_approval_unit, level_order } = req.body;
            const companyId = req.user.company_id;

            const type = await OrganizationType.create({
                company_id: companyId,
                name,
                code_prefix,
                description,
                is_storage_allowed: !!is_storage_allowed,
                is_department: !!is_department,
                is_approval_unit: !!is_approval_unit,
                level_order: level_order || 0
            });

            res.status(201).json({ success: true, data: type });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Create a new organization node.
     */
    async createNode(req, res, next) {
        try {
            let { name, code, parent_id, org_type_id, manager_id, location_id, can_store_inventory, metadata, status } = req.body;
            const companyId = req.user.company_id;
            const permissions = await getEffectivePermissions(req.user);

            const isSystemAdmin = (req.user.role?.level >= 100) || permissions.includes('system:manage');
            const canManageRoots = isSystemAdmin || permissions.includes('organization:manage_roots');

            // For non-admins: if no parent_id given, anchor to their own org node
            if (!parent_id && !isSystemAdmin) {
                if (!req.user.org_node_id) {
                    return res.status(403).json({ success: false, message: 'Access denied: You are not assigned to an organization node' });
                }
                parent_id = req.user.org_node_id;
            }

            if (!parent_id) {
                if (!canManageRoots) {
                    return res.status(403).json({ success: false, message: 'Access denied: You do not have permission to create root-level organizations' });
                }
            } else {
                // Attach-to-Parent Security Check
                const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
                const targetNodeId = parseInt(parent_id);
                if (!allowedNodes.includes(targetNodeId)) {
                    return res.status(403).json({ success: false, message: 'Access denied: You cannot attach nodes to a parent outside your visibility scope' });
                }
            }

            // Create initial node
            const node = await OrganizationNode.create({
                company_id: companyId,
                name,
                code,
                parent_id,
                org_type_id,
                manager_id,
                location_id,
                created_by: req.user.id, // Secure the creator
                can_store_inventory: !!can_store_inventory,
                metadata: metadata || {},
                status: status || 'active'
            });

            // Calculate and update materialized path
            const path = await hierarchyService.calculatePath(node.id, parent_id);
            await node.update({ path });

            await ActivityLog.create({
                company_id: companyId,
                user_id: req.user.id,
                action: 'CREATE',
                resource: 'organization_nodes',
                resource_id: node.id,
                details: { name, code, parent_id }
            });

            res.status(201).json({ success: true, data: node });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get details of a single node.
     */
    async getNodeById(req, res, next) {
        try {
            const { id } = req.params;
            const targetId = parseInt(id);
            
            const permissions = await getEffectivePermissions(req.user);
            const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
            
            if (!allowedNodes.includes(targetId)) {
                return res.status(403).json({ success: false, message: 'Access denied: This node is outside your visibility scope' });
            }

            const node = await OrganizationNode.findOne({
                where: { id: targetId, company_id: req.user.company_id },
                include: [
                    { model: OrganizationType, as: 'type' },
                    { model: OrganizationNode, as: 'parent' }
                ]
            });

            if (!node) return res.status(404).json({ success: false, message: 'Node not found' });

            res.json({ success: true, data: node });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Delete an organization node.
     */
    async deleteNode(req, res, next) {
        try {
            const { id } = req.params;
            const companyId = req.user.company_id;

            const node = await OrganizationNode.findOne({ where: { id, company_id: companyId } });
            if (!node) return res.status(404).json({ success: false, message: 'Node not found' });

            // Scoping check for destructive action
            const allowedNodes = await hierarchyService.getAllowedNodes(req.user);
            if (!allowedNodes.includes(Number(id))) {
                return res.status(403).json({ success: false, message: 'Access denied: This node is outside your visibility scope' });
            }

            // Prevent deleting a root if not authorized
            const permissions = await getEffectivePermissions(req.user);
            const canManageRoots = permissions.includes('organization:manage_roots') || permissions.includes('system:manage');

            if (!node.parent_id && !canManageRoots) {
                return res.status(403).json({ success: false, message: 'Access denied: You do not have permission to remove root-level organizations' });
            }

            // Check if node has children
            const children = await OrganizationNode.count({ where: { parent_id: id } });
            if (children > 0) {
                return res.status(400).json({ success: false, message: 'Cannot delete node with children. Reassign children first.' });
            }

            await node.destroy();
            
            await ActivityLog.create({
                company_id: companyId,
                user_id: req.user.id,
                action: 'DELETE',
                resource: 'organization_nodes',
                resource_id: id,
                details: { name: node.name }
            });

            res.json({ success: true, message: 'Node deleted successfully' });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Update an organization node.
     */
    async updateNode(req, res, next) {
        try {
            const { id } = req.params;
            const targetId = parseInt(id);
            const companyId = req.user.company_id;
            const updateData = req.body;

            const permissions = await getEffectivePermissions(req.user);
            const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
            
            if (!allowedNodes.includes(targetId)) {
                return res.status(403).json({ success: false, message: 'Access denied: You are not authorized to modify this node' });
            }

            const node = await OrganizationNode.findOne({ where: { id: targetId, company_id: companyId } });
            if (!node) return res.status(404).json({ success: false, message: 'Node not found' });

            // Restriction: Cannot move a root node if not authorized
            if (!node.parent_id && updateData.parent_id !== undefined && updateData.parent_id !== null) {
                const canManageRoots = permissions.includes('system:manage') || permissions.includes('organization:manage_roots');
                if (!canManageRoots) {
                    return res.status(403).json({ success: false, message: 'Access denied: You do not have permission to re-parent root nodes' });
                }
            }

            await node.update(updateData);
            
            // Recalculate path if parent changed
            if (updateData.parent_id !== undefined && updateData.parent_id !== node.parent_id) {
                const path = await hierarchyService.calculatePath(node.id, updateData.parent_id);
                await node.update({ path });
            }

            await ActivityLog.create({
                company_id: companyId,
                user_id: req.user.id,
                action: 'UPDATE',
                resource: 'organization_nodes',
                resource_id: id,
                details: updateData
            });

            res.json({ success: true, message: 'Node updated successfully', data: node });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Toggle node active status.
     */
    async toggleStatus(req, res, next) {
        try {
            const { id } = req.params;
            const targetId = parseInt(id);
            const companyId = req.user.company_id;

            const permissions = await getEffectivePermissions(req.user);
            const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
            
            if (!allowedNodes.includes(targetId)) {
                return res.status(403).json({ success: false, message: 'Access denied: You are not authorized to modify this node' });
            }

            const node = await OrganizationNode.findOne({ where: { id: targetId, company_id: companyId } });
            if (!node) return res.status(404).json({ success: false, message: 'Node not found' });

            node.status = node.status === 'active' ? 'inactive' : 'active';
            await node.save();

            await ActivityLog.create({
                company_id: companyId,
                user_id: req.user.id,
                action: 'UPDATE',
                resource: 'organization_nodes',
                resource_id: id,
                details: { status: node.status }
            });

            res.json({ success: true, message: `Node ${node.status} successfully`, data: node });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Update an organization type (Level 100+ only).
     */
    async updateType(req, res, next) {
        try {
            const permissions = await getEffectivePermissions(req.user);
            if (!permissions.includes('system:manage') && !permissions.includes('organization:manage_types')) {
                return res.status(403).json({ success: false, message: 'Institutional Breach: Insufficient permissions to manage structural types' });
            }

            const { id } = req.params;
            const companyId = req.user.company_id;
            const updateData = req.body;

            const type = await OrganizationType.findOne({ where: { id, company_id: companyId } });
            if (!type) return res.status(404).json({ success: false, message: 'Type not found' });

            await type.update(updateData);

            await ActivityLog.create({
                company_id: companyId,
                user_id: req.user.id,
                action: 'UPDATE',
                resource: 'organization_types',
                resource_id: id,
                details: updateData
            });

            res.json({ success: true, message: 'Organization type updated', data: type });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Delete an organization type (Level 100+ only).
     */
    async deleteType(req, res, next) {
        try {
            const permissions = await getEffectivePermissions(req.user);
            if (!permissions.includes('system:manage') && !permissions.includes('organization:manage_types')) {
                return res.status(403).json({ success: false, message: 'Institutional Breach: Insufficient permissions to remove structural types' });
            }

            const { id } = req.params;
            const companyId = req.user.company_id;

            const type = await OrganizationType.findOne({ where: { id, company_id: companyId } });
            if (!type) return res.status(404).json({ success: false, message: 'Type not found' });

            // Check if any nodes are using this type
            const nodeCount = await OrganizationNode.count({ where: { org_type_id: id } });
            if (nodeCount > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Cannot delete type '${type.name}' because it is assigned to ${nodeCount} nodes. Reassign or delete those nodes first.` 
                });
            }

            await type.destroy();

            await ActivityLog.create({
                company_id: companyId,
                user_id: req.user.id,
                action: 'DELETE',
                resource: 'organization_types',
                resource_id: id,
                details: { name: type.name }
            });

            res.json({ success: true, message: 'Organization type deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = organizationController;
