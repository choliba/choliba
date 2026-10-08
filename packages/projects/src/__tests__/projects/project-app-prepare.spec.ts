import type { ProjectSettings } from '../../projects/project-settings';

import { APP_PREPARED_ENV, AppError, prepareApp, type SetupSpawn } from '../../projects/project-app-prepare';

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

function prepare(setup: readonly string[] | undefined, statuses: readonly (number | null)[], env = {}) {
  const calls: Call[] = [];
  const said: string[] = [];
  const spawn: SetupSpawn = (command, _args, options) => {
    calls.push({ command, cwd: options.cwd, shell: options.shell });
    return { status: statuses[calls.length - 1] ?? 0 };
  };
  const run = (): void => {
    prepareApp(settingsWith(setup), {
      projectsDir: '/p',
      env,
      stderr: { write: (chunk: string) => said.push(chunk) },
      spawn,
    });
  };
  return { calls, said, run };
}

describe('prepareApp', () => {
  it('runs each setup command in the application folder, in order, saying which', () => {
    const { calls, said, run } = prepare(['bun install', 'bun run build'], [0, 0]);

    run();

    expect(calls).toEqual([
      { command: 'bun install', cwd: '/code/app', shell: true },
      { command: 'bun run build', cwd: '/code/app', shell: true },
    ]);
    expect(said).toEqual([
      'preparando a aplicação: bun install (em /code/app)\n',
      'preparando a aplicação: bun run build (em /code/app)\n',
    ]);
  });

  it('stops at the first command that fails with an AppError, naming it, its code and where it is declared', () => {
    const { calls, run } = prepare(['bun install', 'bun run build'], [2]);

    const error = (() => {
      try {
        run();
        return undefined;
      } catch (thrown) {
        return thrown;
      }
    })();

    expect(error).toBeInstanceOf(AppError);
    expect((error as Error).message).toBe(
      'a aplicação não ficou pronta: "bun install" saiu com código 2 (envs[development].setup em /p/demo/config.json).',
    );
    expect(calls).toHaveLength(1);
  });

  it('does nothing without setup, or in a batch whose application is already prepared', () => {
    const none = prepare(undefined, []);
    none.run();
    const batch = prepare(['bun install'], [], { [APP_PREPARED_ENV]: '1' });
    batch.run();

    expect([...none.calls, ...batch.calls]).toEqual([]);
  });
});
