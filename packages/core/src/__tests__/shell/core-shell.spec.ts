import { CONFIG, coreShell, createShell, THEME } from '../..';
import { BufferWritable, fakePlatform, VERBS_ROOT } from '../../testing';

describe('coreShell', () => {
  it('gives the configuration of where the process started', () => {
    const { container } = createShell(fakePlatform({ cwd: '/ws/sub' }), [coreShell, VERBS_ROOT]);

    expect(container.get(CONFIG).startDir()).toBe('/ws/sub');
    expect(container.get(CONFIG)).toBe(container.get(CONFIG));
  });

  it('gives a theme that colors a terminal and respects --no-color', () => {
    const tty = { stdout: new BufferWritable(true) };

    expect(createShell(fakePlatform(tty), [coreShell, VERBS_ROOT]).container.get(THEME).enabled()).toBe(true);
    expect(createShell(fakePlatform(), [coreShell, VERBS_ROOT]).container.get(THEME).enabled()).toBe(false);
    expect(
      createShell(fakePlatform({ ...tty, noColorFlag: true }), [coreShell, VERBS_ROOT])
        .container.get(THEME)
        .enabled(),
    ).toBe(false);
  });

  it('runs the hidden terminal command and list config', () => {
    expect(coreShell.commands.map((command) => command.name)).toEqual(['terminal', 'config']);
  });
});
