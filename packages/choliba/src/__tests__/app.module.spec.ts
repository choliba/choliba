import { CommandTestFactory } from 'nest-commander-testing';

import { ExitStatus } from '@choliba/core/nest';
import { fakePlatform } from '@choliba/core/testing';

import { AppModule } from '../app.module';
import { fakeRuntime } from './helpers/runtime';

describe('AppModule', () => {
  it.each([
    [['projects', '--help'], 'Usage:  choliba projects'],
    [['check', '--help'], 'Usage:  choliba check'],
    [['tests', '--help'], 'Usage:  choliba tests'],
    [['completion', '--help'], 'Usage:  choliba completion'],
    [['--help'], 'Usage:  choliba COMMAND'],
  ])('runs every command of choliba: %j', async (argv, help) => {
    const platform = fakePlatform({ argv });
    const app = await CommandTestFactory.createTestingCommand({
      imports: [AppModule.forRoot(platform, fakeRuntime())],
    }).compile();
    await CommandTestFactory.runWithoutClosing(app, [...argv]);

    expect(app.get(ExitStatus).code()).toBe(0);
    expect(platform.stdout.text()).toContain(help);
    await app.close();
  });
});
