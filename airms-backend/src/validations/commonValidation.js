const { query, param } = require('express-validator');

const paginationValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    
    query('sort_by')
        .optional()
        .isString().withMessage('Sort field must be a string'),
    
    query('sort_order')
        .optional()
        .isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
];

const idValidation = [
    param('id')
        .isInt().withMessage('ID must be an integer')
];

const uuidValidation = [
    param('uuid')
        .isUUID().withMessage('Invalid UUID format')
];

const searchValidation = [
    query('search')
        .optional()
        .isString().withMessage('Search term must be a string')
        .isLength({ max: 100 }).withMessage('Search term too long')
];

const dateRangeValidation = [
    query('start_date')
        .optional()
        .isISO8601().withMessage('Invalid start date format'),
    
    query('end_date')
        .optional()
        .isISO8601().withMessage('Invalid end date format')
        .custom((value, { req }) => {
            if (req.query.start_date && new Date(value) < new Date(req.query.start_date)) {
                throw new Error('End date must be after start date');
            }
            return true;
        })
];

const booleanValidation = (field) => [
    query(field)
        .optional()
        .isBoolean().withMessage(`${field} must be a boolean`)
];

const arrayValidation = (field, options = {}) => [
    body(field)
        .optional()
        .isArray().withMessage(`${field} must be an array`)
        .custom((value) => {
            if (options.minLength && value.length < options.minLength) {
                throw new Error(`${field} must have at least ${options.minLength} items`);
            }
            if (options.maxLength && value.length > options.maxLength) {
                throw new Error(`${field} cannot have more than ${options.maxLength} items`);
            }
            return true;
        })
];

const objectValidation = (field) => [
    body(field)
        .optional()
        .isObject().withMessage(`${field} must be an object`)
];

const enumValidation = (field, allowedValues) => [
    body(field)
        .optional()
        .isIn(allowedValues).withMessage(`Invalid ${field} value`)
];

module.exports = {
    paginationValidation,
    idValidation,
    uuidValidation,
    searchValidation,
    dateRangeValidation,
    booleanValidation,
    arrayValidation,
    objectValidation,
    enumValidation
};