const {
    OrganizationNode,
    OrganizationType,
    ActivityLog,
    Role,
    User,
    FormTemplate,
    UserNode,
    UserRole,
    UserPermission,
    RolePermission,
    Inventory,
    Assignment,
    Issue,
    Request,
    RequestItem,
    Approval,
    StoreForm,
    DischargeForm,
    Transfer,
    Return,
    Product,
    Workflow,
    WorkflowStep,
    DischargeItem
} = require('../models');
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
            
            // Use the tree-specific scoping method: includes inactive nodes (only excludes archived)
            // so org admins can still see and reactivate their inactive sub-branches.
            const allowedNodeIds = await hierarchyService.getAllowedNodesForTree(req.user, permissions);

            const where = { 
                ...(allowedNodeIds !== null ? { id: { [Op.in]: allowedNodeIds } } : {}),
                company_id: companyId,
                status: { [Op.ne]: 'archived' }
            };

            // Fetch authorized nodes (Efficient query with type inclusion and raw data)
            const nodes = await OrganizationNode.findAll({
                where,
                attributes: ['id', 'name', 'code', 'parent_id', 'org_type_id', 'manager_id', 'location_id', 'status', 'path', 'can_store_inventory'],
                include: [{ model: OrganizationType, as: 'type', attributes: ['id', 'name', 'code_prefix'] }],
                order: [['path', 'ASC']],
                raw: true,
                nest: true
            });

            // ─── OPTIMIZED TREE BUILDER (O(N)) ───
            // Use a Map for O(1) lookup during construction
            const nodeMap = {};
            nodes.forEach(node => {
                nodeMap[node.id] = {
                    ...node, // Already raw JS object, no need for node.get({ plain: true })
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
                attributes: ['id', 'name', 'code', 'parent_id', 'org_type_id', 'manager_id', 'location_id', 'status', 'path', 'can_store_inventory'],
                include: [{ model: OrganizationType, as: 'type', attributes: ['id', 'name', 'code_prefix'] }],
                raw: true,
                nest: true
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
                if (allowedNodes !== null && !allowedNodes.includes(targetNodeId)) {
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
            
            if (allowedNodes !== null && !allowedNodes.includes(targetId)) {
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
    /**
     * Get the dependencies count before deleting a node.
     */
    async getDeletePreview(req, res, next) {
        try {
            const { id } = req.params;
            const companyId = req.user.company_id;

            const node = await OrganizationNode.findOne({ where: { id, company_id: companyId } });
            if (!node) return res.status(404).json({ success: false, message: 'Node not found' });

            // Scoping check for access
            const permissions = req.userPermissions || await getEffectivePermissions(req.user);
            const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
            if (allowedNodes !== null && !allowedNodes.includes(Number(id))) {
                return res.status(403).json({ success: false, message: 'Access denied: This node is outside your visibility scope' });
            }

            // Get descendants
            const descendantIds = await hierarchyService.getDescendants(id);

            // Count sub-nodes (excluding the target node itself)
            const subNodesCount = Math.max(0, descendantIds.length - 1);

            // Count inventories
            const inventoryCount = await Inventory.count({
                where: {
                    org_node_id: { [Op.in]: descendantIds },
                    company_id: companyId
                }
            });

            // Count users
            const usersCount = await User.count({
                where: {
                    org_node_id: { [Op.in]: descendantIds },
                    company_id: companyId
                }
            });

            // Count roles
            const rolesCount = await Role.count({
                where: {
                    org_node_id: { [Op.in]: descendantIds },
                    company_id: companyId
                }
            });

            // Count form templates
            const templatesCount = await FormTemplate.count({
                where: {
                    org_node_id: { [Op.in]: descendantIds },
                    company_id: companyId
                }
            });

            res.json({
                success: true,
                data: {
                    nodeName: node.name,
                    subNodesCount,
                    inventoryCount,
                    usersCount,
                    rolesCount,
                    templatesCount
                }
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Delete an organization node and all its sub-hierarchy resources recursively.
     */
    async deleteNode(req, res, next) {
        const transaction = await OrganizationNode.sequelize.transaction();
        try {
            const { id } = req.params;
            const companyId = req.user.company_id;

            const node = await OrganizationNode.findOne({ 
                where: { id, company_id: companyId },
                transaction
            });
            if (!node) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: 'Node not found' });
            }

            // Scoping check for destructive action
            const permissions = req.userPermissions || await getEffectivePermissions(req.user);
            const allowedNodes = await hierarchyService.getAllowedNodes(req.user, permissions);
            if (allowedNodes !== null && !allowedNodes.includes(Number(id))) {
                await transaction.rollback();
                return res.status(403).json({ success: false, message: 'Access denied: This node is outside your visibility scope' });
            }

            // Prevent deleting a root if not authorized
            const canManageRoots = permissions.includes('organization:manage_roots') || permissions.includes('system:manage');
            if (!node.parent_id && !canManageRoots) {
                await transaction.rollback();
                return res.status(403).json({ success: false, message: 'Access denied: You do not have permission to remove root-level organizations' });
            }

            // Get descendants (all nodes to be deleted)
            const descendantIds = await hierarchyService.getDescendants(id);

            // Log activity first before deleting any users/roles to avoid FK violations
            await ActivityLog.create({
                company_id: companyId,
                user_id: req.user.id,
                action: 'DELETE',
                resource: 'organization_nodes',
                resource_id: id,
                details: { name: node.name, deletedDescendants: descendantIds }
            }, { transaction });

            // 1. Roles: Find roles under these nodes
            const roles = await Role.findAll({ 
                where: { org_node_id: { [Op.in]: descendantIds }, company_id: companyId },
                attributes: ['id'],
                transaction
            });
            const roleIds = roles.map(r => r.id);

            if (roleIds.length > 0) {
                await WorkflowStep.update({ required_role_id: null }, { where: { required_role_id: { [Op.in]: roleIds } }, transaction });
                await RolePermission.destroy({ where: { role_id: { [Op.in]: roleIds } }, transaction });
                await UserRole.destroy({ where: { role_id: { [Op.in]: roleIds } }, transaction });
                await User.update({ role_id: null }, { where: { role_id: { [Op.in]: roleIds } }, transaction });
                await Role.destroy({ where: { id: { [Op.in]: roleIds }, company_id: companyId }, transaction });
            }

            // 2. Form Templates: Find templates under these nodes
            const templates = await FormTemplate.findAll({
                where: { org_node_id: { [Op.in]: descendantIds }, company_id: companyId },
                attributes: ['id'],
                transaction
            });
            const templateIds = templates.map(t => t.id);

            if (templateIds.length > 0) {
                await Product.update(
                    { form_template_id: null },
                    { where: { form_template_id: { [Op.in]: templateIds } }, transaction }
                );
                await Product.update(
                    { blueprint_template_id: null },
                    { where: { blueprint_template_id: { [Op.in]: templateIds } }, transaction }
                );
                await FormTemplate.destroy({ where: { id: { [Op.in]: templateIds }, company_id: companyId }, transaction });
            }

            // 3. Inventories & Assignments: Find and delete inventories/assignments under these nodes
            const inventories = await Inventory.findAll({
                where: { org_node_id: { [Op.in]: descendantIds }, company_id: companyId },
                attributes: ['id', 'serial_number'],
                transaction
            });
            const inventoryIds = inventories.map(i => i.id);
            const serialNumbers = inventories.map(i => i.serial_number).filter(sn => sn !== null);

            const assignments = await Assignment.findAll({
                where: {
                    [Op.or]: [
                        { org_node_id: { [Op.in]: descendantIds } },
                        { serial_number: { [Op.in]: serialNumbers } }
                    ],
                    company_id: companyId
                },
                attributes: ['id'],
                transaction
            });
            const assignmentIds = assignments.map(a => a.id);

            if (assignmentIds.length > 0) {
                await Return.update({ assignment_id: null }, { where: { assignment_id: { [Op.in]: assignmentIds } }, transaction });
                await Issue.update({ assignment_id: null }, { where: { assignment_id: { [Op.in]: assignmentIds } }, transaction });
                await Assignment.destroy({ where: { id: { [Op.in]: assignmentIds } }, transaction });
            }

            if (inventoryIds.length > 0) {
                await RequestItem.update({ inventory_id: null }, { where: { inventory_id: { [Op.in]: inventoryIds } }, transaction });
            }

            // 4. Users: Find and delete users under these nodes
            const users = await User.findAll({
                where: { org_node_id: { [Op.in]: descendantIds }, company_id: companyId },
                attributes: ['id'],
                transaction
            });
            const userIds = users.map(u => u.id);

            if (userIds.length > 0) {
                await UserNode.destroy({ where: { user_id: { [Op.in]: userIds } }, transaction });
                await UserRole.destroy({ where: { user_id: { [Op.in]: userIds } }, transaction });
                await UserPermission.destroy({ where: { user_id: { [Op.in]: userIds } }, transaction });
                await UserPermission.update({ granted_by: null }, { where: { granted_by: { [Op.in]: userIds } }, transaction });

                await Assignment.destroy({ where: { user_id: { [Op.in]: userIds } }, transaction });

                await Issue.update({ user_id: null }, { where: { user_id: { [Op.in]: userIds } }, transaction });
                await Issue.update({ reported_by: null }, { where: { reported_by: { [Op.in]: userIds } }, transaction });
                await Issue.update({ assigned_to: null }, { where: { assigned_to: { [Op.in]: userIds } }, transaction });
                await Issue.update({ resolved_by: null }, { where: { resolved_by: { [Op.in]: userIds } }, transaction });

                await ActivityLog.update({ user_id: null }, { where: { user_id: { [Op.in]: userIds } }, transaction });

                const requests = await Request.findAll({
                    where: {
                        [Op.or]: [
                            { requester_id: { [Op.in]: userIds } },
                            { target_user_id: { [Op.in]: userIds } }
                        ]
                    },
                    attributes: ['id'],
                    transaction
                });
                const requestIds = requests.map(r => r.id);

                if (requestIds.length > 0) {
                    await Approval.destroy({ where: { request_id: { [Op.in]: requestIds } }, transaction });
                    await RequestItem.destroy({ where: { request_id: { [Op.in]: requestIds } }, transaction });
                    await Request.destroy({ where: { id: { [Op.in]: requestIds } }, transaction });
                }

                await Request.update({ chairman_approver_id: null }, { where: { chairman_approver_id: { [Op.in]: userIds } }, transaction });
                await Request.update({ storage_approver_id: null }, { where: { storage_approver_id: { [Op.in]: userIds } }, transaction });
                await Request.update({ cancelled_by: null }, { where: { cancelled_by: { [Op.in]: userIds } }, transaction });

                await Approval.update({ approver_id: null }, { where: { approver_id: { [Op.in]: userIds } }, transaction });

                await StoreForm.update({ created_by: null }, { where: { created_by: { [Op.in]: userIds } }, transaction });
                await DischargeForm.update({ to_user_id: null }, { where: { to_user_id: { [Op.in]: userIds } }, transaction });
                await DischargeForm.update({ created_by: null }, { where: { created_by: { [Op.in]: userIds } }, transaction });
                await DischargeForm.update({ approved_by: null }, { where: { approved_by: { [Op.in]: userIds } }, transaction });

                await Transfer.update({ from_user_id: null }, { where: { from_user_id: { [Op.in]: userIds } }, transaction });
                await Transfer.update({ to_user_id: null }, { where: { to_user_id: { [Op.in]: userIds } }, transaction });
                await Transfer.update({ requested_by: null }, { where: { requested_by: { [Op.in]: userIds } }, transaction });
                await Transfer.update({ approved_by: null }, { where: { approved_by: { [Op.in]: userIds } }, transaction });

                await Return.update({ user_id: null }, { where: { user_id: { [Op.in]: userIds } }, transaction });
                await Return.update({ received_by: null }, { where: { received_by: { [Op.in]: userIds } }, transaction });

                await OrganizationNode.update({ manager_id: null }, { where: { manager_id: { [Op.in]: userIds } }, transaction });

                await User.update({ created_by: null }, { where: { created_by: { [Op.in]: userIds } }, transaction });
                await Role.update({ created_by_id: null }, { where: { created_by_id: { [Op.in]: userIds } }, transaction });
                await Workflow.update({ created_by: null }, { where: { created_by: { [Op.in]: userIds } }, transaction });
                await FormTemplate.update({ created_by: null }, { where: { created_by: { [Op.in]: userIds } }, transaction });
                await Inventory.update({ assigned_to: null }, { where: { assigned_to: { [Op.in]: userIds } }, transaction });
                await DischargeItem.update({ to_user_id: null }, { where: { to_user_id: { [Op.in]: userIds } }, transaction });

                await User.destroy({ where: { id: { [Op.in]: userIds }, company_id: companyId }, transaction });
            }

            // 5. Inventories: Delete remaining inventories under these nodes
            await Inventory.destroy({
                where: { org_node_id: { [Op.in]: descendantIds }, company_id: companyId },
                transaction
            });

            // 6. Organization Node References Cleanup in other tables to avoid foreign key errors:
            await Workflow.update({ org_node_id: null }, { where: { org_node_id: { [Op.in]: descendantIds }, company_id: companyId }, transaction });
            await StoreForm.update({ org_node_id: null }, { where: { org_node_id: { [Op.in]: descendantIds } }, transaction });
            await DischargeForm.update({ from_node_id: null }, { where: { from_node_id: { [Op.in]: descendantIds } }, transaction });
            await DischargeForm.update({ to_node_id: null }, { where: { to_node_id: { [Op.in]: descendantIds } }, transaction });
            await Transfer.update({ from_node_id: null }, { where: { from_node_id: { [Op.in]: descendantIds } }, transaction });
            await Transfer.update({ to_node_id: null }, { where: { to_node_id: { [Op.in]: descendantIds } }, transaction });
            await Return.update({ from_node_id: null }, { where: { from_node_id: { [Op.in]: descendantIds } }, transaction });
            await Return.update({ to_node_id: null }, { where: { to_node_id: { [Op.in]: descendantIds } }, transaction });
            await Issue.update({ org_node_id: null }, { where: { org_node_id: { [Op.in]: descendantIds } }, transaction });
            await Request.update({ org_node_id: null }, { where: { org_node_id: { [Op.in]: descendantIds } }, transaction });
            await ActivityLog.update({ org_node_id: null }, { where: { org_node_id: { [Op.in]: descendantIds }, company_id: companyId }, transaction });

            await Product.update({ org_node_id: null }, { where: { org_node_id: { [Op.in]: descendantIds } }, transaction });
            await DischargeItem.update({ to_node_id: null }, { where: { to_node_id: { [Op.in]: descendantIds } }, transaction });

            // 7. UserNode: Delete remaining UserNode records for these nodes
            await UserNode.destroy({
                where: { org_node_id: { [Op.in]: descendantIds } },
                transaction
            });

            // 8. Delete descendant nodes sorted by path length DESC (deepest first)
            const sortedNodes = await OrganizationNode.findAll({
                where: { id: { [Op.in]: descendantIds }, company_id: companyId },
                attributes: ['id', 'path'],
                order: [['path', 'DESC']],
                transaction
            });
            const sortedIds = sortedNodes.map(n => n.id);

            for (const nodeId of sortedIds) {
                await OrganizationNode.destroy({
                    where: { id: nodeId, company_id: companyId },
                    transaction
                });
            }

            await transaction.commit();
            res.json({ success: true, message: 'Node and all sub-hierarchy contents deleted successfully' });
        } catch (error) {
            await transaction.rollback();
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
            
            if (allowedNodes !== null && !allowedNodes.includes(targetId)) {
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
            const userRoleLevel = req.user.role?.level || 0;
            const isSuperAdmin = userRoleLevel >= 100 || permissions.includes('system:manage');

            // Use tree-scoped allowedNodes (includes inactive nodes) so org admins can
            // reach and toggle their own inactive branches.
            const allowedNodes = await hierarchyService.getAllowedNodesForTree(req.user, permissions);

            if (allowedNodes !== null && !allowedNodes.includes(targetId)) {
                return res.status(403).json({ success: false, message: 'Access denied: You are not authorized to modify this node' });
            }

            const node = await OrganizationNode.findOne({ where: { id: targetId, company_id: companyId } });
            if (!node) return res.status(404).json({ success: false, message: 'Node not found' });

            const isCurrentlyInactive = node.status === 'inactive';

            if (isCurrentlyInactive) {
                // REACTIVATING — check who originally deactivated it
                const meta = node.metadata || {};
                const deactivatedByLevel = meta.deactivated_by_role_level || 0;

                if (deactivatedByLevel >= 100 && !isSuperAdmin) {
                    return res.status(403).json({
                        success: false,
                        message: 'Access denied: This node was deactivated by a Super Admin. Only a Super Admin can reactivate it.'
                    });
                }

                // Clear the deactivation tracking
                node.metadata = { ...meta, deactivated_by_role_level: null };
                node.status = 'active';
            } else {
                // DEACTIVATING — record who did it so reactivation can be gated correctly
                const meta = node.metadata || {};
                node.metadata = { ...meta, deactivated_by_role_level: userRoleLevel };
                node.status = 'inactive';
            }

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
