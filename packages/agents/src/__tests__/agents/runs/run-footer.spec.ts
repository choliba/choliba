import { buildTheme } from '@choliba/core';

import type { RunFooterInfo } from '../../../agents/interfaces/run-footer.interface';
import { footerLines, providerContext, summaryLine, wantsFooter } from '../../../agents/runs/run-footer';

const DOCKER: RunFooterInfo = {
  provider: 'cursor',
  place: { kind: 'docker', image: 'choliba-agent:latest', container: 'choliba-2026-10-12T05-53-29.739Z-383691' },
  startedAt: 0,
};
const LOCAL: RunFooterInfo = { provider: 'claude', place: { kind: 'local' }, startedAt: 0 };
const PLAIN = buildTheme({}, false);

describe('footerLines', () => {
  it('is a rule and the table: the titles, then the run and how long it has been going', () => {
    expect(footerLines(DOCKER, 102_000, 120, PLAIN)).toEqual([
      '─'.repeat(120),
      'provider  sandbox  imagem                container                                decorrido',
      'cursor    docker   choliba-agent:latest  choliba-2026-10-12T05-53-29.739Z-383691  00:01:42',
    ]);
  });

  it('shows — for the image and the container on this machine', () => {
    expect(footerLines(LOCAL, 0, 80, PLAIN)[2]).toBe('claude    local    —       —          00:00:00');
  });

  it('cuts the image and the container first in a narrower terminal, keeping the time whole', () => {
    const [, head, values] = footerLines(DOCKER, 102_000, 60, PLAIN);

    expect(head).toBe('provider  sandbox  imagem          container       decorrido');
    expect(values).toBe('cursor    docker   choliba-agent…  choliba-2026-…  00:01:42');
  });

  it('turns into one line when the table does not fit, and into the time alone when that does not either', () => {
    expect(footerLines(DOCKER, 102_000, 40, PLAIN)).toEqual(['cursor · docker · 00:01:42']);
    expect(footerLines(DOCKER, 102_000, 10, PLAIN)).toEqual(['00:01:42']);
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

  it('sums the run up when it ends', () => {
    expect(summaryLine(LOCAL, 190_000, 0)).toBe('claude · local · decorrido 00:03:10 · código 0');
  });
});

describe('wantsFooter', () => {
  it('draws only on a terminal that is not dumb', () => {
    expect(wantsFooter({ write: () => undefined, isTTY: true }, {})).toBe(true);
    expect(wantsFooter({ write: () => undefined, isTTY: true }, { TERM: 'dumb' })).toBe(false);
    expect(wantsFooter({ write: () => undefined }, {})).toBe(false);
  });
});
