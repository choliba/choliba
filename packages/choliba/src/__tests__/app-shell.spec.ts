import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { listAgents } from '@choliba/agents';
import { PANEL_ICON, PANEL_LOGO, PANEL_VERSION, type ShellModule } from '@choliba/core';
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

  it("gives the panel the owl it ships, in the package's assets", () => {
    const logo = createCholibaShell(fakePlatform(), fakeRuntime()).container.get(PANEL_LOGO);

    expect(logo.endsWith(join('assets', 'choliba-logo.png'))).toBe(true);
    expect(existsSync(logo)).toBe(true);
  });

  it('gives the panel the owl drawn for its header', () => {
    expect(createCholibaShell(fakePlatform(), fakeRuntime()).container.get(PANEL_ICON)).toMatchObject({
      width: 10,
      height: 8,
    });
  });

  it('gives the panel the version line of --version', () => {
    expect(createCholibaShell(fakePlatform(), fakeRuntime()).container.get(PANEL_VERSION)).toMatch(
      /^choliba 0\.0\.1-dev/,
    );
  });

  it('runs every command and verb, and nothing of the old root', () => {
    const shell = createCholibaShell(fakePlatform(), fakeRuntime());

    for (const word of ['run', 'add', 'new', 'list', 'check', 'panel', 'setup', 'lint', 'format', 'terminal']) {
      expect(shell.has(word)).toBe(true);
    }
    for (const word of ['agents', 'projects', 'tests', '__complete']) {
      expect(shell.has(word)).toBe(false);
    }
  });

  it("runs the command of each official agent's step that calls choliba", () => {
    const shell = createCholibaShell(fakePlatform(), fakeRuntime());
    const calls = listAgents(join(__dirname, '..', '..', '..', '..', '.choliba', 'agents')).flatMap((agent) =>
      Object.values(agent.steps).flatMap((steps) =>
        [...steps.before, ...steps.after.success, ...steps.after.failure, ...steps.after.always]
          .filter((step) => step.action === 'run' && step.args[0] === 'bunx' && step.args[1] === 'choliba')
          .map((step) => `${agent.id}: ${step.args.slice(2, 4).join(' ')}`),
      ),
    );

    expect(calls.length).toBeGreaterThan(0);
    expect(calls.filter((call) => !shell.has(call.split(' ')[1] ?? ''))).toEqual([]);
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
