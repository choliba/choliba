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

  it('runs every command and verb, and nothing of the old root', () => {
    const shell = createCholibaShell(fakePlatform(), fakeRuntime());

    for (const word of ['run', 'add', 'new', 'list', 'check', 'setup', 'lint', 'format', 'terminal']) {
      expect(shell.has(word)).toBe(true);
    }
    for (const word of ['agents', 'projects', 'tests', '__complete']) {
      expect(shell.has(word)).toBe(false);
    }
  });

  it.each([
    [['run', 'tests', '--help'], 'Usage:  choliba run tests'],
    [['new', 'project', '--help'], 'Usage:  choliba new project'],
    [['list', 'projects', '--help'], 'Usage:  choliba list projects'],
    [['run', '--help'], 'Usage:  choliba run TYPE [ARGS]'],
  ])('runs a command through the shell: %j', async (argv, help) => {
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
