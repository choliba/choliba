import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AgentDefinition } from '../../agents/interfaces/agent.interface';
import type { PermissionPolicy } from '../../agents/interfaces/command.interface';
import type { ProviderRequest } from '../../providers/interfaces/provider.interface';
import { NO_PERMISSIONS, readAgentPermissions } from '../../runs/permissions';
import { deleteScript } from '../../runs/run-tools/delete.tool';
import { DEFAULT_PLAYWRIGHT_OUTPUT_DIR, playwrightScript } from '../../runs/run-tools/playwright.tool';
import {
  activeRunTools,
  applyRunTools,
  planRunTools,
  runToolCommands,
  runToolLines,
} from '../../runs/run-tools/run-tools';
import { NO_MODE_STEPS, fakeSections } from '../helpers/agent';
import { makeTmpDir } from '../helpers/tmp';

const RUN_DIR = '/w/.cache/runs/x';

function fakeRequest(
  declared: unknown,
  policy: PermissionPolicy,
  workspaceRoot = '/w',
  runDir = RUN_DIR,
): ProviderRequest {
  const agent: AgentDefinition = {
    name: 'echo',
    id: 'echo',
    displayName: 'Echo',
    version: '1.0.0',
    description: 'repeats things',
    supportedModels: [],
    skills: [],
    mcps: [],
    policy,
    taskRequired: true,
    projectRequired: false,
    allowWithoutTicket: false,
    defaultMode: 'execute',
    modes: ['execute'],
    permissions: readAgentPermissions(declared),
    dir: '/w/agents/echo',
    sections: fakeSections('be an echo'),
    steps: NO_MODE_STEPS,
    sourcePath: '/w/agents/echo/agent.yaml',
  };
  return { agent, mode: 'execute', policy, userPrompt: 'x', workspaceRoot, runDir, addDirs: [], model: undefined };
}

describe('activeRunTools', () => {
  it('has delete only when allow.delete lists a path and the run may change files', () => {
    const permissions = readAgentPermissions({ allow: { delete: ['app/'] } });

    expect(activeRunTools(permissions, RUN_DIR, 'edits')).toEqual([
      { name: 'delete', path: `${RUN_DIR}.delete`, allowed: undefined, denied: [] },
    ]);
    expect(activeRunTools(permissions, RUN_DIR, 'read-only')).toEqual([]);
    expect(activeRunTools(NO_PERMISSIONS, RUN_DIR, 'edits')).toEqual([]);
  });

  it('takes the declared tools with their subcommands, the denied ones, and drops a tool denied whole', () => {
    const permissions = readAgentPermissions({
      allow: { tools: { 'playwright-cli': ['*'], 'playwright-trace': ['open'] } },
      deny: { tools: { 'playwright-cli': ['eval', 'route'] } },
    });

    expect(activeRunTools(permissions, RUN_DIR, 'read-only')).toEqual([
      { name: 'playwright-cli', path: `${RUN_DIR}.playwright-cli`, allowed: undefined, denied: ['eval', 'route'] },
      { name: 'playwright-trace', path: `${RUN_DIR}.playwright-trace`, allowed: ['open'], denied: [] },
    ]);
    const deniedWhole = readAgentPermissions({
      allow: { tools: { 'playwright-cli': ['*'] } },
      deny: { tools: { 'playwright-cli': ['*'] } },
    });
    expect(activeRunTools(deniedWhole, RUN_DIR, 'edits')).toEqual([]);
  });

  it('ignores a name that is no run tool', () => {
    const permissions = readAgentPermissions({ allow: { tools: { nope: ['*'] } } });

    expect(activeRunTools(permissions, RUN_DIR, 'edits')).toEqual([]);
  });
});

