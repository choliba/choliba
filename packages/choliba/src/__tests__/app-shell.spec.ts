import { fakePlatform } from '@choliba/core/testing';

import { CHOLIBA_SHELL, createCholibaShell } from '../app-shell';
import { RUNTIME } from '../runtime';
import { fakeRuntime } from './helpers/runtime';

describe('the choliba shell', () => {
  it('lists every package once, in a fixed order', () => {
    expect(CHOLIBA_SHELL.map((module) => module.name)).toEqual([
      '@choliba/core',
      '@choliba/agents',
      '@choliba/projects',
      '@choliba/runner',
      '@choliba/terminal',
    ]);
  });

  it('adds the app last, with the runtime it gets', () => {
    const runtime = fakeRuntime();

    expect(createCholibaShell(fakePlatform(), runtime).container.get(RUNTIME)).toBe(runtime);
  });

  it('runs the commands that left Nest, and has the fallback for `choliba <agent>`', () => {
    const shell = createCholibaShell(fakePlatform(), fakeRuntime());

    expect(shell.has('agents')).toBe(true);
    expect(shell.has('tests')).toBe(true);
    expect(shell.has('terminal')).toBe(true);
    expect(shell.has('check')).toBe(true);
    expect(shell.has('setup')).toBe(true);
    expect(shell.has('lint')).toBe(true);
    expect(shell.has('format')).toBe(true);
    expect(shell.fallback).toBeDefined();
    for (const word of ['projects', '__complete']) {
      expect(shell.has(word)).toBe(false);
    }
  });

  it('runs a command that left Nest, through the shell', async () => {
    const platform = fakePlatform({ argv: ['tests', '--help'] });

    await expect(createCholibaShell(platform, fakeRuntime()).run()).resolves.toBe(0);
    expect(platform.stdout.text()).toContain('Usage:  choliba tests');
  });
});
