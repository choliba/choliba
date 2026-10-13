import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';

import {
  bwrapOnPath,
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
  '/w/',
  '/w/.cache/',
  '/w/.cache/runs/',
  '/w/.cache/runs/1/',
  '/w/docs/',
  '/w/docs/segredo/',
  '/w/docs/nota.txt',
]);

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
  const sandbox = new LocalSandbox({ disk: DISK, bwrap: '/usr/bin/bwrap' });

  it('refuses the command when bwrap is not installed, and says how to install it', () => {
    const missing = new LocalSandbox({ disk: DISK, bwrap: undefined });
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
    expect(plan.command.slice(0, 2)).toEqual(['/usr/bin/bwrap', '--die-with-parent']);
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
        '--chdir',
        '/w/.cache/runs/1',
        '--',
        'claude',
        '-p',
      ]),
    );
    expect(plan.command.slice(-5)).toEqual(['--chdir', '/w/.cache/runs/1', '--', 'claude', '-p']);
  });

  it('covers a denied file with an empty one', () => {
    const plan = sandbox.plan({
      command: ['cat'],
      reach: reach({ allowRead: ['/w/docs/'], denyRead: ['/w/docs/nota.txt'] }),
    });
    const hidden = plan.command.indexOf('/w/docs/nota.txt');
    expect(plan.command.slice(hidden - 2, hidden + 1)).toEqual(['--dev-bind', '/dev/null', '/w/docs/nota.txt']);
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
      const plan = new LocalSandbox({ disk: facts, bwrap }).plan({
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
});
