#!/usr/bin/env bun
// Wiring only (excluded from coverage, like every main.ts): the process and Bun as the app's platform and
// runtime, and the command line, without its global flags, for the commands to parse.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { createInterface, type Interface } from 'node:readline';

import {
  createBunProcessSpawner,
  createSpawnGitRunner,
  takeGlobalFlags,
  type Ask,
  type BunSpawnFn,
  type Platform,
} from '@choliba/core';

import { createCholibaShell } from './app-shell';
import type { Runtime } from './runtime';

const { argv, noColorFlag } = takeGlobalFlags(process.argv.slice(2));

/**
 * Asks on the terminal (the question on stderr), one stdin line per answer. Lines typed ahead wait in a queue, and
 * stdin is paused while no question waits, so the process can end; once stdin closes, every answer is blank.
 */
function terminalAsk(): Ask {
  const typed: string[] = [];
  const waiting: ((line: string) => void)[] = [];
  let reader: Interface | undefined;
  let closed = false;
  const open = (): Interface => {
    const lines = createInterface({ input: process.stdin });
    lines.on('line', (line) => {
      const answer = waiting.shift();
      if (answer === undefined) typed.push(line);
      else answer(line);
      if (waiting.length === 0) lines.pause();
    });
    lines.on('close', () => {
      closed = true;
      for (const answer of waiting.splice(0)) answer('');
    });
    return lines;
  };
  return (question) => {
    process.stderr.write(question);
    reader ??= open();
    const ready = typed.shift();
    if (ready !== undefined || closed) return Promise.resolve((ready ?? '').trim());
    reader.resume();
    return new Promise((resolve) => {
      waiting.push((line) => {
        resolve(line.trim());
      });
    });
  };
}

const platform: Platform = {
  argv,
  cwd: process.cwd(),
  env: process.env,
  stdout: process.stdout,
  stderr: process.stderr,
  clock: () => new Date(),
  signals: process,
  spawn: createBunProcessSpawner(Bun.spawn as unknown as BunSpawnFn),
  which: (bin) => Bun.which(bin),
  git: createSpawnGitRunner(),
  // Questions go to stderr, so stdout keeps only what the command prints.
  ...(process.stdin.isTTY ? { ask: terminalAsk() } : {}),
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
