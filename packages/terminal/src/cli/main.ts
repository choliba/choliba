#!/usr/bin/env bun
import { createBunProcessSpawner } from '../spawn';
import { ProcessRunner } from '../process-runner';
import { runCli } from './run';

// The only line in this package that reads the real `Bun.spawn`. Kept here, in the
// thin wiring entrypoint the coverage ratchet already excludes, so every other
// module stays importable (and testable) under Jest's Node environment. See spawn.ts.
const runner = new ProcessRunner({ spawner: createBunProcessSpawner(Bun.spawn) });

runCli(process.argv.slice(2), { runner })
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
