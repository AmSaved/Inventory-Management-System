const { FormTemplate, OrganizationNode } = require('../models');
const { Op } = require('sequelize');
const hierarchyService = require('../services/hierarchyService');

/**
 * Resolve the org_node_id to scope a template to.
 * Super admins (no org_node_id) → null (company-wide).
 * Branch users → root node of their hierarchy.
 */
async function resolveTemplateOrgNode(user) {
    if (!user.org_node_id) return null;
    try {
        const breadcrumb = await hierarchyService.getBreadcrumb(user.org_node_id);
        if (breadcrumb && breadcrumb.length > 0) {
            return breadcrumb[0].id; // root node of user's hierarchy
        }
    } catch (e) {
        // Ignore and fall back to null
    }
    return user.org_node_id;
}

async function buildOrgNodeFilter(user) {
    if (!user.org_node_id) {
        // Super admin: see all templates for this company (no org_node restriction)
        return {};
    }
    const rootNodeId = await resolveTemplateOrgNode(user);
    if (!rootNodeId) return { org_node_id: -1 }; // Force empty result if root node is not found

    return {
        org_node_id: rootNodeId
    };
}

exports.createTemplate = async (req, res) => {
    try {
        const { name, template_key, module, schema, icon, description, is_active } = req.body;

        const org_node_id = await resolveTemplateOrgNode(req.user);

        const template = await FormTemplate.create({
            name,
            template_key: template_key || `tpl_${Date.now()}`,
            module: module || 'blueprint',
            schema: schema || [],
            icon,
            description,
            is_active: is_active !== undefined ? is_active : true,
            company_id: req.user.company_id,
            org_node_id,
            created_by: req.user.id
        });

        res.status(201).json({
            success: true,
            message: 'Blueprint architecture created successfully',
            data: template
        });
    } catch (error) {
        console.error('Error creating blueprint template:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create blueprint template',
            error: error.message
        });
    }
};

exports.getTemplates = async (req, res) => {
    try {
        const orgNodeFilter = await buildOrgNodeFilter(req.user);

        const templates = await FormTemplate.findAll({
            where: {
                company_id: req.user.company_id,
                ...orgNodeFilter
            },
            order: [['module', 'ASC'], ['name', 'ASC']]
        });

        res.json({
            success: true,
            data: templates
        });
    } catch (error) {
        console.error('Error fetching form templates:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch form templates',
            error: error.message
        });
    }
};

exports.getTemplateByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const orgNodeFilter = await buildOrgNodeFilter(req.user);

        const template = await FormTemplate.findOne({
            where: {
                module: category, // Mapping category param to module for compatibility
                company_id: req.user.company_id,
                is_active: true,
                ...orgNodeFilter
            }
        });

        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'No active template found for this architecture'
            });
        }

        res.json({
            success: true,
            data: template
        });
    } catch (error) {
        console.error('Error fetching template:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch template',
            error: error.message
        });
    }
};

exports.updateTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, module, schema, icon, description, is_active } = req.body;

        const template = await FormTemplate.findOne({
            where: { id, company_id: req.user.company_id }
        });

        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'Blueprint architecture not found'
            });
        }

        await template.update({
            name,
            module,
            schema,
            icon,
            description,
            is_active
        });

        res.json({
            success: true,
            message: 'Blueprint architecture updated successfully',
            data: template
        });
    } catch (error) {
        console.error('Error updating blueprint template:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update blueprint template',
            error: error.message
        });
    }
};

exports.deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;

        const template = await FormTemplate.findOne({
            where: { id, company_id: req.user.company_id }
        });

        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'Blueprint architecture not found'
            });
        }

        await template.destroy();

        res.json({
            success: true,
            message: 'Blueprint architecture deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting blueprint template:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete blueprint template',
            error: error.message
        });
    }
};

exports.getTemplateByModuleAndKey = async (req, res) => {
    try {
        const { module, key } = req.params;
        const orgNodeFilter = await buildOrgNodeFilter(req.user);

        const template = await FormTemplate.findOne({
            where: {
                module,
                template_key: key,
                company_id: req.user.company_id,
                is_active: true,
                ...orgNodeFilter
            }
        });

        if (!template) {
            return res.status(404).json({
                success: false,
                message: `No active template found for module: ${module} and key: ${key}`
            });
        }

        res.json({
            success: true,
            data: template
        });
    } catch (error) {
        console.error('Error fetching template by module/key:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch template',
            error: error.message
        });
    }
};
