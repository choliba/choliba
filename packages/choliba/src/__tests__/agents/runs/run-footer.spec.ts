import {
  buildTheme,
  createLineRunScreen,
  footerLines,
  oneLine,
  providerContext,
  summaryLine,
  wantsFooter,
} from '@choliba/shell';

import type { RunFooterInfo } from '@choliba/engine';

const DOCKER: RunFooterInfo = {
  provider: 'cursor',
  model: 'Auto',
  place: { kind: 'docker', image: 'choliba-agent:latest', container: 'choliba-2026-10-12T05-53-29.739Z-383691' },
  startedAt: 0,
};
const LOCAL: RunFooterInfo = { provider: 'claude', place: { kind: 'local' }, startedAt: 0 };
const PLAIN = buildTheme({}, false);

describe('footerLines', () => {
  it('shows the missing model on the compact line', () => {
    expect(oneLine(LOCAL, 0, 80)).toBe('claude · — · local · 00:00:00.000');
  });

  it('closes the frame, then draws the table with column rules: the titles, the run and its time', () => {
    expect(footerLines(DOCKER, 102_317, 120, PLAIN)).toEqual([
      `└${'─'.repeat(118)}┘`,
      'provider │ modelo │ sandbox │ imagem               │ container                               │ decorrido',
      '─────────┼────────┼─────────┼──────────────────────┼─────────────────────────────────────────┼─────────────',
      'cursor   │ Auto   │ docker  │ choliba-agent:latest │ choliba-2026-10-12T05-53-29.739Z-383691 │ 00:01:42.317',
    ]);
  });

  it('shows — for the model until it is reported, and no image nor container column on this machine', () => {
    expect(footerLines(LOCAL, 0, 80, PLAIN).slice(1)).toEqual([
      'provider │ modelo │ sandbox │ decorrido',
      '─────────┼────────┼─────────┼─────────────',
      'claude   │ —      │ local   │ 00:00:00.000',
    ]);
  });

  it('cuts the image and the container first in a narrower terminal, keeping the time whole', () => {
    expect(footerLines(DOCKER, 102_317, 70, PLAIN)[3]).toBe(
      'cursor   │ Auto   │ docker  │ choliba-ag… │ choliba-20… │ 00:01:42.317',
    );
  });

  it('turns into one line when the table does not fit, and into the time alone when that does not either', () => {
    expect(footerLines(DOCKER, 102_317, 50, PLAIN)).toEqual([
      `└${'─'.repeat(48)}┘`,
      'cursor · Auto · docker · 00:01:42.317',
    ]);
    expect(footerLines(DOCKER, 102_317, 20, PLAIN)[1]).toBe('00:01:42.317');
  });

  it('draws the titles bold when the theme colors', () => {
    const [, head] = footerLines(LOCAL, 0, 80, buildTheme({}, true));

    expect(head).toContain('\u001b[1mprovider\u001b[22m');
  });
});

describe('the lines that stand for the footer', () => {
  it('adds the sandbox, the image and the container to the provider line, only in a container', () => {
    expect(providerContext(DOCKER)).toBe(' · docker · choliba-agent:latest · choliba-2026-10-12T05-53-29.739Z-383691');
    expect(providerContext(LOCAL)).toBe('');
  });

  it('sums the run up when it ends, with the model and the milliseconds', () => {
    expect(summaryLine(DOCKER, 190_482, 0)).toBe('cursor · Auto · docker · decorrido 00:03:10.482 · código 0');
    expect(summaryLine(LOCAL, 1_000, 1)).toBe('claude · — · local · decorrido 00:00:01.000 · código 1');
  });
});

describe('wantsFooter', () => {
  it('draws only on a terminal that is not dumb', () => {
    expect(wantsFooter({ write: () => undefined, isTTY: true }, {})).toBe(true);
    expect(wantsFooter({ write: () => undefined, isTTY: true }, { TERM: 'dumb' })).toBe(false);
    expect(wantsFooter({ write: () => undefined }, {})).toBe(false);
  });
});

describe('createLineRunScreen', () => {
  it('uses a positive terminal width for the footer frame', () => {
    const chunks: string[] = [];
    const screen = createLineRunScreen({
      info: LOCAL,
      name: 'echo',
      color: undefined,
      theme: PLAIN,
      stdout: { columns: 80, write: (text) => chunks.push(text) },
      stderr: { write: () => undefined },
      now: () => new Date(0),
      footer: true,
      every: () => () => undefined,
    });

    screen.close(0);

    expect(chunks.join('')).toContain('┌─ echo ─');
  });
});
