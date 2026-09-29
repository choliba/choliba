import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const mockQuestion = jest.fn((_prompt: string) => Promise.resolve('n'));
const mockClose = jest.fn(() => undefined);

jest.mock('node:readline/promises', () => ({
  __esModule: true,
  default: {
    createInterface: jest.fn(() => ({
      question: (prompt: string) => mockQuestion(prompt),
      close: mockClose,
    })),
  },
}));

import * as projects from '@choliba/projects';
import * as terminalOutput from '@choliba/terminal/output';

import { installSilentTerminal } from '../helpers/silent-terminal';
import { isStdinInteractive, playwrightNodePath, readProcessStdinIsTTY, runTestsCli } from '../../cli/run-tests';

const TEST_ROOTS = { packageRoot: '/tmp/playwright-pkg', monorepoRoot: '/tmp/monorepo' };

function withProject(fn: (projectsDir: string, cwd: string) => Promise<void>): Promise<void> {
  const projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-tests-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'run-tests-cwd-'));
  return fn(projectsDir, cwd).finally(() => {
    fs.rmSync(projectsDir, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
  });
}

function writeProject(projectsDir: string, name: string, tickets: { suffix: string; specs?: string[] }[] = []): void {
  const projectDir = path.join(projectsDir, name);
  fs.mkdirSync(path.join(projectDir, 'tests'), { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, 'config.json'),
    JSON.stringify({ name: 'Demo', envs: [{ nome: 'development', baseURL: 'http://localhost/', appDir: '/app' }] }),
  );
  fs.writeFileSync(path.join(projectDir, '.env.json'), JSON.stringify({ development: {} }));
  if (tickets.length > 0) {
    const ticketsDir = path.join(projectDir, 'tickets');
    fs.mkdirSync(ticketsDir, { recursive: true });
    for (const ticket of tickets) {
      const criterios =
        ticket.specs && ticket.specs.length > 0
          ? [{ id: 'CA-01', testes: ticket.specs.map((spec) => `${spec} › d › CA-01: x`) }]
          : [];
      fs.writeFileSync(path.join(ticketsDir, `${ticket.suffix}.json`), JSON.stringify({ criterios }));
      for (const spec of ticket.specs ?? []) {
        fs.writeFileSync(path.join(projectDir, 'tests', spec), '// spec');
      }
    }
  }
}

