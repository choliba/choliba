import eslint from '@eslint/js';
import type { Linter } from 'eslint';
import tseslint from 'typescript-eslint';

/**
 * The ESLint config a workspace gets (`choliba/eslint`, imported by its eslint.config.js): the
 * recommended rules of JavaScript and TypeScript, none that need type information — so the specs lint
 * without a tsconfig — and none of what the tools generate.
 */
const config: Linter.Config[] = [
  {
    ignores: [
      '**/node_modules/**',
      '.cache/**',
      '.playwright-cli/**',
      '**/ticket-runs/**',
      '**/test-results/**',
      '**/playwright-report/**',
    ],
  },
  eslint.configs.recommended,
  ...(tseslint.configs.recommended as Linter.Config[]),
];

export default config;
