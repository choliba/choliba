import { type ShellModule } from '@choliba/core';
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
    expect(shell.has('projects')).toBe(true);
    expect(shell.has('check')).toBe(true);
    expect(shell.has('setup')).toBe(true);
    expect(shell.has('lint')).toBe(true);
    expect(shell.has('format')).toBe(true);
    expect(shell.fallback).toBeDefined();
    expect(shell.has('__complete')).toBe(false);
  });

  it.each([
    [['tests', '--help'], 'Usage:  choliba tests'],
    [['projects', '--help'], 'Usage:  choliba projects'],
  ])('runs a command that left Nest, through the shell: %j', async (argv, help) => {
    const platform = fakePlatform({ argv });

    await expect(createCholibaShell(platform, fakeRuntime()).run()).resolves.toBe(0);
    expect(platform.stdout.text()).toContain(help);
  });

  it('lists a command a package puts in the shell, after the ones the app orders', async () => {
    const deploy: ShellModule = {
      name: 'deploy',
      commands: [
        {
          name: 'deploy',
          help: () => [{ name: 'deploy', description: 'Publica o site', group: 'Commands', spec: { usage: 'deploy' } }],
          run: () => Promise.resolve(),
        },
      ],
    };
    const platform = fakePlatform({ argv: ['--help'] });

    await expect(createCholibaShell(platform, fakeRuntime(), [...CHOLIBA_SHELL, deploy]).run()).resolves.toBe(0);

    const help = platform.stdout.text();
    expect(help).toContain('Publica o site');
    expect(help.indexOf('setup')).toBeLessThan(help.indexOf('deploy'));
  });
});
