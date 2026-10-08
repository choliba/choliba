#!/usr/bin/env bun
// Wiring only (excluded from coverage, like every main.ts): the process and Bun as the platform, the real commands
// and the questions as the runtime, and the command line for the commands to parse.
import 'reflect-metadata';

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';

import { cancel, isCancel, multiselect, select, text } from '@clack/prompts';
import { SELF_DECLARED_DEPS_METADATA } from '@nestjs/common/constants';
import { CommandFactory } from 'nest-commander';

import { ExitStatus } from '@choliba/core/nest';
import { createSpawnGitRunner, takeGlobalFlags, type Platform } from '@choliba/core';
import { createBunProcessSpawner } from '@choliba/terminal/nest';

import { AppModule } from './app.module';
import { CholibaCliRootCommand } from './help/root.command';
import { UsageError } from './new/new-options';
import type { Choice, Prompter } from './new/prompter';
import type { CliRuntime } from './runtime/interfaces/runtime.interface';

// The folder a run from the sources was started in, when it had to start again from this package's folder.
const SOURCE_CWD = 'CHOLIBA_CLI_SOURCE_CWD';
const sourceCwd = process.env[SOURCE_CWD];
delete process.env['CHOLIBA_CLI_SOURCE_CWD'];

// From the sources, Bun takes the decorator settings only from a tsconfig.json in the current folder: start again
// from this package's folder, which has one, keeping where the command was run (as the choliba's main.ts does).
if (Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, CholibaCliRootCommand) === undefined) {
  if (import.meta.path.endsWith('.ts') && sourceCwd === undefined) {
    const again = spawnSync(process.execPath, [import.meta.path, ...process.argv.slice(2)], {
      stdio: 'inherit',
      cwd: dirname(import.meta.dir),
      env: { ...process.env, [SOURCE_CWD]: process.cwd() },
    });
    process.exit(again.status ?? 1);
  }
  process.stderr.write(
    'O choliba-cli rodou do código-fonte sem os decorators ligados: rode-o a partir do repositório.\n',
  );
  process.exit(1);
}

/** Ends the run when the person cancels a question (Ctrl-C, Esc). */
function stopIfCancelled(value: unknown): void {
  if (isCancel(value)) {
    cancel('Cancelado: nada mais foi feito.');
    throw new UsageError('cancelado pela pessoa.');
  }
}

function options(choices: readonly Choice<string>[]): { value: string; label: string }[] {
  return choices.map((choice) => ({ value: choice.value, label: choice.label }));
}

/** The choices picked, back as the typed values they came from. */
function picked<T extends string>(choices: readonly Choice<T>[], values: readonly string[]): T[] {
  return choices.filter((choice) => values.includes(choice.value)).map((choice) => choice.value);
}

const clackPrompter: Prompter = {
  text: async (message, _flag, fallback) => {
    const value = await text({
      message,
      ...(fallback === undefined ? {} : { placeholder: fallback, defaultValue: fallback }),
    });
    stopIfCancelled(value);
    return String(value);
  },
  select: async (message, choices, fallback) => {
    const value = await select<string>({ message, options: options(choices), initialValue: fallback });
    stopIfCancelled(value);
    return picked(choices, [String(value)])[0] ?? fallback;
  },
  multiselect: async (message, choices, fallback) => {
    const values = await multiselect<string>({
      message,
      options: options(choices),
      initialValues: [...fallback],
      required: false,
    });
    stopIfCancelled(values);
    return picked(choices, Array.isArray(values) ? values.map(String) : []);
  },
};

const { argv, noColorFlag } = takeGlobalFlags(process.argv.slice(2));
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

const runtime: CliRuntime = {
  // The steps' own output goes to stderr with the rest of the progress: stdout keeps only the summary.
  run: (command, args, cwd) => spawnSync(command, [...args], { cwd, stdio: ['inherit', 2, 2] }).status ?? 1,
  prompter: clackPrompter,
  interactive: process.stdin.isTTY && process.stdout.isTTY,
  packageDir: join(import.meta.dir, '..'),
};

const unexpected = { failed: false };
const app = await CommandFactory.runWithoutClosing(AppModule.forRoot(platform, runtime), {
  logger: false,
  cliName: 'choliba-cli',
  serviceErrorHandler: (error) => {
    process.stderr.write(`${error.message}\n`);
    unexpected.failed = true;
  },
});
process.exitCode = unexpected.failed ? 1 : app.get(ExitStatus).code();
await app.close();
