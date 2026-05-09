const bwipjs = require('bwip-js');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

class BarcodeService {
    // Generate barcode for SKU
    async generateBarcode(sku) {
        try {
            const barcode = await bwipjs.toBuffer({
                bcid: process.env.BARCODE_FORMAT || 'code128',
                text: sku,
                scale: 3,
                height: 10,
                includetext: true,
                textxalign: 'center',
                textfont: 'Helvetica',
                textsize: 12
            });

            return barcode.toString('base64');
        } catch (error) {
            logger.error('Generate barcode error:', error);
            throw new Error('Failed to generate barcode');
        }
    }

    // Generate QR code
    async generateQRCode(data) {
        try {
            const qrCode = await QRCode.toDataURL(data, {
                errorCorrectionLevel: 'H',
                type: 'image/png',
                quality: 0.92,
                margin: 1,
                width: 200
            });

            return qrCode;
        } catch (error) {
            logger.error('Generate QR code error:', error);
            throw new Error('Failed to generate QR code');
        }
    }

    // Generate serial numbers
    async generateSerialNumbers(count, productId) {
        try {
            const serialNumbers = [];
            const prefix = productId.toString().padStart(4, '0');

            for (let i = 0; i < count; i++) {
                const uniqueId = uuidv4().split('-')[0].toUpperCase();
                const serialNumber = `${prefix}-${uniqueId}`;
                serialNumbers.push(serialNumber);
            }

            return serialNumbers;
        } catch (error) {
            logger.error('Generate serial numbers error:', error);
            throw error;
        }
    }

    // Generate batch number
    async generateBatchNumber(productId) {
        try {
            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

            return `BATCH-${year}${month}${day}-${productId}-${random}`;
        } catch (error) {
            logger.error('Generate batch number error:', error);
            throw error;
        }
    }

    // Scan barcode
    async scanBarcode(barcodeData) {
        try {
            // Decode barcode if needed
            // For now, return the raw data
            return {
                format: this.detectBarcodeFormat(barcodeData),
                data: barcodeData,
                timestamp: new Date()
            };
        } catch (error) {
            logger.error('Scan barcode error:', error);
            throw new Error('Invalid barcode');
        }
    }

    // Detect barcode format
    detectBarcodeFormat(barcodeData) {
        // Simple format detection
        if (barcodeData.startsWith('http') || barcodeData.includes('://')) {
            return 'QR_URL';
        }
        if (/^\d+$/.test(barcodeData)) {
            return 'EAN13';
        }
        if (/^[A-Z0-9]+$/.test(barcodeData)) {
            return 'CODE128';
        }
        return 'UNKNOWN';
    }

    // Generate label
    async generateLabel(product, options = {}) {
        try {
            const label = {
                product_name: product.name,
                sku: product.sku,
                barcode: product.barcode_data,
                qr_code: product.qr_code_data,
                brand: product.brand,
                model: product.model,
                category: product.category,
                ...options
            };

            return label;
        } catch (error) {
            logger.error('Generate label error:', error);
            throw error;
        }
    }

    // Batch generate barcodes
    async batchGenerateBarcodes(products) {
        try {
            const results = [];

            for (const product of products) {
                try {
                    const barcode = await this.generateBarcode(product.sku);
                    const qrCode = await this.generateQRCode(product.sku);

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

    // Verify barcode
    async verifyBarcode(barcode, expectedSku) {
        try {
            // In a real implementation, you would decode and verify the barcode
            // For now, just return true
            return {
                valid: true,
                scanned_sku: expectedSku,
                matches: true
            };
        } catch (error) {
            logger.error('Verify barcode error:', error);
            return {
                valid: false,
                error: error.message
            };
        }
    }
}

module.exports = new BarcodeService();