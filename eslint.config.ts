import { defineConfig } from 'eslint/config';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

import { structureConfig } from './eslint.structure';

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'coverage/**',
      '.agents/**',
      '.choliba/skills/**',
      '.claude/**',
      '.playwright-cli/**',
      'docs/.vitepress/cache/**',
    ],
  },
  eslint.configs.recommended,
  // Regras com informação de tipo: sem elas `no-explicit-any` não pega `any`
  // implícito vindo de JSON.parse/libs (no-unsafe-* cobrem esse vazamento).
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      // `@Module({...}) export class XModule {}` é uma classe vazia por definição; sem decorator a regra vale.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  // O padrão do código (plano 035), só nos pacotes já migrados.
  ...structureConfig(),
  // Sempre por último: desliga regras de estilo do ESLint que colidiriam
  // com a formatação do Prettier.
  eslintConfigPrettier,
);
