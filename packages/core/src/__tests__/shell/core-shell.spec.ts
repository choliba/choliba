import { CONFIG, coreShell, createShell, THEME } from '../..';
import { BufferWritable, fakePlatform } from '../../testing';

describe('coreShell', () => {
  it('gives the configuration of where the process started', () => {
    const { container } = createShell(fakePlatform({ cwd: '/ws/sub' }), [coreShell]);

    expect(container.get(CONFIG).startDir()).toBe('/ws/sub');
    expect(container.get(CONFIG)).toBe(container.get(CONFIG));
  });

  it('gives a theme that colors a terminal and respects --no-color', () => {
    const tty = { stdout: new BufferWritable(true) };

    expect(createShell(fakePlatform(tty), [coreShell]).container.get(THEME).enabled()).toBe(true);
    expect(createShell(fakePlatform(), [coreShell]).container.get(THEME).enabled()).toBe(false);
    expect(
      createShell(fakePlatform({ ...tty, noColorFlag: true }), [coreShell])
        .container.get(THEME)
        .enabled(),
    ).toBe(false);
  });

  it('runs no command yet: the root and help are still on Nest', () => {
    expect(coreShell.commands).toEqual([]);
  });
});
