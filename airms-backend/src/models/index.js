const sequelize = require('../config/database');
const User = require('./User');
const Role = require('./Role');
const Permission = require('./Permission');
const RolePermission = require('./RolePermission');
const UserPermission = require('./UserPermission');
const UserRole = require('./UserRole');
const Company = require('./Company');
const OrganizationType = require('./OrganizationType');
const OrganizationNode = require('./OrganizationNode');
const Product = require('./Product');
const Inventory = require('./Inventory');
const Request = require('./Request');
const RequestItem = require('./RequestItem');
const Approval = require('./Approval');
const StoreForm = require('./StoreForm');
const StoreItem = require('./StoreItem');
const DischargeForm = require('./DischargeForm');
const DischargeItem = require('./DischargeItem');
const Assignment = require('./Assignment');
const Return = require('./Return');
const ReturnItem = require('./ReturnItem');
const Transfer = require('./Transfer');
const TransferItem = require('./TransferItem');
const Issue = require('./Issue');
const ActivityLog = require('./ActivityLog');
const Workflow = require('./Workflow');
const WorkflowStep = require('./WorkflowStep');
const WorkflowStatus = require('./WorkflowStatus');
const WorkflowRoute = require('./WorkflowRoute');

// ============================================
// Company Associations (Multi-Tenancy)
// ============================================
Company.hasMany(OrganizationType, { foreignKey: 'company_id', as: 'organizationTypes' });
OrganizationType.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

Company.hasMany(OrganizationNode, { foreignKey: 'company_id', as: 'nodes' });
OrganizationNode.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

Company.hasMany(User, { foreignKey: 'company_id', as: 'users' });
User.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

Company.hasMany(Role, { foreignKey: 'company_id', as: 'roles' });
Role.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

Company.hasMany(Product, { foreignKey: 'company_id', as: 'products' });
Product.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

Company.hasMany(Inventory, { foreignKey: 'company_id', as: 'inventory' });
Inventory.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// ============================================
// Organization Hierarchy Associations
// ============================================
OrganizationType.hasMany(OrganizationNode, { foreignKey: 'org_type_id', as: 'nodes' });
OrganizationNode.belongsTo(OrganizationType, { foreignKey: 'org_type_id', as: 'type' });

OrganizationNode.hasMany(OrganizationNode, { foreignKey: 'parent_id', as: 'children' });
OrganizationNode.belongsTo(OrganizationNode, { foreignKey: 'parent_id', as: 'parent' });

OrganizationNode.hasMany(User, { foreignKey: 'org_node_id', as: 'users' });
User.belongsTo(OrganizationNode, { foreignKey: 'org_node_id', as: 'organizationNode' });

OrganizationNode.hasMany(Inventory, { foreignKey: 'org_node_id', as: 'inventory' });
Inventory.belongsTo(OrganizationNode, { foreignKey: 'org_node_id', as: 'organizationNode' });

// ============================================
// Role & Permission Associations
// ============================================
Role.hasMany(User, { foreignKey: 'role_id', as: 'users' });
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });

// Many-to-Many Role Associations
User.belongsToMany(Role, { 
    through: UserRole, 
    foreignKey: 'user_id', 
    otherKey: 'role_id',
    as: 'roles'
});
Role.belongsToMany(User, { 
    through: UserRole, 
    foreignKey: 'role_id', 
    otherKey: 'user_id',
    as: 'assignedUsers'
});

// Role Organization Isolation
Role.belongsTo(OrganizationNode, { foreignKey: 'org_node_id', as: 'organizationNode' });
OrganizationNode.hasMany(Role, { foreignKey: 'org_node_id', as: 'roles' });

// Role Ownership isolation

User.hasMany(Role, { foreignKey: 'created_by_id', as: 'ownedRoles' });
Role.belongsTo(User, { foreignKey: 'created_by_id', as: 'roleRegistrar' });

Role.belongsToMany(Permission, { 
    through: RolePermission, 
    foreignKey: 'role_id', 
    otherKey: 'permission_id',
    as: 'permissions'
});
Permission.belongsToMany(Role, { 
    through: RolePermission, 
    foreignKey: 'permission_id', 
    otherKey: 'role_id',
    as: 'roles'
});

User.belongsToMany(Permission, { 
    through: UserPermission, 
    foreignKey: 'user_id', 
    otherKey: 'permission_id',
    as: 'permissions'
});
Permission.belongsToMany(User, { 
    through: UserPermission, 
    foreignKey: 'permission_id', 
    otherKey: 'user_id',
    as: 'users'
});

UserPermission.belongsTo(Permission, { foreignKey: 'permission_id', as: 'permission' });
UserPermission.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
RolePermission.belongsTo(Permission, { foreignKey: 'permission_id', as: 'permission' });
RolePermission.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });

