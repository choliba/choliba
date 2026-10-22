import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { ProjectSettings } from '@choliba/domain';

import { APP_PREPARED_ENV, AppError, prepareApp, type SetupSpawn } from '../../app/project-app-prepare';

function settingsWith(setup?: readonly string[]): ProjectSettings {
  const environment = {
    nome: 'development',
    baseURL: 'http://localhost:3000',
    appDir: '/code/app',
    ...(setup === undefined ? {} : { setup }),
  };
  return {
    project: 'demo',
    projectPath: '/p/demo',
    config: { name: 'Demo', envs: [environment] },
    environment,
    appDir: '/code/app',
    credentials: {},
    globals: {},
    env: {},
  };
}

interface Call {
  readonly command: string;
  readonly cwd: string;
  readonly shell: boolean;
}

/** A log in a fresh folder of its own, which does not exist yet. */
function logFileIn(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-')), 'app', 'demo.setup.log');
}

/** `prepareApp` of `setup`, each command writing `said by <command>` to the log and ending with its status. */
function prepare(setup: readonly string[] | undefined, statuses: readonly (number | null)[], env = {}) {
  const calls: Call[] = [];
  const said: string[] = [];
  const logFile = logFileIn();
  const spawn: SetupSpawn = (command, _args, options) => {
    calls.push({ command, cwd: options.cwd, shell: options.shell });
    fs.writeSync(options.stdio[1], `said by ${command}\n`);
    return { status: statuses[calls.length - 1] ?? 0 };
  };
  const run = (): Promise<void> =>
    prepareApp(settingsWith(setup), {
      projectsDir: '/p',
      env,
      stderr: { write: (chunk: string) => said.push(chunk) },
      spawn,
      logFile,
    });
  return { calls, said, run, logFile };
}

describe('prepareApp', () => {
  it('runs each setup command in the application folder, in order, saying which', async () => {
    const prepared = prepare(['bun install', 'bun run build'], [0, 0, 0, 0]);
    const { calls, said, run } = prepared;

    await run();

    expect(calls.slice(0, 2)).toEqual([
      { command: 'bun install', cwd: '/code/app', shell: true },
      { command: 'bun run build', cwd: '/code/app', shell: true },
    ]);
    expect(said).toEqual([
      `preparando a aplicação: bun install (em /code/app; log em ${prepared.logFile})\n`,
      `preparando a aplicação: bun run build (em /code/app; log em ${prepared.logFile})\n`,
    ]);
    // Their output goes to the log, from scratch, each after the command that wrote it.
    expect(fs.readFileSync(prepared.logFile, 'utf8')).toBe(
      '$ bun install\nsaid by bun install\n$ bun run build\nsaid by bun run build\n',
    );
    await prepared.run();
    expect(fs.readFileSync(prepared.logFile, 'utf8')).toBe(
      '$ bun install\nsaid by bun install\n$ bun run build\nsaid by bun run build\n',
    );
  });

  it('stops at the first command that fails with an AppError, naming it, its code, where it is declared and the log', async () => {
    const { calls, run, logFile } = prepare(['bun install', 'bun run build'], [2]);

    const error: unknown = await run().then(
      () => undefined,
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(AppError);
    expect((error as Error).message).toBe(
      'a aplicação não ficou pronta: "bun install" saiu com código 2 (envs[development].setup em /p/demo/config.json). ' +
        `Log em ${logFile}:\n  $ bun install\n  said by bun install`,
    );
    expect(calls).toHaveLength(1);
  });

  it('does nothing without setup, or in a batch whose application is already prepared', async () => {
    const none = prepare(undefined, []);
    await none.run();
    const batch = prepare(['bun install'], [], { [APP_PREPARED_ENV]: '1' });
    await batch.run();

    expect([...none.calls, ...batch.calls]).toEqual([]);
  });
});
