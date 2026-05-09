const { Product, Inventory, ActivityLog, OrganizationNode, sequelize } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const barcodeService = require('../services/barcodeService');
const logger = require('../config/logger');

const productController = {
    /**
     * Get all products scoped to the user's company.
     */
    async getAll(req, res, next) {
        try {
            const { page = 1, limit = 10, search, category, brand, is_active, in_stock } = req.query;
            const company_id = req.user.company_id;
            const where = { company_id };
            
            if (category) where.category = category;
            if (brand) where.brand = brand;
            if (is_active !== undefined) where.is_active = is_active === 'true';
            
            if (in_stock === 'true') {
                // Filter to products that actually exist in the inventory (Stock Intake)
                where.id = {
                    [Op.in]: sequelize.literal(`(
                        SELECT DISTINCT product_id 
                        FROM inventory 
                        WHERE company_id = ${company_id}
                    )`)
                };
            }

            if (search) {
                where[Op.or] = [
                    { name: { [Op.iLike]: `%${search}%` } },
                    { sku: { [Op.iLike]: `%${search}%` } }
                ];
            }
            
            const offset = (page - 1) * limit;
            
            const findOptions = {
                where,
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['created_at', 'DESC']]
            };

            if (in_stock === 'true') {
                // Filter to products that actually exist in the inventory (Stock Intake)
                // We use an inner join (required: true) on inventory
                findOptions.include = [{
                    model: Inventory,
                    as: 'inventory',
                    required: true,
                    where: { company_id },
                    attributes: [] // We don't need the inventory data itself, just the join to filter
                }];
                // When using required include, findAndCountAll needs subQuery: false if using limits
                findOptions.subQuery = false;
                findOptions.distinct = true; // Ensure count is correct for joined results
            }
            
            const { count, rows } = await Product.findAndCountAll(findOptions);

            res.json({
                success: true,
                data: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    pages: Math.ceil(count / limit)
                }
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get product by ID (scoped to company).
     */
    async getById(req, res, next) {
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;
            
            const product = await Product.findOne({
                where: { id, company_id },
                include: [{
                    model: Inventory,
                    as: 'inventory',
                    required: false, // Don't hide the product if no inventory in these nodes
                    where: req.authorizedNodes ? { 
                        org_node_id: { [Op.in]: req.authorizedNodes } 
                    } : {},
                    include: [{
                        model: OrganizationNode,
                        as: 'organizationNode',
                        attributes: ['id', 'name', 'code']
                    }]
                }]
            });

            if (!product) {
                return res.status(404).json({ success: false, message: 'Product not found' });
            }

            res.json({ success: true, data: product });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Create product (scoped to company).
     */
    async create(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const productData = req.body;
            const company_id = req.user.company_id;
            
            // Generate codes
            productData.barcode_data = await barcodeService.generateBarcode(productData.sku);
            productData.qr_code_data = await barcodeService.generateQRCode(productData.sku);
            productData.company_id = company_id;

            const product = await Product.create(productData);

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'CREATE',
                resource: 'products',
                resource_id: product.id,
                details: { sku: product.sku, name: product.name }
            });

            res.status(201).json({
                success: true,
                message: 'Product created successfully',
                data: product
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Update product (scoped to company).
     */
    async update(req, res, next) {
        try {
            const { id } = req.params;
            const productData = req.body;
            const company_id = req.user.company_id;

            const product = await Product.findOne({ where: { id, company_id } });
            if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

            if (productData.sku && productData.sku !== product.sku) {
                productData.barcode_data = await barcodeService.generateBarcode(productData.sku);
                productData.qr_code_data = await barcodeService.generateQRCode(productData.sku);
            }

            await product.update(productData);

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'UPDATE',
                resource: 'products',
                resource_id: id,
                details: productData
            });

            res.json({ success: true, message: 'Product updated successfully', data: product });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Delete product.
     */
    async delete(req, res, next) {
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;

            const product = await Product.findOne({ where: { id, company_id } });
            if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

            const inventoryCount = await Inventory.count({ where: { product_id: id } });
            if (inventoryCount > 0) {
                return res.status(400).json({ success: false, message: 'Cannot delete product with existing inventory' });
            }

            await product.destroy();

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'DELETE',
                resource: 'products',
                resource_id: id
            });

            res.json({ success: true, message: 'Product deleted successfully' });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get unique categories for company.
     */
    async getCategories(req, res, next) {
        try {
            const categories = await Product.findAll({
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('category')), 'category']],
                where: { company_id: req.user.company_id, category: { [Op.ne]: null } }
            });

            res.json({
                success: true,
                data: categories.map(c => c.category)
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get unique brands for company.
     */
    async getBrands(req, res, next) {
        try {
            const brands = await Product.findAll({
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('brand')), 'brand']],
                where: { company_id: req.user.company_id, brand: { [Op.ne]: null } }
            });

            res.json({
                success: true,
                data: brands.map(b => b.brand)
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Toggle active status.
     */
    async toggleStatus(req, res, next) {
        try {
            const { id } = req.params;
            const company_id = req.user.company_id;
            
            const product = await Product.findOne({ where: { id, company_id } });
            if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

            await product.update({ is_active: !product.is_active });

            await ActivityLog.create({
                company_id,
                user_id: req.user.id,
                action: 'UPDATE',
                resource: 'products',
                resource_id: id,
                details: { is_active: product.is_active }
            });

            res.json({ success: true, data: product });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = productController;