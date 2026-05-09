const { validationResult } = require('express-validator');

const validate = (validations) => {
    return async (req, res, next) => {
        // Run all validations
        for (let validation of validations) {
            const result = await validation.run(req);
            if (result.errors.length) break;
        }

        // Check for errors
        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }

        // Format errors
        const formattedErrors = errors.array().map(error => ({
            field: error.param || error.path,
            path: error.path || error.param,
            message: error.msg,
            msg: error.msg,
            value: error.value
        }));

        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: formattedErrors
        });
    };
};

module.exports = { validate };