// ============================================
// Product & Inventory Associations
// ============================================
Product.hasMany(Inventory, { foreignKey: 'product_id', as: 'inventory' });
Inventory.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Product.hasMany(RequestItem, { foreignKey: 'product_id', as: 'requestItems' });
RequestItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Product.hasMany(StoreItem, { foreignKey: 'product_id', as: 'storeItems' });
StoreItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Product.hasMany(DischargeItem, { foreignKey: 'product_id', as: 'dischargeItems' });
DischargeItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Product.hasMany(Assignment, { foreignKey: 'product_id', as: 'assignments' });
Assignment.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Product.hasMany(ReturnItem, { foreignKey: 'product_id', as: 'returnItems' });
ReturnItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Product.hasMany(TransferItem, { foreignKey: 'product_id', as: 'transferItems' });
TransferItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Product.hasMany(Issue, { foreignKey: 'product_id', as: 'issues' });
Issue.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// ============================================
// Request & Approval Associations
// ============================================
User.hasMany(Request, { foreignKey: 'requester_id', as: 'requests' });
Request.belongsTo(User, { as: 'requester', foreignKey: 'requester_id' });
Request.belongsTo(User, { as: 'targetUser', foreignKey: 'target_user_id' });
User.hasMany(Assignment, { foreignKey: 'user_id', as: 'assignments' });
Assignment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Request.hasMany(RequestItem, { foreignKey: 'request_id', as: 'items' });
RequestItem.belongsTo(Request, { foreignKey: 'request_id', as: 'request' });

Request.hasMany(Approval, { foreignKey: 'request_id', as: 'approvals' });
Approval.belongsTo(Request, { foreignKey: 'request_id', as: 'request' });

Approval.belongsTo(User, { as: 'approver', foreignKey: 'approver_id' });

DischargeForm.hasMany(Approval, { foreignKey: 'discharge_form_id', as: 'approvals' });
Approval.belongsTo(DischargeForm, { foreignKey: 'discharge_form_id', as: 'dischargeForm' });

StoreForm.hasMany(Approval, { foreignKey: 'store_form_id', as: 'approvals' });
Approval.belongsTo(StoreForm, { foreignKey: 'store_form_id', as: 'storeForm' });

Request.belongsTo(Workflow, { foreignKey: 'workflow_id', as: 'workflow' });
Request.belongsTo(WorkflowStep, { foreignKey: 'current_step_id', as: 'currentStep' });

Request.belongsTo(OrganizationNode, { foreignKey: 'org_node_id', as: 'organizationNode' });
OrganizationNode.hasMany(Request, { foreignKey: 'org_node_id', as: 'requests' });

// ============================================
// Workflow Associations
// ============================================
Workflow.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
Company.hasMany(Workflow, { foreignKey: 'company_id', as: 'workflows' });

Workflow.belongsTo(OrganizationNode, { foreignKey: 'org_node_id', as: 'organizationNode' });
OrganizationNode.hasMany(Workflow, { foreignKey: 'org_node_id', as: 'workflows' });

Workflow.hasMany(WorkflowStep, { foreignKey: 'workflow_id', as: 'steps', onDelete: 'CASCADE' });
WorkflowStep.belongsTo(Workflow, { foreignKey: 'workflow_id', as: 'workflow' });

WorkflowStep.belongsTo(Role, { foreignKey: 'required_role_id', as: 'requiredRole' });

WorkflowStep.belongsTo(WorkflowStatus, { foreignKey: 'status_id', as: 'statusLabel' });
WorkflowStatus.hasMany(WorkflowStep, { foreignKey: 'status_id', as: 'steps' });

WorkflowStatus.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
Company.hasMany(WorkflowStatus, { foreignKey: 'company_id', as: 'workflowStatuses' });

Workflow.hasMany(WorkflowRoute, { foreignKey: 'workflow_id', as: 'routes' });
WorkflowRoute.belongsTo(Workflow, { foreignKey: 'workflow_id', as: 'workflow' });

WorkflowStep.hasMany(WorkflowRoute, { foreignKey: 'source_step_id', as: 'outgoingRoutes' });
WorkflowRoute.belongsTo(WorkflowStep, { foreignKey: 'source_step_id', as: 'sourceStep' });

WorkflowStep.hasMany(WorkflowRoute, { foreignKey: 'target_step_id', as: 'incomingRoutes' });
WorkflowRoute.belongsTo(WorkflowStep, { foreignKey: 'target_step_id', as: 'targetStep' });

// ============================================
// Store & Discharge Form Associations
// ============================================
StoreForm.belongsTo(OrganizationNode, { foreignKey: 'org_node_id', as: 'organizationNode' });
StoreForm.belongsTo(User, { as: 'creator', foreignKey: 'created_by' });
StoreForm.hasMany(StoreItem, { foreignKey: 'store_form_id', as: 'items' });
StoreItem.belongsTo(StoreForm, { foreignKey: 'store_form_id', as: 'storeForm' });

