import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'dist-standalone', 'scripts/parity/output', 'scripts/parity/.font-cache'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // `_name`: a parameter the mock backend ignores but a real one will use (see services/).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    // Screens, components and hooks read and write data only through services/ — never the mock
    // data itself — so a real backend can replace services/ alone (docs/SUPABASE.md).
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/services/**', 'src/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['**/data/*'], message: 'Dados só pela camada services/ (ver docs/SUPABASE.md).' }] }
      ]
    }
  },
  {
    // Node scripts; the parity harness also ships functions that run inside the browser page.
    files: ['scripts/**/*.{js,mjs}', '*.config.js'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.node, ...globals.browser } }
  },
  prettier
);
