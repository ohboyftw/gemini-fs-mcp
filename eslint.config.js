const globals = require('globals');
const pluginJs = require('@eslint/js');

module.exports = [
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.commonjs,
                ...globals.es2021,
                ...globals.node,
                ...globals.mocha
            },
            ecmaVersion: 12,
            sourceType: 'commonjs'
        },
        rules: {
            'indent': [
                'error',
                4
            ],
            'linebreak-style': [
                'error',
                'windows'
            ],
            'quotes': [
                'error',
                'single'
            ],
            'semi': [
                'error',
                'always'
            ]
        }
    },
    pluginJs.configs.recommended
];