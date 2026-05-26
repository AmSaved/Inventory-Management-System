const express = require('express');
const router = express.Router();
const formTemplateController = require('../controllers/formTemplateController');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

// All form template routes require authentication
router.use(authMiddleware);

// CRUD routes mapped to Product permissions as per user logic
router.post('/', checkPermission('product:create'), formTemplateController.createTemplate);
router.get('/', formTemplateController.getTemplates);
router.get('/category/:category', formTemplateController.getTemplateByCategory);
router.get('/module/:module/key/:key', formTemplateController.getTemplateByModuleAndKey);
router.put('/:id', checkPermission('product:update'), formTemplateController.updateTemplate);
router.delete('/:id', checkPermission('product:delete'), formTemplateController.deleteTemplate);

module.exports = router;
