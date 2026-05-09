const { validationResult } = require('express-validator');
const { Request, Approval, User, ActivityLog } = require('../models');
const approvalService = require('../services/approvalService');

const approvalController = {
    /**
     * Get pending approvals categorized by type.
     */
    async getPendingByType(req, res, next) {
        try {
            const { type } = req.params;
            const companyId = req.user.company_id;
            let data = [];

            switch (type) {
                case 'inventory':
                    data = await approvalService.getTransferApprovals(companyId, req.user, 'node_to_node');
                    break;
                case 'items':
                    // Everything except node_to_node for item-level transfers
                    data = await approvalService.getTransferApprovals(companyId, req.user, ['user_to_user', 'user_to_node', 'node_to_user']); 
                    break;
                case 'discharge':
                    data = await approvalService.getDischargeApprovals(companyId, req.user);
                    break;
                case 'returns':
                    data = await approvalService.getReturnApprovals(companyId, req.user);
                    break;
                case 'procurement':
                    data = await approvalService.getPendingApprovals(companyId, req.user);
                    break;
                default:
                    data = await approvalService.getPendingApprovals(companyId, req.user);
            }

            res.json({
                success: true,
                type,
                data
            });
        } catch (error) {
            next(error);
        }
    },
    /**
     * Handle workflow approvals dynamically based on the Organization's Process Design.
     * This replaces legacy chairmanApprove and storageApprove with a generic handler.
     */
    async approve(req, res, next) {
        try {
            const { id } = req.params;
            const { comments, resourceType } = req.body;
            const company_id = req.user.company_id;

            const result = await approvalService.processAction(company_id, id, resourceType || 'request', req.user, 'approve', comments);
            
            res.json({
                success: true,
                message: result.isFinalStep ? 'Command fully authorized' : `Request moved to next step: ${result.resource.workflow_status}`,
                data: result
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Handle workflow rejections dynamically.
     */
    async reject(req, res, next) {
        try {
            const { id } = req.params;
            const { comments, resourceType } = req.body;
            const company_id = req.user.company_id;

            const result = await approvalService.processAction(company_id, id, resourceType || 'request', req.user, 'reject', comments);
            
            res.json({
                success: true,
                message: 'Command rejected',
                data: result
            });
        } catch (error) {
            next(error);
        }
    },

    // Get approval history for request
    async getApprovalHistory(req, res, next) {
        try {
            const { request_id: requestId } = req.params;

            const approvals = await Approval.findAll({
                where: { request_id: requestId },
                include: [{
                    model: User,
                    as: 'approver',
                    attributes: ['id', 'first_name', 'last_name', 'email']
                }],
                order: [['approval_level', 'ASC'], ['created_at', 'ASC']]
            });

            res.json({
                success: true,
                data: approvals
            });
        } catch (error) {
            next(error);
        }
    },


    async checkApprovalStatus(req, res, next) {
        try {
            const { request_id: requestId } = req.params;

            const request = await Request.findByPk(requestId, {
                include: ['approvals']
            });

            if (!request) {
                return res.status(404).json({
                    success: false,
                    message: 'Request not found'
                });
            }

            const status = {
                request_id: request.id,
                request_number: request.request_number,
                current_status: request.status,
                approvals: {}
            };

            // Get chairman approval
            const chairmanApproval = request.approvals.find(a => a.approval_level === 1);
            if (chairmanApproval) {
                status.approvals.chairman = {
                    status: chairmanApproval.status,
                    approved_at: chairmanApproval.approved_at,
                    comments: chairmanApproval.comments
                };
            }

            // Get storage approval
            const storageApproval = request.approvals.find(a => a.approval_level === 2);
            if (storageApproval) {
                status.approvals.storage = {
                    status: storageApproval.status,
                    approved_at: storageApproval.approved_at,
                    comments: storageApproval.comments
                };
            }

            res.json({
                success: true,
                data: status
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = approvalController;
