#!/usr/bin/env bun
import { createBunProcessSpawner } from '@choliba/terminal';
import { ProcessRunner } from '@choliba/terminal';

import { loadRepoConfig } from '@choliba/core/config';

import { runAgentsCli } from './run';

// The only lines in this package that read the real `Bun.*` globals. Kept here, in the thin
// wiring entrypoint the coverage ratchet already excludes, so every other module stays
// importable (and testable) under Jest's Node environment — see @choliba/terminal's
// spawn.ts for why that seam matters.
const runner = new ProcessRunner({ spawner: createBunProcessSpawner(Bun.spawn) });

// A provider spawned from some other cwd would have claude prefix its commands with
// `cd <root> &&`, which the read-only policy's allowlist does not include — see cli/run.ts's
// `isInside`. Resolving the real repo root here means every run, wherever it was invoked from,
// spawns providers with the same cwd.
const repoRoot = Bun.spawnSync(['git', 'rev-parse', '--show-toplevel']).stdout.toString().trim() || process.cwd();
const config = loadRepoConfig(repoRoot);

runAgentsCli(process.argv.slice(2), {
  runner,
  which: (bin) => Bun.which(bin),
  repoRoot,
  commands: [],
  config,
  now: () => new Date(),
  stdout: process.stdout,
  stderr: process.stderr,
  signals: process,
})
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
