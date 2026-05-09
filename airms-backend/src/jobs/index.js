const cron = require('node-cron');
const logger = require('../config/logger');
const emailReminders = require('./emailReminders');
const inventoryAlerts = require('./inventoryAlerts');
const reportGenerator = require('./reportGenerator');
const cleanupJobs = require('./cleanupJobs');

// Initialize all cron jobs
const initJobs = () => {
    logger.info('Initializing cron jobs...');

    // Run every day at 8 AM
    cron.schedule('0 8 * * *', async () => {
        logger.info('Running daily email reminders...');
        try {
            await emailReminders.sendDueDateReminders();
        } catch (error) {
            logger.error('Email reminders error:', error);
        }
    });

    // Run every hour
    cron.schedule('0 * * * *', async () => {
        logger.info('Checking inventory alerts...');
        try {
            await inventoryAlerts.checkLowStock();
        } catch (error) {
            logger.error('Inventory alerts error:', error);
        }
    });

    // Run every Monday at 1 AM
    cron.schedule('0 1 * * 1', async () => {
        logger.info('Generating weekly reports...');
        try {
            await reportGenerator.generateWeeklyReports();
        } catch (error) {
            logger.error('Weekly reports error:', error);
        }
    });

    // Run every first day of month at 2 AM
    cron.schedule('0 2 1 * *', async () => {
        logger.info('Generating monthly reports...');
        try {
            await reportGenerator.generateMonthlyReports();
        } catch (error) {
            logger.error('Monthly reports error:', error);
        }
    });

    // Run every day at 3 AM
    cron.schedule('0 3 * * *', async () => {
        logger.info('Running cleanup jobs...');
        try {
            await cleanupJobs.cleanOldLogs();
            await cleanupJobs.cleanTempFiles();
        } catch (error) {
            logger.error('Cleanup jobs error:', error);
        }
    });

    logger.info('All cron jobs initialized');
};

module.exports = {
    initJobs
};