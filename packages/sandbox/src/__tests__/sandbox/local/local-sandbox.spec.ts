import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';

import {
  bwrapOnPath,
  resolverFolder,
  LocalSandbox,
  readDir,
  SandboxEnforcementError,
  type DiskFacts,
  type SandboxPermissions,
  type SandboxReach,
} from '../../../index';
import { makeTmpDir } from '../../helpers/tmp';

const NO_PERMISSIONS: SandboxPermissions = {
  allowRead: [],
  allowWrite: [],
  allowExecute: [],
  denyRead: [],
  denyWrite: [],
};

function disk(entries: readonly string[]): DiskFacts {
  const folders = new Set(entries.filter((entry) => entry.endsWith('/')).map((entry) => entry.slice(0, -1)));
  const files = new Set(entries.filter((entry) => !entry.endsWith('/')));
  return {
    exists: (path) => path === '/' || folders.has(path) || files.has(path),
    isDirectory: (path) => path === '/' || folders.has(path),
    read: (dir) =>
      [...folders, ...files]
        .filter((path) => path.startsWith(`${dir}/`) && !path.slice(dir.length + 1).includes('/'))
        .map((path) => ({ name: path.slice(dir.length + 1), isDirectory: folders.has(path) })),
  };
}

const DISK = disk([
  '/provider/claude',
  '/w/',
  '/w/.cache/',
  '/w/.cache/runs/',
  '/w/.cache/runs/1/',
  '/w/docs/',
  '/w/docs/segredo/',
  '/w/docs/nota.txt',
]);

const PROGRAM = {
  executable: '/provider/claude',
  readOnly: ['/provider/claude'],
  credentials: ['CLAUDE_CODE_OAUTH_TOKEN'],
  credentialHelp: 'defina a credencial',
};

const ENVIRONMENT = { HOME: '/home/test', CLAUDE_CODE_OAUTH_TOKEN: 'secret' };

function reach(permissions: Partial<SandboxPermissions>, more: Partial<SandboxReach> = {}): SandboxReach {
  return {
    permissions: { ...NO_PERMISSIONS, ...permissions },
    policy: 'edits',
    addDirs: [],
    runDir: '/w/.cache/runs/1',
    alsoRead: [],
    alsoWrite: [],
    ...more,
  };
}

describe('bwrapOnPath', () => {
  it('returns the first executable bwrap, and nothing when the path has none', () => {
    const saved = process.env['PATH'];
    delete process.env['PATH'];
    try {
      expect(bwrapOnPath()).toBeUndefined();
    } finally {
      process.env['PATH'] = saved;
    }
    expect(bwrapOnPath('')).toBeUndefined();
    const tmp = makeTmpDir('bwrap-path');
    try {
      const missing = join(tmp.path, 'missing');
      const plain = join(tmp.path, 'bwrap');
      writeFileSync(plain, '');
      expect(bwrapOnPath(`${delimiter}${missing}${delimiter}${tmp.path}`)).toBeUndefined();
      chmodSync(plain, 0o755);
      expect(bwrapOnPath(`${delimiter}${tmp.path}`)).toBe(plain);
    } finally {
      tmp.cleanup();
    }
  });
});

