import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import eslintCommentsPlugin from 'eslint-plugin-eslint-comments'
import importPlugin from 'eslint-plugin-import'

export default [
  {
    files: ['src/**/*.ts'],
    ignores: ['node_modules', 'build', 'coverage'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'eslint-comments': eslintCommentsPlugin,
      import: importPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'eslint-comments/disable-enable-pair': ['error', { allowWholeFile: true }],
      'eslint-comments/no-unused-disable': 'error',
      'import/order': ['error', { 'newlines-between': 'always', alphabetize: { order: 'asc' } }],
      'sort-imports': ['error', { ignoreDeclarationSort: true, ignoreCase: true }],
    },
  },
]
