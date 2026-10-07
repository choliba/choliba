import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ensureApp, type EnsureAppDeps } from '../../app/ensure-app';
import { answers } from '../../app/launch';
import type { LaunchedApp } from '../../app/launch';
import { AppError } from '../../app/prepare-app';
import type { ProjectSettings } from '../../projects/settings';

function settingsWith(environment: Partial<ProjectSettings['environment']> = {}): ProjectSettings {
  const env = { nome: 'development', baseURL: 'http://localhost:3417', appDir: '/code/app', ...environment };
  return {
    project: 'demo',
    projectPath: '/p/demo',
    config: { name: 'Demo', envs: [env] },
    environment: env,
    appDir: env.appDir,
    credentials: {},
    globals: {},
    env: {},
  };
}

interface Scene {
  readonly deps: EnsureAppDeps;
  readonly launched: { command: string; cwd: string; logFile: string }[];
  readonly said: string[];
  readonly stopped: () => number;
  readonly logDir: string;
}

/** `upAfter`: how many checks of baseURL fail before it answers (`Infinity`: never); `exitCode`: the server's. */
function scene(upAfter: number, exitCode?: number | null, timeoutMs = 10_000, log?: string): Scene {
  const logDir = mkdtempSync(join(tmpdir(), 'ensure-app-'));
  const launched: Scene['launched'] = [];
  const said: string[] = [];
  let checks = 0;
  let stops = 0;
  let clock = 0;
  const app: LaunchedApp = {
    exitCode: () => exitCode,
    stop: () => {
      stops += 1;
    },
  };
  const deps: EnsureAppDeps = {
    projectsDir: '/p',
    logDir,
    env: {},
    stderr: { write: (chunk: string) => said.push(chunk) },
    spawn: () => ({ status: 0 }),
    launch: (command, cwd, logFile) => {
      launched.push({ command, cwd, logFile });
      if (log !== undefined) writeFileSync(logFile, log);
      return app;
    },
    isUp: () => {
      checks += 1;
      return Promise.resolve(checks > upAfter);
    },
    sleep: (ms) => {
      clock += ms;
      return Promise.resolve();
    },
    now: () => clock,
    timeoutMs,
  };
  return { deps, launched, said, stopped: () => stops, logDir };
}

async function failure(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error('expected a failure');
}

describe('ensureApp', () => {
  it('uses an application that is already up as it is, and never stops it', async () => {
    const s = scene(0);

    const app = await ensureApp(settingsWith({ start: 'bun run dev' }), s.deps);
    app.stop();

    expect(app.started).toBe(false);
    expect(s.launched).toEqual([]);
    expect(s.stopped()).toBe(0);
  });

  it('starts it with envs[].start in appDir when baseURL does not answer, waits for it, and stops it', async () => {
    const s = scene(3);

    const app = await ensureApp(settingsWith({ start: 'bun run dev' }), s.deps);

    expect(app.started).toBe(true);
    expect(s.launched).toEqual([{ command: 'bun run dev', cwd: '/code/app', logFile: join(s.logDir, 'demo.log') }]);
    expect(s.said).toEqual([`subindo a aplicação: bun run dev (em /code/app; log em ${join(s.logDir, 'demo.log')})\n`]);
    app.stop();
    expect(s.stopped()).toBe(1);
    rmSync(s.logDir, { recursive: true, force: true });
  });

  it('stops before anything else when the application is down and the environment has no start', async () => {
    const s = scene(Infinity);

    const error = await failure(ensureApp(settingsWith(), s.deps));

    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe(
      'a aplicação não responde em http://localhost:3417 e o ambiente development não tem envs[].start: suba-a ou configure o start em /p/demo/config.json.',
    );
    expect(s.launched).toEqual([]);
  });

  it('fails with the end of the log when the server ends before answering', async () => {
    const s = scene(Infinity, 1, 10_000, 'boot\nerror: Module not found "x.ts"\n');

    const error = await failure(ensureApp(settingsWith({ start: 'bun x.ts' }), s.deps));

    expect(error.message).toBe(
      `a aplicação não subiu (envs[].start): o comando terminou com código 1. Log em ${join(s.logDir, 'demo.log')}:\n  boot\n  error: Module not found "x.ts"`,
    );
    expect(s.stopped()).toBe(1);
    rmSync(s.logDir, { recursive: true, force: true });
  });

  it('fails when baseURL does not answer in time, stopping the server', async () => {
    const s = scene(Infinity, undefined, 2_000);

    const error = await failure(ensureApp(settingsWith({ start: 'bun run dev' }), s.deps));

    expect(error.message).toBe(
      `a aplicação não subiu (envs[].start): http://localhost:3417 não respondeu em 2 s. Log em ${join(s.logDir, 'demo.log')}:`,
    );
    expect(s.stopped()).toBe(1);
    rmSync(s.logDir, { recursive: true, force: true });
  });

  it('says nothing about the log when the server wrote nothing', async () => {
    const s = scene(Infinity, 2, 10_000, '');

    const error = await failure(ensureApp(settingsWith({ start: 'bun x.ts' }), s.deps));

    expect(error.message).toMatch(/terminou com código 2\. Log em .*demo\.log:$/);
    rmSync(s.logDir, { recursive: true, force: true });
  });

  it('runs the setup first, and stops there when it fails', async () => {
    const s = scene(0);

    const error = await failure(
      ensureApp(settingsWith({ setup: ['bun install'] }), { ...s.deps, spawn: () => ({ status: 3 }) }),
    );

    expect(error.message).toContain('a aplicação não ficou pronta: "bun install" saiu com código 3');
  });
});

describe('ensureApp, for real', () => {
  it('starts a real server with envs[].start, waits until it answers, and stops it', async () => {
    const logDir = mkdtempSync(join(tmpdir(), 'ensure-app-real-'));
    const port = 41_000 + Math.floor(Math.random() * 2_000);
    const baseURL = `http://127.0.0.1:${String(port)}/`;
    const server = `node -e "require('http').createServer((q, r) => r.end('ok')).listen(${String(port)}, '127.0.0.1')"`;
    try {
      const app = await ensureApp(settingsWith({ baseURL, start: server, appDir: logDir }), {
        projectsDir: '/p',
        logDir,
        env: process.env,
        stderr: { write: () => true },
        spawn: () => ({ status: 0 }),
      });

      expect(app.started).toBe(true);
      expect(await answers(baseURL)).toBe(true);
      app.stop();
      for (let tries = 0; tries < 40 && (await answers(baseURL)); tries += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(await answers(baseURL)).toBe(false);
    } finally {
      rmSync(logDir, { recursive: true, force: true });
    }
  });
});
