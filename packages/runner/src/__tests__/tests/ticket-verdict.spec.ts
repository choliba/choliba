import {
  criterionRuns,
  formatCriteriaSummary,
  formatFailures,
  verdictProblems,
  type PlaywrightReport,
} from '../../tests/ticket-verdict';

function test(title: string, status: string, message?: string, devices: readonly (string | undefined)[] = [undefined]) {
  return {
    title,
    tests: devices.map((projectName) => ({
      ...(projectName === undefined ? {} : { projectName }),
      status,
      results: message === undefined ? [{ status: 'passed' }] : [{ status: 'failed', error: { message } }],
    })),
  };
}

function report(specs: ReturnType<typeof test>[], errors: PlaywrightReport['errors'] = []): PlaywrightReport {
  return { suites: [{ title: 'demo-2.spec.ts', specs }], errors };
}

const TICKET = { criterios: [{ id: 'CA-01' }, { id: 'CA-02' }] };

describe('criterionRuns', () => {
  it('groups the tests by the criterion their title starts with, keeping the last error without colors', () => {
    const runs = criterionRuns(
      TICKET,
      report([
        test('CA-01: mostra o erro', 'unexpected', '\u001b[31mexpect(locator).toBeVisible()\u001b[39m failed'),
        test('CA-02: limpa o campo', 'expected'),
        test('sem critério', 'expected'),
      ]),
    );

    expect(runs).toEqual([
      {
        id: 'CA-01',
        tests: [
          {
            title: 'demo-2.spec.ts › CA-01: mostra o erro',
            status: 'unexpected',
            error: 'expect(locator).toBeVisible() failed',
          },
        ],
      },
      { id: 'CA-02', tests: [{ title: 'demo-2.spec.ts › CA-02: limpa o campo', status: 'expected' }] },
    ]);
  });

  it('reads a ticket without criteria and a report without suites as nothing', () => {
    expect(criterionRuns({}, {})).toEqual([]);
    expect(criterionRuns(TICKET, {})).toEqual([
      { id: 'CA-01', tests: [] },
      { id: 'CA-02', tests: [] },
    ]);
  });
});

describe('verdictProblems', () => {
  it('accepts red when every criterion has a test and every one of them fails on the behavior', () => {
    const red = report([test('CA-01: a', 'unexpected', 'Timeout'), test('CA-02: b', 'unexpected', 'toHaveText')]);
    expect(verdictProblems('red', TICKET, red)).toEqual([]);
  });

  it('refuses red for a criterion without a test, one skipped and one broken by its own code', () => {
    const ticket = { criterios: [{ id: 'CA-01' }, { id: 'CA-02' }, { id: 'CA-03' }, { id: 'CA-04' }] };
    const red = report([
      test('CA-02: b', 'expected'),
      test('CA-03: c', 'skipped'),
      test('CA-04: d', 'unexpected', 'ReferenceError: page2 is not defined'),
    ]);

    expect(verdictProblems('red', ticket, red)).toEqual([
      'CA-01: nenhum teste (o título precisa começar com "CA-01:")',
      'CA-03: teste pulado: c',
      'CA-04: o teste quebra no próprio código, não no comportamento: ReferenceError: page2 is not defined',
    ]);
  });

  it('accepts red with a criterion that already passes: it is met, and stays as a regression test', () => {
    const partial = report([test('CA-01: a', 'expected'), test('CA-02: b', 'unexpected', 'toBeVisible')]);

    expect(verdictProblems('red', TICKET, partial)).toEqual([]);
  });

  it('refuses red when every criterion already passes: there is nothing to implement', () => {
    const allMet = report([test('CA-01: a', 'expected'), test('CA-02: b', 'flaky')]);

    expect(verdictProblems('red', TICKET, allMet)).toEqual([
      'todos os critérios já passam: nada a implementar (é um ticket de regressão?)',
    ]);
  });

  it('counts a criterion with a passing and a failing test as still to implement', () => {
    const mixed = report([
      test('CA-01: a', 'expected'),
      test('CA-01: a2', 'unexpected', 'Timeout'),
      test('CA-02: b', 'expected'),
    ]);

    expect(verdictProblems('red', TICKET, mixed)).toEqual([]);
    expect(formatCriteriaSummary(criterionRuns(TICKET, mixed))).toBe(
      'A implementar: CA-01. Já atendidos (regressão): CA-02.',
    );
  });

  it('refuses any verdict when the spec does not load, and a ticket without criteria', () => {
    expect(verdictProblems('red', TICKET, report([], [{ message: 'SyntaxError: Unexpected token' }]))).toEqual([
      'o spec não carregou: SyntaxError: Unexpected token',
    ]);
    expect(verdictProblems('red', TICKET, report([], [{}]))).toEqual(['o spec não carregou: ']);
    expect(verdictProblems('green', {}, report([]))).toEqual(['o ticket não tem critérios']);
    expect(verdictProblems('green', {}, {})).toEqual(['o ticket não tem critérios']);
  });

  it('accepts green when every criterion has a test and all of them pass, and names what still fails', () => {
    expect(verdictProblems('green', TICKET, report([test('CA-01: a', 'expected'), test('CA-02: b', 'flaky')]))).toEqual(
      [],
    );
    expect(
      verdictProblems(
        'green',
        TICKET,
        report([test('CA-01: a', 'expected'), test('CA-02: b', 'unexpected', 'Timeout')]),
      ),
    ).toEqual(['CA-02: ainda falha: b: Timeout']);
    const noError = { title: 'CA-02: b', tests: [{ status: 'unexpected', results: [{ status: 'failed' }] }] };
    expect(verdictProblems('green', TICKET, report([test('CA-01: a', 'expected'), noError]))).toEqual([
      'CA-02: ainda falha: b',
    ]);
  });

  it('says each problem in one line, with the device and without the call log', () => {
    const goto = 'Error: page.goto: Timeout 5000ms exceeded\nCall log:\n  - navigating to "http://x/"';
    const broken = 'ReferenceError: page2 is not defined\n    at demo-2.spec.ts:3';
    const run = report([
      test('CA-01: a', 'unexpected', goto, ['chromium', 'mobile-chrome']),
      test('CA-02: b', 'unexpected', broken, ['chromium']),
    ]);

    expect(verdictProblems('green', TICKET, run)).toEqual([
      'CA-01 [chromium]: ainda falha: a: Error: page.goto: Timeout 5000ms exceeded',
      'CA-01 [mobile-chrome]: ainda falha: a: Error: page.goto: Timeout 5000ms exceeded',
      'CA-02 [chromium]: ainda falha: b: ReferenceError: page2 is not defined',
    ]);
    expect(verdictProblems('red', TICKET, run)).toEqual([
      'CA-02 [chromium]: o teste quebra no próprio código, não no comportamento: ReferenceError: page2 is not defined',
    ]);
  });

  it('says the application is not up when a page could not be reached, in red as in green', () => {
    const refused = 'Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/\nCall log:';
    const run = report([test('CA-01: a', 'unexpected', refused), test('CA-02: b', 'unexpected', 'Timeout')]);
    const notUp =
      'a aplicação não respondeu no baseURL: configure envs[].start (e envs[].setup) no config.json do projeto, ou suba-a antes';

    expect(verdictProblems('red', TICKET, run)).toEqual([notUp]);
    expect(verdictProblems('green', TICKET, run)).toEqual([
      'CA-01: ainda falha: a: Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/',
      'CA-02: ainda falha: b: Timeout',
      notUp,
    ]);
  });

  it('says the application did not start when Playwright could not start it (envs[].start)', () => {
    const errors = [{ message: 'Error: Process from config.webServer was not able to start. Exit code: 1\nmore' }];

    expect(verdictProblems('green', TICKET, report([], errors))).toEqual([
      'a aplicação não subiu (envs[].start): Error: Process from config.webServer was not able to start. Exit code: 1',
    ]);
  });
});

