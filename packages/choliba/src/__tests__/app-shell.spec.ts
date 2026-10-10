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
    expect(shell.has('tests')).toBe(true);
    expect(shell.has('terminal')).toBe(true);
    expect(shell.fallback).toBeDefined();
    for (const word of ['projects', 'check', 'lint', 'format', 'setup', '__complete']) {
      expect(shell.has(word)).toBe(false);
    }
  });

  it('runs a command that left Nest, through the shell', async () => {
    const platform = fakePlatform({ argv: ['tests', '--help'] });

    await expect(createCholibaShell(platform).run()).resolves.toBe(0);
    expect(platform.stdout.text()).toContain('Usage:  choliba tests');
  });
});
