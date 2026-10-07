import {
  NO_PERMISSIONS,
  absolutePermissions,
  allowedCommands,
  canRead,
  outsideExecuteDirs,
  pathBase,
  blocksEveryCommand,
  formatPermissions,
  mapPermissions,
  pathGlob,
  permissionTexts,
  readAgentPermissions,
  withoutTrailingSlash,
} from '../../runs/permissions';

const DELEGATION =
  'You may not delegate: no subagents (Agent/Task tools), no parallel sessions, no other agent working for you. If you are stuck, stop and report.';

const DECLARED = readAgentPermissions({
  allow: {
    read: ['src/'],
    write: ['docs/'],
    delete: ['app/'],
    execute: { './': ['git diff', 'bunx choliba tests'], '/app/': ['git diff', 'composer test'] },
    tools: { 'playwright-cli': ['*'], 'playwright-trace': ['open'] },
  },
  deny: {
    read: ['.env'],
    write: ['packages/'],
    delete: ['app/secrets/'],
    execute: { '/etc/': ['*'], './': ['git push'] },
    tools: { 'playwright-cli': ['eval'] },
  },
});

describe('readAgentPermissions', () => {
  it('reads every list of allow and deny, execute as one rule per directory', () => {
    expect(DECLARED).toEqual({
      allowRead: ['src/'],
      allowWrite: ['docs/'],
      allowDelete: ['app/'],
      allowExecute: [
        { dir: './', commands: ['git diff', 'bunx choliba tests'] },
        { dir: '/app/', commands: ['git diff', 'composer test'] },
      ],
      allowTools: [
        { tool: 'playwright-cli', subcommands: ['*'] },
        { tool: 'playwright-trace', subcommands: ['open'] },
      ],
      denyRead: ['.env'],
      denyWrite: ['packages/'],
      denyDelete: ['app/secrets/'],
      denyExecute: [
        { dir: '/etc/', commands: ['*'] },
        { dir: './', commands: ['git push'] },
      ],
      denyTools: [{ tool: 'playwright-cli', subcommands: ['eval'] }],
    });
  });

  it('allows nothing when permissions are absent, empty or partial', () => {
    expect(readAgentPermissions(undefined)).toEqual(NO_PERMISSIONS);
    expect(readAgentPermissions({})).toEqual(NO_PERMISSIONS);
    expect(readAgentPermissions({ allow: { read: ['a'] }, deny: 'x' })).toEqual({
      ...NO_PERMISSIONS,
      allowRead: ['a'],
    });
    expect(readAgentPermissions({ allow: { execute: { './': 'git' } } }).allowExecute).toEqual([
      { dir: './', commands: [] },
    ]);
    expect(readAgentPermissions({ allow: { tools: { 'playwright-cli': 'x' } } }).allowTools).toEqual([
      { tool: 'playwright-cli', subcommands: [] },
    ]);
  });
});

describe('mapPermissions and permissionTexts', () => {
  it('change and list every path, directory, command and subcommand, never a tool name', () => {
    const upper = mapPermissions(DECLARED, (text) => text.toUpperCase());

    expect(upper.allowExecute[1]).toEqual({ dir: '/APP/', commands: ['GIT DIFF', 'COMPOSER TEST'] });
    expect(upper.denyExecute[0]).toEqual({ dir: '/ETC/', commands: ['*'] });
    expect(upper.allowTools[1]).toEqual({ tool: 'playwright-trace', subcommands: ['OPEN'] });
    expect(permissionTexts(upper)).toEqual([
      'SRC/',
      'DOCS/',
      'APP/',
      './',
      'GIT DIFF',
      'BUNX CHOLIBA TESTS',
      '/APP/',
      'GIT DIFF',
      'COMPOSER TEST',
      '*',
      'OPEN',
      '.ENV',
      'PACKAGES/',
      'APP/SECRETS/',
      '/ETC/',
      '*',
      './',
      'GIT PUSH',
      'EVAL',
    ]);
  });
});

describe('allowedCommands and blocksEveryCommand', () => {
  it('list each allowed command once, and tell a deny of everything', () => {
    expect(allowedCommands(DECLARED)).toEqual(['git diff', 'bunx choliba tests', 'composer test']);
    expect(DECLARED.denyExecute.map(blocksEveryCommand)).toEqual([true, false]);
  });
});

