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

  it('runs the commands that left Nest, and has the fallback for `choliba <agent>`', () => {
    const shell = createCholibaShell(fakePlatform());

    expect(shell.has('agents')).toBe(true);
    expect(shell.fallback).toBeDefined();
    for (const word of ['projects', 'tests', 'terminal', 'check', 'lint', 'format', 'setup', '__complete']) {
      expect(shell.has(word)).toBe(false);
    }
  });
});
