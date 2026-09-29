import { readAgentPermissions } from '../../../permissions';
import { cursorPermissions, shellToken } from '../../../providers/cursor/permissions';

const DECLARED = readAgentPermissions({
  allow: { read: ['src/'], write: ['docs/', 'README.md'], execute: { './': ['git diff'] } },
  deny: { read: ['/etc/passwd'], write: ['packages/'], execute: { './': ['prettier', 'bun run format'] } },
});

describe('shellToken', () => {
  it('uses the first word, with the rest as word:args', () => {
    expect(shellToken('prettier')).toBe('Shell(prettier)');
    expect(shellToken(' bun  run format ')).toBe('Shell(bun:run format*)');
  });
});

describe('cursorPermissions', () => {
  it('anchors paths at the workspace root and maps commands to Shell tokens', () => {
    expect(cursorPermissions(DECLARED, 'edits', '/repo')).toEqual({
      allow: [
        'Read(/repo/src/**)',
        'Write(/repo/docs/**)',
        'Write(/repo/README.md)',
        'Shell(git:diff*)',
        'Shell(cd:/repo)',
      ],
      deny: ['Read(/etc/passwd)', 'Write(/repo/packages/**)', 'Shell(prettier)', 'Shell(bun:run format*)'],
    });
  });

  it('allows every tool of an MCP server, or only the tools it lists', () => {
    const servers = [
      { name: 'browser', config: { command: 'x' }, path: '/b.json' },
      { name: 'app', config: { command: 'y' }, path: '/a.json', tools: ['jira_search', 'use_environment'] },
    ];

    expect(cursorPermissions(DECLARED, 'read-only', '/repo', servers).allow).toEqual([
      'Read(/repo/src/**)',
      'Shell(git:diff*)',
      'Shell(cd:/repo)',
      'Mcp(browser:*)',
      'Mcp(app:jira_search)',
      'Mcp(app:use_environment)',
    ]);
  });

  it('allows cd into the workspace root only to an agent that may run commands, since cursor prefixes them with it', () => {
    expect(cursorPermissions({ ...DECLARED, allowExecute: [] }, 'edits', '/repo').allow).not.toContain(
      'Shell(cd:/repo)',
    );
    expect(cursorPermissions(DECLARED, 'edits', '/outro/lugar').allow).toContain('Shell(cd:/outro/lugar)');
  });

  it('drops the write allowances in read-only runs but keeps every deny', () => {
    const permissions = cursorPermissions(DECLARED, 'read-only', '/repo');

    expect(permissions.allow).toEqual(['Read(/repo/src/**)', 'Shell(git:diff*)', 'Shell(cd:/repo)']);
    expect(permissions.deny).toContain('Write(/repo/packages/**)');
  });

  it('allows cd into each directory execute names, once, and blocks the cd into a directory denied whole', () => {
    const permissions = readAgentPermissions({
      allow: { execute: { './': ['a'], '/app/': ['composer test', 'a'], '/repo/': ['b'] } },
      deny: { execute: { '/etc/': ['*'], 'tmp/': ['*'] } },
    });

    expect(cursorPermissions(permissions, 'edits', '/repo')).toEqual({
      allow: ['Shell(a)', 'Shell(composer:test*)', 'Shell(b)', 'Shell(cd:/repo)', 'Shell(cd:/app)'],
      deny: ['Shell(cd:/etc)', 'Shell(cd:/repo/tmp)'],
    });
  });
});
