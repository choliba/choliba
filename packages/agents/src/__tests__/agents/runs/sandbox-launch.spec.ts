import { statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ClaudeAgentProvider,
  ClaudeOllamaAgentProvider,
  CodexAgentProvider,
  CursorAgentProvider,
} from '@choliba/providers';

import { launchFor, realDisk, type LaunchDisk } from '../../../agents/runs/sandbox-launch';
import { NO_PERMISSIONS, type AgentPermissions } from '../../../common/agent-permissions';
import type { ProviderRequest } from '../../../common/interfaces/provider.interface';
import { NO_MODE_STEPS, fakeSections } from '../../helpers/agent';
import { makeTmpDir } from '../../helpers/tmp';

function request(permissions: Partial<AgentPermissions> = {}, more: Partial<ProviderRequest> = {}): ProviderRequest {
  return {
    agent: {
      name: 'echo',
      id: 'echo',
      displayName: 'Echo',
      version: '1.0.0',
      description: 'd',
      providers: [],
      skills: [],
      mcps: [],
      policy: 'edits',
      taskRequired: true,
      projectRequired: false,
      allowWithoutTicket: false,
      defaultMode: 'execute',
      modes: ['execute'],
      permissions: { ...NO_PERMISSIONS, ...permissions },
      steps: NO_MODE_STEPS,
      sections: fakeSections('be an echo'),
      dir: '/w/.choliba/agents/echo',
      sourcePath: '/w/.choliba/agents/echo/agent.yaml',
    },
    mode: 'execute',
    policy: 'edits',
    userPrompt: 'Task:\ndo it',
    workspaceRoot: '/w',
    runDir: '/w/.cache/runs/1',
    addDirs: [],
    model: undefined,
    ...more,
  };
}

/** Every path exists, as a folder unless it has a dot in its last part; records the folders made and the links. */
function disk(): LaunchDisk & { readonly made: string[]; readonly links: readonly (readonly [string, string])[] } {
  const made: string[] = [];
  const links: (readonly [string, string])[] = [];
  return {
    made,
    links,
    exists: () => true,
    isDirectory: (path) => !/\.[^/]*$/.test(path.split('/').pop() ?? ''),
    read: () => [],
    owner: () => ({ uid: 1000, gid: 1000 }),
    ensureDir: (path) => {
      made.push(path);
    },
    link: (target, path) => {
      links.push([target, path]);
    },
    realpath: (path) => path,
    runtime: '/home/test/.bun/bin/bun',
  };
}

const PROVIDER = {
  adapter: new ClaudeAgentProvider(),
  command: ['claude'],
  executable: '/provider/claude',
};

const CONFIG = {
  HOME: '/home/test',
  CHOL_GLOBAL_DIR: '/g',
  CHOL_PROJECTS_DIR: '/g/projects',
  CLAUDE_CODE_OAUTH_TOKEN: 'segredo',
};

