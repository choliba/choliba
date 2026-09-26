/** @jest-config-loader esbuild-register */
import * as path from 'node:path';
import type { Config } from 'jest';
import coverageConfig from './jest.coverage.config.json';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Este arquivo vive em jest/; a raiz do Jest é a raiz do repositório.
  rootDir: path.resolve(__dirname, '..'),
  // `roots` não lista packages/ e apps/ de propósito: um deles pode não existir
  // (Jest falha com "roots[n] was not found"). O testMatch faz o filtro.
  roots: ['<rootDir>'],
  // Padrão do projeto: specs vivem em src/__tests__/ (ver skill add-workspace-package).
  testMatch: ['<rootDir>/{packages,apps}/*/src/__tests__/**/*.spec.ts'],
  modulePathIgnorePatterns: ['<rootDir>/coverage', '<rootDir>/.agents', '<rootDir>/.claude'],
  detectOpenHandles: true,
};

// A config de cobertura (jest.coverage.config.json: exclusões, reporters,
// thresholds e teardown do ratchet) só vale com --coverage (bun run test:cov);
// `bun run test` não carrega nem valida contra o ratchet.
if (process.argv.includes('--coverage')) {
  Object.assign(config, coverageConfig.coverageConfig);
}

export default config;
