// ESLint flat config — root configuration
// Applied to the entire monorepo.
// Per-package overrides can extend this via their own eslint.config.mjs.

import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // Global ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/*.tsbuildinfo',
      '**/coverage/**',
      '**/.turbo/**',
      '**/drizzle/**',
      '**/*.config.*',
      '**/postcss.config.js',
      '**/tailwind.config.ts',
      '**/load/**',
      '**/e2e/**',
      '**/test/**',
      '**/tests/**',
      '**/*.test.ts',
      '**/*.spec.ts',
    ],
  },

  // Base JS recommended
  js.configs.recommended,

  // TypeScript source files across packages & apps
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.es2021,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,

      // In TypeScript projects, tsc handles undefined checks
      'no-undef': 'off',
      'no-control-regex': 'off',
      'no-useless-assignment': 'off',
      'no-unused-vars': 'off',

      // Prefer type imports
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // No unused vars (allows _ prefix)
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Enforce no explicit any where possible, but allow type narrowing
      '@typescript-eslint/no-explicit-any': 'warn',

      // Security rule: no direct pool access from feature code
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'pg',
              importNames: ['Pool', 'Client'],
              message: 'Direct pg Pool/Client import is forbidden. Use withTenant() from @growthomic/db.',
            },
          ],
        },
      ],
    },
  },

  // Client.ts in @growthomic/db is where the singleton pool is created
  {
    files: ['packages/db/src/client.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  // API app specific overrides (NestJS controllers & services)
  {
    files: ['apps/api/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },

  // Web app specific overrides (Next.js UI components & pages)
  {
    files: ['apps/web/**/*.ts', 'apps/web/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
    },
  },
];