describe('launchFor', () => {
  it('wraps the command in bwrap, with the run folder writable and as its working directory', () => {
    const launch = launchFor(
      {
        sandbox: { kind: 'local' },
        command: ['claude', '-p'],
        provider: PROVIDER,
        request: request(),
        files: [],
        config: CONFIG,
      },
      disk(),
    );
    expect(launch.place).toEqual({ kind: 'local' });
    expect(launch.command[0]).toMatch(/bwrap$/);
    expect(launch.command.slice(-5)).toEqual(['--chdir', '/w/.cache/runs/1', '--', '/provider/claude', '-p']);
    const home = launch.command.indexOf('/home/test');
    const provider = launch.command.indexOf('/provider/claude');
    const run = launch.command.indexOf('/w/.cache/runs/1');
    expect(home).toBeGreaterThan(0);
    expect(provider).toBeGreaterThan(home);
    expect(run).toBeGreaterThan(provider);
    expect(launch.env).toEqual({ ...CONFIG, PATH: '/w/.cache/runs/1.bin:/usr/local/bin:/usr/bin:/bin' });
    expect(launch.paths).toEqual(
      expect.arrayContaining([{ path: '/w/.cache/runs/1', access: 'write', directory: true }]),
    );
  });

  it('mounts the whole cursor version folder but only the claude executable', () => {
    const base = disk();
    const fake = { ...base, realpath: (path: string) => `/versions/1/${path.split('/').pop() ?? ''}` };
    const cursor = {
      adapter: new CursorAgentProvider(),
      command: ['agent'],
      executable: '/home/test/.local/bin/agent',
    };
    const launch = launchFor(
      {
        sandbox: { kind: 'local' },
        command: ['agent', '-p'],
        provider: cursor,
        request: request(),
        files: [],
        config: { HOME: '/home/test', CURSOR_API_KEY: 'secret' },
      },
      fake,
    );
    expect(launch.command).toEqual(expect.arrayContaining(['--ro-bind', '/versions/1', '/versions/1']));
    expect(launch.command.slice(-2)).toEqual(['/versions/1/agent', '-p']);
    // The run tools' scripts run on choliba's own bun, which lives under the home the sandbox empties.
    expect(launch.command).toEqual(
      expect.arrayContaining(['--ro-bind', '/home/test/.bun/bin/bun', '/home/test/.bun/bin/bun']),
    );
    // bunx beside it, which the disk of this spec has (every path exists): an agent's command calls it.
    expect(launch.command).toEqual(
      expect.arrayContaining(['--ro-bind', '/home/test/.bun/bin/bunx', '/home/test/.bun/bin/bunx']),
    );
    const withoutBunx = launchFor(
      {
        sandbox: { kind: 'local' },
        command: ['agent', '-p'],
        provider: cursor,
        request: request(),
        files: [],
        config: { HOME: '/home/test', CURSOR_API_KEY: 'secret' },
      },
      { ...fake, exists: (path: string) => !path.endsWith('/bunx') },
    );
    expect(withoutBunx.command).not.toContain('/home/test/.bun/bin/bunx');
  });

  it("puts a run's tool shortcuts first on the local PATH", () => {
    const launch = launchFor(
      {
        sandbox: { kind: 'local' },
        command: ['claude'],
        provider: PROVIDER,
        request: request({ allowTools: [{ tool: 'ask', subcommands: ['*'] }] }),
        files: [],
        config: { ...CONFIG, PATH: '/usr/bin:/bin' },
      },
      disk(),
    );

    expect(launch.env?.['PATH']).toBe('/w/.cache/runs/1.bin:/usr/bin:/bin');
  });

  it("links the provider's short name in the shortcuts folder, and still runs the realpath", () => {
    const fake = disk();
    const launch = launchFor(
      {
        sandbox: { kind: 'local' },
        command: ['claude', '-p'],
        provider: PROVIDER,
        request: request(),
        files: [],
        config: CONFIG,
      },
      fake,
    );
    expect(fake.links).toEqual([['/provider/claude', '/w/.cache/runs/1.bin/claude']]);
    expect(launch.env?.['PATH']?.startsWith('/w/.cache/runs/1.bin:')).toBe(true);
    expect(launch.command.slice(-2)).toEqual(['/provider/claude', '-p']);
  });

  it('does not link a shortcut when the provider has no short name', () => {
    const input = {
      sandbox: { kind: 'local' } as const,
      command: ['claude', '-p'],
      request: request(),
      files: [],
      config: CONFIG,
    };
    for (const command of [[], ['']]) {
      const fake = disk();
      const launch = launchFor({ ...input, provider: { ...PROVIDER, command } }, fake);
      expect(fake.links).toEqual([]);
      expect(launch.command.slice(-2)).toEqual(['/provider/claude', '-p']);
    }
  });

  it('refuses a broken provider link and a missing credential with actionable messages', () => {
    const broken = {
      ...disk(),
      realpath: () => {
        throw new Error('broken link');
      },
    };
    const input = {
      sandbox: { kind: 'local' } as const,
      command: ['claude'],
      provider: PROVIDER,
      request: request(),
      files: [],
      config: CONFIG,
    };
    expect(() => launchFor(input, broken)).toThrow('O provider local não foi encontrado: claude.');
    expect(() => launchFor({ ...input, provider: { ...PROVIDER, command: [] } }, broken)).toThrow(
      'O provider local não foi encontrado: comando vazio.',
    );
    expect(() => launchFor({ ...input, config: { HOME: '/home/test' } }, disk())).toThrow('claude setup-token');
  });

  it('in a container, mounts the run, the packages and the run files, and passes the credentials by name', () => {
    const fake = disk();
    const launch = launchFor(
      {
        sandbox: { kind: 'docker', image: 'choliba-agent', network: 'isolated' },
        command: ['claude', '-p'],
        provider: PROVIDER,
        request: request({ allowRead: ['docs/'], allowDelete: ['/w/app/'] }),
        files: [
          { path: '/w/.cache/runs/1.delete', content: '' },
          { path: '/w/.cache/runs/1.bin/delete', content: '' },
        ],
        config: CONFIG,
      },
      fake,
    );
    expect(launch.paths.map((path) => `${path.access} ${path.path}`)).toEqual([
      'write /w/.cache/runs/1',
      'read /w/.cache/runs/1.bin/delete',
      'read /w/.cache/runs/1.delete',
      'read /w/docs',
      'read /w/node_modules',
    ]);
    expect(launch.command.slice(0, 2)).toEqual(['docker', 'run']);
    expect(launch.command.slice(-3)).toEqual(['choliba-agent', 'claude', '-p']);
    expect(launch.command.join(' ')).toContain('--env CLAUDE_CODE_OAUTH_TOKEN');
    expect(launch.command.join(' ')).toContain('--env PATH');
    expect(launch.command.join(' ')).not.toContain('segredo');
    expect(launch.env).toMatchObject({
      CLAUDE_CODE_OAUTH_TOKEN: 'segredo',
      PATH: '/w/.cache/runs/1.bin:/usr/local/bin:/usr/bin:/bin',
    });
    expect(launch.place).toEqual({ kind: 'docker', image: 'choliba-agent', container: 'choliba-1' });
    expect(launch.command.slice(2, 5)).toEqual(['--rm', '--name', 'choliba-1']);
    expect(fake.made).toEqual([]);
  });

  it("passes the provider's own variables, its Ollama address as the container reaches this machine", () => {
    const launch = launchFor(
      {
        sandbox: { kind: 'docker', image: 'choliba-agent', network: 'isolated' },
        command: ['claude', '-p'],
        provider: { ...PROVIDER, adapter: new ClaudeOllamaAgentProvider() },
        request: request({}, { model: 'ollama:qwen3.5:4b' }),
        files: [],
        config: CONFIG,
      },
      disk(),
    );
    expect(launch.command.join(' ')).toContain('--env ANTHROPIC_BASE_URL');
    expect(launch.env).toMatchObject({
      ANTHROPIC_BASE_URL: 'http://host.docker.internal:11434',
      ANTHROPIC_AUTH_TOKEN: 'ollama',
      CLAUDE_CODE_OAUTH_TOKEN: '',
    });
  });

  it("points Codex at the run's isolated home inside the local sandbox", () => {
    const codex = {
      adapter: new CodexAgentProvider(),
      command: ['codex'],
      executable: '/provider/codex',
    };
    const launch = launchFor(
      {
        sandbox: { kind: 'local' },
        command: ['codex', 'exec'],
        provider: codex,
        request: request(),
        files: [],
        config: { HOME: '/home/test', CODEX_HOME: '/home/test/.codex' },
      },
      disk(),
    );

    expect(launch.env).toMatchObject({ CODEX_HOME: '/w/.cache/runs/1/.codex' });
    expect(launch.command.slice(-2)).toEqual(['/provider/codex', 'exec']);
  });

  it("mounts Codex's npm launcher and native platform package in the local sandbox", () => {
    const codex = {
      adapter: new CodexAgentProvider(),
      command: ['codex'],
      executable: '/home/test/.bun/bin/codex',
    };
    const fake = {
      ...disk(),
      realpath: () => '/home/test/.bun/install/global/node_modules/@openai/codex/bin/codex.js',
    };
    const launch = launchFor(
      {
        sandbox: { kind: 'local' },
        command: ['codex', 'exec'],
        provider: codex,
        request: request(),
        files: [],
        config: { HOME: '/home/test', CODEX_HOME: '/home/test/.codex' },
      },
      fake,
    );

    expect(launch.command).toEqual(
      expect.arrayContaining([
        '--ro-bind',
        '/home/test/.bun/install/global/node_modules/@openai',
        '/home/test/.bun/install/global/node_modules/@openai',
      ]),
    );
    expect(launch.command.slice(-2)).toEqual([
      '/home/test/.bun/install/global/node_modules/@openai/codex/bin/codex.js',
      'exec',
    ]);
  });

  it("opens the browser tools' output and the project's ticket-runs for writing, creating them first", () => {
    const fake = disk();
    const launch = launchFor(
      {
        sandbox: { kind: 'docker', image: 'choliba-agent', network: 'isolated' },
        command: ['claude'],
        provider: PROVIDER,
        request: request(
          { allowTools: [{ tool: 'playwright-cli', subcommands: ['*'] }] },
          {
            project: {
              name: 'loja',
              baseURL: 'http://localhost:3000',
              agentBaseURL: 'http://host.docker.internal:3000',
              appDir: '/app',
            },
          },
        ),
        files: [],
        config: CONFIG,
      },
      fake,
    );
    expect(fake.made).toEqual(['/w/.cache/playwright-cli', '/g/projects/loja/ticket-runs']);
    expect(launch.paths).toEqual(
      expect.arrayContaining([
        { path: '/w/.cache/playwright-cli', access: 'write', directory: true },
        { path: '/g/projects/loja/ticket-runs', access: 'write', directory: true },
      ]),
    );
  });
});

