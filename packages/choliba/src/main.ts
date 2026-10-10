#!/usr/bin/env bun
// Wiring only (excluded from coverage, like every main.ts): the process and Bun as the app's platform and
// runtime, and the command line, without its global flags, for the commands to parse.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';

import { createSpawnGitRunner, takeGlobalFlags, type Platform } from '@choliba/core';
import { createBunProcessSpawner } from '@choliba/terminal/nest';

import { createCholibaShell } from './app-shell';
import type { Runtime } from './runtime';

const { argv, noColorFlag } = takeGlobalFlags(process.argv.slice(2));

const platform: Platform = {
  argv,
  cwd: process.cwd(),
  env: process.env,
  stdout: process.stdout,
  stderr: process.stderr,
  clock: () => new Date(),
  signals: process,
  spawn: createBunProcessSpawner(Bun.spawn),
  which: (bin) => Bun.which(bin),
  git: createSpawnGitRunner(),
  noColorFlag,
};

const runtime: Runtime = {
  entryDir: import.meta.dir,
  script: process.argv[1] ?? '',
  execPath: process.execPath,
  home: homedir(),
  resolve: (specifier) => Bun.resolveSync(specifier, import.meta.dir),
  run: (command, args, cwd) => spawnSync(command, [...args], { stdio: 'inherit', cwd }).status ?? 1,
  capture: (command, args, cwd) => {
    const result = spawnSync(command, [...args], { cwd, encoding: 'utf8' });
    return { status: result.status, stderr: result.stderr };
  },
  spawnDetached: (command, cwd) => {
    Bun.spawn([...command], { cwd, stdio: ['ignore', 'ignore', 'ignore'] }).unref();
  },
  sleep: (ms) => Bun.sleep(ms),
  writeTerminal: (text) => {
    try {
      writeFileSync('/dev/tty', text);
      return true;
    } catch {
      return false;
    }
  },
};

process.exitCode = await createCholibaShell(platform, runtime).run();