describe('LocalSandbox', () => {
  const sandbox = new LocalSandbox({ disk: DISK, bwrap: '/usr/bin/bwrap', environment: ENVIRONMENT });

  it('refuses the command when bwrap is not installed, and says how to install it', () => {
    const missing = new LocalSandbox({ disk: DISK, bwrap: undefined, environment: ENVIRONMENT });
    expect(() => missing.plan({ command: ['claude', '-p'], reach: reach({ allowRead: ['/w/docs/'] }) })).toThrow(
      SandboxEnforcementError,
    );
    expect(() => missing.plan({ command: ['claude', '-p'], reach: reach({ allowRead: ['/w/docs/'] }) })).toThrow(
      'sudo apt install bubblewrap',
    );
  });

  it('mounts the same coarse paths as the container and starts in the run folder', () => {
    const plan = sandbox.plan({
      command: ['claude', '-p'],
      program: PROGRAM,
      reach: reach({
        allowRead: ['/w/docs/'],
        allowWrite: ['/w/docs/nota.txt'],
        denyRead: ['/w/docs/segredo/'],
      }),
    });
    expect(plan.place).toEqual({ kind: 'local' });
    expect(plan.paths.map((path) => `${path.access} ${path.path}`)).toEqual([
      'write /w/.cache/runs/1',
      'write /w/docs',
      'hidden /w/docs/segredo',
    ]);
    expect(plan.skipped).toEqual([]);
    expect(plan.command.slice(0, 3)).toEqual(['/usr/bin/bwrap', '--die-with-parent', '--unshare-pid']);
    expect(plan.command).not.toContain('/run/systemd/resolve');
    expect(plan.command).toEqual(
      expect.arrayContaining([
        '--ro-bind-try',
        '/usr',
        '--bind',
        '/w/docs',
        '--bind',
        '/w/.cache/runs/1',
        '--tmpfs',
        '/w/docs/segredo',
        '--tmpfs',
        '/home/test',
        '--setenv',
        'HOME',
        '/home/test',
        '--setenv',
        'PLAYWRIGHT_MCP_SANDBOX',
        'false',
        '--ro-bind',
        '/provider/claude',
        '/provider/claude',
        '--chdir',
        '/w/.cache/runs/1',
        '--',
        '/provider/claude',
        '-p',
      ]),
    );
    expect(plan.command.slice(-5)).toEqual(['--chdir', '/w/.cache/runs/1', '--', '/provider/claude', '-p']);
    expect(plan.env).toEqual(ENVIRONMENT);
  });

  it('covers a denied file with an empty one', () => {
    const plan = sandbox.plan({
      command: ['cat'],
      program: PROGRAM,
      reach: reach({ allowRead: ['/w/docs/'], denyRead: ['/w/docs/nota.txt'] }),
    });
    const hidden = plan.command.indexOf('/w/docs/nota.txt');
    expect(plan.command.slice(hidden - 2, hidden + 1)).toEqual(['--dev-bind', '/dev/null', '/w/docs/nota.txt']);
  });

  it('mounts the resolver folder back over the empty /run, so names resolve', () => {
    const withResolver = new LocalSandbox({
      disk: DISK,
      bwrap: '/usr/bin/bwrap',
      environment: ENVIRONMENT,
      resolver: '/run/systemd/resolve',
    });
    const plan = withResolver.plan({
      command: ['claude'],
      program: PROGRAM,
      reach: reach({ allowRead: ['/w/docs/'] }),
    });
    const run = plan.command.indexOf('/run');
    expect(plan.command.slice(run - 1, run + 4)).toEqual([
      '--tmpfs',
      '/run',
      '--ro-bind-try',
      '/run/systemd/resolve',
      '/run/systemd/resolve',
    ]);
  });

  it('refuses an absent program closure and accepts any declared credential', () => {
    const absent = { ...PROGRAM, readOnly: ['/provider/missing'] };
    expect(() =>
      sandbox.plan({ command: ['claude'], program: absent, reach: reach({ allowRead: ['/w/docs/'] }) }),
    ).toThrow('O provider local não foi encontrado: claude.');
    expect(() =>
      sandbox.plan({
        command: [],
        program: { ...PROGRAM, executable: '/provider/missing' },
        reach: reach({ allowRead: ['/w/docs/'] }),
      }),
    ).toThrow('O provider local não foi encontrado: comando vazio.');

    const alternative = new LocalSandbox({
      disk: DISK,
      bwrap: '/usr/bin/bwrap',
      environment: { HOME: '/home/test', ANTHROPIC_API_KEY: 'secret' },
    });
    expect(() =>
      alternative.plan({
        command: ['claude'],
        program: { ...PROGRAM, credentials: ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY'] },
        reach: reach({ allowRead: ['/w/docs/'] }),
      }),
    ).not.toThrow();
  });

  it('asks no credential of a program that authenticates by a file of its own', () => {
    const bare = new LocalSandbox({ disk: DISK, bwrap: '/usr/bin/bwrap', environment: { HOME: '/home/test' } });
    const input = { command: ['codex'], reach: reach({ allowRead: ['/w/docs/'] }) };

    expect(() => bare.plan({ ...input, program: { ...PROGRAM, credentials: [] } })).not.toThrow();
    expect(() => bare.plan({ ...input, program: PROGRAM })).toThrow('defina a credencial');
  });

  it("puts the provider's own variables over the inherited ones, and lets them be its credential", () => {
    const withoutCredential = new LocalSandbox({
      disk: DISK,
      bwrap: '/usr/bin/bwrap',
      environment: { HOME: '/home/test', CLAUDE_CODE_OAUTH_TOKEN: '', PATH: '/usr/bin' },
    });
    const program = { ...PROGRAM, credentials: ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_AUTH_TOKEN'] };
    const input = { command: ['claude'], program, reach: reach({ allowRead: ['/w/docs/'] }) };
    expect(() => withoutCredential.plan(input)).toThrow('defina a credencial');

    const plan = withoutCredential.plan({ ...input, variables: { ANTHROPIC_AUTH_TOKEN: 'ollama', PATH: '/bin' } });
    expect(plan.env).toEqual({
      HOME: '/home/test',
      CLAUDE_CODE_OAUTH_TOKEN: '',
      PATH: '/bin',
      ANTHROPIC_AUTH_TOKEN: 'ollama',
    });
  });

  it('refuses a missing home and program with the boundary messages', () => {
    const withoutHome = new LocalSandbox({
      disk: DISK,
      bwrap: '/usr/bin/bwrap',
      environment: { CLAUDE_CODE_OAUTH_TOKEN: 'secret' },
    });
    expect(() =>
      withoutHome.plan({ command: ['claude'], program: PROGRAM, reach: reach({ allowRead: ['/w/docs/'] }) }),
    ).toThrow('O sandbox local precisa da variável HOME definida.');
    expect(() => sandbox.plan({ command: [], reach: reach({ allowRead: ['/w/docs/'] }) })).toThrow(
      'O provider local não foi encontrado: comando vazio.',
    );
  });
});

describe('LocalSandbox with bwrap', () => {
  it('does not read outside an allow, hides a deny inside it, and starts in the run folder', () => {
    const bwrap = bwrapOnPath();
    expect(bwrap).toBeDefined();
    const tmp = makeTmpDir('bwrap-run');
    try {
      const allow = join(tmp.path, 'allow');
      const secret = join(allow, 'secret');
      const outside = join(tmp.path, 'outside');
      const runDir = join(tmp.path, 'run');
      mkdirSync(secret, { recursive: true });
      mkdirSync(outside);
      mkdirSync(runDir);
      writeFileSync(join(allow, 'file.txt'), 'visible');
      writeFileSync(join(secret, 'nope.txt'), 'hidden');
      writeFileSync(join(outside, 'file.txt'), 'outside');
      const facts: DiskFacts = {
        exists: existsSync,
        isDirectory: (path) => existsSync(path) && statSync(path).isDirectory(),
        read: readDir,
      };
      const plan = new LocalSandbox({
        disk: facts,
        bwrap,
        environment: { HOME: tmp.path, CLAUDE_CODE_OAUTH_TOKEN: 'secret' },
      }).plan({
        command: [
          '/usr/bin/bash',
          '-c',
          [
            'echo PWD=$(pwd)',
            `echo ALLOW=$(cat ${allow}/file.txt)`,
            `echo SECRET=$(ls -A ${secret})`,
            `cat ${outside}/file.txt >/dev/null 2>&1 || echo OUT=missing`,
            `touch ${allow}/new.txt >/dev/null 2>&1 || echo RO=denied`,
            'touch wrote && echo WROTE',
          ].join('; '),
        ],
        program: {
          executable: '/usr/bin/bash',
          readOnly: ['/usr/bin/bash'],
          credentials: ['CLAUDE_CODE_OAUTH_TOKEN'],
          credentialHelp: 'defina a credencial',
        },
        reach: reach({ allowRead: [`${allow}/`], denyRead: [`${secret}/`] }, { policy: 'read-only', runDir }),
      });
      const result = spawnSync(plan.command[0] ?? '', plan.command.slice(1), { encoding: 'utf8' });
      expect([result.status, result.stdout, result.stderr]).toEqual([
        0,
        `PWD=${runDir}\nALLOW=visible\nSECRET=\nOUT=missing\nRO=denied\nWROTE\n`,
        '',
      ]);
      expect(result.stdout).not.toContain('hidden');
      expect(result.stdout).not.toContain('outside');
    } finally {
      tmp.cleanup();
    }
  });

  it('reads a folder mounted inside a hidden one, through a link that points into it, and nothing else there', () => {
    const bwrap = bwrapOnPath();
    expect(bwrap).toBeDefined();
    const tmp = makeTmpDir('bwrap-inside-hidden');
    try {
      const root = join(tmp.path, 'w');
      const runDir = join(root, 'run');
      mkdirSync(join(root, 'packages', 'choliba'), { recursive: true });
      mkdirSync(join(root, 'packages', 'other'), { recursive: true });
      mkdirSync(join(root, 'node_modules'), { recursive: true });
      mkdirSync(runDir);
      writeFileSync(join(root, 'packages', 'choliba', 'main.txt'), 'ran\n');
      symlinkSync('../packages/choliba', join(root, 'node_modules', 'choliba'));
      const facts: DiskFacts = {
        exists: existsSync,
        isDirectory: (path) => existsSync(path) && statSync(path).isDirectory(),
        read: readDir,
      };
      const plan = new LocalSandbox({
        disk: facts,
        bwrap,
        environment: { HOME: join(tmp.path, 'home'), CLAUDE_CODE_OAUTH_TOKEN: 'secret', PATH: '/usr/bin:/bin' },
      }).plan({
        command: ['/usr/bin/bash', '-c', `cat ${root}/node_modules/choliba/main.txt; ls ${root}/packages`],
        program: {
          executable: '/usr/bin/bash',
          readOnly: ['/usr/bin/bash'],
          credentials: ['CLAUDE_CODE_OAUTH_TOKEN'],
          credentialHelp: 'defina a credencial',
        },
        reach: reach(
          { allowRead: [root], denyRead: [join(root, 'packages')] },
          { runDir, alsoRead: [join(root, 'node_modules'), join(root, 'packages', 'choliba')] },
        ),
      });
      const result = spawnSync(plan.command[0] ?? '', plan.command.slice(1), { encoding: 'utf8', env: plan.env });
      expect([result.status, result.stdout, result.stderr]).toEqual([0, 'ran\ncholiba\n', '']);
    } finally {
      tmp.cleanup();
    }
  });

  it('follows a short-name link in a mounted shortcuts folder after home is emptied', () => {
    const bwrap = bwrapOnPath();
    expect(bwrap).toBeDefined();
    const tmp = makeTmpDir('bwrap-shortcut');
    try {
      const home = join(tmp.path, 'home');
      const version = join(home, '.local', 'share', 'agent', 'versions', '1');
      const executable = join(version, 'agent');
      const runDir = join(tmp.path, 'run');
      const shortcuts = `${runDir}.bin`;
      mkdirSync(version, { recursive: true });
      mkdirSync(runDir);
      mkdirSync(shortcuts);
      writeFileSync(executable, '#!/usr/bin/bash\necho ran\n');
      chmodSync(executable, 0o755);
      symlinkSync(executable, join(shortcuts, 'agent'));
      const facts: DiskFacts = {
        exists: existsSync,
        isDirectory: (path) => existsSync(path) && statSync(path).isDirectory(),
        read: readDir,
      };
      const plan = new LocalSandbox({
        disk: facts,
        bwrap,
        environment: { HOME: home, CLAUDE_CODE_OAUTH_TOKEN: 'secret', PATH: `${shortcuts}:/usr/bin:/bin` },
      }).plan({
        command: ['/usr/bin/bash', '-c', 'agent'],
        program: {
          executable: '/usr/bin/bash',
          readOnly: [version, '/usr/bin/bash'],
          credentials: ['CLAUDE_CODE_OAUTH_TOKEN'],
          credentialHelp: 'defina a credencial',
        },
        reach: reach({}, { runDir, alsoRead: [shortcuts] }),
      });
      const result = spawnSync(plan.command[0] ?? '', plan.command.slice(1), {
        encoding: 'utf8',
        env: plan.env,
      });
      expect([result.status, result.stdout, result.stderr]).toEqual([0, 'ran\n', '']);
    } finally {
      tmp.cleanup();
    }
  });
});

describe('resolverFolder', () => {
  it('gives the folder of the resolver configuration under /run, and nothing elsewhere or when it cannot be read', () => {
    expect(resolverFolder(() => '/run/systemd/resolve/stub-resolv.conf')).toBe('/run/systemd/resolve');
    expect(resolverFolder(() => '/etc/resolv.conf')).toBeUndefined();
    expect(
      resolverFolder(() => {
        throw new Error('ENOENT');
      }),
    ).toBeUndefined();
    expect(['string', 'undefined']).toContain(typeof resolverFolder());
  });
});