describe('launchFor — CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR', () => {
  it('takes an absolute output folder as it is', () => {
    const fake = disk();
    launchFor(
      {
        sandbox: { kind: 'docker', image: 'choliba-agent', network: 'isolated' },
        command: ['claude'],
        provider: PROVIDER,
        request: request({ allowTools: [{ tool: 'playwright-trace', subcommands: ['*'] }] }),
        files: [],
        config: { CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR: '/saida' },
      },
      fake,
    );
    expect(fake.made).toEqual(['/saida']);
  });
});

describe('launchFor — the browsers of Playwright', () => {
  const TRACE = request({ allowTools: [{ tool: 'playwright-trace', subcommands: ['*'] }] });
  const BROWSERS = { path: '/home/test/.cache/ms-playwright', access: 'read', directory: true };

  /** The folders a launch mounts for `config`, in `sandbox`, for `forRequest`, on `fake`. */
  function mounted(
    config: Readonly<Record<string, string>>,
    sandbox: Parameters<typeof launchFor>[0]['sandbox'] = { kind: 'local' },
    forRequest: ProviderRequest = TRACE,
    fake: LaunchDisk = disk(),
  ): readonly unknown[] {
    return launchFor({ sandbox, command: ['claude'], provider: PROVIDER, request: forRequest, files: [], config }, fake)
      .paths;
  }

  it('gives a local run with a Playwright run tool the browsers, read-only, that its hidden home keeps', () => {
    expect(mounted(CONFIG)).toContainEqual(BROWSERS);
    // Where playwright-cli keeps the browser it left open between two commands is written, in the cache folder,
    // wherever the browsers are.
    const state = (cache: string) =>
      ['daemon', 'b'].map((folder) => ({ path: `${cache}/ms-playwright/${folder}`, access: 'write', directory: true }));
    const elsewhere = mounted({ ...CONFIG, PLAYWRIGHT_BROWSERS_PATH: '/data/browsers' });
    for (const each of state('/home/test/.cache')) expect(elsewhere).toContainEqual(each);
    const xdg = mounted({ ...CONFIG, XDG_CACHE_HOME: '/xdg' });
    for (const each of state('/xdg')) expect(xdg).toContainEqual(each);
    expect(mounted(CONFIG, { kind: 'local' }, request())).not.toContainEqual(state('/home/test/.cache')[0]);
    expect(mounted({ ...CONFIG, PLAYWRIGHT_BROWSERS_PATH: '/data/browsers' })).toContainEqual({
      ...BROWSERS,
      path: '/data/browsers',
    });
  });

  it('gives none in a container, without a Playwright run tool, with the browsers in node_modules or not there', () => {
    const missing = { ...disk(), exists: (path: string) => !path.includes('ms-playwright') };

    expect(mounted(CONFIG, { kind: 'docker', image: 'choliba-agent', network: 'isolated' })).not.toContainEqual(
      expect.objectContaining({ path: BROWSERS.path }),
    );
    expect(mounted(CONFIG, { kind: 'local' }, request())).not.toContainEqual(BROWSERS);
    expect(mounted({ ...CONFIG, PLAYWRIGHT_BROWSERS_PATH: '0' })).not.toContainEqual(
      expect.objectContaining({ access: 'read', path: expect.stringContaining('ms-playwright') as string }),
    );
    expect(mounted(CONFIG, { kind: 'local' }, TRACE, missing)).not.toContainEqual(BROWSERS);
    const { HOME: _home, ...homeless } = CONFIG;
    expect(() => mounted(homeless)).toThrow('HOME');
  });
});

describe('realDisk', () => {
  it('reads the disk, the owner of a path, and makes folders', () => {
    const tmp = makeTmpDir('real-disk');
    try {
      const folder = join(tmp.path, 'a', 'b');
      realDisk.ensureDir(folder);
      writeFileSync(join(tmp.path, 'f.txt'), 'x');
      expect(realDisk.exists(folder)).toBe(true);
      expect(realDisk.isDirectory(folder)).toBe(true);
      expect(realDisk.isDirectory(join(tmp.path, 'f.txt'))).toBe(false);
      expect(realDisk.isDirectory(join(tmp.path, 'nada'))).toBe(false);
      const { uid, gid } = statSync(tmp.path);
      expect(realDisk.owner(tmp.path)).toEqual({ uid, gid });
      const target = join(tmp.path, 'f.txt');
      const shortcut = join(folder, 'claude');
      realDisk.link(target, shortcut);
      expect(realDisk.realpath(shortcut)).toBe(realDisk.realpath(target));
      realDisk.link(target, shortcut);
      expect(realDisk.realpath(shortcut)).toBe(realDisk.realpath(target));
    } finally {
      tmp.cleanup();
    }
  });
});
