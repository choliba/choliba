import * as runner from '../index';
import * as nest from '../nest';

describe.each([
  ['@choliba/runner', runner],
  ['@choliba/runner/nest', nest],
])('%s', (_name, barrel) => {
  it('exports only defined values', () => {
    for (const [name, value] of Object.entries(barrel)) {
      expect([name, value]).toEqual([name, expect.anything()]);
    }
  });
});
