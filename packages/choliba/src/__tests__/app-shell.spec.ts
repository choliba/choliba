import { fakePlatform } from '@choliba/core/testing';

import { CHOLIBA_SHELL, createCholibaShell } from '../app-shell';

describe('the choliba shell', () => {
  it('lists every package once, in a fixed order, the app last', () => {
    expect(CHOLIBA_SHELL.map((module) => module.name)).toEqual([
      '@choliba/core',
      '@choliba/agents',
      '@choliba/projects',
      '@choliba/runner',
      '@choliba/terminal',
      'choliba',
    ]);
  });

  it('runs terminal from the shell and leaves the other commands on Nest', () => {
    const shell = createCholibaShell(fakePlatform());

    expect(shell.has('terminal')).toBe(true);
    for (const word of ['agents', 'projects', 'tests', 'check', 'lint', 'format', 'setup', '__complete']) {
      expect(shell.has(word)).toBe(false);
    }
    expect(shell.entries()).toEqual([]);
  });
});
