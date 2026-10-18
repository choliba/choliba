import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { readReport, ticketResults } from '../../tests/ticket-results';

/** A spec of `title` that ran once per device with `status`, and failed with `message` when given. */
function spec(title: string, status: string, message?: string, devices: readonly (string | undefined)[] = [undefined]) {
  return {
    title,
    tests: devices.map((projectName) => ({
      ...(projectName === undefined ? {} : { projectName }),
      status,
      results: message === undefined ? [{ status: 'passed' }] : [{ status: 'failed', error: { message } }],
    })),
  };
}

/** A report folder holding `report` as `results.json`, removed after `fn`. */
function withReport(report: object | undefined, fn: (folder: string) => void): void {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-results-'));
  try {
    if (report !== undefined) fs.writeFileSync(path.join(folder, 'results.json'), JSON.stringify(report));
    fn(folder);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

const CRITERIA = [{ id: 'CA-01' }, { id: 'CA-02' }, { id: 'CA-03' }, { id: 'CA-04' }];

describe('ticketResults', () => {
  it('gives the last run: when, how long, the counts, each test, and where each criterion stands', () => {
    const report = {
      stats: {
        startTime: '2026-10-17T06:01:48.003Z',
        duration: 17112,
        expected: 2,
        unexpected: 1,
        skipped: 1,
        flaky: 1,
      },
      suites: [
        {
          title: 'site-1.spec.ts',
          specs: [
            spec('CA-01: abre a página', 'expected', undefined, ['chromium']),
            spec('CA-01: mostra o rodapé', 'unexpected', '\u001b[31mnão achou o rodapé\u001b[39m'),
            spec('CA-02: mostra a versão', 'flaky'),
            spec('CA-03: mostra a licença', 'skipped'),
            spec('sem critério', 'expected'),
          ],
        },
      ],
    };
    withReport(report, (folder) => {
      expect(ticketResults(folder, CRITERIA)).toEqual({
        ranAt: '2026-10-17T06:01:48.003Z',
        duration: 17112,
        stats: { passed: 2, failed: 1, skipped: 1, flaky: 1 },
        tests: [
          { title: 'CA-01: abre a página', file: 'site-1.spec.ts', status: 'passed', device: 'chromium' },
          {
            title: 'CA-01: mostra o rodapé',
            file: 'site-1.spec.ts',
            status: 'failed',
            error: 'não achou o rodapé',
          },
          { title: 'CA-02: mostra a versão', file: 'site-1.spec.ts', status: 'flaky' },
          { title: 'CA-03: mostra a licença', file: 'site-1.spec.ts', status: 'skipped' },
        ],
        criteria: [
          { id: 'CA-01', status: 'falhou' },
          { id: 'CA-02', status: 'passou' },
          { id: 'CA-03', status: 'não rodou' },
          { id: 'CA-04', status: 'sem teste' },
        ],
      });
    });
  });

  it('reads an outcome it does not know as failed, and a report with no counts as zero', () => {
    const report = { suites: [{ title: 'a.spec.ts', specs: [spec('CA-01: x', 'timedOut', 'tempo esgotado')] }] };
    withReport(report, (folder) => {
      expect(ticketResults(folder, [{ id: 'CA-01' }])).toMatchObject({
        ranAt: '',
        duration: 0,
        stats: { passed: 0, failed: 0, skipped: 0, flaky: 0 },
        tests: [{ title: 'CA-01: x', status: 'failed' }],
        criteria: [{ id: 'CA-01', status: 'falhou' }],
      });
    });
  });

  it('gives nothing for a ticket that never ran', () => {
    withReport(undefined, (folder) => {
      expect(ticketResults(folder, CRITERIA)).toBeUndefined();
      expect(readReport(folder)).toBeUndefined();
    });
  });
});
