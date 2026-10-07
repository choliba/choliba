import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { clearCursorState, cursorProjectSlug, cursorStatePaths } from '../../../providers/cursor/cursor-state';
import { makeTmpDir } from '../../helpers/tmp';

// A real run dir and what cursor-agent 2026.10.01 left for it under /home/jackson/.cursor.
const RUN_DIR = '/home/jackson/dev/ferramenta/.cache/runs/2026-10-07T08-32-39.223Z-1088051';
const PROJECT = 'home-jackson-dev-ferramenta-cache-runs-2026-10-07T08-32-39-223Z-1088051';

describe('cursorProjectSlug', () => {
  it('turns every run of non-alphanumerics into one dash, without dashes at the ends', () => {
    expect(cursorProjectSlug(RUN_DIR)).toBe(PROJECT);
    expect(cursorProjectSlug('/a//b./')).toBe('a-b');
  });
});

describe('cursorStatePaths', () => {
  it('names the project, the shortened socket folder and the chats cursor keeps for the run dir', () => {
    expect(cursorStatePaths(RUN_DIR, {}, '/home/jackson')).toEqual([
      `/home/jackson/.cursor/projects/${PROJECT}`,
      '/home/jackson/.cursor/projects/home-jackson-dev-ferramenta-cache-runs-2026-10-07T08--e0080fb',
      '/home/jackson/.cursor/chats/af71a120b41eb8b7327da547d1ea1ae5',
    ]);
  });

  it('keeps the socket in the project folder when its path is short enough', () => {
    expect(cursorStatePaths('/w', {}, '/h')).toEqual([
      '/h/.cursor/projects/w',
      expect.stringMatching(/^\/h\/.cursor\/chats\//),
    ]);
  });

  it('follows CURSOR_DATA_DIR and CURSOR_CONFIG_DIR', () => {
    const paths = cursorStatePaths('/w', { CURSOR_DATA_DIR: '/data', CURSOR_CONFIG_DIR: '/config' }, '/h');

    expect(paths[0]).toBe('/data/projects/w');
    expect(paths[1]).toMatch(/^\/config\/chats\/[0-9a-f]{32}$/);
  });

  it('keeps the chats under XDG_CONFIG_HOME when it is set, and ignores blank variables', () => {
    const paths = cursorStatePaths(
      '/w',
      { CURSOR_DATA_DIR: ' ', CURSOR_CONFIG_DIR: '', XDG_CONFIG_HOME: '/xdg' },
      '/h',
    );

    expect(paths[0]).toBe('/h/.cursor/projects/w');
    expect(paths[1]).toMatch(/^\/xdg\/cursor\/chats\//);
  });

  it('moves the socket out of a data dir too long for it', () => {
    const data = `/${'d'.repeat(80)}`;
    const deep = `/${'e'.repeat(90)}`;

    expect(cursorStatePaths('/w', { CURSOR_DATA_DIR: data }, '/h')).toContain(`${data}/w`);
    expect(cursorStatePaths('/w', { CURSOR_DATA_DIR: deep }, '/h')).toContain('/tmp/.cursor/w');
  });
});

describe('clearCursorState', () => {
  it("removes only what cursor kept for the run dir, and nothing else of the user's", () => {
    const tmp = makeTmpDir('cursor-state');
    try {
      const env = { CURSOR_DATA_DIR: tmp.path, CURSOR_CONFIG_DIR: tmp.path };
      const kept = [join(tmp.path, 'projects', 'other'), join(tmp.path, 'cli-config.json')];
      const [project, chats] = cursorStatePaths('/w', env);
      mkdirSync(join(project ?? '', 'agent-transcripts'), { recursive: true });
      mkdirSync(chats ?? '', { recursive: true });
      mkdirSync(kept[0] ?? '');
      writeFileSync(kept[1] ?? '', '{}');

      clearCursorState('/w', env);

      expect([project, chats].filter((path) => existsSync(path ?? ''))).toEqual([]);
      expect(kept.every((path) => existsSync(path))).toBe(true);
      expect(() => {
        clearCursorState('/w', env);
      }).not.toThrow();
    } finally {
      tmp.cleanup();
    }
  });
});
