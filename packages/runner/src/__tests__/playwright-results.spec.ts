import { flattenResults, isRealFailure } from '../playwright-results';

describe('playwright-results', () => {
  it('flattenResults includes describe in fullTitle', () => {
    const suites = [
      {
        title: 'login.spec.ts',
        specs: [],
        suites: [
          {
            title: 'Autenticação com credenciais válidas',
            specs: [
              {
                title: 'CA-03: usuário autenticado com sucesso',
                tests: [{ projectName: 'firefox', status: 'expected', results: [{ status: 'passed' }] }],
              },
            ],
          },
        ],
      },
    ];

    const [result] = flattenResults(suites);
    expect(result?.fullTitle).toBe(
      'login.spec.ts › Autenticação com credenciais válidas › CA-03: usuário autenticado com sucesso',
    );
  });

  it('flattenResults uses aggregate status', () => {
    const suites = [
      {
        title: 'login.spec.ts',
        suites: [],
        specs: [
          {
            title: 'CA-01: passou de primeira',
            tests: [{ projectName: 'firefox', status: 'expected', results: [{ status: 'passed' }] }],
          },
        ],
      },
    ];

    expect(flattenResults(suites)[0]?.status).toBe('expected');
  });

  it('isRealFailure distinguishes expected from unexpected', () => {
    expect(isRealFailure('expected')).toBe(false);
    expect(isRealFailure('skipped')).toBe(false);
    expect(isRealFailure('flaky')).toBe(false);
    expect(isRealFailure('unexpected')).toBe(true);
  });

  it('flattenResults omits projectName when absent and nests suites', () => {
    const suites = [
      {
        title: 'outer.spec.ts',
        specs: [
          {
            title: 'CA-01: leaf',
            tests: [{ status: 'expected', results: [] }],
          },
        ],
        suites: [
          {
            title: 'Nested',
            specs: [{ title: 'CA-02: inner', tests: [{ projectName: 'firefox', status: 'expected', results: [] }] }],
          },
        ],
      },
    ];

    const flat = flattenResults(suites);
    expect(flat[0]?.projectName).toBeUndefined();
    expect(flat[1]?.projectName).toBe('firefox');
    expect(flat[1]?.fullTitle).toContain('Nested › CA-02: inner');
  });

  it('flattenResults skips suites without a specs array', () => {
    const suites = [
      {
        title: 'wrapper.spec.ts',
        suites: [
          {
            title: 'Inner',
            specs: [{ title: 'CA-01: nested', tests: [{ status: 'expected', results: [] }] }],
          },
        ],
      },
    ];

    expect(flattenResults(suites)[0]?.fullTitle).toBe('wrapper.spec.ts › Inner › CA-01: nested');
  });

  it('flattenResults handles specs without a tests array', () => {
    const suites = [
      {
        title: 'solo.spec.ts',
        specs: [{ title: 'CA-01: alone' }],
        suites: [],
      },
    ];

    expect(flattenResults(suites)).toEqual([]);
  });

  it('flattenResults handles empty specs and missing results arrays', () => {
    const suites = [
      {
        title: 'empty.spec.ts',
        specs: [{ title: 'CA-01: alone', tests: [] }],
        suites: [],
      },
      {
        title: 'bare.spec.ts',
        specs: [{ title: 'CA-02: no results', tests: [{ status: 'skipped' }] }],
        suites: [],
      },
    ];

    const flat = flattenResults(suites);
    expect(flat).toHaveLength(1);
    expect(flat[0]?.status).toBe('skipped');
    expect(flat[0]?.results).toEqual([]);
  });
});
