const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validate } = require('../middleware/validate');
const { rateLimiter } = require('../middleware/rateLimiter');
const { authMiddleware } = require('../middleware/auth');
const { 
    registerValidation, 
    loginValidation,
    changePasswordValidation,
    forgotPasswordValidation,
    resetPasswordValidation 
} = require('../validations/authValidation');

// Public routes with rate limiting
router.post('/login', rateLimiter, validate(loginValidation), authController.login);
router.post('/refresh-token', rateLimiter, authController.refreshToken);
router.post('/forgot-password', rateLimiter, validate(forgotPasswordValidation), authController.forgotPassword);
router.post('/reset-password', rateLimiter, validate(resetPasswordValidation), authController.resetPassword);

// Protected routes
router.post('/logout', authMiddleware, authController.logout);
router.post('/change-password', authMiddleware, validate(changePasswordValidation), authController.changePassword);
router.get('/me', authMiddleware, authController.getCurrentUser);

module.exports = router;