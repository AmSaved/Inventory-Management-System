const cron = require('node-cron');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../config/logger');
const emailService = require('../services/emailService');
const reportService = require('../services/reportService');
const { User, OrganizationNode } = require('../models');

class ReportGenerator {
    constructor() {
        this.reportsDir = path.join(__dirname, '../../uploads/reports');
        this.ensureDirectoryExists();
    }

    // Ensure reports directory exists
    async ensureDirectoryExists() {
        try {
            await fs.access(this.reportsDir);
        } catch (error) {
            await fs.mkdir(this.reportsDir, { recursive: true });
        }
    }

    // Generate weekly reports
    async generateWeeklyReports() {
        try {
            logger.info('Generating weekly reports...');

            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);

            // Generate different report types
            const reports = await Promise.all([
                this.generateInventoryReport('weekly', startDate, endDate),
                this.generateRequestReport('weekly', startDate, endDate),
                this.generateDischargeReport('weekly', startDate, endDate),
                this.generateIssueReport('weekly', startDate, endDate)
            ]);

            // Send reports to relevant users
            await this.distributeWeeklyReports(reports);

            logger.info('Weekly reports generated successfully');
            return reports;
        } catch (error) {
            logger.error('Generate weekly reports error:', error);
            throw error;
        }
    }

    // Generate monthly reports
    async generateMonthlyReports() {
        try {
            logger.info('Generating monthly reports...');

            const endDate = new Date();
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 1);

            // Generate comprehensive monthly reports
            const reports = await Promise.all([
                this.generateInventoryReport('monthly', startDate, endDate),
                this.generateRequestReport('monthly', startDate, endDate),
                this.generateDischargeReport('monthly', startDate, endDate),
                this.generateReturnReport('monthly', startDate, endDate),
                this.generateTransferReport('monthly', startDate, endDate),
                this.generateIssueReport('monthly', startDate, endDate),
                this.generateUserActivityReport('monthly', startDate, endDate),
                this.generateBranchPerformanceReport('monthly', startDate, endDate)
            ]);

            // Send reports to management
            await this.distributeMonthlyReports(reports);

            logger.info('Monthly reports generated successfully');
            return reports;
        } catch (error) {
            logger.error('Generate monthly reports error:', error);
            throw error;
        }
    }

    // Generate inventory report
    async generateInventoryReport(period, startDate, endDate) {
        try {
            const data = await reportService.getInventoryValuation();
            
            // Generate Excel
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Inventory');

            // Add title
            worksheet.mergeCells('A1:E1');
            worksheet.getCell('A1').value = `Inventory Report - ${period}`;
            worksheet.getCell('A1').font = { size: 16, bold: true };
            worksheet.getCell('A1').alignment = { horizontal: 'center' };

            // Add date range
            worksheet.addRow([]);
            worksheet.addRow([`Period: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`]);

            // Add summary
            worksheet.addRow([]);
            worksheet.addRow(['Summary']);
            worksheet.addRow([`Total Items: ${data.summary.total_items}`]);
            worksheet.addRow([`Total Quantity: ${data.summary.total_quantity}`]);
            worksheet.addRow([`Total Value: $${data.summary.total_value.toFixed(2)}`]);

            // Add headers
            worksheet.addRow([]);
            const headers = ['Organization Unit', 'Product', 'SKU', 'Quantity', 'Value'];
            worksheet.addRow(headers).eachCell(cell => {
                cell.font = { bold: true };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE0E0E0' }
                };
            });

            // Add data
            data.items.forEach(item => {
                worksheet.addRow([
                    item.organizationNode?.name || 'N/A',
                    item.product?.name || 'N/A',
                    item.product?.sku || 'N/A',
                    item.quantity,
                    item.total_value || 0
                ]);
            });

            // Format columns
            worksheet.columns.forEach(column => {
                column.width = 20;
            });

            // Save file
            const filename = `inventory-report-${period}-${Date.now()}.xlsx`;
            const filepath = path.join(this.reportsDir, filename);
            await workbook.xlsx.writeFile(filepath);

            return {
                type: 'inventory',
                period,
                filename,
                filepath,
                generated_at: new Date()
            };
        } catch (error) {
            logger.error('Generate inventory report error:', error);
            throw error;
        }
    }

    // Generate request report
    async generateRequestReport(period, startDate, endDate) {
        try {
            const data = await reportService.getRequestAnalytics(null, startDate, endDate);
            
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Requests');

            // Similar implementation as inventory report...
            // (Would continue with full implementation)

            const filename = `requests-report-${period}-${Date.now()}.xlsx`;
            const filepath = path.join(this.reportsDir, filename);
            await workbook.xlsx.writeFile(filepath);

            return {
                type: 'requests',
                period,
                filename,
                filepath,
                generated_at: new Date()
            };
        } catch (error) {
            logger.error('Generate request report error:', error);
            throw error;
        }
    }

    // Generate discharge report
    async generateDischargeReport(period, startDate, endDate) {
        try {
            const data = await reportService.getDischargeReport(null, startDate, endDate);
            
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Discharges');

            const filename = `discharges-report-${period}-${Date.now()}.xlsx`;
            const filepath = path.join(this.reportsDir, filename);
            await workbook.xlsx.writeFile(filepath);

            return {
                type: 'discharges',
                period,
                filename,
                filepath,
                generated_at: new Date()
            };
        } catch (error) {
            logger.error('Generate discharge report error:', error);
            throw error;
        }
    }

    // Generate return report
    async generateReturnReport(period, startDate, endDate) {
        try {
            const data = await reportService.getReturnReport(null, startDate, endDate);
            
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Returns');

            const filename = `returns-report-${period}-${Date.now()}.xlsx`;
            const filepath = path.join(this.reportsDir, filename);
            await workbook.xlsx.writeFile(filepath);

            return {
                type: 'returns',
                period,
                filename,
                filepath,
                generated_at: new Date()
            };
        } catch (error) {
            logger.error('Generate return report error:', error);
            throw error;
        }
    }

    // Generate transfer report
    async generateTransferReport(period, startDate, endDate) {
        try {
            const data = await reportService.getTransferReport(null, null, startDate, endDate);
            
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Transfers');

            const filename = `transfers-report-${period}-${Date.now()}.xlsx`;
            const filepath = path.join(this.reportsDir, filename);
            await workbook.xlsx.writeFile(filepath);

            return {
                type: 'transfers',
                period,
                filename,
                filepath,
                generated_at: new Date()
            };
        } catch (error) {
            logger.error('Generate transfer report error:', error);
            throw error;
        }
    }

    // Generate issue report
    async generateIssueReport(period, startDate, endDate) {
        try {
            const data = await reportService.getIssueReport(null, startDate, endDate);
            
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Issues');

            const filename = `issues-report-${period}-${Date.now()}.xlsx`;
            const filepath = path.join(this.reportsDir, filename);
            await workbook.xlsx.writeFile(filepath);

            return {
                type: 'issues',
                period,
                filename,
                filepath,
                generated_at: new Date()
            };
        } catch (error) {
            logger.error('Generate issue report error:', error);
            throw error;
        }
    }

    // Generate user activity report
    async generateUserActivityReport(period, startDate, endDate) {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('User Activity');

            const filename = `user-activity-${period}-${Date.now()}.xlsx`;
            const filepath = path.join(this.reportsDir, filename);
            await workbook.xlsx.writeFile(filepath);

            return {
                type: 'user_activity',
                period,
                filename,
                filepath,
                generated_at: new Date()
            };
        } catch (error) {
            logger.error('Generate user activity report error:', error);
            throw error;
        }
    }

    // Generate branch performance report
    async generateBranchPerformanceReport(period, startDate, endDate) {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Branch Performance');

            const filename = `branch-performance-${period}-${Date.now()}.xlsx`;
            const filepath = path.join(this.reportsDir, filename);
            await workbook.xlsx.writeFile(filepath);

            return {
                type: 'branch_performance',
                period,
                filename,
                filepath,
                generated_at: new Date()
            };
        } catch (error) {
            logger.error('Generate branch performance report error:', error);
            throw error;
        }
    }

    // Distribute weekly reports
    async distributeWeeklyReports(reports) {
        try {
            // Get branch managers and storage managers
            const recipients = await User.findAll({
                where: {
                    role_id: [3, 4], // Storage Managers and Cluster Managers
                    is_active: true
                },
                include: ['organizationNode']
            });

            for (const recipient of recipients) {
                // Filter reports relevant to their branch
                const nodeReports = reports; // In real implementation, filter by node

                await emailService.sendReportEmail(
                    recipient.email,
                    `Weekly Reports - ${recipient.organizationNode?.name || 'All Units'}`,
                    'Please find attached the weekly reports.',
                    branchReports.map(r => ({
                        filename: r.filename,
                        path: r.filepath
                    }))
                );
            }
        } catch (error) {
            logger.error('Distribute weekly reports error:', error);
        }
    }

    // Distribute monthly reports
    async distributeMonthlyReports(reports) {
        try {
            // Get executives and managers
            const recipients = await User.findAll({
                where: {
                    role_id: [1, 2, 3, 4], // All management roles
                    is_active: true
                }
            });

            for (const recipient of recipients) {
                await emailService.sendReportEmail(
                    recipient.email,
                    'Monthly Reports - AIRMS',
                    'Please find attached the monthly reports.',
                    reports.map(r => ({
                        filename: r.filename,
                        path: r.filepath
                    }))
                );
            }
        } catch (error) {
            logger.error('Distribute monthly reports error:', error);
        }
    }

    // Clean old reports
    async cleanOldReports(daysToKeep = 30) {
        try {
            const files = await fs.readdir(this.reportsDir);
            const now = Date.now();

            for (const file of files) {
                const filepath = path.join(this.reportsDir, file);
                const stats = await fs.stat(filepath);
                const age = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);

                if (age > daysToKeep) {
                    await fs.unlink(filepath);
                    logger.info(`Deleted old report: ${file}`);
                }
            }
        } catch (error) {
            logger.error('Clean old reports error:', error);
        }
    }
}

module.exports = new ReportGenerator();