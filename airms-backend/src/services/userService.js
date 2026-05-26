const { User, Role, OrganizationNode, Permission, UserPermission, ActivityLog, Assignment, Product, UserRole, UserNode, Request, Approval, StoreForm, DischargeForm, Return, Transfer, Issue, Inventory, Workflow, FormTemplate, DischargeItem } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

class UserService {
    /**
     * Get all users with pagination, scoped to company and optional organization unit.
     */
    async getAllUsers(companyId, page = 1, limit = 10, search = '', filters = {}) {
        try {
            const where = { company_id: companyId };

            if (search) {
                where[Op.or] = [
                    { first_name: { [Op.iLike]: `%${search}%` } },
                    { last_name: { [Op.iLike]: `%${search}%` } },
                    { email: { [Op.iLike]: `%${search}%` } },
                    { employee_id: { [Op.iLike]: `%${search}%` } }
                ];
            }

            if (filters.role_id) where.role_id = filters.role_id;
            if (filters.org_node_id) where.org_node_id = filters.org_node_id;
            if (filters.is_active !== undefined) where.is_active = filters.is_active;
            if (filters.created_by) where.created_by = filters.created_by;

            const offset = (page - 1) * limit;

            const { count, rows } = await User.findAndCountAll({
                where,
                include: [
                    {
                        model: Role,
                        as: 'role',
                        attributes: ['id', 'name', 'level']
                    },
                    {
                        model: OrganizationNode,
                        as: 'organizationNode',
                        attributes: ['id', 'name', 'code']
                    },
                    {
                        model: Role,
                        as: 'roles',
                        attributes: ['id', 'name'],
                        through: { attributes: [] }
                    }
                ],
                attributes: { exclude: ['password_hash', 'refresh_token'] },
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['created_at', 'DESC']]
            });

            return {
                users: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    pages: Math.ceil(count / limit)
                }
            };
        } catch (error) {
            logger.error('Get all users error:', error);
            throw error;
        }
    }

    /**
     * Get user by ID (scoped to company).
     */
    async getUserById(companyId, id) {
        try {
            const user = await User.findOne({
                where: { id, company_id: companyId },
                include: [
                    { model: Role, as: 'role' },
                    { 
                        model: Role, 
                        as: 'roles',
                        through: { attributes: [] }
                    },
                    { model: OrganizationNode, as: 'organizationNode' },
                    {
                        model: Permission,
                        as: 'permissions',
                        through: { attributes: ['granted_at', 'expires_at'] }
                    }
                ],
                attributes: { exclude: ['password_hash', 'refresh_token'] }
            });

            if (!user) {
                throw new Error('User not found');
            }

            return user;
        } catch (error) {
            logger.error('Get user by ID error:', error);
            throw error;
        }
    }

    /**
     * Create a new user within a company.
     */
    async createUser(companyId, userData, createdBy) {
        try {
            const orConditions = [{ email: userData.email }];
            if (userData.employee_id) {
                orConditions.push({ employee_id: userData.employee_id });
            }

            const existingUser = await User.findOne({
                where: {
                    company_id: companyId,
                    [Op.or]: orConditions
                }
            });

            if (existingUser) {
                throw new Error('User already exists with this email or employee ID in this company');
            }

            userData.company_id = companyId;
            userData.created_by = createdBy;

            // Handle password hashing if provided
            if (userData.password) {
                userData.password_hash = userData.password;
                delete userData.password;
            }

            // Ensure name fields are present
            if (!userData.first_name || !userData.last_name) {
                throw new Error('Both First Name and Last Name are required for identity records');
            }

            // Fallback for missing employee_id to prevent database constraint errors
            if (!userData.employee_id) {
                const randomDigits = Math.floor(1000 + Math.random() * 9000);
                userData.employee_id = `EMP-${userData.email.split('@')[0].toUpperCase()}-${randomDigits}`;
            }

            // Fallback for missing username to prevent unique constraint errors with blank strings
            if (!userData.username) {
                userData.username = userData.email.split('@')[0];
            }

            const user = await User.create(userData);

            // Many-to-Many Role Assignment
            if (userData.role_ids && Array.isArray(userData.role_ids)) {
                await user.setRoles(userData.role_ids);
            } else if (userData.role_id) {
                // Backward compatibility: If only single role_id is provided, sync it to the junction table too
                await user.addRole(userData.role_id);
            }

            return user;
        } catch (error) {
            logger.error('Create user error:', error);
            throw error;
        }
    }

    /**
     * Update user details.
     */
    async updateUser(companyId, id, userData, updatedBy) {
        try {
            const user = await User.findOne({ where: { id, company_id: companyId } });
            if (!user) {
                throw new Error('User not found');
            }

            // Sanitization & Password Handling
            if (userData.password && userData.password.trim() !== '') {
                userData.password_hash = userData.password;
            }
            
            delete userData.password;
            delete userData.password_hash_internal; // Defensive
            delete userData.refresh_token;
            delete userData.company_id;
            delete userData.created_by;

            await user.update(userData);

            // Sync Many-to-Many Roles
            if (userData.role_ids && Array.isArray(userData.role_ids)) {
                await user.setRoles(userData.role_ids);
                
                // Update legacy role_id to the first role in the list for backward compatibility with old code
                if (userData.role_ids.length > 0) {
                    await user.update({ role_id: userData.role_ids[0] });
                }
            }

            return user;
        } catch (error) {
            logger.error('Update user error:', error);
            throw error;
        }
    }

    /**
     * Delete user only if they have no active assignments.
     */
        async deleteUser(companyId, id) {
        try {
            const user = await User.findOne({ where: { id, company_id: companyId } });
            if (!user) throw new Error('User not found');

            // Fire all database cleanup updates in parallel (extremely fast!)
            await Promise.all([
                UserPermission.destroy({ where: { user_id: id } }),
                UserRole ? UserRole.destroy({ where: { user_id: id } }) : Promise.resolve(),
                UserNode ? UserNode.destroy({ where: { user_id: id } }) : Promise.resolve(),
                ActivityLog.update({ user_id: null }, { where: { user_id: id } }),
                User.update({ created_by: null }, { where: { created_by: id } }),
                Role.update({ created_by_id: null }, { where: { created_by_id: id } }),
                Assignment.update(
                    { 
                        status: 'returned', 
                        actual_return_date: new Date(), 
                        condition_at_return: 'good',
                        notes: 'Automatically returned to store due to user account deletion'
                    },
                    { where: { user_id: id, status: 'active' } }
                ),
                Inventory.update(
                    { assigned_to: null, status: 'available', assignment_notes: 'Released due to user account deletion' },
                    { where: { assigned_to: id } }
                ),
                Assignment.update({ user_id: null }, { where: { user_id: id } }),
                Request ? Request.update(
                    { status: 'rejected', notes: 'Automatically rejected due to user account deletion' },
                    { 
                        where: { 
                            status: 'pending',
                            [Op.or]: [
                                { requester_id: id },
                                { target_user_id: id }
                            ]
                        } 
                    }
                ) : Promise.resolve(),
                Request ? Request.update({ requester_id: null }, { where: { requester_id: id } }) : Promise.resolve(),
                Request ? Request.update({ target_user_id: null }, { where: { target_user_id: id } }) : Promise.resolve(),
                Request ? Request.update({ chairman_approver_id: null }, { where: { chairman_approver_id: id } }) : Promise.resolve(),
                Request ? Request.update({ storage_approver_id: null }, { where: { storage_approver_id: id } }) : Promise.resolve(),
                Request ? Request.update({ cancelled_by: null }, { where: { cancelled_by: id } }) : Promise.resolve(),
                Approval ? Approval.update({ approver_id: null }, { where: { approver_id: id } }) : Promise.resolve(),
                StoreForm ? StoreForm.update({ created_by: null }, { where: { created_by: id } }) : Promise.resolve(),
                DischargeForm ? DischargeForm.update({ to_user_id: null }, { where: { to_user_id: id } }) : Promise.resolve(),
                DischargeForm ? DischargeForm.update({ created_by: null }, { where: { created_by: id } }) : Promise.resolve(),
                DischargeForm ? DischargeForm.update({ approved_by: null }, { where: { approved_by: id } }) : Promise.resolve(),
                DischargeItem ? DischargeItem.update({ to_user_id: null }, { where: { to_user_id: id } }) : Promise.resolve(),
                Return ? Return.update({ user_id: null }, { where: { user_id: id } }) : Promise.resolve(),
                Return ? Return.update({ received_by: null }, { where: { received_by: id } }) : Promise.resolve(),
                Transfer ? Transfer.update({ from_user_id: null }, { where: { from_user_id: id } }) : Promise.resolve(),
                Transfer ? Transfer.update({ to_user_id: null }, { where: { to_user_id: id } }) : Promise.resolve(),
                Transfer ? Transfer.update({ requested_by: null }, { where: { requested_by: id } }) : Promise.resolve(),
                Transfer ? Transfer.update({ approved_by: null }, { where: { approved_by: id } }) : Promise.resolve(),
                Issue ? Issue.update({ user_id: null }, { where: { user_id: id } }) : Promise.resolve(),
                Issue ? Issue.update({ reported_by: null }, { where: { reported_by: id } }) : Promise.resolve(),
                Issue ? Issue.update({ assigned_to: null }, { where: { assigned_to: id } }) : Promise.resolve(),
                Issue ? Issue.update({ resolved_by: null }, { where: { resolved_by: id } }) : Promise.resolve(),
                OrganizationNode.update({ manager_id: null }, { where: { manager_id: id } }),
                OrganizationNode.update({ created_by: null }, { where: { created_by: id } }),
                Workflow ? Workflow.update({ created_by: null }, { where: { created_by: id } }) : Promise.resolve(),
                FormTemplate ? FormTemplate.update({ created_by: null }, { where: { created_by: id } }) : Promise.resolve()
            ]);

            await user.destroy();
            return true;
        } catch (error) {
            logger.error('Delete user error:', error);
            throw error;
        }
    }
    /**
     * Get user permissions (both role-based and direct).
     */
    async getUserPermissions(companyId, userId) {
        try {
            const user = await User.findOne({
                where: { id: userId, company_id: companyId },
                include: [
                    {
                        model: Role,
                        as: 'role',
                        include: [{ model: Permission, as: 'permissions' }]
                    },
                    {
                        model: Role,
                        as: 'roles',
                        include: [{ model: Permission, as: 'permissions' }]
                    },
                    {
                        model: Permission,
                        as: 'permissions',
                        through: { attributes: [] }
                    }
                ]
            });

            if (!user) throw new Error('User not found');

            const legacyRolePermissions = user.role?.permissions || [];
            const manyToManyRolePermissions = user.roles?.flatMap(r => r.permissions || []) || [];
            const directPermissions = user.permissions || [];

            const allPermissions = [...new Set([
                ...legacyRolePermissions.map(p => p.name),
                ...manyToManyRolePermissions.map(p => p.name),
                ...directPermissions.map(p => p.name)
            ])];

            return {
                role_permissions: [...legacyRolePermissions, ...manyToManyRolePermissions],
                direct_permissions: directPermissions,
                all_permissions: allPermissions
            };
        } catch (error) {
            logger.error('Get user permissions error:', error);
            throw error;
        }
    }

    /**
     * Assign direct permissions to a user.
     */
    async assignPermissions(companyId, userId, permissionIds, grantedBy) {
        try {
            const user = await User.findOne({ where: { id: userId, company_id: companyId } });
            if (!user) throw new Error('User not found');

            await UserPermission.destroy({ where: { user_id: userId } });

            const permissions = permissionIds.map(permissionId => ({
                user_id: userId,
                permission_id: permissionId,
                granted_by: grantedBy,
                granted_at: new Date()
            }));

            await UserPermission.bulkCreate(permissions);
            return true;
        } catch (error) {
            logger.error('Assign permissions error:', error);
            throw error;
        }
    }
}

module.exports = new UserService();