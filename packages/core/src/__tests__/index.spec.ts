import * as core from '..';
import * as nest from '../nest';

describe.each([
  ['@choliba/core', core],
  ['@choliba/core/nest', nest],
])('%s', (_name, barrel) => {
  it('exports only defined values', () => {
    const exported = Object.entries(barrel);

    expect(exported.length).toBeGreaterThan(0);
    for (const [name, value] of exported) {
      expect([name, value]).toEqual([name, expect.anything()]);
    }
  });
});
