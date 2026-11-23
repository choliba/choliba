import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, mock } from 'bun:test';

/**
 * Loaded before every test (bunfig.toml, `preload`): the developer's .env
 * reaches `bun test` too, and its CHOLIBA_* variables (CHOLIBA_DEBUG, the
 * rounds' folders, the CLIs' credentials) would change what the tests see.
 * They start without them; a test that needs one sets it.
 */
for (const name of Object.keys(process.env)) {
  if (name.startsWith('CHOLIBA_')) Reflect.deleteProperty(process.env, name);
}

/**
 * The tests do not load a choliba.config.ts, so `getConfig()` falls back to
 * the defaults, relative to the current directory: the repository. A
 * `Workspace` made without `homes` would keep its CLI home in
 * `<repo>/.choliba/homes`. Here the default homes go to a temporary folder,
 * removed at the end (afterAll below); the product's default (`.choliba/homes`) is unchanged.
 */
const realConstants = await import('../../src/config/constants');
const testHomes = mkdtempSync(join(tmpdir(), 'choliba-test-homes-'));
await mock.module('../../src/config/constants', () => ({
  ...realConstants,
  DEFAULT_HOMES_DIR: testHomes,
}));

/** The repository's own `.choliba`: the suite must never create it. */
const repoState = join(import.meta.dir, '..', '..', '.choliba');
const repoStateExisted = existsSync(repoState);

// An afterAll of the preload runs once, after every file (bun test never
// fires the process's `exit` here): the temporary homes go, then the guard.
afterAll(() => {
  rmSync(testHomes, { recursive: true, force: true });
  if (!repoStateExisted && existsSync(repoState)) {
    throw new Error(
      `A suíte criou ${repoState}: algum teste usa um padrão da config (workspaces, banco, logs, homes) relativo ao diretório atual. Dê a ele uma pasta temporária.`,
    );
  }
});
