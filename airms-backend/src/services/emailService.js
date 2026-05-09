const nodemailer = require('nodemailer');
const logger = require('../config/logger');

class EmailService {
    constructor() {
        this.transporter = null;
        this.initialize();
    }

    // Initialize email transporter
    initialize() {
        try {
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT,
                secure: process.env.SMTP_PORT === '465',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });
        } catch (error) {
            logger.error('Email service initialization error:', error);
        }
    }

    // Send email
    async sendEmail(to, subject, html, text = '') {
        try {
            if (!this.transporter) {
                throw new Error('Email transporter not initialized');
            }

            const mailOptions = {
                from: process.env.EMAIL_FROM || 'noreply@airms.com',
                to,
                subject,
                html,
                text: text || html.replace(/<[^>]*>/g, '') // Strip HTML for text version
            };

            const info = await this.transporter.sendMail(mailOptions);
            logger.info(`Email sent: ${info.messageId}`);
            
            return info;
        } catch (error) {
            logger.error('Send email error:', error);
            throw error;
        }
    }

    // Send welcome email
    async sendWelcomeEmail(to, name, tempPassword) {
        const subject = 'Welcome to AIRMS';
        const html = `
            <h1>Welcome to AIRMS!</h1>
            <p>Hello ${name},</p>
            <p>Your account has been created successfully.</p>
            <p><strong>Temporary Password:</strong> ${tempPassword}</p>
            <p>Please login and change your password immediately.</p>
            <p><a href="${process.env.FRONTEND_URL}/login">Login here</a></p>
            <br>
            <p>Best regards,<br>AIRMS Team</p>
        `;

        return this.sendEmail(to, subject, html);
    }

    // Send password reset email
    async sendPasswordResetEmail(to, resetToken) {
        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        const subject = 'Password Reset Request';
        const html = `
            <h1>Password Reset Request</h1>
            <p>You requested to reset your password.</p>
            <p>Click the link below to reset your password:</p>
            <p><a href="${resetLink}">Reset Password</a></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <br>
            <p>Best regards,<br>AIRMS Team</p>
        `;

        return this.sendEmail(to, subject, html);
    }

    // Send notification email
    async sendNotificationEmail(to, notification) {
        const subject = notification.subject;
        const html = `
            <h2>${notification.subject}</h2>
            <p>${notification.message}</p>
            ${notification.data ? this.formatNotificationData(notification.data) : ''}
            <br>
            <p><a href="${process.env.FRONTEND_URL}">View in Dashboard</a></p>
            <br>
            <p>Best regards,<br>AIRMS Team</p>
        `;

        return this.sendEmail(to, subject, html);
    }

    // Send report email
    async sendReportEmail(to, reportName, reportData, attachment) {
        const subject = `Report: ${reportName}`;
        const html = `
            <h2>${reportName}</h2>
            <p>Your requested report is ready.</p>
            <p>Please find the attached report.</p>
            <br>
            <p>Best regards,<br>AIRMS Team</p>
        `;

        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to,
            subject,
            html,
            attachments: attachment ? [attachment] : []
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            logger.info(`Report email sent: ${info.messageId}`);
            return info;
        } catch (error) {
            logger.error('Send report email error:', error);
            throw error;
        }
    }

    // Format notification data for email
    formatNotificationData(data) {
        let html = '<table style="border-collapse: collapse; width: 100%;">';
        
        for (const [key, value] of Object.entries(data)) {
            if (value && typeof value !== 'object') {
                html += `
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px;"><strong>${key}</strong></td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${value}</td>
                    </tr>
                `;
            }
        }
        
        html += '</table>';
        return html;
    }

    // Verify connection
    async verifyConnection() {
        try {
            if (!this.transporter) {
                return false;
            }
            await this.transporter.verify();
            return true;
        } catch (error) {
            logger.error('Email connection verification error:', error);
            return false;
        }
    }
}

module.exports = new EmailService();