describe('runToolCommands', () => {
  it('allows a tool by its script, or by script and subcommand when listed, and names the scripts', () => {
    const permissions = readAgentPermissions({
      allow: { delete: ['app/'], tools: { 'playwright-trace': ['open', 'close'] } },
      deny: { tools: { 'playwright-trace': ['snapshot'] } },
    });

    expect(runToolCommands(activeRunTools(permissions, RUN_DIR, 'edits'))).toEqual({
      allow: [`${RUN_DIR}.delete`, `${RUN_DIR}.playwright-trace open`, `${RUN_DIR}.playwright-trace close`],
      deny: [`${RUN_DIR}.playwright-trace snapshot`],
      scripts: [`${RUN_DIR}.delete`, `${RUN_DIR}.playwright-trace`],
    });
  });
});

describe('planRunTools and applyRunTools', () => {
  it('plans one script per tool next to the run dir, with absolute roots and the output folder', () => {
    const request = fakeRequest(
      {
        allow: { delete: ['app/'], tools: { 'playwright-cli': ['*'], 'playwright-trace': ['*'] } },
        deny: { delete: ['app/secrets/'] },
      },
      'edits',
    );

    const files = planRunTools(request, { CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR: 'saidas' });

    expect(files.map((file) => file.path)).toEqual([
      `${RUN_DIR}.delete`,
      `${RUN_DIR}.playwright-cli`,
      `${RUN_DIR}.playwright-trace`,
    ]);
    expect(files[0]?.content).toContain('["/w/app/"]');
    expect(files[0]?.content).toContain('["/w/app/secrets/"]');
    expect(files[1]?.content).toContain('const command = "cli"');
    expect(files[1]?.content).toContain('const outputDir = "saidas"');
    expect(files[2]?.content).toContain('const command = "trace"');
    expect(files[2]?.content).toContain('const outputDir = null');
    expect(
      planRunTools(fakeRequest({ allow: { tools: { 'playwright-cli': ['*'] } } }, 'edits'), {})[0]?.content,
    ).toContain(`const outputDir = "${DEFAULT_PLAYWRIGHT_OUTPUT_DIR}"`);
  });

  it('writes the scripts as executables and removes them on restore, once', () => {
    const tmp = makeTmpDir('run-tools-apply');
    try {
      const path = join(tmp.path, 'run.delete');
      const restore = applyRunTools([{ path, content: '#!/usr/bin/env bun\n' }]);

      expect(statSync(path).mode & 0o777).toBe(0o755);
      restore();
      restore();
      expect(existsSync(path)).toBe(false);
      applyRunTools([])();
    } finally {
      tmp.cleanup();
    }
  });
});

describe('runToolLines', () => {
  const permissions = readAgentPermissions({
    allow: { delete: ['app/'], tools: { 'playwright-cli': ['*'], 'playwright-trace': ['open'] } },
    deny: { tools: { 'playwright-cli': ['eval'] } },
  });

  it('tells each tool by its full path, how it is called and what it may do', () => {
    expect(runToolLines(permissions, { runDir: RUN_DIR, root: '/w', policy: 'edits' })).toEqual([
      'Tools: run each by its full path, exactly as shown, from where you are (never cd); nothing else does what they do:',
      `- \`${RUN_DIR}.delete <path…>\`: removes files and folders under the paths you may delete; it is the only way to delete`,
      `- \`${RUN_DIR}.playwright-cli <command> [args]\`: the browser (playwright cli) (not: eval)`,
      `- \`${RUN_DIR}.playwright-trace <command> [args]\`: reads the trace.zip of a failed test (playwright trace) (only: open)`,
    ]);
  });

  it('leaves delete out of a read-only run, assumes edits without a policy, and says nothing without a place or tools', () => {
    expect(runToolLines(permissions, { runDir: RUN_DIR, root: '/w', policy: 'read-only' }).join('\n')).not.toContain(
      '.delete',
    );
    expect(runToolLines(permissions, { runDir: RUN_DIR, root: '/w' }).join('\n')).toContain('.delete');
    expect(runToolLines(permissions)).toEqual([]);
    expect(runToolLines(NO_PERMISSIONS, { runDir: RUN_DIR, root: '/w' })).toEqual([]);
  });
});

