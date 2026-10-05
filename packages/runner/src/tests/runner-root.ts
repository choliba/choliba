import path from 'node:path';

import { locateResource } from '@choliba/core/config';

/**
 * The folder with the runner's Playwright config (and its `reporters/` and `shared/`): `packages/runner`
 * in this repository, the package root once built and installed (see `locateResource`).
 */
export function findRunnerRoot(argv: readonly string[] = process.argv, sourceDir: string = __dirname): string {
  const config =
    locateResource('playwright.config.ts', sourceDir, argv) ?? locateResource('playwright.config.js', sourceDir, argv);
  if (config === undefined) {
    throw new Error(`Configuração do Playwright do runner não encontrada a partir de ${sourceDir}.`);
  }
  return path.dirname(config);
}
