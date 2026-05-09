const bwipjs = require('bwip-js');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../config/logger');

class BarcodeGenerator {
    constructor() {
        this.barcodeDir = path.join(__dirname, '../../uploads/barcodes');
        this.ensureDirectoryExists();
    }

    // Ensure barcode directory exists
    async ensureDirectoryExists() {
        try {
            await fs.access(this.barcodeDir);
        } catch (error) {
            await fs.mkdir(this.barcodeDir, { recursive: true });
        }
    }

    // Generate barcode
    async generateBarcode(sku, options = {}) {
        try {
            const barcode = await bwipjs.toBuffer({
                bcid: options.format || 'code128',
                text: sku,
                scale: options.scale || 3,
                height: options.height || 10,
                includetext: options.includeText !== false,
                textxalign: 'center',
                textfont: 'Helvetica',
                textsize: options.textSize || 12,
                backgroundcolor: options.bgColor || 'FFFFFF',
                padding: options.padding || 5
            });

            // Save to file if requested
            if (options.saveToFile) {
                const filename = `barcode-${sku}-${Date.now()}.png`;
                const filepath = path.join(this.barcodeDir, filename);
                await fs.writeFile(filepath, barcode);
                return {
                    data: barcode.toString('base64'),
                    filepath,
                    filename
                };
            }

            return {
                data: barcode.toString('base64'),
                format: options.format || 'code128'
            };
        } catch (error) {
            logger.error('Generate barcode error:', error);
            throw new Error('Failed to generate barcode');
        }
    }

    // Generate QR code
    async generateQRCode(data, options = {}) {
        try {
            const qrOptions = {
                errorCorrectionLevel: options.errorCorrection || 'H',
                type: 'image/png',
                quality: options.quality || 0.92,
                margin: options.margin || 1,
                width: options.width || 200,
                color: {
                    dark: options.darkColor || '#000000',
                    light: options.lightColor || '#FFFFFF'
                }
            };

            const qrCode = await QRCode.toDataURL(data, qrOptions);

            // Save to file if requested
            if (options.saveToFile) {
                const base64Data = qrCode.replace(/^data:image\/png;base64,/, '');
                const filename = `qrcode-${Date.now()}.png`;
                const filepath = path.join(this.barcodeDir, filename);
                await fs.writeFile(filepath, base64Data, 'base64');
                return {
                    data: qrCode,
                    filepath,
                    filename
                };
            }

            return qrCode;
        } catch (error) {
            logger.error('Generate QR code error:', error);
            throw new Error('Failed to generate QR code');
        }
    }

    // Generate serial number
    async generateSerialNumber(productId, options = {}) {
        try {
            const prefix = options.prefix || productId.toString().padStart(4, '0');
            const timestamp = Date.now().toString(36).toUpperCase();
            const random = Math.random().toString(36).substring(2, 8).toUpperCase();
            const uniqueId = uuidv4().split('-')[0].toUpperCase();
            
            let serialNumber;
            switch (options.format || 'standard') {
                case 'standard':
                    serialNumber = `${prefix}-${timestamp}-${random}`;
                    break;
                case 'uuid':
                    serialNumber = `${prefix}-${uniqueId}`;
                    break;
                case 'date':
                    const date = new Date();
                    const year = date.getFullYear().toString().slice(-2);
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    const day = date.getDate().toString().padStart(2, '0');
                    serialNumber = `${prefix}${year}${month}${day}${random}`;
                    break;
                default:
                    serialNumber = `${prefix}-${timestamp}`;
            }

            return serialNumber;
        } catch (error) {
            logger.error('Generate serial number error:', error);
            throw error;
        }
    }

    // Generate batch number
    async generateBatchNumber(productId, options = {}) {
        try {
            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

            return `BATCH-${year}${month}${day}-${productId}-${random}`;
        } catch (error) {
            logger.error('Generate batch number error:', error);
            throw error;
        }
    }

    // Generate product label
    async generateProductLabel(product, options = {}) {
        try {
            const label = {
                product_name: product.name,
                sku: product.sku,
                brand: product.brand,
                model: product.model,
                category: product.category,
                barcode: await this.generateBarcode(product.sku, { saveToFile: true }),
                qr_code: await this.generateQRCode(product.sku, { saveToFile: true }),
                specifications: product.specifications,
                ...options
            };

            return label;
        } catch (error) {
            logger.error('Generate product label error:', error);
            throw error;
        }
    }

