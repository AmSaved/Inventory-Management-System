const { FormTemplate } = require('../models');

exports.createTemplate = async (req, res) => {
    try {
        const { name, template_key, module, schema, icon, description, is_active } = req.body;
        
        const template = await FormTemplate.create({
            name,
            template_key: template_key || `tpl_${Date.now()}`,
            module: module || 'blueprint',
            schema: schema || [],
            icon,
            description,
            is_active: is_active !== undefined ? is_active : true,
            company_id: req.user.company_id
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
        const templates = await FormTemplate.findAll({
            where: { company_id: req.user.company_id },
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
        const template = await FormTemplate.findOne({
            where: { 
                module: category, // Mapping category param to module for compatibility
                company_id: req.user.company_id,
                is_active: true
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
        const template = await FormTemplate.findOne({
            where: { 
                module,
                template_key: key,
                company_id: req.user.company_id,
                is_active: true
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
