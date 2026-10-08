import js from '@eslint/js';
import tseslint from './tooling/lint/config.mjs';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  {linterOptions:{reportUnusedDisableDirectives:'error'}},
  { ignores: ['node_modules/**', '**/node_modules/**', 'dist/**', 'generated/**', '**/.cache/**', '**/.verification/**', '**/.wrangler/**'] },
  { files: ['**/*.{js,mjs,ts,tsx}'], languageOptions: { globals: {...globals.browser,...globals.node} }, rules: js.configs.recommended.rules },
  ...tseslint.configs.recommended.map(config => ({...config,files:['**/*.{ts,tsx}']})),
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error',{argsIgnorePattern:'^_',caughtErrors:'none',ignoreRestSiblings:true}],
      // Existing boundary adapters deliberately use any; strict tsc checks contracts.
      '@typescript-eslint/no-explicit-any': 'off',
      // Assertions express established DOM/D1 adapters without changing runtime values.
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
    },
  },
  // Recovery boundaries intentionally suppress private upstream errors; do not
  // attach their causes. Empty catch bodies deliberately tolerate cleanup failure.
  {rules:{'preserve-caught-error':'off','no-empty':['error',{allowEmptyCatch:true}]}},
  { files:['frontend/**/*.{ts,tsx}'], plugins:{'react-hooks':hooks}, rules:{'react-hooks/rules-of-hooks':'error','react-hooks/exhaustive-deps':'error'} },
];
