const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Generate random string
const generateRandomString = (length = 32) => {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
};

// Generate random number
const generateRandomNumber = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Hash password
const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
};

// Compare password
const comparePassword = async (password, hash) => {
    return bcrypt.compare(password, hash);
};

// Generate JWT token
const generateToken = (payload, expiresIn = '7d') => {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

// Verify JWT token
const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return null;
    }
};

// Format date
const formatDate = (date, format = 'YYYY-MM-DD') => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
};

// Calculate days between dates
const daysBetween = (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
};

// Format currency
const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency
    }).format(amount);
};

// Format number with commas
const formatNumber = (number) => {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Truncate text
const truncateText = (text, length = 100, suffix = '...') => {
    if (text.length <= length) return text;
    return text.substring(0, length) + suffix;
};

// Slugify string
const slugify = (text) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
};

// Parse JSON safely
const safeJsonParse = (str, defaultValue = null) => {
    try {
        return JSON.parse(str);
    } catch (e) {
        return defaultValue;
    }
};

// Deep clone object
const deepClone = (obj) => {
    return JSON.parse(JSON.stringify(obj));
};

// Remove null/undefined values from object
const removeEmpty = (obj) => {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v != null && v !== '')
    );
};

// Paginate array
const paginateArray = (array, page, limit) => {
    const start = (page - 1) * limit;
    const end = page * limit;
    return {
        data: array.slice(start, end),
        pagination: {
            total: array.length,
            page,
            limit,
            pages: Math.ceil(array.length / limit)
        }
    };
};

// Group array by key
const groupBy = (array, key) => {
    return array.reduce((result, item) => {
        const groupKey = typeof key === 'function' ? key(item) : item[key];
        if (!result[groupKey]) {
            result[groupKey] = [];
        }
        result[groupKey].push(item);
        return result;
    }, {});
};

// Sort array by key
const sortBy = (array, key, order = 'asc') => {
    return array.sort((a, b) => {
        const aVal = typeof key === 'function' ? key(a) : a[key];
        const bVal = typeof key === 'function' ? key(b) : b[key];
        
        if (order === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });
};

// Generate pagination links
const generatePaginationLinks = (baseUrl, page, pages, query = {}) => {
    const links = {
        first: `${baseUrl}?page=1&limit=${query.limit || 10}`,
        last: `${baseUrl}?page=${pages}&limit=${query.limit || 10}`,
        prev: null,
        next: null
    };

    if (page > 1) {
        links.prev = `${baseUrl}?page=${page - 1}&limit=${query.limit || 10}`;
    }

    if (page < pages) {
        links.next = `${baseUrl}?page=${page + 1}&limit=${query.limit || 10}`;
    }

    return links;
};

// Mask email
const maskEmail = (email) => {
    const [local, domain] = email.split('@');
    const maskedLocal = local.charAt(0) + '*'.repeat(local.length - 2) + local.charAt(local.length - 1);
    return `${maskedLocal}@${domain}`;
};

// Mask phone
const maskPhone = (phone) => {
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
};

// Get file extension
const getFileExtension = (filename) => {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
};

// Generate filename
const generateFilename = (originalname) => {
    const ext = getFileExtension(originalname);
    const timestamp = Date.now();
    const random = generateRandomString(8);
    return `file-${timestamp}-${random}.${ext}`;
};

// Calculate percentage
const calculatePercentage = (value, total) => {
    if (total === 0) return 0;
    return (value / total) * 100;
};

// Generate unique ID
const generateUniqueId = (prefix = 'ID') => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`.toUpperCase();
};

// Validate email format
const isValidEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

// Validate phone format
const isValidPhone = (phone) => {
    const re = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;
    return re.test(phone);
};

// Sleep for milliseconds
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

// Retry function
const retry = async (fn, maxAttempts = 3, delay = 1000) => {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxAttempts - 1) throw error;
            await sleep(delay * Math.pow(2, i));
        }
    }
};

module.exports = {
    generateRandomString,
    generateRandomNumber,
    hashPassword,
    comparePassword,
    generateToken,
    verifyToken,
    formatDate,
    daysBetween,
    formatCurrency,
    formatNumber,
    truncateText,
    slugify,
    safeJsonParse,
    deepClone,
    removeEmpty,
    paginateArray,
    groupBy,
    sortBy,
    generatePaginationLinks,
    maskEmail,
    maskPhone,
    getFileExtension,
    generateFilename,
    calculatePercentage,
    generateUniqueId,
    isValidEmail,
    isValidPhone,
    sleep,
    retry
};