describe('formatFailures', () => {
  it('lists each criterion with its tests, what failed and why, for the phase that implements', () => {
    const text = formatFailures(
      'demo-2',
      criterionRuns(TICKET, report([test('CA-01: a', 'unexpected', 'Timeout 5000ms'), test('CA-02: b', 'expected')])),
    );

    expect(text).toBe(
      [
        '# Falhas do ticket demo-2',
        '',
        'A implementar: CA-01. Já atendidos (regressão): CA-02.',
        '',
        '## CA-01',
        '',
        '- demo-2.spec.ts › CA-01: a (unexpected)',
        '',
        '  ```',
        '  Timeout 5000ms',
        '  ```',
        '',
        '## CA-02 — já atendido (regressão)',
        '',
        '- demo-2.spec.ts › CA-02: b (expected)',
        '',
      ].join('\n'),
    );
  });

  it("points at each failed test's trace, for the playwright-trace skill", () => {
    const traced = {
      title: 'CA-01: a',
      tests: [
        {
          status: 'unexpected',
          results: [
            {
              status: 'failed',
              error: { message: 'Timeout' },
              attachments: [
                { name: 'screenshot', path: '/r/shot.png' },
                { name: 'trace', path: '/r/trace.zip' },
              ],
            },
          ],
        },
      ],
    };
    const runs = criterionRuns({ criterios: [{ id: 'CA-01' }] }, report([traced]));

    expect(runs[0]?.tests[0]?.trace).toBe('/r/trace.zip');
    expect(formatFailures('demo-2', runs)).toContain('  trace: /r/trace.zip\n');
  });

  it('says when a criterion has no test, and puts the criteria already met last', () => {
    expect(formatFailures('demo-2', [{ id: 'CA-01', tests: [] }])).toContain('- nenhum teste');
    const runs = criterionRuns(TICKET, report([test('CA-01: a', 'expected'), test('CA-02: b', 'unexpected', 'x')]));
    const text = formatFailures('demo-2', runs);
    expect(text.indexOf('## CA-02')).toBeLessThan(text.indexOf('## CA-01 — já atendido (regressão)'));
    expect(formatCriteriaSummary([])).toBe('A implementar: nenhum. Já atendidos (regressão): nenhum.');
  });
});
