import { criterionRuns, formatFailures, verdictProblems, type PlaywrightReport } from '../ticket-verdict';

function test(title: string, status: string, message?: string) {
  return {
    title,
    tests: [
      { status, results: message === undefined ? [{ status: 'passed' }] : [{ status: 'failed', error: { message } }] },
    ],
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

  it('refuses red for a criterion without a test, one that already passes, one skipped and one broken by its own code', () => {
    const ticket = { criterios: [{ id: 'CA-01' }, { id: 'CA-02' }, { id: 'CA-03' }, { id: 'CA-04' }] };
    const red = report([
      test('CA-02: b', 'expected'),
      test('CA-03: c', 'skipped'),
      test('CA-04: d', 'unexpected', 'ReferenceError: page2 is not defined'),
    ]);

    expect(verdictProblems('red', ticket, red)).toEqual([
      'CA-01: nenhum teste (o título precisa começar com "CA-01:")',
      'CA-02: já passa (o comportamento já existe?): demo-2.spec.ts › CA-02: b',
      'CA-03: teste pulado: demo-2.spec.ts › CA-03: c',
      'CA-04: o teste quebra no próprio código, não no comportamento: ReferenceError: page2 is not defined',
    ]);
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
    ).toEqual(['CA-02: ainda falha: demo-2.spec.ts › CA-02: b: Timeout']);
    const noError = { title: 'CA-02: b', tests: [{ status: 'unexpected', results: [{ status: 'failed' }] }] };
    expect(verdictProblems('green', TICKET, report([test('CA-01: a', 'expected'), noError]))).toEqual([
      'CA-02: ainda falha: demo-2.spec.ts › CA-02: b',
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
        '## CA-01',
        '',
        '- demo-2.spec.ts › CA-01: a (unexpected)',
        '',
        '  ```',
        '  Timeout 5000ms',
        '  ```',
        '',
        '## CA-02',
        '',
        '- demo-2.spec.ts › CA-02: b (expected)',
        '',
      ].join('\n'),
    );
  });

  it('says when a criterion has no test', () => {
    expect(formatFailures('demo-2', [{ id: 'CA-01', tests: [] }])).toContain('- nenhum teste');
  });
});