describe('runTestsCli', () => {
  let restoreTerminal: () => void;

  beforeEach(() => {
    restoreTerminal = installSilentTerminal();
    mockQuestion.mockReset();
    mockClose.mockReset();
  });

  afterEach(() => {
    restoreTerminal();
  });

  it('isStdinInteractive honors explicit stdinIsTTY and falls back to a reader', () => {
    expect(isStdinInteractive(false)).toBe(false);
    expect(isStdinInteractive(true)).toBe(true);
    expect(isStdinInteractive(undefined, () => true)).toBe(true);
    expect(isStdinInteractive(undefined, () => false)).toBe(false);

    const stdinSpy = jest
      .spyOn(process, 'stdin', 'get')
      .mockReturnValue({ isTTY: true } as NodeJS.ReadStream & { fd: 0 });
    expect(readProcessStdinIsTTY()).toBe(true);
    expect(isStdinInteractive()).toBe(true);
    stdinSpy.mockRestore();
  });

  it('lets a spec outside any node_modules find @playwright/test, keeping the NODE_PATH already set', async () => {
    const runnerRoot = path.join(__dirname, '..', '..', '..');
    const modules = path.dirname(
      path.dirname(path.dirname(require.resolve('@playwright/test/package.json', { paths: [runnerRoot] }))),
    );
    expect(playwrightNodePath(runnerRoot, undefined)).toBe(modules);
    expect(playwrightNodePath(runnerRoot, '/x')).toBe(`${modules}${path.delimiter}/x`);
    expect(playwrightNodePath(runnerRoot, `${modules}${path.delimiter}/x`)).toBe(`${modules}${path.delimiter}/x`);
    expect(playwrightNodePath('/nowhere', '/x')).toBe('/x');
    expect(playwrightNodePath('/nowhere', undefined)).toBeUndefined();

    const envs: NodeJS.ProcessEnv[] = [];
    await runTestsCli({
      packageRoot: runnerRoot,
      monorepoRoot: '/tmp/monorepo',
      argv: ['--list'],
      env: { NODE_PATH: '/x' },
      spawnPlaywright: (_args, env) => {
        envs.push(env);
        return 0;
      },
      loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: '/p' }),
      stdinIsTTY: false,
    });
    expect(envs[0]?.['NODE_PATH']).toBe(`${modules}${path.delimiter}/x`);
  });

  it('forwards raw playwright flags', async () => {
    const calls: string[][] = [];
    const result = await runTestsCli({
      ...TEST_ROOTS,
      argv: ['--list'],
      spawnPlaywright: (args) => {
        calls.push(args);
        return 0;
      },
      loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: '/p' }),
      stdinIsTTY: false,
    });

    expect(result.exitCode).toBe(0);
    expect(calls[0]).toEqual(['test', '--list']);
  });

  it.each([['--help'], ['-h'], ['demo:T-01', '--help']])(
    'shows its own help for %s instead of Playwright’s',
    async (...argv) => {
      const stdout = jest.spyOn(terminalOutput, 'writeStdout');
      const spawnPlaywright = jest.fn(() => 0);
      const result = await runTestsCli({
        ...TEST_ROOTS,
        argv,
        spawnPlaywright,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: '/p' }),
        stdinIsTTY: false,
      });

      expect(result.exitCode).toBe(0);
      expect(spawnPlaywright).not.toHaveBeenCalled();
      const [[help]] = stdout.mock.calls as [[string]];
      expect(help).toContain('choliba tests [PROJECT');
      expect(help).toContain('--expect');
      expect(help).toContain('playwright test --help');
    },
  );

  it('completes its flags, the projects, their tickets and the values of --expect', async () => {
    await withProject(async (projectsDir) => {
      writeProject(projectsDir, 'demo', [{ suffix: 'T-01' }, { suffix: 'T-02' }]);
      const stdout = jest.spyOn(terminalOutput, 'writeStdout');
      const run = (...argv: string[]): Promise<unknown> =>
        runTestsCli({
          ...TEST_ROOTS,
          argv: ['__complete', ...argv],
          loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        });

      await run('--');
      await run('');
      await run('demo', '--expect', '');
      await run('demo', 'x');
      await run('demo', '--failures', '');
      await run('demo:');
      await run('demo:T-02');
      await run('nope:');

      expect(stdout.mock.calls).toEqual([
        ['--expect\n--failures\n--help\n'],
        ['demo\n'],
        ['red\ngreen\n'],
        [':files\n'],
        ['demo:T-01\ndemo:T-02\n'],
        ['demo:T-02\n'],
      ]);
    });
  });

  it('completes no project when the workspace locations cannot be read', async () => {
    const stdout = jest.spyOn(terminalOutput, 'writeStdout');
    await runTestsCli({
      ...TEST_ROOTS,
      argv: ['__complete', ''],
      loadConfig: () => {
        throw new Error('sem PROJECTS_DIR');
      },
    });
    expect(stdout.mock.calls).toEqual([['--expect\n--failures\n--help\n-h\n']]);
  });

  it('describes itself in one line, for bun chol:help', async () => {
    const stdout = jest.spyOn(terminalOutput, 'writeStdout');
    await runTestsCli({
      ...TEST_ROOTS,
      argv: ['__describe'],
      loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: '/p' }),
    });
    expect(stdout.mock.calls).toEqual([
      ['Roda os testes E2E dos projetos com o Playwright. Sem PROJECT, roda todos os projetos.\n'],
    ]);
  });

  it('fails when project does not exist', async () => {
    await withProject(async (projectsDir, cwd) => {
      await expect(
        runTestsCli({
          ...TEST_ROOTS,
          argv: ['missing:T-01'],
          cwd,
          env: {},
          loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
          spawnPlaywright: () => 0,
          stdinIsTTY: false,
        }),
      ).rejects.toThrow('não existe');
    });
  });

  it('rejects space-separated project and ticket', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo', [{ suffix: 'T-01', specs: ['a.spec.ts'] }]);

      await expect(
        runTestsCli({
          ...TEST_ROOTS,
          argv: ['demo', 'demo-T-01'],
          cwd,
          loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
          spawnPlaywright: () => 0,
          stdinIsTTY: false,
        }),
      ).rejects.toThrow('parece projeto e ticket separados');
    });
  });

  it('runs ticket specs and fills tests afterward', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo', [{ suffix: 'T-01', specs: ['alpha.spec.ts'] }]);
      const calls: string[][] = [];

      const result = await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo:T-01'],
        cwd,
        env: { TICKET_RUNS: projectsDir },
        stdinIsTTY: false,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir, TICKET_RUNS: projectsDir }),
        spawnPlaywright: (args) => {
          calls.push(args);
          return 0;
        },
      });

      expect(result.exitCode).toBe(0);
      expect(calls[0]?.[1]).toBe(path.join(projectsDir, 'demo', 'tests', 'alpha.spec.ts'));
    });
  });

  it('runs the whole project when the ticket has no referenced specs', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo', [{ suffix: 'T-01' }]);
      const calls: string[][] = [];

      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo:T-01'],
        cwd,
        stdinIsTTY: false,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        spawnPlaywright: (args) => {
          calls.push(args);
          return 0;
        },
      });

      expect(calls[0]?.[1]).toBe(path.join(projectsDir, 'demo'));
    });
  });

  it('expands multi-ticket selectors sequentially', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo', [
        { suffix: 'T-01', specs: ['a.spec.ts'] },
        { suffix: 'T-02', specs: ['b.spec.ts'] },
      ]);
      const calls: string[][] = [];

      const result = await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo:T-01,T-02'],
        cwd,
        stdinIsTTY: false,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        spawnPlaywright: (args) => {
          calls.push(args);
          return 0;
        },
      });

      expect(result.exitCode).toBe(0);
      expect(calls).toHaveLength(2);
    });
  });

  it('runs all tickets when only the project is given', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo', [
        { suffix: 'T-01', specs: ['a.spec.ts'] },
        { suffix: 'T-02', specs: ['b.spec.ts'] },
      ]);
      const calls: string[][] = [];

      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo'],
        cwd,
        stdinIsTTY: false,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        spawnPlaywright: (args) => {
          calls.push(args);
          return 0;
        },
      });

      expect(calls).toHaveLength(2);
    });
  });

  it('runs every project when argv is empty', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'alpha');
      writeProject(projectsDir, 'beta');
      const calls: string[][] = [];

      await runTestsCli({
        ...TEST_ROOTS,
        argv: [],
        cwd,
        stdinIsTTY: false,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        spawnPlaywright: (args) => {
          calls.push(args);
          return 0;
        },
      });

      expect(calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('opens the html report when the user confirms at the prompt', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo', [{ suffix: 'T-01', specs: ['a.spec.ts'] }]);
      const shown: string[] = [];

      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo:T-01'],
        cwd,
        stdinIsTTY: true,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        spawnPlaywright: () => 0,
        promptOpenReport: () => Promise.resolve(true),
        openHtmlReport: (_projectsDir, project, ticket) => {
          shown.push(`${project}:${ticket ?? ''}`);
        },
      });

      expect(shown).toEqual(['demo:demo-T-01']);
    });
  });

  it('rejects multi-ticket selectors combined with a file path', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo', [{ suffix: 'T-01', specs: ['a.spec.ts'] }]);

      await expect(
        runTestsCli({
          ...TEST_ROOTS,
          argv: ['demo:T-*,T-02/tests/foo.spec.ts'],
          cwd,
          loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
          spawnPlaywright: () => 0,
          stdinIsTTY: false,
        }),
      ).rejects.toThrow('glob/lista/intervalo');
    });
  });

  it('uses the default spawnPlaywright implementation', async () => {
    const spawnCalls: { command: string; args: readonly string[] }[] = [];
    await runTestsCli({
      ...TEST_ROOTS,
      argv: ['--list'],
      loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: '/p' }),
      spawnSyncFn: (command, args) => {
        spawnCalls.push({ command, args });
        return { status: 0 };
      },
      stdinIsTTY: false,
    });

    expect(spawnCalls[0]).toEqual({
      command: 'bunx',
      args: ['playwright', 'test', '--list'],
    });
  });

  it('opens the default html report after a successful ticket run', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo', [{ suffix: 'T-01', specs: ['a.spec.ts'] }]);
      const spawnCalls: { command: string; args: readonly string[] }[] = [];

      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo:T-01'],
        cwd,
        stdinIsTTY: true,
        env: { TICKET_RUNS: projectsDir },
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir, TICKET_RUNS: projectsDir }),
        promptOpenReport: () => Promise.resolve(true),
        spawnSyncFn: (command, args) => {
          spawnCalls.push({ command, args });
          return { status: 0 };
        },
      });

      expect(spawnCalls.some((call) => call.args.includes('show-report'))).toBe(true);
    });
  });

  it('parses spaced ticket ranges and csv arguments', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo', [
        { suffix: 'CAD-01', specs: ['a.spec.ts'] },
        { suffix: 'CAD-02', specs: ['b.spec.ts'] },
        { suffix: 'CAD-03', specs: ['c.spec.ts'] },
      ]);
      const calls: string[][] = [];

      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo:CAD-01', '-', 'CAD-02'],
        cwd,
        stdinIsTTY: false,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        spawnPlaywright: (args) => {
          calls.push(args);
          return 0;
        },
      });

      expect(calls).toHaveLength(2);

      calls.length = 0;
      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo:CAD-01,CAD-02'],
        cwd,
        stdinIsTTY: false,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        spawnPlaywright: (args) => {
          calls.push(args);
          return 0;
        },
      });

      expect(calls).toHaveLength(2);

      calls.length = 0;
      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo:CAD-01,', 'CAD-02'],
        cwd,
        stdinIsTTY: false,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        spawnPlaywright: (args) => {
          calls.push(args);
          return 0;
        },
      });

      expect(calls).toHaveLength(2);

      calls.length = 0;
      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo:CAD-01,', 'CAD-02', 'CAD-03'],
        cwd,
        stdinIsTTY: false,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        spawnPlaywright: (args) => {
          calls.push(args);
          return 0;
        },
      });

      expect(calls).toHaveLength(3);
    });
  });

  it('refuses a target without a project name', async () => {
    await withProject(async (projectsDir, cwd) => {
      const calls: string[][] = [];

      await expect(
        runTestsCli({
          ...TEST_ROOTS,
          argv: [''],
          cwd,
          stdinIsTTY: false,
          loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
          spawnPlaywright: (args) => {
            calls.push(args);
            return 0;
          },
        }),
      ).rejects.toThrow('erro: informe um projeto');
      expect(calls).toEqual([]);
    });
  });

  it('refuses a project that is not configured yet', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo');
      fs.writeFileSync(
        path.join(projectsDir, 'demo', '.env.json'),
        JSON.stringify({ development: { X: 'CHANGE_ME' } }),
      );

      await expect(
        runTestsCli({
          ...TEST_ROOTS,
          argv: ['demo'],
          cwd,
          stdinIsTTY: false,
          loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
          spawnPlaywright: () => 0,
        }),
      ).rejects.toThrow('troque CHANGE_ME em:');
    });
  });

  it('runs a direct file path under the project', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo', [{ suffix: 'T-01', specs: ['a.spec.ts'] }]);
      const calls: string[][] = [];

      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo/tests/a.spec.ts'],
        cwd,
        stdinIsTTY: false,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        spawnPlaywright: (args) => {
          calls.push(args);
          return 0;
        },
      });

      expect(calls[0]?.[1]).toBe(path.join(projectsDir, 'demo', 'tests', 'a.spec.ts'));
    });
  });

  it('fails when ticket spec resolution throws', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo');

      await expect(
        runTestsCli({
          ...TEST_ROOTS,
          argv: ['demo:demo-MISSING'],
          cwd,
          stdinIsTTY: false,
          loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
          spawnPlaywright: () => 0,
        }),
      ).rejects.toThrow('Ticket');
    });
  });

  it('propagates non-zero exit codes from sequential ticket runs', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo', [
        { suffix: 'T-01', specs: ['a.spec.ts'] },
        { suffix: 'T-02', specs: ['b.spec.ts'] },
      ]);

      const result = await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo:T-01,T-02'],
        cwd,
        stdinIsTTY: false,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        spawnPlaywright: () => 1,
      });

      expect(result.exitCode).toBe(1);
    });
  });

  it('cleans up local playwright folders after a ticket run', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo', [{ suffix: 'T-01', specs: ['a.spec.ts'] }]);
      fs.mkdirSync(path.join(cwd, 'test-results'), { recursive: true });
      fs.mkdirSync(path.join(cwd, 'playwright-report'), { recursive: true });

      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo:T-01'],
        cwd,
        stdinIsTTY: false,
        env: { TICKET_RUNS: projectsDir },
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir, TICKET_RUNS: projectsDir }),
        spawnPlaywright: () => 0,
      });

      expect(fs.existsSync(path.join(cwd, 'test-results'))).toBe(false);
      expect(fs.existsSync(path.join(cwd, 'playwright-report'))).toBe(false);
    });
  });

  it('uses resolveLocations when loadConfig is omitted', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'run-tests-env-'));
    try {
      fs.writeFileSync(path.join(tmp, '.env'), 'CHOL_GLOBAL_DIR=/tmp/global\n');
      await runTestsCli({
        packageRoot: TEST_ROOTS.packageRoot,
        monorepoRoot: tmp,
        argv: ['--list'],
        stdinIsTTY: false,
        spawnPlaywright: () => 0,
      });
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('opens the default html report after a single-ticket project run', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo', [{ suffix: 'T-01', specs: ['a.spec.ts'] }]);
      const spawnCalls: { command: string; args: readonly string[] }[] = [];

      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo'],
        cwd,
        stdinIsTTY: true,
        env: { TICKET_RUNS: projectsDir },
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir, TICKET_RUNS: projectsDir }),
        promptOpenReport: () => Promise.resolve(true),
        spawnPlaywright: () => 0,
        spawnSyncFn: (command, args) => {
          spawnCalls.push({ command, args });
          return { status: 0 };
        },
      });

      expect(spawnCalls.some((call) => call.args.includes('show-report'))).toBe(true);
    });
  });

  it('prompts via readline when opening the html report', async () => {
    mockQuestion.mockResolvedValueOnce('y');
    // A implementação real (askOpenReport) passa `process.stdin` pro readline mockado abaixo;
    // essa leitura sozinha já basta pro Node abrir o handle real de stdin (TTYWRAP) num
    // terminal de verdade. O readline em si está mockado e ignora `input`, então trocamos
    // o getter por um objeto qualquer só pra nunca tocar no stream real.
    const stdinSpy = jest.spyOn(process, 'stdin', 'get').mockReturnValue({} as NodeJS.ReadStream & { fd: 0 });

    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo', [{ suffix: 'T-01', specs: ['a.spec.ts'] }]);
      const spawnCalls: { command: string; args: readonly string[] }[] = [];

      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo:T-01'],
        cwd,
        stdinIsTTY: true,
        env: { TICKET_RUNS: projectsDir },
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir, TICKET_RUNS: projectsDir }),
        spawnPlaywright: () => 0,
        spawnSyncFn: (command, args) => {
          spawnCalls.push({ command, args });
          return { status: 0 };
        },
      });

      expect(mockQuestion).toHaveBeenCalledWith('Abrir o relatório HTML? [y/N] ');
      expect(spawnCalls.some((call) => call.args.includes('show-report'))).toBe(true);
    });

    stdinSpy.mockRestore();
  });

  it('skips opening the html report when readline answer is not y', async () => {
    mockQuestion.mockResolvedValueOnce('n');
    const stdinSpy = jest.spyOn(process, 'stdin', 'get').mockReturnValue({} as NodeJS.ReadStream & { fd: 0 });

    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo', [{ suffix: 'T-01', specs: ['a.spec.ts'] }]);
      const spawnCalls: { command: string; args: readonly string[] }[] = [];

      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo:T-01'],
        cwd,
        stdinIsTTY: true,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        spawnPlaywright: () => 0,
        spawnSyncFn: (command, args) => {
          spawnCalls.push({ command, args });
          return { status: 0 };
        },
      });

      expect(spawnCalls.some((call) => call.args.includes('show-report'))).toBe(false);
    });

    stdinSpy.mockRestore();
  });

  it('treats a null spawn status as exit code 1', async () => {
    const result = await runTestsCli({
      ...TEST_ROOTS,
      argv: ['--list'],
      stdinIsTTY: false,
      loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: '/p' }),
      spawnSyncFn: () => ({ status: null }),
    });

    expect(result.exitCode).toBe(1);
  });

  it('passes terminal width and playwright extras from csv continuation', async () => {
    const previousColumns = process.stdout.columns;
    Object.defineProperty(process.stdout, 'columns', { value: 96, configurable: true });

    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo', [
        { suffix: 'CAD-01', specs: ['a.spec.ts'] },
        { suffix: 'CAD-02', specs: ['b.spec.ts'] },
      ]);
      let capturedEnv: NodeJS.ProcessEnv | undefined;
      const calls: string[][] = [];

      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo:CAD-01,', 'CAD-02', '--headed'],
        cwd,
        stdinIsTTY: false,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        spawnPlaywright: (args, env) => {
          capturedEnv = env;
          calls.push(args);
          return 0;
        },
      });

      expect(capturedEnv?.['TERM_COLS']).toBe('96');
      expect(calls[0]).toContain('--headed');
    });

    Object.defineProperty(process.stdout, 'columns', { value: previousColumns, configurable: true });
  });

  it('falls back to 80 columns when stdout width is unavailable', async () => {
    const previousColumns = process.stdout.columns;
    Object.defineProperty(process.stdout, 'columns', { value: 0, configurable: true });

    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo', [{ suffix: 'T-01', specs: ['a.spec.ts'] }]);
      let capturedEnv: NodeJS.ProcessEnv | undefined;

      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo:T-01'],
        cwd,
        stdinIsTTY: false,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        spawnPlaywright: (_args, env) => {
          capturedEnv = env;
          return 0;
        },
      });

      expect(capturedEnv?.['TERM_COLS']).toBe('80');
    });

    Object.defineProperty(process.stdout, 'columns', { value: previousColumns, configurable: true });
  });

  it('runs a project without a tickets directory', async () => {
    await withProject(async (projectsDir, cwd) => {
      const projectDir = path.join(projectsDir, 'demo');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(
        path.join(projectDir, 'config.json'),
        JSON.stringify({ name: 'Demo', envs: [{ nome: 'development', baseURL: 'http://localhost/', appDir: '/app' }] }),
      );
      fs.writeFileSync(path.join(projectDir, '.env.json'), JSON.stringify({ development: {} }));
      const calls: string[][] = [];

      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo'],
        cwd,
        stdinIsTTY: false,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        spawnPlaywright: (args) => {
          calls.push(args);
          return 0;
        },
      });

      expect(calls[0]?.[1]).toBe(path.join(projectsDir, 'demo'));
    });
  });

  it('propagates failures when running every project', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'alpha', [{ suffix: 'T-01', specs: ['a.spec.ts'] }]);
      writeProject(projectsDir, 'beta', [{ suffix: 'T-01', specs: ['b.spec.ts'] }]);

      const result = await runTestsCli({
        ...TEST_ROOTS,
        argv: [],
        cwd,
        stdinIsTTY: false,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        spawnPlaywright: () => 1,
      });

      expect(result.exitCode).toBe(1);
    });
  });

  it('declines the sequential html report prompt for a single-ticket project', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo', [{ suffix: 'T-01', specs: ['a.spec.ts'] }]);
      const spawnCalls: { command: string; args: readonly string[] }[] = [];

      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo'],
        cwd,
        stdinIsTTY: true,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        promptOpenReport: () => Promise.resolve(false),
        spawnPlaywright: () => 0,
        spawnSyncFn: (command, args) => {
          spawnCalls.push({ command, args });
          return { status: 0 };
        },
      });

      expect(spawnCalls.some((call) => call.args.includes('show-report'))).toBe(false);
    });
  });

  it('uses projectsDir for html report when TICKET_RUNS is blank', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo', [{ suffix: 'T-01', specs: ['a.spec.ts'] }]);
      const spawnCalls: { command: string; args: readonly string[] }[] = [];

      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo:T-01'],
        cwd,
        stdinIsTTY: true,
        env: { TICKET_RUNS: '   ' },
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        promptOpenReport: () => Promise.resolve(true),
        spawnPlaywright: () => 0,
        spawnSyncFn: (command, args) => {
          spawnCalls.push({ command, args });
          return { status: 0 };
        },
      });

      expect(spawnCalls.some((call) => call.args.some((arg) => arg.includes(projectsDir)))).toBe(true);
    });
  });

  it('runs a project with an empty tickets directory', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo');
      fs.mkdirSync(path.join(projectsDir, 'demo', 'tickets'), { recursive: true });
      const calls: string[][] = [];

      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo'],
        cwd,
        stdinIsTTY: false,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        spawnPlaywright: (args) => {
          calls.push(args);
          return 0;
        },
      });

      expect(calls[0]?.[1]).toBe(path.join(projectsDir, 'demo'));
    });
  });

  it('passes undefined ticket to showReport when running a whole project', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo');
      const shown: string[] = [];

      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo'],
        cwd,
        stdinIsTTY: true,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        spawnPlaywright: () => 0,
        promptOpenReport: () => Promise.resolve(true),
        openHtmlReport: (_projectsDir, project, ticket) => {
          shown.push(`${project}:${ticket ?? 'none'}`);
        },
      });

      expect(shown).toEqual(['demo:none']);
    });
  });

  it('stops csv continuation at slashes and empty args', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo', [
        { suffix: 'CAD-01', specs: ['a.spec.ts'] },
        { suffix: 'CAD-02', specs: ['b.spec.ts'] },
      ]);
      const calls: string[][] = [];

      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo:CAD-01,', 'CAD/02'],
        cwd,
        stdinIsTTY: false,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        spawnPlaywright: (args) => {
          calls.push(args);
          return 0;
        },
      });

      expect(calls).toHaveLength(1);

      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo:CAD-01,', 'CAD-02', ''],
        cwd,
        stdinIsTTY: false,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        spawnPlaywright: (args) => {
          calls.push(args);
          return 0;
        },
      });

      expect(calls).toHaveLength(3);
    });
  });

  it('stops csv continuation at short flags', async () => {
    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo', [
        { suffix: 'CAD-01', specs: ['a.spec.ts'] },
        { suffix: 'CAD-02', specs: ['b.spec.ts'] },
      ]);
      const calls: string[][] = [];

      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo:CAD-01,', 'CAD-02', '-g'],
        cwd,
        stdinIsTTY: false,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        spawnPlaywright: (args) => {
          calls.push(args);
          return 0;
        },
      });

      expect(calls).toHaveLength(2);
      expect(calls[1]).toContain('-g');
    });
  });

  it('skips playwright folder cleanup when report stays in package root', async () => {
    const reportSpy = jest.spyOn(projects, 'resolveReportFolder').mockReturnValue('playwright-report');

    await withProject(async (projectsDir, cwd) => {
      writeProject(projectsDir, 'demo', [{ suffix: 'T-01', specs: ['a.spec.ts'] }]);
      fs.mkdirSync(path.join(cwd, 'test-results'), { recursive: true });
      fs.mkdirSync(path.join(cwd, 'playwright-report'), { recursive: true });

      await runTestsCli({
        ...TEST_ROOTS,
        argv: ['demo:T-01'],
        cwd,
        stdinIsTTY: false,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir }),
        spawnPlaywright: () => 0,
      });

      expect(fs.existsSync(path.join(cwd, 'test-results'))).toBe(true);
      expect(fs.existsSync(path.join(cwd, 'playwright-report'))).toBe(true);
    });

    reportSpy.mockRestore();
  });

  describe('a ticket with no referenced test yet, and --expect', () => {
    /** `demo` with ticket T-01 (CA-01, CA-02, no `testes`) and its spec `tests/demo-T-01.spec.ts`. */
    function writeTicketWithSpec(projectsDir: string): void {
      writeProject(projectsDir, 'demo');
      const projectDir = path.join(projectsDir, 'demo');
      fs.mkdirSync(path.join(projectDir, 'tickets'), { recursive: true });
      fs.writeFileSync(
        path.join(projectDir, 'tickets', 'T-01.json'),
        JSON.stringify({
          criterios: [
            { id: 'CA-01', testes: [] },
            { id: 'CA-02', testes: [] },
          ],
        }),
      );
      fs.writeFileSync(path.join(projectDir, 'tests', 'demo-T-01.spec.ts'), '// spec');
    }

    function result(title: string, status: string, message?: string) {
      const results = message === undefined ? [{ status: 'passed' }] : [{ status: 'failed', error: { message } }];
      return { title, tests: [{ status, results }] };
    }

    /** A `spawnPlaywright` that writes this report where the ticket's run keeps it, and exits with `status`. */
    function playwrightReporting(
      projectsDir: string,
      specs: ReturnType<typeof result>[],
      status: number,
      calls: string[][] = [],
    ): (args: string[]) => number {
      return (args) => {
        calls.push(args);
        const folder = projects.resolveReportFolder(projectsDir, 'demo', 'demo-T-01');
        fs.mkdirSync(folder, { recursive: true });
        fs.writeFileSync(
          path.join(folder, 'results.json'),
          JSON.stringify({ suites: [{ title: 'demo-T-01.spec.ts', specs }], errors: [] }),
        );
        return status;
      };
    }

    function run(projectsDir: string, cwd: string, argv: string[], spawnPlaywright: (args: string[]) => number) {
      return runTestsCli({
        ...TEST_ROOTS,
        argv,
        cwd,
        env: {},
        stdinIsTTY: false,
        loadConfig: () => ({ CHOL_GLOBAL_DIR: '/g', PROJECTS_DIR: projectsDir, TICKET_RUNS: projectsDir }),
        spawnPlaywright,
      });
    }

    function stderrText(): string {
      return (terminalOutput.writeStderr as jest.Mock).mock.calls.map(([chunk]) => String(chunk)).join('');
    }

    it('runs tests/<ticket>.spec.ts instead of the whole project', async () => {
      await withProject(async (projectsDir, cwd) => {
        writeTicketWithSpec(projectsDir);
        const calls: string[][] = [];

        await run(projectsDir, cwd, ['demo:T-01'], playwrightReporting(projectsDir, [], 1, calls));

        expect(calls[0]?.[1]).toBe(path.join(projectsDir, 'demo', 'tests', 'demo-T-01.spec.ts'));
      });
    });

    it('--expect red succeeds when every criterion fails, keeps the flags from Playwright and writes --failures', async () => {
      await withProject(async (projectsDir, cwd) => {
        writeTicketWithSpec(projectsDir);
        const calls: string[][] = [];
        const failures = path.join(cwd, 'out', 'falhas.md');
        const specs = [result('CA-01: a', 'unexpected', 'Timeout'), result('CA-02: b', 'unexpected', 'toHaveText')];

        const status = await run(
          projectsDir,
          cwd,
          ['demo:T-01', '--expect', 'red', '--failures', failures, '--workers=1'],
          playwrightReporting(projectsDir, specs, 1, calls),
        );

        expect(status.exitCode).toBe(0);
        expect(calls[0]?.slice(2)).toEqual(['--workers=1']);
        expect(fs.readFileSync(failures, 'utf8')).toContain('## CA-02');
      });
    });

    it('--failures alone writes the failures and keeps the exit code of Playwright', async () => {
      await withProject(async (projectsDir, cwd) => {
        writeTicketWithSpec(projectsDir);
        const failures = path.join(cwd, 'falhas.md');

        const status = await run(
          projectsDir,
          cwd,
          ['demo:T-01', `--failures=${failures}`],
          playwrightReporting(projectsDir, [result('CA-01: a', 'unexpected', 'Timeout')], 1),
        );

        expect(status.exitCode).toBe(1);
        expect(fs.readFileSync(failures, 'utf8')).toContain('Timeout');
      });
    });

    it('--expect green fails naming what still fails', async () => {
      await withProject(async (projectsDir, cwd) => {
        writeTicketWithSpec(projectsDir);
        const specs = [result('CA-01: a', 'expected'), result('CA-02: b', 'unexpected', 'Timeout')];

        const status = await run(
          projectsDir,
          cwd,
          ['demo:T-01', '--expect', 'green'],
          playwrightReporting(projectsDir, specs, 1),
        );

        expect(status.exitCode).toBe(1);
        expect(stderrText()).toContain('CA-02: ainda falha');
      });
    });

    it('--expect green also fails when Playwright does, even with every criterion passing', async () => {
      await withProject(async (projectsDir, cwd) => {
        writeTicketWithSpec(projectsDir);
        const specs = [result('CA-01: a', 'expected'), result('CA-02: b', 'expected')];

        const status = await run(
          projectsDir,
          cwd,
          ['demo:T-01', '--expect', 'green'],
          playwrightReporting(projectsDir, specs, 1),
        );

        expect(status.exitCode).toBe(1);
        expect(stderrText()).toContain('o Playwright terminou com 1');
      });
    });

    it('--expect fails when the run left no report', async () => {
      await withProject(async (projectsDir, cwd) => {
        writeTicketWithSpec(projectsDir);

        const status = await run(projectsDir, cwd, ['demo:T-01', '--expect=red'], () => 1);

        expect(status.exitCode).toBe(1);
        expect(stderrText()).toContain('results.json');
      });
    });

    it('refuses --expect with an unknown value, without a value, or without a single ticket', async () => {
      await withProject(async (projectsDir, cwd) => {
        writeTicketWithSpec(projectsDir);
        const spawn = (): number => 0;

        await expect(run(projectsDir, cwd, ['demo:T-01', '--expect', 'blue'], spawn)).rejects.toThrow('--expect');
        await expect(run(projectsDir, cwd, ['demo:T-01', '--failures'], spawn)).rejects.toThrow('--failures');
        await expect(run(projectsDir, cwd, ['demo', '--expect', 'red'], spawn)).rejects.toThrow('um ticket');
        await expect(run(projectsDir, cwd, ['demo/tests/a.spec.ts', '--expect', 'red'], spawn)).rejects.toThrow(
          'um ticket',
        );
      });
    });
  });
});
