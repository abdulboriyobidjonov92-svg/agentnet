// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const requireRolesOnAdmin = require('./eslint-rules/require-roles-on-admin');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      sourceType: 'commonjs',
    },
    plugins: {
      // Repo-ichi ESLint qoidalari (nashr qilinadigan paket emas).
      local: {
        rules: {
          'require-roles-on-admin': requireRolesOnAdmin,
        },
      },
    },
    rules: {
      // Loyihada `any` ataylab keng ishlatiladi (engine javoblari, Prisma JSON maydonlari)
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // SEC-05 AC #6: @Roles bo'lmagan admin/* endpoint — xato (bloklovchi).
      'local/require-roles-on-admin': 'error',
    },
  },
);
