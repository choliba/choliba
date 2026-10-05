import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { absolutePermissions, readAgentPermissions } from '../../../runs/permissions';
import type { DirEntry, ReadDir } from '../../../providers/cursor/permissions';
import { complementOf, cursorPermissions, readDir, shellToken } from '../../../providers/cursor/permissions';
import { activeRunTools, runToolCommands } from '../../../runs/run-tools/run-tools';
import { makeTmpDir } from '../../helpers/tmp';

const ROOT = '/repo';
const RUN_DIR = '/repo/.cache/runs/x';

const dir = (name: string): DirEntry => ({ name, isDirectory: true });
const file = (name: string): DirEntry => ({ name, isDirectory: false });

/** A small disk: the workspace `/repo`, its run dir, and a few folders around it. */
const DISK: Readonly<Record<string, readonly DirEntry[]>> = {
  '/': [dir('etc'), dir('home'), dir('repo')],
  '/repo': [dir('.cache'), dir('docs'), dir('packages'), dir('src'), file('README.md'), file('secret.txt')],
  '/repo/.cache': [dir('other'), dir('runs')],
  '/repo/.cache/runs': [dir('old'), dir('x')],
};

const fakeDisk: ReadDir = (path) => DISK[path] ?? [];

const DECLARED = absolutePermissions(
  readAgentPermissions({
    allow: { read: ['src/'], write: ['docs/', 'README.md'], execute: { './': ['git diff'] } },
    deny: { read: ['/etc/passwd'], write: ['packages/'], execute: { './': ['prettier', 'bun run format'] } },
  }),
  ROOT,
);

/** The complement of `kept` on the fake disk, as `kind` tokens. */
function denied(kind: 'Read' | 'Write', kept: readonly string[]): readonly string[] {
  return complementOf(kept, fakeDisk).map((path) => `${kind}(${path.endsWith('/') ? `${path}**` : path})`);
}

describe('shellToken', () => {
  it('uses the first word, with the rest as word:args', () => {
    expect(shellToken('prettier')).toBe('Shell(prettier)');
    expect(shellToken(' bun  run format ')).toBe('Shell(bun:run format*)');
  });
});

describe('complementOf', () => {
  it('lists, in each folder from / down to a kept path, every entry that leads to none', () => {
    expect(complementOf([RUN_DIR, '/repo/src', '/repo/README.md'], fakeDisk)).toEqual([
      '/etc/',
      '/home/',
      '/repo/.cache/other/',
      '/repo/.cache/runs/old/',
      '/repo/docs/',
      '/repo/packages/',
      '/repo/secret.txt',
    ]);
  });

  it('keeps everything under a kept folder, even another kept path inside it', () => {
    expect(complementOf(['/repo', RUN_DIR], fakeDisk)).toEqual(['/etc/', '/home/']);
  });
});

describe('readDir', () => {
  it('reads a real folder, telling folders from files, and nothing from one that does not exist', () => {
    const tmp = makeTmpDir('cursor-readdir');
    try {
      mkdirSync(join(tmp.path, 'sub'));
      writeFileSync(join(tmp.path, 'a.txt'), 'a');

      expect([...readDir(tmp.path)].sort((a, b) => a.name.localeCompare(b.name))).toEqual([file('a.txt'), dir('sub')]);
      expect(readDir(join(tmp.path, 'nope'))).toEqual([]);
    } finally {
      tmp.cleanup();
    }
  });
});

