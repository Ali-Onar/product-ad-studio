import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname, });

const eslintConfig = [
  // Global ignores
  { ignores: ['.next/**', 'node_modules/**'], },

  // Base configs
  eslint.configs.recommended,
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  // TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: './tsconfig.json', },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      // Indent (2 spaces)
      indent: ['error', 2],
      'react/jsx-indent': ['error', 2],
      'react/jsx-indent-props': ['error', 2],

      // Whitespace
      'no-trailing-spaces': 'error',
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],
      'object-curly-spacing': ['error', 'always'],

      // Max line length
      'max-len': ['warn', {
        code: 300,
        ignoreComments: true,
        ignoreUrls: true,
        ignoreTemplateLiterals: true,
      }],

      // Object curly newline
      'object-curly-newline': ['error', {
        ObjectExpression: { multiline: true, minProperties: 4 },
        ObjectPattern: { multiline: true, minProperties: 4 },
        ImportDeclaration: 'never',
        ExportDeclaration: { multiline: true, minProperties: 4 },
      }],

      // TypeScript naming convention
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: ['enumMember', 'typeLike'],
          format: ['PascalCase'],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
        },
        {
          selector: ['method', 'variableLike', 'classProperty'],
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: ['property', 'classProperty'],
          format: ['UPPER_CASE', 'PascalCase'],
          modifiers: ['static', 'public'],
        },
        {
          selector: ['property', 'classProperty'],
          format: ['UPPER_CASE', 'PascalCase'],
          modifiers: ['public', 'readonly'],
        },
        {
          selector: ['property'],
          format: ['camelCase'],
          modifiers: ['static', 'private'],
        },
        {
          selector: 'variable',
          modifiers: ['const', 'global'],
          format: ['UPPER_CASE', 'camelCase', 'PascalCase'],
        },
        {
          selector: ['variable'],
          modifiers: ['const', 'global', 'exported'],
          types: ['function'],
          format: ['PascalCase', 'camelCase'],
        },
      ],

      // Padding between statements
      'padding-line-between-statements': [
        'warn',
        { blankLine: 'always', prev: '*', next: 'block' },
        { blankLine: 'always', prev: 'block', next: '*' },
        { blankLine: 'always', prev: '*', next: 'block-like' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
        { blankLine: 'always', prev: '*', next: 'return' },
      ],

      // React
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/require-default-props': 'off',
      'react/jsx-props-no-spreading': 'off',
      'react/function-component-definition': 'off',
      'react/jsx-filename-extension': ['warn', { extensions: ['.tsx', '.jsx'] }],

      // React Hooks
      'react-hooks/exhaustive-deps': 0,
      'react-hooks/set-state-in-effect': 'off',

      // TypeScript
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unsafe-assignment': [0],
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],

      // General
      'no-underscore-dangle': 'off',
      'no-use-before-define': 'off',
      'class-methods-use-this': 'off',
      'no-tabs': 'off',
      'global-require': 'off',

      // Import
      'import/extensions': 'off',
      'import/no-unresolved': 'off',
      'import/no-named-as-default': 'off',
      'import/no-named-as-default-member': 'off',
      'import/prefer-default-export': 'off',

      // TypeScript additional
      '@typescript-eslint/lines-between-class-members': 'off',

      // React additional
      'react/forbid-prop-types': 'off',
    },
  },

  // JavaScript files
  {
    files: ['**/*.js', '**/*.jsx', '**/*.mjs'],
    rules: {
      indent: ['error', 2],
      'no-trailing-spaces': 'error',
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],
      'object-curly-spacing': ['error', 'always'],
      'max-len': ['warn', {
        code: 300,
        ignoreComments: true,
        ignoreUrls: true,
        ignoreTemplateLiterals: true,
      }],
      'object-curly-newline': ['error', {
        ObjectExpression: { multiline: true, minProperties: 4 },
        ObjectPattern: { multiline: true, minProperties: 4 },
        ImportDeclaration: 'never',
        ExportDeclaration: { multiline: true, minProperties: 4 },
      }],
      'padding-line-between-statements': [
        'warn',
        { blankLine: 'always', prev: '*', next: 'block' },
        { blankLine: 'always', prev: 'block', next: '*' },
        { blankLine: 'always', prev: '*', next: 'block-like' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
        { blankLine: 'always', prev: '*', next: 'return' },
      ],
      'no-underscore-dangle': 'off',
      'no-tabs': 'off',
      'global-require': 'off',
      'import/extensions': 'off',
      'import/no-unresolved': 'off',
      'import/no-named-as-default': 'off',
      'import/no-named-as-default-member': 'off',
      'import/prefer-default-export': 'off',
      'react/forbid-prop-types': 'off',
    },
  },

  // Config files - allow require()
  {
    files: ['*.config.ts', '*.config.js', '*.config.mjs', 'tailwind.config.ts'],
    rules: { '@typescript-eslint/no-require-imports': 'off', },
  },
];

export default eslintConfig;
