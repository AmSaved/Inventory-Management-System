module.exports = {
    env: {
        node: true,
        es2021: true,
        jest: true,
    },
    extends: ['airbnb-base', 'prettier'],
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    rules: {
        'no-console': ['error', { allow: ['warn', 'error'] }],
        'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        'import/prefer-default-export': 'off',
        'class-methods-use-this': 'off',
        'consistent-return': 'off',
        'func-names': 'off',
        'no-param-reassign': 'off',
        'no-underscore-dangle': 'off',
        'max-len': ['error', { code: 120 }],
        'no-await-in-loop': 'off',
    },
    settings: {
        'import/resolver': {
            node: {
                extensions: ['.js'],
            },
        },
    },
};