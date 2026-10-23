import path from 'node:path';

import { locateResource } from '@choliba/kernel';

/**
 * The folder with the runner's Playwright config (and its `reporters/` and `shared/`): `packages/runner`
 * in this repository, the package root once built and installed (see `locateResource`).
 */
export function findRunnerRoot(argv: readonly string[] = process.argv, sourceDir: string = __dirname): string {
  // Both names from each start: the installed package has the .js, and the sources a locally built bundle remembers
  // have the .ts; looking for the .ts everywhere first found those sources, and their Playwright, on the machine that built it.
  const config = locateResource(['playwright.config.ts', 'playwright.config.js'], sourceDir, argv);
  if (config === undefined) {
    throw new Error(`Configuração do Playwright do runner não encontrada a partir de ${sourceDir}.`);
  }
  return path.dirname(config);
}
