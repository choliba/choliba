import { token, type ShellModule } from '../..';
import { fakePlatform, replace, runShell } from '../../testing';

const CLOCK_TEXT = token<string>('clock text');

const clock: ShellModule = {
  name: 'clock',
  provide: (container) => {
    container.provide(CLOCK_TEXT, () => 'meio-dia');
  },
  commands: [
    {
      name: 'now',
      run: (container, io) => {
        io.write(`${container.get(CLOCK_TEXT)}\n`);
        io.exit(io.args('now').length);
        return Promise.resolve();
      },
    },
  ],
};

describe('runShell', () => {
  it('runs the command line against the modules and gives its exit code', async () => {
    const platform = fakePlatform({ argv: ['now', 'a', 'b'] });

    await expect(runShell([clock], platform)).resolves.toBe(2);
    expect(platform.stdout.text()).toBe('meio-dia\n');
  });

  it('puts what the spec replaces in place of the services', async () => {
    const platform = fakePlatform({ argv: ['now'] });

    await expect(runShell([clock], platform, [replace(CLOCK_TEXT, 'meia-noite')])).resolves.toBe(0);
    expect(platform.stdout.text()).toBe('meia-noite\n');
  });
});
