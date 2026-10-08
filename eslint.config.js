import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// Where design is allowed to live: src/theme (tokens), src/ui (the component
// library) and src/app (the shell and feature components, each with its own
// CSS module). Screens compose those and never style anything inline, so a
// look can only change in one place. See docs/DESIGN.md.
const noInlineStyle = {
  selector: "JSXAttribute[name.name='style']",
  message: 'No inline styles in screens: add a prop or a variant to a component in src/ui or src/app instead.',
};

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { window: 'readonly', document: 'readonly', localStorage: 'readonly', fetch: 'readonly' },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // Modules that pair a provider or helper with its hook are fine to mix.
  {
    files: ['src/lib/**/*.tsx', 'src/ui/PrintPortal/*.tsx', 'src/data/**/*.tsx', 'src/app/**/*.tsx', 'src/screens/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['src/screens/**/*.tsx'],
    rules: { 'no-restricted-syntax': ['error', noInlineStyle] },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly', setTimeout: 'readonly', localStorage: 'readonly' } },
  },
);
