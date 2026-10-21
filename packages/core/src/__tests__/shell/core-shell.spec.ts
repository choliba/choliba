import { createShell, THEME } from '@choliba/shell';

import { coreShell, openOpenTuiPanel, PANEL_OPENER } from '../..';
import { BufferWritable, fakePlatform, VERBS_ROOT } from '../../testing';

describe('coreShell', () => {
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

  it('opens the panel on OpenTUI', () => {
    expect(createShell(fakePlatform(), [coreShell, VERBS_ROOT]).container.get(PANEL_OPENER)).toBe(openOpenTuiPanel);
  });

  it('runs the hidden terminal command and the panel', () => {
    expect(coreShell.commands.map((command) => command.name)).toEqual(['terminal', 'panel']);
  });
});