interface Ran {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

interface DeleteScene {
  readonly root: string;
  readonly app: string;
  /** Runs the written script with `paths`, from the run dir, as the agent would. */
  readonly run: (...paths: string[]) => Ran;
}

/** A run dir and an `app/` root next to it, with the delete script written for `allow` and `deny`. */
function withDeleteScript(
  fn: (scene: DeleteScene) => void,
  roots: (app: string) => { allow: string[]; deny?: string[] } = (app) => ({ allow: [`${app}/`] }),
): void {
  const tmp = makeTmpDir('delete-script');
  try {
    const app = join(tmp.path, 'app');
    const runDir = join(tmp.path, 'run');
    mkdirSync(app);
    mkdirSync(runDir);
    const { allow, deny = [] } = roots(app);
    const script = `${runDir}.delete`;
    const restore = applyRunTools([{ path: script, content: deleteScript(allow, deny) }]);
    try {
      fn({
        root: tmp.path,
        app,
        run: (...paths) => spawnSync('bun', [script, ...paths], { cwd: runDir, encoding: 'utf8' }),
      });
    } finally {
      restore();
    }
  } finally {
    tmp.cleanup();
  }
}

describe('the delete script', () => {
  it('removes files and folders under an allow root, each printed', () => {
    withDeleteScript(({ app, run }) => {
      writeFileSync(join(app, 'a.txt'), 'x');
      mkdirSync(join(app, 'dir', 'sub'), { recursive: true });

      const result = run(join(app, 'a.txt'), '../app/dir');

      expect(result.status).toBe(0);
      expect(result.stdout).toContain(join(app, 'a.txt'));
      expect(existsSync(join(app, 'a.txt'))).toBe(false);
      expect(existsSync(join(app, 'dir'))).toBe(false);
    });
  });

  it('removes a symlink itself, never what it points to', () => {
    withDeleteScript(({ root, app, run }) => {
      writeFileSync(join(app, 'real.txt'), 'kept');
      symlinkSync('real.txt', join(app, 'link'));
      writeFileSync(join(root, 'outside.txt'), 'kept');
      symlinkSync(join(root, 'outside.txt'), join(app, 'escape'));
      symlinkSync(app, join(app, 'loop'));

      expect(run(join(app, 'link'), join(app, 'escape'), join(app, 'loop')).status).toBe(0);
      expect(existsSync(join(app, 'real.txt'))).toBe(true);
      expect(existsSync(join(root, 'outside.txt'))).toBe(true);
      expect(existsSync(join(app, 'link'))).toBe(false);
      expect(existsSync(join(app, 'loop'))).toBe(false);
    });
  });

  it('removes a dangling symlink', () => {
    withDeleteScript(({ app, run }) => {
      symlinkSync(join(app, 'gone'), join(app, 'dangling'));

      expect(run(join(app, 'dangling')).status).toBe(0);
    });
  });

  it('refuses what is outside the roots, reached through a symlinked folder, missing or a root itself', () => {
    withDeleteScript(({ root, app, run }) => {
      mkdirSync(join(root, 'other'));
      writeFileSync(join(root, 'other', 'a.txt'), 'x');
      symlinkSync(join(root, 'other'), join(app, 'other-link'));

      expect(run(join(root, 'other', 'a.txt')).stderr).toMatch(/Fora dos diretórios permitidos/);
      expect(run(join(app, 'other-link', 'a.txt')).stderr).toMatch(/Fora dos diretórios permitidos/);
      expect(run(join(app, 'missing')).stderr).toMatch(/Não encontrado/);
      expect(run(app).stderr).toMatch(/raiz permitida/);
      expect(run(`${app}/`).status).toBe(1);
      expect(existsSync(join(root, 'other', 'a.txt'))).toBe(true);
      expect(existsSync(app)).toBe(true);
    });
  });

  it('refuses a path under a deny root', () => {
    withDeleteScript(
      ({ app, run }) => {
        mkdirSync(join(app, 'secrets'));
        writeFileSync(join(app, 'secrets', 'key'), 'x');

        expect(run(join(app, 'secrets', 'key')).stderr).toMatch(/Apagar negado/);
        expect(existsSync(join(app, 'secrets', 'key'))).toBe(true);
      },
      (app) => ({ allow: [`${app}/`], deny: [`${app}/secrets/`] }),
    );
  });

  it('stops at the first refused path and says how to use it without one', () => {
    withDeleteScript(({ app, run }) => {
      writeFileSync(join(app, 'b.txt'), 'x');

      expect(run(join(app, 'missing'), join(app, 'b.txt')).status).toBe(1);
      expect(existsSync(join(app, 'b.txt'))).toBe(true);
      expect(run().stderr).toMatch(/uso:/);
    });
  });

  it('refuses everything for a root that does not exist', () => {
    withDeleteScript(
      ({ app, run }) => {
        writeFileSync(join(app, 'a.txt'), 'x');

        expect(run(join(app, 'a.txt')).stderr).toMatch(/Fora dos diretórios permitidos/);
      },
      (app) => ({ allow: [join(app, 'ghost')] }),
    );
  });
});

interface FakeCall {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly out: string | null;
}

/**
 * Runs a Playwright script against a fake `@playwright/test` that prints what it got and exits 3, from a run dir
 * that is not the workspace root.
 */
function runPlaywrightScript(
  command: 'cli' | 'trace',
  args: readonly string[],
  outputDir?: string,
): {
  readonly status: number | null;
  readonly call: FakeCall;
  readonly workspace: string;
} {
  const tmp = makeTmpDir('playwright-script');
  try {
    const fake = join(tmp.path, 'choliba', 'node_modules', '@playwright', 'test');
    mkdirSync(fake, { recursive: true });
    writeFileSync(join(fake, 'package.json'), '{ "name": "@playwright/test" }');
    writeFileSync(
      join(fake, 'cli.js'),
      'console.log(JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd(), out: process.env.PLAYWRIGHT_MCP_OUTPUT_DIR ?? null })); process.exit(3);',
    );
    const workspace = join(tmp.path, 'workspace');
    const runDir = join(workspace, '.cache', 'runs', 'x');
    mkdirSync(runDir, { recursive: true });
    const script = `${runDir}.playwright-${command}`;
    const content = playwrightScript({
      command,
      workspaceRoot: workspace,
      resolveFrom: [join(tmp.path, 'nowhere'), join(tmp.path, 'choliba')],
      ...(outputDir === undefined ? {} : { outputDir }),
    });
    applyRunTools([{ path: script, content }]);
    const env = { ...process.env };
    delete env['PLAYWRIGHT_MCP_OUTPUT_DIR'];
    const result = spawnSync(script, [...args], { cwd: runDir, encoding: 'utf8', env });
    return { status: result.status, call: JSON.parse(result.stdout) as FakeCall, workspace };
  } finally {
    tmp.cleanup();
  }
}

describe('the playwright scripts', () => {
  it('cli runs the Playwright found next to choliba in the workspace root, with every file it names under the output folder', () => {
    const { status, call, workspace } = runPlaywrightScript(
      'cli',
      ['screenshot', '--filename=a.png', '--filename', 'b.png', '--filename', '/abs/c.png'],
      'saidas',
    );

    expect(status).toBe(3);
    expect(call).toEqual({
      argv: ['cli', 'screenshot', '--filename=saidas/a.png', '--filename', 'saidas/b.png', '--filename', '/abs/c.png'],
      cwd: workspace,
      out: 'saidas',
    });
  });

  it('fails with a message naming where it looked when no Playwright is found', () => {
    const tmp = makeTmpDir('playwright-missing');
    try {
      const script = join(tmp.path, 'run.playwright-trace');
      applyRunTools([
        {
          path: script,
          content: playwrightScript({ command: 'trace', workspaceRoot: tmp.path, resolveFrom: [tmp.path] }),
        },
      ]);
      const result = spawnSync(script, ['open'], { encoding: 'utf8' });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`Playwright do choliba não encontrado a partir de: ${tmp.path}`);
    } finally {
      tmp.cleanup();
    }
  });

  it('trace passes its arguments as they are, with no output folder', () => {
    const { status, call } = runPlaywrightScript('trace', ['open', 't.zip']);

    expect(status).toBe(3);
    expect(call.argv).toEqual(['trace', 'open', 't.zip']);
    expect(call.out).toBeNull();
  });
});
