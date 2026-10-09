import { absolutePermissions, readAgentPermissions } from '../../common/agent-permissions';
import type { DirEntry, ReadDir } from '../../common/resolve-denies';
import { claudePermissionArgs } from '../../providers/claude/claude-permissions';
import { cursorPermissions } from '../../providers/cursor/cursor-permissions';

const dir = (name: string): DirEntry => ({ name, isDirectory: true });
const file = (name: string): DirEntry => ({ name, isDirectory: false });

/** A workspace like dev-tools, `/w`, with its skills, and the app the agent works on, `/t`. */
const DISK: Readonly<Record<string, readonly DirEntry[]>> = {
  '/': [dir('t'), dir('w')],
  '/w': [dir('.cache'), dir('.choliba'), file('.env')],
  '/w/.choliba': [dir('agents'), dir('skills')],
  '/w/.choliba/skills': [dir('other'), dir('react-vite')],
};

const fakeDisk: ReadDir = (path) => DISK[path] ?? [];

const SKILL = '/w/.choliba/skills/react-vite/';

/** The developer agent of dev-tools: the whole workspace denied for reading, but its skill. */
const PERMISSIONS = absolutePermissions(
  readAgentPermissions({
    allow: { read: [SKILL, '/t/'] },
    deny: { read: ['/w', `!${SKILL}`] },
  }),
  '/w',
);

describe('the same agent.yaml in every provider', () => {
  it('reads the skill under a denied workspace, and nothing else of it, in Claude and in Cursor', () => {
    const claude = claudePermissionArgs(PERMISSIONS, 'edits', [], { allow: [], deny: [], scripts: [] }, fakeDisk);
    const cursor = cursorPermissions(PERMISSIONS, 'edits', '/w', '/w/.cache/runs/x', [], fakeDisk);
    const denied = ['/w/.choliba/agents/**', '/w/.choliba/skills/other/**', '/w/.env'];

    expect(claude.allowedTools).toContain(`Read(/${SKILL}**)`);
    expect(claude.disallowedTools).toEqual(expect.arrayContaining(denied.map((path) => `Read(/${path})`)));
    expect(claude.disallowedTools.filter((rule) => rule.startsWith('Read(//w)') || rule === 'Read(//w/**)')).toEqual(
      [],
    );

    expect(cursor.allow).toContain(`Read(${SKILL}**)`);
    expect(cursor.deny).toEqual(expect.arrayContaining(denied.map((path) => `Read(${path})`)));
    expect(cursor.deny.filter((rule) => rule === 'Read(/w)' || rule === 'Read(/w/**)')).toEqual([]);
  });
});
