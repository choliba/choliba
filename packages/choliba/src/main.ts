#!/usr/bin/env bun
// Wiring only (excluded from coverage, like every main.ts): the process and Bun as the app's platform and
// runtime, and the command line, without its global flags, for the commands to parse.
import 'reflect-metadata';

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname } from 'node:path';

import { SELF_DECLARED_DEPS_METADATA } from '@nestjs/common/constants';
import { CommandFactory } from 'nest-commander';

import { ExitStatus } from '@choliba/core/nest';
import { createSpawnGitRunner, takeGlobalFlags, type Platform } from '@choliba/core/platform';
import { createBunProcessSpawner } from '@choliba/terminal';

import { AppModule } from './app.module';
import { CholibaRootCommand } from './help/root.command';
import type { Runtime } from './runtime/interfaces/runtime.interface';

// The folder a run from the sources was started in, when it had to start again from this package's folder.
const SOURCE_CWD = 'CHOLIBA_SOURCE_CWD';
const sourceCwd = process.env[SOURCE_CWD];
// Read once: the processes this one starts (an agent's `bunx choliba …`) find their own folder.
delete process.env['CHOLIBA_SOURCE_CWD'];

// From the sources, Bun takes the decorator settings only from a tsconfig.json in the current folder: from any other
// (a subfolder of this repository, the folder an agent runs in) the `@Inject`s are dropped and every command gets
// `undefined`. Start again from this package's folder, which has one, keeping where the command was run.
if (Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, CholibaRootCommand) === undefined) {
  if (import.meta.path.endsWith('.ts') && sourceCwd === undefined) {
    const again = spawnSync(process.execPath, [import.meta.path, ...process.argv.slice(2)], {
      stdio: 'inherit',
      cwd: dirname(import.meta.dir),
      env: { ...process.env, [SOURCE_CWD]: process.cwd() },
    });
    process.exit(again.status ?? 1);
  }
  process.stderr.write(
    'O choliba rodou do código-fonte sem os decorators ligados: rode-o a partir do repositório dele ' +
      '(onde está o tsconfig.json) ou instale o pacote (bun run chol:pack).\n',
  );
  process.exit(1);
}

const { argv, noColorFlag } = takeGlobalFlags(process.argv.slice(2));
// The command-line parser reads process.argv: it gets the line without the global flags.
process.argv = [...process.argv.slice(0, 2), ...argv];

const platform: Platform = {
  argv,
  cwd: sourceCwd ?? process.cwd(),
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
  run: (command, args, cwd, env = {}) =>
    spawnSync(command, [...args], { stdio: 'inherit', cwd, env: { ...process.env, ...env } }).status ?? 1,
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

/** Set when a command threw something it did not expect. */
const unexpected = { failed: false };
const app = await CommandFactory.runWithoutClosing(AppModule.forRoot(platform, runtime), {
  logger: false,
  cliName: 'choliba',
  // Something a command did not expect: its message, and exit code 1.
  serviceErrorHandler: (error) => {
    process.stderr.write(`${error.message}\n`);
    unexpected.failed = true;
  },
});
process.exitCode = unexpected.failed ? 1 : app.get(ExitStatus).code();
await app.close();