describe('formatPermissions', () => {
  it('writes each list for the model, in the order allow then deny', () => {
    expect(formatPermissions(DECLARED)).toBe(
      [
        '<permissions>',
        'Enforced by the command, not only asked: anything not allowed below is blocked. Relative paths are relative to the workspace root; paths ending in / cover everything under them.',
        'You may read:',
        '- src/',
        'You may write:',
        '- docs/',
        'You may delete:',
        '- app/',
        'You may run:',
        '- in ./: git diff, bunx choliba tests',
        '- in /app/: git diff, composer test',
        'You may not read:',
        '- .env',
        'You may not write:',
        '- packages/',
        'You may not delete:',
        '- app/secrets/',
        'You may not run:',
        '- in /etc/: every command',
        '- in ./: git push',
        'Run each command exactly as listed, from where you are (a folder inside the workspace, where it works as is):',
        'chaining listed commands with && works, but any other part (cd, a pipe, a redirection, another program) gets the whole command refused.',
        DELEGATION,
        '</permissions>',
      ].join('\n'),
    );
  });

  it('ends with the run tools it is given, which alone are enough to allow something', () => {
    const place = { runDir: '/w/.cache/runs/x', root: '/w' };
    const text = formatPermissions(DECLARED, place, ['Tools: …', '- `x.delete <path…>`']);
    expect(text.split('\n').slice(-4)).toEqual(['Tools: …', '- `x.delete <path…>`', DELEGATION, '</permissions>']);

    const onlyTools = formatPermissions(NO_PERMISSIONS, place, ['Tools: …']);
    expect(onlyTools).not.toContain('Nothing is allowed');
    expect(onlyTools).not.toContain('Run each command exactly as listed');
  });

  it('says that nothing is allowed when nothing is declared', () => {
    expect(formatPermissions(NO_PERMISSIONS)).toContain('Nothing is allowed');
  });

  it('tells every agent it may not delegate, whatever it may do', () => {
    expect(formatPermissions(NO_PERMISSIONS).split('\n').slice(-2)).toEqual([DELEGATION, '</permissions>']);
    expect(formatPermissions(DECLARED)).toContain(DELEGATION);
  });
});

describe('pathGlob', () => {
  it('turns a directory into everything under it and keeps anything else', () => {
    expect(pathGlob('docs/')).toBe('docs/**');
    expect(pathGlob('README.md')).toBe('README.md');
    expect(pathGlob('tsconfig*.json')).toBe('tsconfig*.json');
  });
});

describe('withoutTrailingSlash', () => {
  it('drops the trailing slash of a directory, but keeps the root', () => {
    expect(withoutTrailingSlash('/app/')).toBe('/app');
    expect(withoutTrailingSlash('/app')).toBe('/app');
    expect(withoutTrailingSlash('/')).toBe('/');
  });
});

describe('absolutePermissions', () => {
  it('makes every path and directory absolute from the workspace root, leaving commands alone', () => {
    const absolute = absolutePermissions(DECLARED, '/w');

    expect(absolute.allowRead).toEqual(['/w/src/']);
    expect(absolute.denyRead).toEqual(['/w/.env']);
    expect(absolute.allowExecute).toEqual([
      { dir: '/w/', commands: ['git diff', 'bunx choliba tests'] },
      { dir: '/app/', commands: ['git diff', 'composer test'] },
    ]);
  });
});

describe('outsideExecuteDirs and canRead', () => {
  const permissions = absolutePermissions(
    readAgentPermissions({
      allow: {
        read: ['/app/', 'LICENSE'],
        execute: { './': ['a'], '/app/sub/': ['b'], '/app': ['c'], '/other/': ['d'] },
      },
    }),
    '/w',
  );

  it('lists the directories execute names other than the workspace root, once', () => {
    expect(outsideExecuteDirs(permissions, '/w/')).toEqual(['/app/sub', '/app', '/other']);
  });

  it('tells a directory inside a readable folder from one that is not', () => {
    expect(['/app', '/app/sub', '/other', '/w'].map((dir) => canRead(permissions, dir))).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});

describe('pathBase', () => {
  it('is the part before the first glob segment, or the folder of a plain path', () => {
    expect(pathBase('/p/*/tickets/')).toBe('/p');
    expect(pathBase('/p/demo/tickets/')).toBe('/p/demo/tickets');
    expect(pathBase('/p/demo/config.json')).toBe('/p/demo');
    expect(pathBase('/*.md')).toBe('/');
    expect(pathBase('/')).toBe('/');
  });
});

describe('formatPermissions with the place of the run', () => {
  it('names the folder the run happens in and the workspace root, so the model runs commands without cd', () => {
    expect(formatPermissions(DECLARED, { runDir: '/w/.cache/runs/x', root: '/w' })).toContain(
      'You run in /w/.cache/runs/x, an empty folder inside the workspace /w. Run each command exactly as listed, from there',
    );
  });
});
