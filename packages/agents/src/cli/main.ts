#!/usr/bin/env bun
import { createBunProcessSpawner } from '@choliba/terminal';
import { ProcessRunnerService } from '@choliba/terminal';

import { findWorkspaceRoot, loadRepoConfig } from '@choliba/core/config';

import { runAgentsCli } from '../runs/run-agents';

// The only lines in this package that read the real `Bun.*` globals. Kept here, in the thin
// wiring entrypoint the coverage ratchet already excludes, so every other module stays
// importable (and testable) under Jest's Node environment — see @choliba/terminal's
// spawn.ts for why that seam matters.
const runner = new ProcessRunnerService({ spawner: createBunProcessSpawner(Bun.spawn) });

// Every run, wherever it was invoked from, spawns providers from the workspace root (the folder whose
// package.json depends on choliba): its `.env`, `.choliba/agents/` and `.choliba/skills/` and `.choliba/mcps/` are the ones used, and the
// provider's commands (`cd <root> && …`) stay inside what the agent's permissions allow.
const repoRoot = findWorkspaceRoot(process.cwd());
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
