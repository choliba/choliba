import { Test } from '@nestjs/testing';
import { CommandTestFactory } from 'nest-commander-testing';

import type { Platform, ShellModule } from '@choliba/core';
import { ExitStatus } from '@choliba/core/nest';
import { fakePlatform } from '@choliba/core/testing';

import { CHOLIBA_SHELL, createCholibaShell } from '../app-shell';
import { AppModule } from '../app.module';
import { CheckCommand } from '../check/nest';
import { fakeRuntime } from './helpers/runtime';

function appFor(
  platform: Platform,
  modules: readonly ShellModule[] = CHOLIBA_SHELL,
): ReturnType<typeof AppModule.forRoot> {
  return AppModule.forRoot(platform, fakeRuntime(), createCholibaShell(platform, modules));
}

describe('AppModule', () => {
  it.each([
    [['check', '--help'], 'Usage:  choliba check'],
    [['--help'], 'Usage:  choliba COMMAND'],
  ])('runs every command of choliba still on Nest: %j', async (argv, help) => {
    const platform = fakePlatform({ argv });
    const app = await CommandTestFactory.createTestingCommand({ imports: [appFor(platform)] }).compile();
    await CommandTestFactory.runWithoutClosing(app, [...argv]);

    expect(app.get(ExitStatus).code()).toBe(0);
    expect(platform.stdout.text()).toContain(help);
    await app.close();
  });

  it('lists a command a package puts in the shell, without touching the root', async () => {
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
    const app = await CommandTestFactory.createTestingCommand({
      imports: [appFor(platform, [...CHOLIBA_SHELL, deploy])],
    }).compile();
    await CommandTestFactory.runWithoutClosing(app, ['--help']);

    const help = platform.stdout.text();
    expect(help).toContain('Publica o site');
    expect(help.indexOf('setup')).toBeLessThan(help.indexOf('deploy'));
    await app.close();
  });

  it('has the command main.ts checks the decorators on', async () => {
    const module = await Test.createTestingModule({ imports: [appFor(fakePlatform())] }).compile();

    expect(module.get(CheckCommand)).toBeInstanceOf(CheckCommand);
    await module.close();
  });
});