describe('cursorPermissions', () => {
  it('allows what is declared, and denies the rest of the disk for reading and writing', () => {
    expect(cursorPermissions(DECLARED, 'edits', ROOT, RUN_DIR, [], fakeDisk)).toEqual({
      allow: [
        'Read(/repo/src/**)',
        'Write(/repo/docs/**)',
        'Write(/repo/README.md)',
        'Shell(git:diff*)',
        `Shell(cd:${RUN_DIR})`,
      ],
      deny: [
        'Read(/etc/passwd)',
        'Write(/repo/packages/**)',
        'Shell(prettier)',
        'Shell(bun:run format*)',
        ...denied('Read', [RUN_DIR, '/repo/src']),
        ...denied('Write', [RUN_DIR, '/repo/docs', '/repo/README.md']),
      ],
    });
  });

  it('drops the write allowances in read-only runs, so writing is denied everywhere but the run dir', () => {
    const permissions = cursorPermissions(DECLARED, 'read-only', ROOT, RUN_DIR, [], fakeDisk);

    expect(permissions.allow).toEqual(['Read(/repo/src/**)', 'Shell(git:diff*)', `Shell(cd:${RUN_DIR})`]);
    expect(permissions.deny).toEqual(expect.arrayContaining([...denied('Write', [RUN_DIR])]));
    expect(permissions.deny).toContain('Write(/repo/docs/**)');
  });

  it('keeps the folder before a glob, since cursor cannot deny around one', () => {
    const permissions = readAgentPermissions({ allow: { read: ['/repo/docs/*.md'] } });

    expect(cursorPermissions(permissions, 'edits', ROOT, RUN_DIR, [], fakeDisk).deny).not.toContain(
      'Read(/repo/docs/**)',
    );
  });

  it('allows every tool of an MCP server, or only the tools it lists', () => {
    const servers = [
      { name: 'browser', config: { command: 'x' }, path: '/b.json' },
      { name: 'app', config: { command: 'y' }, path: '/a.json', tools: ['jira_search', 'use_environment'] },
    ];

    expect(cursorPermissions(DECLARED, 'read-only', ROOT, RUN_DIR, servers, fakeDisk).allow).toEqual([
      'Read(/repo/src/**)',
      'Shell(git:diff*)',
      `Shell(cd:${RUN_DIR})`,
      'Mcp(browser:*)',
      'Mcp(app:jira_search)',
      'Mcp(app:use_environment)',
    ]);
  });

  it('allows cd into the run dir and each other folder execute names, and none to an agent that runs nothing', () => {
    const permissions = absolutePermissions(
      readAgentPermissions({
        allow: { execute: { './': ['a'], '/app/': ['composer test', 'a'], '/repo/': ['b'] } },
        deny: { execute: { '/etc/': ['*'], 'tmp/': ['*'] } },
      }),
      ROOT,
    );
    const noCommands = cursorPermissions({ ...DECLARED, allowExecute: [] }, 'edits', ROOT, RUN_DIR, [], fakeDisk);

    expect(cursorPermissions(permissions, 'edits', ROOT, RUN_DIR, [], fakeDisk).allow).toEqual([
      'Shell(a)',
      'Shell(composer:test*)',
      'Shell(b)',
      `Shell(cd:${RUN_DIR})`,
      'Shell(cd:/app)',
    ]);
    expect(cursorPermissions(permissions, 'edits', ROOT, RUN_DIR, [], fakeDisk).deny).toEqual(
      expect.arrayContaining(['Shell(cd:/etc)', 'Shell(cd:/repo/tmp)']),
    );
    expect(noCommands.allow.some((token) => token.startsWith('Shell(cd:'))).toBe(false);
  });

  it('reads the real disk when no reader is given', () => {
    const permissions = cursorPermissions(DECLARED, 'edits', ROOT, RUN_DIR);

    expect(permissions.deny.length).toBeGreaterThan(4);
  });

  it('allows each run tool by its script and cd into the run dir, and denies its denied subcommands and writing it', () => {
    const declared = absolutePermissions(
      readAgentPermissions({
        allow: { delete: ['/repo/src/'], tools: { 'playwright-trace': ['open'] } },
        deny: { tools: { 'playwright-trace': ['snapshot'] } },
      }),
      ROOT,
    );
    const tools = runToolCommands(activeRunTools(declared, RUN_DIR, 'edits'));
    const permissions = cursorPermissions(declared, 'edits', ROOT, RUN_DIR, [], fakeDisk, tools);

    expect(permissions.allow).toEqual([
      `Shell(${RUN_DIR}.delete)`,
      `Shell(${RUN_DIR}.playwright-trace:open*)`,
      `Shell(cd:${RUN_DIR})`,
    ]);
    expect(permissions.deny).toEqual(
      expect.arrayContaining([
        `Write(${RUN_DIR}.delete)`,
        `Write(${RUN_DIR}.playwright-trace)`,
        `Shell(${RUN_DIR}.playwright-trace:snapshot*)`,
      ]),
    );
  });

  it('has no delete tool in a read-only run', () => {
    const declared = absolutePermissions(
      readAgentPermissions({ allow: { delete: ['/repo/src/'], read: ['src/'] } }),
      ROOT,
    );
    const tools = runToolCommands(activeRunTools(declared, RUN_DIR, 'read-only'));
    const permissions = cursorPermissions(declared, 'read-only', ROOT, RUN_DIR, [], fakeDisk, tools);

    expect(permissions.allow).toEqual(['Read(/repo/src/**)']);
    expect([...permissions.allow, ...permissions.deny].join(' ')).not.toContain('.delete');
  });
});
