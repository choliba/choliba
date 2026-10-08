import { parseTestsTarget } from '../../tests/tests-target';
import { TestsError } from '../../tests/tests-error';

describe('parseTestsTarget', () => {
  it('reads project, ticket and path, and how many words they took', () => {
    expect(parseTestsTarget('demo:T-01/tests/a.spec.ts', ['demo:T-01/tests/a.spec.ts', '--headed'])).toEqual({
      project: 'demo',
      rawTicket: 'T-01',
      pathSuffix: '/tests/a.spec.ts',
      consumedArgs: 1,
    });
    expect(parseTestsTarget('demo:T-01', ['demo:T-01', '-', 'T-03'])).toMatchObject({
      rawTicket: 'T-01 - T-03',
      consumedArgs: 3,
    });
    expect(parseTestsTarget('demo:T-01,', ['demo:T-01,', 'T-02', '--headed'])).toMatchObject({
      rawTicket: 'T-01,T-02',
      consumedArgs: 2,
    });
  });

  it('takes a project followed by its own flags as the whole project', () => {
    expect(parseTestsTarget('demo', ['demo', '-x'])).toMatchObject({ project: 'demo', rawTicket: '', consumedArgs: 1 });
    expect(parseTestsTarget('demo', ['demo', 'other'])).toMatchObject({ project: 'demo', rawTicket: '' });
  });

  it('says how to write it when the ticket is separated by a space, or there is no project', () => {
    expect(() => parseTestsTarget('demo', ['demo', 'demo-T-01'])).toThrow('use ":" (ex.: demo:demo-T-01)');
    expect(() => parseTestsTarget(':T-01', [':T-01'])).toThrow(TestsError);
    expect(() => parseTestsTarget(':T-01', [':T-01'])).toThrow('erro: informe um projeto');
  });
});
