import { statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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
      supportedModels: [],
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

/** Every path exists, as a folder unless it has a dot in its last part; records the folders made. */
function disk(): LaunchDisk & { readonly made: string[] } {
  const made: string[] = [];
  return {
    made,
    exists: () => true,
    isDirectory: (path) => !/\.[^/]*$/.test(path.split('/').pop() ?? ''),
    read: () => [],
    owner: () => ({ uid: 1000, gid: 1000 }),
    ensureDir: (path) => {
      made.push(path);
    },
  };
}

const CONFIG = { CHOL_GLOBAL_DIR: '/g', CHOL_PROJECTS_DIR: '/g/projects', CLAUDE_CODE_OAUTH_TOKEN: 'segredo' };

describe('launchFor', () => {
  it('starts the command as it is on this machine', () => {
    expect(
      launchFor({ sandbox: { kind: 'local' }, command: ['claude', '-p'], request: request(), files: [], config: {} }),
    ).toEqual({ command: ['claude', '-p'], mounts: [], skipped: [] });
  });

  it('in a container, mounts the run, the packages and the run files, and passes the credentials by name', () => {
    const fake = disk();
    const launch = launchFor(
      {
        sandbox: { kind: 'docker', image: 'choliba-agent' },
        command: ['claude', '-p'],
        request: request({ allowRead: ['docs/'] }),
        files: [{ path: '/w/.cache/runs/1.delete', content: '' }],
        config: CONFIG,
      },
      fake,
    );
    expect(launch.mounts.map((mount) => `${mount.access} ${mount.path}`)).toEqual([
      'write /w/.cache/runs/1',
      'read /w/.cache/runs/1.delete',
      'read /w/docs',
      'read /w/node_modules',
    ]);
    expect(launch.command.slice(0, 2)).toEqual(['docker', 'run']);
    expect(launch.command.slice(-3)).toEqual(['choliba-agent', 'claude', '-p']);
    expect(launch.command.join(' ')).toContain('--env CLAUDE_CODE_OAUTH_TOKEN');
    expect(launch.command.join(' ')).not.toContain('segredo');
    expect(launch.env).toMatchObject({ CLAUDE_CODE_OAUTH_TOKEN: 'segredo' });
    expect(fake.made).toEqual([]);
  });

  it("opens the browser tools' output and the project's ticket-runs for writing, creating them first", () => {
    const fake = disk();
    const launch = launchFor(
      {
        sandbox: { kind: 'docker', image: 'choliba-agent' },
        command: ['claude'],
        request: request(
          { allowTools: [{ tool: 'playwright-cli', subcommands: ['*'] }] },
          { project: { name: 'loja', baseURL: 'http://localhost:3000', appDir: '/app' } },
        ),
        files: [],
        config: CONFIG,
      },
      fake,
    );
    expect(fake.made).toEqual(['/w/.cache/playwright-cli', '/g/projects/loja/ticket-runs']);
    expect(launch.mounts).toEqual(
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
        sandbox: { kind: 'docker', image: 'choliba-agent' },
        command: ['claude'],
        request: request({ allowTools: [{ tool: 'playwright-trace', subcommands: ['*'] }] }),
        files: [],
        config: { CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR: '/saida' },
      },
      fake,
    );
    expect(fake.made).toEqual(['/saida']);
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
    } finally {
      tmp.cleanup();
    }
  });
});