    // Batch generate barcodes
    async batchGenerateBarcodes(products, options = {}) {
        try {
            const results = [];

            for (const product of products) {
                try {
                    const barcode = await this.generateBarcode(product.sku, options);
                    const qrCode = await this.generateQRCode(product.sku, options);

                    results.push({
                        sku: product.sku,
                        success: true,
                        barcode,
                        qr_code: qrCode
                    });
                } catch (error) {
                    results.push({
                        sku: product.sku,
                        success: false,
                        error: error.message
                    });
                }
            }

            return results;
        } catch (error) {
            logger.error('Batch generate barcodes error:', error);
            throw error;
        }
    }

    // Scan barcode
    async scanBarcode(barcodeData) {
        try {
            // Detect barcode format
            const format = this.detectBarcodeFormat(barcodeData);
            
            // Extract information from barcode
            const info = this.extractBarcodeInfo(barcodeData, format);

            return {
                valid: true,
                format,
                data: barcodeData,
                info,
                timestamp: new Date()
            };
        } catch (error) {
            logger.error('Scan barcode error:', error);
            return {
                valid: false,
                error: 'Invalid barcode'
            };
        }
    }

    // Detect barcode format
    detectBarcodeFormat(barcodeData) {
        if (barcodeData.startsWith('http') || barcodeData.includes('://')) {
            return 'QR_URL';
        }
        if (/^\d{13}$/.test(barcodeData)) {
            return 'EAN13';
        }
        if (/^\d{8}$/.test(barcodeData)) {
            return 'EAN8';
        }
        if (/^\d{12}$/.test(barcodeData)) {
            return 'UPC';
        }
        if (/^[A-Z0-9]+$/.test(barcodeData)) {
            return 'CODE128';
        }
        if (/^\d+$/.test(barcodeData)) {
            return 'CODE39';
        }
        return 'UNKNOWN';
    }

    // Extract information from barcode
    extractBarcodeInfo(barcodeData, format) {
        const info = {
            sku: null,
            product_id: null,
            batch: null,
            serial: null
        };

        // Try to extract SKU (assuming format: SKU-XXX-XXX)
        const skuMatch = barcodeData.match(/^([A-Z0-9]{2,}-[A-Z0-9]{3,}-[0-9]{3,})/);
        if (skuMatch) {
            info.sku = skuMatch[1];
        }

        // Try to extract batch number
        const batchMatch = barcodeData.match(/BATCH-(\d{6})-(\d+)-(\d{4})/);
        if (batchMatch) {
            info.batch = batchMatch[0];
        }

        return info;
    }

    // Verify barcode
    async verifyBarcode(barcode, expectedSku) {
        try {
            const scanResult = await this.scanBarcode(barcode);
            
            if (!scanResult.valid) {
                return {
                    valid: false,
                    error: 'Invalid barcode'
                };
            }

            const matches = scanResult.info.sku === expectedSku;

            return {
                valid: true,
                matches,
                scanned_sku: scanResult.info.sku,
                expected_sku: expectedSku,
                format: scanResult.format
            };
        } catch (error) {
            logger.error('Verify barcode error:', error);
            return {
                valid: false,
                error: error.message
            };
        }
    }

    // Print barcode (generate PDF for printing)
    async generatePrintPDF(barcodes, options = {}) {
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ size: options.pageSize || 'A4', margin: 50 });

        const pageWidth = doc.page.width - 100;
        const itemsPerRow = options.itemsPerRow || 3;
        const itemWidth = pageWidth / itemsPerRow;
        const itemHeight = options.itemHeight || 150;

        let x = 50;
        let y = 50;
        let count = 0;

        for (const barcode of barcodes) {
            if (count > 0 && count % itemsPerRow === 0) {
                x = 50;
                y += itemHeight;
                
                if (y > doc.page.height - 100) {
                    doc.addPage();
                    y = 50;
                }
            }

            // Draw barcode
            if (barcode.image) {
                doc.image(barcode.image, x, y, { width: itemWidth - 20 });
            }

            // Draw text
            doc.fontSize(10).text(barcode.label || barcode.sku, x, y + 80, {
                width: itemWidth - 20,
                align: 'center'
            });

            x += itemWidth;
            count++;
        }

        return doc;
    }
}

module.exports = new BarcodeGenerator();