StoreForm.belongsTo(Workflow, { foreignKey: 'workflow_id', as: 'workflow' });
StoreForm.belongsTo(WorkflowStep, { foreignKey: 'current_step_id', as: 'currentStep' });

DischargeForm.belongsTo(OrganizationNode, { as: 'fromNode', foreignKey: 'from_node_id' });
DischargeForm.belongsTo(OrganizationNode, { as: 'toNode', foreignKey: 'to_node_id' });
DischargeForm.belongsTo(User, { as: 'toUser', foreignKey: 'to_user_id' });
DischargeForm.belongsTo(User, { as: 'creator', foreignKey: 'created_by' });
DischargeForm.belongsTo(Request, { foreignKey: 'request_id', as: 'request' });
DischargeForm.hasMany(DischargeItem, { foreignKey: 'discharge_form_id', as: 'items' });
DischargeItem.belongsTo(DischargeForm, { foreignKey: 'discharge_form_id', as: 'dischargeForm' });

DischargeForm.belongsTo(Workflow, { foreignKey: 'workflow_id', as: 'workflow' });
DischargeForm.belongsTo(WorkflowStep, { foreignKey: 'current_step_id', as: 'currentStep' });

DischargeItem.hasMany(Assignment, { foreignKey: 'discharge_item_id', as: 'assignments' });
Assignment.belongsTo(DischargeItem, { foreignKey: 'discharge_item_id', as: 'dischargeItem' });

// ============================================
// Asset Tracking Associations
// ============================================
Assignment.belongsTo(OrganizationNode, { foreignKey: 'org_node_id', as: 'organizationNode' });

Return.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Return.belongsTo(User, { as: 'receiver', foreignKey: 'received_by' });
Return.belongsTo(OrganizationNode, { as: 'fromNode', foreignKey: 'from_node_id' });
Return.belongsTo(OrganizationNode, { as: 'toNode', foreignKey: 'to_node_id' });
Return.belongsTo(Assignment, { foreignKey: 'assignment_id', as: 'assignment' });
Assignment.hasMany(Return, { foreignKey: 'assignment_id', as: 'returns' });

Transfer.belongsTo(User, { as: 'fromUser', foreignKey: 'from_user_id' });
Transfer.belongsTo(OrganizationNode, { as: 'fromNode', foreignKey: 'from_node_id' });
Transfer.belongsTo(User, { as: 'toUser', foreignKey: 'to_user_id' });
Transfer.belongsTo(OrganizationNode, { as: 'toNode', foreignKey: 'to_node_id' });
Transfer.belongsTo(User, { as: 'requester', foreignKey: 'requested_by' });

Transfer.belongsTo(Workflow, { foreignKey: 'workflow_id', as: 'workflow' });
Transfer.belongsTo(WorkflowStep, { foreignKey: 'current_step_id', as: 'currentStep' });

Transfer.hasMany(TransferItem, { foreignKey: 'transfer_id', as: 'items' });
TransferItem.belongsTo(Transfer, { foreignKey: 'transfer_id', as: 'transfer' });

Return.hasMany(ReturnItem, { foreignKey: 'return_id', as: 'items' });
ReturnItem.belongsTo(Return, { foreignKey: 'return_id', as: 'return' });

Return.belongsTo(Workflow, { foreignKey: 'workflow_id', as: 'workflow' });
Return.belongsTo(WorkflowStep, { foreignKey: 'current_step_id', as: 'currentStep' });

Issue.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Issue.belongsTo(User, { as: 'reporter', foreignKey: 'reported_by' });
Issue.belongsTo(User, { as: 'assignee', foreignKey: 'assigned_to' });
Issue.belongsTo(User, { as: 'resolver', foreignKey: 'resolved_by' });
Issue.belongsTo(OrganizationNode, { foreignKey: 'org_node_id', as: 'organizationNode' });
Issue.belongsTo(Assignment, { foreignKey: 'assignment_id', as: 'assignment' });
Assignment.hasMany(Issue, { foreignKey: 'assignment_id', as: 'issues' });

ActivityLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
ActivityLog.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

module.exports = {
    sequelize,
    User,
    Role,
    Permission,
    RolePermission,
    UserPermission,
    UserRole,
    Company,
    OrganizationType,
    OrganizationNode,
    Product,
    Inventory,
    Request,
    RequestItem,
    Approval,
    StoreForm,
    StoreItem,
    DischargeForm,
    DischargeItem,
    Assignment,
    Return,
    ReturnItem,
    Transfer,
    TransferItem,
    Issue,
    ActivityLog,
    Workflow,
    WorkflowStep,
    WorkflowStatus,
    WorkflowRoute
};